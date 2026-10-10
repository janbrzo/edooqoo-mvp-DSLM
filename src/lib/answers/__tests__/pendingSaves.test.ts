import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPendingSaves } from '../pendingSaves';

describe('createPendingSaves', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the pending save of exercise A when exercise B is edited inside the window', () => {
    const q = createPendingSaves(1500);
    const a = vi.fn();
    const b = vi.fn();
    q.schedule(0, a);
    vi.advanceTimersByTime(500);
    q.schedule(1, b);
    vi.advanceTimersByTime(1500);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('debounces repeated edits of the same exercise to the latest job', () => {
    const q = createPendingSaves(1500);
    const first = vi.fn();
    const last = vi.fn();
    q.schedule(2, first);
    vi.advanceTimersByTime(1000);
    q.schedule(2, last);
    vi.advanceTimersByTime(1499);
    expect(last).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(first).not.toHaveBeenCalled();
    expect(last).toHaveBeenCalledTimes(1);
  });

  it('flush runs every pending save once and leaves nothing queued', async () => {
    const q = createPendingSaves(1500);
    const a = vi.fn();
    const b = vi.fn().mockResolvedValue(undefined);
    q.schedule(0, a);
    q.schedule(4, b);
    await q.flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(q.size()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('flush does not reject when a save fails', async () => {
    const q = createPendingSaves(1500);
    const ok = vi.fn();
    q.schedule(0, () => Promise.reject(new Error('network')));
    q.schedule(1, ok);
    await expect(q.flush()).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('cancel drops only that exercise (blur saves it directly)', () => {
    const q = createPendingSaves(1500);
    const a = vi.fn();
    const b = vi.fn();
    q.schedule(0, a);
    q.schedule(1, b);
    q.cancel(0);
    vi.advanceTimersByTime(1500);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
