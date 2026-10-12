import { describe, it, expect, vi } from 'vitest';
import {
  itemId,
  pairEvaluationsWithAnswers,
  callModelWithRetry,
} from '../../../../supabase/functions/verify-open-answers/evaluationMapping';

describe('pairEvaluationsWithAnswers', () => {
  it('numbers ids like the [Answer N] label', () => {
    expect(itemId(0)).toBe('a1');
    expect(itemId(4)).toBe('a5');
  });

  it('maps by echoed id even when the model reorders or skips items', () => {
    const results = [
      { id: itemId(2), quality_score: 0.2 },
      { id: itemId(0), quality_score: 0.9 },
    ];
    expect(pairEvaluationsWithAnswers(results, 3)).toEqual([
      [2, results[0]],
      [0, results[1]],
    ]);
  });

  it('drops unknown, out-of-range and duplicate ids', () => {
    const results = [
      { id: 'a1', quality_score: 0.9 },
      { id: 'a1', quality_score: 0.1 },
      { id: 'a7', quality_score: 0.5 },
      { id: 'a0', quality_score: 0.5 },
      { id: 'x', quality_score: 0.5 },
    ];
    expect(pairEvaluationsWithAnswers(results, 2)).toEqual([[0, results[0]]]);
  });

  it('falls back to position when the model returned no ids', () => {
    const results = [{ quality_score: 0.9 }, { quality_score: 0.4 }, { quality_score: 0.1 }];
    expect(pairEvaluationsWithAnswers(results, 2)).toEqual([
      [0, results[0]],
      [1, results[1]],
    ]);
  });
});

describe('callModelWithRetry', () => {
  const ok = () => new Response('{}', { status: 200 });

  it('returns the first successful response without retrying', async () => {
    const call = vi.fn().mockResolvedValue(ok());
    const res = await callModelWithRetry(call, { retryDelayMs: 0 });
    expect(res.status).toBe(200);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries once on a retryable status', async () => {
    const call = vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status: 429 }))
      .mockResolvedValueOnce(ok());
    const res = await callModelWithRetry(call, { retryDelayMs: 0 });
    expect(res.status).toBe(200);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('retries once after a timeout and does not retry a 400', async () => {
    const hang = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(() => {}))
      .mockResolvedValueOnce(new Response('bad', { status: 400 }));
    const res = await callModelWithRetry(hang, { timeoutMs: 20, retryDelayMs: 0 });
    expect(res.status).toBe(400);
    expect(hang).toHaveBeenCalledTimes(2);
  });

  it('throws when both attempts fail', async () => {
    const call = vi.fn().mockRejectedValue(new Error('network'));
    await expect(callModelWithRetry(call, { retryDelayMs: 0 })).rejects.toThrow('network');
  });
});
