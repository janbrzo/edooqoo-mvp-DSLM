import { describe, it, expect, vi } from 'vitest';
import { createAnswerSaveQueue } from '../answerSaveQueue';

const noWait = () => Promise.resolve();

describe('createAnswerSaveQueue', () => {
  it('saves and reports saved', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const q = createAnswerSaveQueue<string>({ save, wait: noWait });
    expect(await q.enqueue('q1', 'a')).toBe(true);
    expect(q.snapshot().state).toBe('saved');
    expect(q.hasUnsaved()).toBe(false);
  });

  it('retries thrown errors and then succeeds', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('net')).mockRejectedValueOnce(new Error('net')).mockResolvedValue(true);
    const states: string[] = [];
    const q = createAnswerSaveQueue<string>({ save, wait: noWait, onChange: (s) => states.push(s.state) });
    expect(await q.enqueue('q1', 'a')).toBe(true);
    expect(save).toHaveBeenCalledTimes(3);
    expect(states).toContain('retrying');
    expect(q.snapshot().state).toBe('saved');
  });

  it('fails softly after the retry budget and retryFailed recovers', async () => {
    let fail = true;
    const save = vi.fn(async () => { if (fail) throw new Error('net'); return true; });
    const q = createAnswerSaveQueue<string>({ save, wait: noWait, delaysMs: [1, 1] });
    expect(await q.enqueue('q1', 'a')).toBe(false);
    expect(save).toHaveBeenCalledTimes(3);
    expect(q.snapshot()).toMatchObject({ state: 'failed', unsaved: 1, hardFailed: false });
    fail = false;
    expect(await q.retryFailed()).toBe(true);
    expect(q.snapshot().state).toBe('saved');
  });

  it('treats a false result as a hard failure without retrying', async () => {
    const save = vi.fn().mockResolvedValue(false);
    const q = createAnswerSaveQueue<string>({ save, wait: noWait });
    expect(await q.enqueue('q1', 'a')).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(q.snapshot()).toMatchObject({ state: 'failed', hardFailed: true });
    expect(await q.flush()).toBe(false);
  });

  it('supersedes an older payload for the same question', async () => {
    const seen: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const save = vi.fn(async (_k: string, p: string) => { seen.push(p); if (p === 'a') await gate; return true; });
    const q = createAnswerSaveQueue<string>({ save, wait: noWait });
    const first = q.enqueue('q1', 'a');
    void q.enqueue('q1', 'b');
    release();
    await first;
    expect(await q.flush()).toBe(true);
    expect(seen).toEqual(['a', 'b']);
    expect(q.hasUnsaved()).toBe(false);
  });

  it('runs onSaved only after a confirmed save', async () => {
    const onSaved = vi.fn();
    const q = createAnswerSaveQueue<string>({ save: async () => false, wait: noWait });
    await q.enqueue('q1', 'a', { onSaved });
    expect(onSaved).not.toHaveBeenCalled();
    const ok = createAnswerSaveQueue<string>({ save: async () => true, wait: noWait });
    await ok.enqueue('q1', 'a', { onSaved });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('flush waits for all questions', async () => {
    const save = vi.fn(async () => true);
    const q = createAnswerSaveQueue<string>({ save, wait: noWait });
    void q.enqueue('q1', 'a');
    void q.enqueue('q2', 'b');
    expect(await q.flush()).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
