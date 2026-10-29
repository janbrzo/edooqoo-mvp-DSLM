import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENGINE_BUDGETS,
  FALLBACK_STREAM_LIMITS,
  ModelTimeoutError,
  PRIMARY_STREAM_LIMITS,
  callBudgetMs,
  canStartFallback,
  deadlineFrom,
  evaluateStream,
  raceAbort,
  remainingModelMs,
  startStreamWatchdog,
  withCallTimeout,
} from '../engineBudgets';
import { ModelTruncatedError, classifyProviderError } from '../providerErrors';

const S = 1000;

describe('budget constants', () => {
  it('keep the whole pipeline under the 150 s edge limit', () => {
    expect(ENGINE_BUDGETS.totalMs).toBeLessThan(150 * S);
    expect(ENGINE_BUDGETS.nonStreamingPrimaryMs + ENGINE_BUDGETS.postModelReserveMs).toBeLessThanOrEqual(ENGINE_BUDGETS.totalMs);
    expect(ENGINE_BUDGETS.primaryHardMs).toBeLessThan(ENGINE_BUDGETS.totalMs - ENGINE_BUDGETS.postModelReserveMs);
  });

  it('start the fallback only when enough time remains', () => {
    const deadline = deadlineFrom(0);
    expect(canStartFallback(deadline, 0)).toBe(true);
    const last = ENGINE_BUDGETS.totalMs - ENGINE_BUDGETS.postModelReserveMs - ENGINE_BUDGETS.fallbackMinMs;
    expect(canStartFallback(deadline, last)).toBe(true);
    expect(canStartFallback(deadline, last + 1)).toBe(false);
  });

  it('clip a call budget to the time left, or leave it alone without a deadline', () => {
    const deadline = deadlineFrom(0);
    expect(callBudgetMs(30 * S, undefined, 0)).toBe(30 * S);
    expect(callBudgetMs(30 * S, deadline, 0)).toBe(30 * S);
    expect(callBudgetMs(30 * S, deadline, 120 * S)).toBe(remainingModelMs(deadline, 120 * S));
    expect(callBudgetMs(30 * S, deadline, 139 * S)).toBeLessThan(0);
  });
});

describe('evaluateStream', () => {
  const deadlineAt = deadlineFrom(0);
  const clock = (now: number, lastChunkAt: number | null, callStartedAt = 0) => ({ now, callStartedAt, lastChunkAt, deadlineAt });

  it('lets a long generation that keeps streaming run past the hard budget', () => {
    // 111 s into the call with a chunk 1 s ago: the observed worst typical case
    expect(evaluateStream(clock(111 * S, 110 * S), PRIMARY_STREAM_LIMITS)).toEqual({ ok: true });
    expect(evaluateStream(clock(125 * S, 124 * S), PRIMARY_STREAM_LIMITS)).toEqual({ ok: true });
  });

  it('aborts at the request deadline even while streaming', () => {
    const edge = ENGINE_BUDGETS.totalMs - ENGINE_BUDGETS.postModelReserveMs;
    expect(evaluateStream(clock(edge - 1, edge - 2), PRIMARY_STREAM_LIMITS)).toEqual({ ok: true });
    expect(evaluateStream(clock(edge, edge - 1), PRIMARY_STREAM_LIMITS)).toEqual({ ok: false, reason: 'deadline' });
  });

  it('aborts a call that produced no first chunk', () => {
    expect(evaluateStream(clock(59 * S, null), PRIMARY_STREAM_LIMITS)).toEqual({ ok: true });
    expect(evaluateStream(clock(60 * S, null), PRIMARY_STREAM_LIMITS)).toEqual({ ok: false, reason: 'first_chunk_timeout' });
  });

  it('aborts a stalled stream', () => {
    expect(evaluateStream(clock(50 * S, 21 * S), PRIMARY_STREAM_LIMITS)).toEqual({ ok: true });
    expect(evaluateStream(clock(50 * S, 20 * S), PRIMARY_STREAM_LIMITS)).toEqual({ ok: false, reason: 'stall' });
  });

  it('past the hard budget a pause longer than the grace period ends the call', () => {
    expect(evaluateStream(clock(101 * S, 90 * S), PRIMARY_STREAM_LIMITS)).toEqual({ ok: false, reason: 'hard_timeout' });
    expect(evaluateStream(clock(101 * S, 90 * S), FALLBACK_STREAM_LIMITS)).toEqual({ ok: true });
  });
});

