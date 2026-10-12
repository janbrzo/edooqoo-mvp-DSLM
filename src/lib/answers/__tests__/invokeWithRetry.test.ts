import { describe, it, expect, vi } from 'vitest';
import { invokeWithRetry, isTransientInvokeError } from '../invokeWithRetry';

const httpError = (status: number) => ({ name: 'FunctionsHttpError', context: { status } });

describe('invokeWithRetry', () => {
  it('returns the first success without retrying', async () => {
    const call = vi.fn().mockResolvedValue({ data: 1, error: null });
    expect(await invokeWithRetry(call, { delayMs: 0 })).toEqual({ data: 1, error: null });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries once on a transient error', async () => {
    const call = vi.fn()
      .mockResolvedValueOnce({ data: null, error: httpError(503) })
      .mockResolvedValueOnce({ data: 2, error: null });
    expect(await invokeWithRetry(call, { delayMs: 0 })).toEqual({ data: 2, error: null });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('retries once when the call throws', async () => {
    const call = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: 3, error: null });
    expect((await invokeWithRetry(call, { delayMs: 0 })).data).toBe(3);
  });

  it('does not retry access or input errors', async () => {
    const call = vi.fn().mockResolvedValue({ data: null, error: httpError(403) });
    await invokeWithRetry(call, { delayMs: 0 });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('classifies errors', () => {
    expect(isTransientInvokeError({ name: 'FunctionsFetchError' })).toBe(true);
    expect(isTransientInvokeError(httpError(429))).toBe(true);
    expect(isTransientInvokeError(httpError(400))).toBe(false);
    expect(isTransientInvokeError(null)).toBe(false);
  });
});
