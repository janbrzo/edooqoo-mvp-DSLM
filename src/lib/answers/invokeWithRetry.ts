/**
 * One retry for an Edge Function call whose failure is transient (network,
 * relay, timeout, rate limit or 5xx). Homework is evaluated once, at submit,
 * from the student's browser: before this, a single failed call left the whole
 * submission without AI evaluation. Access errors (401/403) and bad requests are
 * returned at once, since a retry cannot fix them.
 */

type InvokeResult<T> = { data: T | null; error: unknown };

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function isTransientInvokeError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; context?: { status?: number } };
  if (e.name === 'FunctionsFetchError' || e.name === 'FunctionsRelayError') return true;
  if (e.name === 'FunctionsHttpError') return RETRYABLE_STATUS.has(e.context?.status ?? 0);
  return false;
}

export async function invokeWithRetry<T>(
  call: () => Promise<InvokeResult<T>>,
  { delayMs = 3000 }: { delayMs?: number } = {},
): Promise<InvokeResult<T>> {
  let first: InvokeResult<T>;
  try {
    first = await call();
    if (!isTransientInvokeError(first.error)) return first;
  } catch {
    // thrown errors are network-level: retry below
  }
  await new Promise((r) => setTimeout(r, delayMs));
  return call();
}
