import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/edgeFunctionHeaders', () => ({
  edgeFunctionHeaders: vi.fn().mockResolvedValue({ 'Content-Type': 'application/json' }),
}));

import {
  WorksheetStreamHttpError,
  isDeterministicStreamFailure,
  streamWorksheetGeneration,
} from '../worksheetStreamService';

describe('isDeterministicStreamFailure', () => {
  it('is true for HTTP 4xx rejections including 429', () => {
    expect(isDeterministicStreamFailure(new WorksheetStreamHttpError('bad', 400))).toBe(true);
    expect(isDeterministicStreamFailure(new WorksheetStreamHttpError('slow down', 429))).toBe(true);
  });

  it('is false for 5xx and for non-HTTP errors (a row may still be saved)', () => {
    expect(isDeterministicStreamFailure(new WorksheetStreamHttpError('boom', 502))).toBe(false);
    expect(isDeterministicStreamFailure(new Error('Failed to fetch'))).toBe(false);
    expect(isDeterministicStreamFailure(null)).toBe(false);
  });
});

describe('streamWorksheetGeneration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports an HTTP rejection once, with its status, and does not retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await new Promise<Error>((resolve) => {
      streamWorksheetGeneration({ prompt: 'p' }, 'teacher-1', { onError: resolve });
    });

    expect(error).toBeInstanceOf(WorksheetStreamHttpError);
    expect((error as WorksheetStreamHttpError).status).toBe(429);
    expect(error.message).toBe('Too many requests');
    expect(isDeterministicStreamFailure(error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never starts a second request when the stream goes silent', async () => {
    vi.useFakeTimers();
    try {
      // A response whose body never produces data and never closes.
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(new ReadableStream({ start() { /* silent */ } }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const onError = vi.fn();
      streamWorksheetGeneration({ prompt: 'p' }, 'teacher-1', { onError });

      await vi.advanceTimersByTimeAsync(46_000);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(String(onError.mock.calls[0][0].message)).toMatch(/Connection lost/);
    } finally {
      vi.useRealTimers();
    }
  });
});
