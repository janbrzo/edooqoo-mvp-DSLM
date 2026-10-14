import { describe, it, expect, vi } from 'vitest';
import { createEventLogger } from '../eventLogRetry';

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe('createEventLogger', () => {
  it('does not retry after success', async () => {
    const call = vi.fn().mockResolvedValue({ error: null });
    await createEventLogger({ call, wait: async () => {} }).log('a', {});
    await flush();
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries a failed call in the background and stops once it works', async () => {
    const call = vi.fn()
      .mockResolvedValueOnce({ error: { message: 'boom' } })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ error: null });
    const waits: number[] = [];
    let open!: () => void;
    const gate = new Promise<void>((r) => { open = r; });
    const logger = createEventLogger({ call, wait: async (ms) => { waits.push(ms); await gate; } });
    await logger.log('a', { n: 1 });
    expect(call).toHaveBeenCalledTimes(1); // caller is released after the first attempt
    open();
    await flush();
    expect(call).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([1000, 3000]);
  });

  it('gives up after 3 attempts in total and reports it', async () => {
    const call = vi.fn().mockResolvedValue({ error: { message: 'down' } });
    const onGiveUp = vi.fn();
    await createEventLogger({ call, wait: async () => {}, onGiveUp }).log('a', {});
    await flush();
    expect(call).toHaveBeenCalledTimes(3);
    expect(onGiveUp).toHaveBeenCalledWith('a', 'down');
  });

  it('a newer log for the same answer cancels the older retries', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const call = vi.fn().mockResolvedValue({ error: { message: 'x' } });
    const logger = createEventLogger({ call, wait: () => gate });
    await logger.log('a', { v: 'old' });
    await logger.log('a', { v: 'new' });
    release();
    await flush();
    const olds = call.mock.calls.filter((c) => (c[0] as any).v === 'old').length;
    expect(olds).toBe(1); // only the first attempt, no stale retry
  });
});
