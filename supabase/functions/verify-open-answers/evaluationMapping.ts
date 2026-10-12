/**
 * Mapping model results back to the answers that were sent, and a bounded model call.
 * Pure helpers (no Deno APIs) so they are unit-tested from vitest.
 */

/** Per-request id the model must echo back; numbered like the "[Answer N]" label (a1 = first). */
export const itemId = (index: number): string => `a${index + 1}`;

const parseItemId = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const m = /^a(\d+)$/.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]) - 1;
  return n >= 0 ? n : null;
};

/**
 * Pair each model result with the index of the answer it belongs to.
 * - When the model echoes ids, results are matched by id: reordered, skipped or
 *   duplicated items can no longer shift scores onto the wrong question
 *   (first result per id wins, unknown ids are dropped).
 * - When no result carries a valid id, the older positional mapping is used.
 * Answers without a pair are simply absent (unevaluated).
 */
export function pairEvaluationsWithAnswers<T = unknown>(
  results: readonly T[],
  answerCount: number,
): Array<[number, T]> {
  const ids = results.map((r) => parseItemId((r as { id?: unknown } | null)?.id));
  const anyId = ids.some((id) => id !== null);
  if (!anyId) {
    return results.slice(0, answerCount).map((r, i) => [i, r] as [number, T]);
  }
  const seen = new Set<number>();
  const pairs: Array<[number, T]> = [];
  results.forEach((r, i) => {
    const idx = ids[i];
    if (idx === null || idx >= answerCount || seen.has(idx)) return;
    seen.add(idx);
    pairs.push([idx, r]);
  });
  return pairs;
}

export interface RetryOptions {
  timeoutMs?: number;
  retryDelayMs?: number;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Run a model call with a timeout and one retry on a thrown error, a timeout or a
 * retryable HTTP status. Returns the last Response (which may still be an error
 * response); throws only when both attempts threw or timed out.
 */
export async function callModelWithRetry(
  call: () => Promise<Response>,
  { timeoutMs = 45_000, retryDelayMs = 1_500 }: RetryOptions = {},
): Promise<Response> {
  const attempt = () =>
    new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`model call timed out after ${timeoutMs} ms`)), timeoutMs);
      call().then(
        (r) => { clearTimeout(timer); resolve(r); },
        (e) => { clearTimeout(timer); reject(e); },
      );
    });

  try {
    const first = await attempt();
    if (!RETRYABLE_STATUS.has(first.status)) return first;
  } catch {
    // fall through to the retry
  }
  await new Promise((r) => setTimeout(r, retryDelayMs + Math.floor(Math.random() * 500)));
  return attempt();
}
