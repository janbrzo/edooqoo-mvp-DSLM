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

  it('flush does not reject when a save fails, it reports that something is unsaved', async () => {
    const q = createPendingSaves(1500);
    const ok = vi.fn();
    q.schedule(0, () => Promise.reject(new Error('network')));
    q.schedule(1, ok);
    await expect(q.flush()).resolves.toBe(false);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(q.pendingIndices()).toEqual([0]);
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

  it('flush resolves true when every save succeeds', async () => {
    const q = createPendingSaves(1500);
    q.schedule(0, () => true);
    q.schedule(1, async () => undefined);
    await expect(q.flush()).resolves.toBe(true);
    expect(q.size()).toBe(0);
  });

  it('retries a failed save with increasing delays and stops reporting it once it succeeds', async () => {
    const q = createPendingSaves(100, [1000, 2000]);
    const job = vi.fn()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(true);
    const statuses: Array<{ pending: number; failed: number }> = [];
    q.onStatus((s) => statuses.push(s));
    q.schedule(0, job);
    await vi.advanceTimersByTimeAsync(100);
    expect(job).toHaveBeenCalledTimes(1);
    expect(q.pendingIndices()).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(job).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(job).toHaveBeenCalledTimes(3);
    expect(q.pendingIndices()).toEqual([]);
    expect(statuses.some((s) => s.failed > 0)).toBe(true);
    expect(statuses[statuses.length - 1]).toEqual({ pending: 0, failed: 0 });
  });

  it('never runs two saves of the same exercise at once and the newest job runs last', async () => {
    const q = createPendingSaves(100);
    const order: string[] = [];
    let release!: () => void;
    const first = vi.fn(() => new Promise<void>((r) => { order.push('first:start'); release = () => { order.push('first:end'); r(); }; }));
    const second = vi.fn(async () => { order.push('second'); });
    q.schedule(0, first);
    await vi.advanceTimersByTimeAsync(100);
    q.schedule(0, second);
    await vi.advanceTimersByTimeAsync(100);
    expect(second).not.toHaveBeenCalled();
    release();
    await vi.advanceTimersByTimeAsync(0);
    await expect(q.flush()).resolves.toBe(true);
    expect(order).toEqual(['first:start', 'first:end', 'second']);
  });

  it('a newer job replaces a failed one instead of retrying the stale payload', async () => {
    const q = createPendingSaves(100, [1000]);
    const stale = vi.fn().mockResolvedValue(false);
    const fresh = vi.fn().mockResolvedValue(true);
    q.schedule(0, stale);
    await vi.advanceTimersByTimeAsync(100);
    q.schedule(0, fresh);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(2000);
    expect(stale).toHaveBeenCalledTimes(1);
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(q.pendingIndices()).toEqual([]);
  });

  it('flushOne saves one exercise now and leaves the others waiting', async () => {
    const q = createPendingSaves(1500);
    const a = vi.fn().mockResolvedValue(true);
    const b = vi.fn().mockResolvedValue(true);
    q.schedule(0, a);
    q.schedule(1, b);
    await expect(q.flushOne(0)).resolves.toBe(true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(q.pendingIndices()).toEqual([1]);
  });
});

describe('createPendingSaves: flush while a save is in flight', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flush waits for the in-flight save and the newer job and then reports true', async () => {
    const q = createPendingSaves(1500);
    let release!: () => void;
    const first = vi.fn(() => new Promise<boolean>((r) => { release = () => r(true); }));
    const second = vi.fn().mockResolvedValue(true);
    q.schedule(0, first);
    await vi.advanceTimersByTimeAsync(1500);
    q.schedule(0, second);
    const flushed = q.flush();
    release();
    await expect(flushed).resolves.toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
    expect(q.pendingIndices()).toEqual([]);
  });

  it('a newer job waits for its own debounce instead of running right after the in-flight save', async () => {
    const q = createPendingSaves(1500);
    let release!: () => void;
    const first = vi.fn(() => new Promise<boolean>((r) => { release = () => r(true); }));
    const second = vi.fn().mockResolvedValue(true);
    q.schedule(0, first);
    await vi.advanceTimersByTimeAsync(1500);
    q.schedule(0, second);
    release();
    await vi.advanceTimersByTimeAsync(100);
    expect(second).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps retrying at the last delay after the delay list is exhausted', async () => {
    const q = createPendingSaves(100, [1000, 2000]);
    const job = vi.fn().mockResolvedValue(false);
    q.schedule(0, job);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(job.mock.calls.length).toBeGreaterThanOrEqual(5);
    job.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(q.pendingIndices()).toEqual([]);
  });
});