describe('stream watchdog with fake timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it('aborts a stream that never delivers a chunk and rejects the pending read', async () => {
    const dog = startStreamWatchdog({ limits: PRIMARY_STREAM_LIMITS, deadlineAt: deadlineFrom(0) });
    const pending = raceAbort(new Promise<never>(() => {}), dog.signal);
    const caught = pending.catch((e) => e);
    await vi.advanceTimersByTimeAsync(61 * S);
    const error = await caught;
    expect(error).toBeInstanceOf(ModelTimeoutError);
    expect(error.reason).toBe('first_chunk_timeout');
    expect(dog.reason()).toBe('first_chunk_timeout');
    dog.stop();
  });

  it('does not abort while chunks keep arriving, past the hard budget', async () => {
    const dog = startStreamWatchdog({ limits: PRIMARY_STREAM_LIMITS, deadlineAt: deadlineFrom(0) });
    for (let t = 0; t < 115; t += 5) {
      dog.touch();
      await vi.advanceTimersByTimeAsync(5 * S);
    }
    expect(dog.reason()).toBeNull();
    expect(dog.signal.aborted).toBe(false);
    dog.stop();
  });

  it('stops polling after stop()', async () => {
    const dog = startStreamWatchdog({ limits: PRIMARY_STREAM_LIMITS, deadlineAt: deadlineFrom(0) });
    dog.stop();
    await vi.advanceTimersByTimeAsync(300 * S);
    expect(dog.signal.aborted).toBe(false);
  });

  it('withCallTimeout rejects after the budget and clears its timer when the call finishes', async () => {
    const slow = withCallTimeout(10 * S, () => new Promise<never>(() => {})).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10 * S);
    expect(await slow).toBeInstanceOf(ModelTimeoutError);

    const fast = await withCallTimeout(10 * S, async () => 'ok');
    expect(fast).toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('classifyProviderError', () => {
  const err = (status: number | undefined, message: string) => Object.assign(new Error(message), status === undefined ? {} : { status });

  it.each([
    [429, 'rate_limit', true],
    [500, 'server', true],
    [503, 'server', true],
    [408, 'timeout', true],
    [401, 'auth', true],
    [403, 'auth', true],
    [404, 'config', true],
    [400, 'request', false],
    [413, 'request', false],
    [422, 'request', false],
  ])('status %i is %s (fallback %s)', (status, kind, fallback) => {
    expect(classifyProviderError(err(status, 'x'))).toMatchObject({ kind, status, fallback });
  });

  it('reads the status from the Gemini message when the error carries none', () => {
    expect(classifyProviderError(err(undefined, 'Error fetching from https://x: [400 Bad Request] bad'))).toMatchObject({ kind: 'request', status: 400, fallback: false });
  });

  it('treats provider-side 400s as fallback-worthy', () => {
    expect(classifyProviderError(err(400, 'API key not valid'))).toMatchObject({ kind: 'config', fallback: true });
    expect(classifyProviderError(err(400, 'FAILED_PRECONDITION: User location is not supported'))).toMatchObject({ kind: 'config', fallback: true });
  });

  it('classifies timeouts, truncation, missing key and unknown errors as fallback-worthy', () => {
    expect(classifyProviderError(new ModelTimeoutError('stall'))).toMatchObject({ kind: 'timeout', fallback: true });
    expect(classifyProviderError(Object.assign(new Error('x'), { name: 'AbortError' }))).toMatchObject({ kind: 'timeout', fallback: true });
    expect(classifyProviderError(new ModelTruncatedError('MAX_TOKENS', ''))).toMatchObject({ kind: 'truncated', fallback: true });
    expect(classifyProviderError(new Error('GEMINI_API_KEY not configured'))).toMatchObject({ kind: 'config', fallback: true });
    expect(classifyProviderError(new Error('Failed to parse stream'))).toMatchObject({ kind: 'unknown', fallback: true });
    expect(classifyProviderError('weird')).toMatchObject({ fallback: true });
  });
});
