/* eslint-disable @typescript-eslint/no-explicit-any */
/** Unit tests of limits.ts (P2.5): key derivation, buckets, DB limiter, fail-open, balance pre-check. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TIERS,
  bucketKind,
  checkBalance,
  checkRateLimit,
  deriveCallerKey,
  limitResponse,
  parseTiers,
  sanitiseIp,
  tiersFor,
  trustedIp,
  type EnvReader,
} from '../limits';

const USER = '11111111-1111-4111-8111-111111111111';
const hdr = (h: Record<string, string>) => new Headers(h);
const env = (o: Record<string, string> = {}): EnvReader => (n) => o[n];

function client(handler: (fn: string, args: any) => any) {
  const calls: Array<{ fn: string; args: any }> = [];
  return {
    calls,
    rpc: (fn: string, args: any) => {
      calls.push({ fn, args });
      return Promise.resolve(handler(fn, args));
    },
  };
}
const allow = () => ({ data: { allowed: true, remaining: 1, retry_after_seconds: 0 }, error: null });
const memory = (answer = true) => ({
  calls: [] as string[],
  isAllowed(k: string) {
    this.calls.push(k);
    return answer;
  },
});
const base = (c: any, over: Record<string, unknown> = {}) => ({
  client: c,
  headers: hdr({ 'x-forwarded-for': '203.0.113.7' }),
  userId: null,
  isAnonymous: false,
  legacyKey: 'legacy',
  ...over,
});

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('caller key', () => {
  it('uses the first x-forwarded-for element, ignoring a client-supplied tail', () => {
    expect(trustedIp(hdr({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(trustedIp(hdr({ 'x-forwarded-for': '203.0.113.7, 10.9.9.9, evil' }))).toBe('203.0.113.7');
    const a = deriveCallerKey(hdr({ 'x-forwarded-for': '203.0.113.7, 1.1.1.1' }), null, false);
    const b = deriveCallerKey(hdr({ 'x-forwarded-for': '203.0.113.7, 2.2.2.2' }), null, false);
    expect(a).toBe(b);
    expect(a).toBe('ip:203.0.113.7');
  });
  it('prefers cf-connecting-ip, falls back to x-real-ip then unknown', () => {
    expect(trustedIp(hdr({ 'cf-connecting-ip': '198.51.100.2', 'x-forwarded-for': '203.0.113.7' }))).toBe('198.51.100.2');
    expect(trustedIp(hdr({ 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9');
    expect(trustedIp(hdr({}))).toBe('unknown');
  });
  it('rejects garbage and keeps keys bounded', () => {
    expect(sanitiseIp('x'.repeat(5000))).toBeNull();
    expect(sanitiseIp("1.2.3.4'; drop table")).toBeNull();
    expect(sanitiseIp('abc')).toBeNull();
    expect(sanitiseIp('2001:DB8::1')).toBe('2001:db8::1');
    expect(trustedIp(hdr({ 'x-forwarded-for': `${'a'.repeat(3000)}, 1.2.3.4` }))).toBe('unknown');
    expect(deriveCallerKey(hdr({ 'x-forwarded-for': 'z'.repeat(9000) }), null, false).length).toBeLessThanOrEqual(64);
  });
  it('uses the user id for signed-in teachers, the IP for anonymous sessions and public callers', () => {
    expect(deriveCallerKey(hdr({ 'x-forwarded-for': '203.0.113.7' }), USER, false)).toBe(`user:${USER}`);
    expect(deriveCallerKey(hdr({ 'x-forwarded-for': '203.0.113.7' }), USER, true)).toBe('ip:203.0.113.7');
    expect(deriveCallerKey(hdr({ 'x-forwarded-for': '203.0.113.7' }), 'not-a-uuid', false)).toBe('ip:203.0.113.7');
  });
});

describe('configuration and buckets', () => {
  it('keeps the legacy thresholds for generate and adds separate batch, regenerate and daily buckets', () => {
    expect(DEFAULT_TIERS.generate.map((t) => [t.limit, t.windowSeconds])).toEqual([
      [3, 300],
      [5, 900],
      [10, 3600],
    ]);
    expect(DEFAULT_TIERS.batch).toEqual([{ limit: 30, windowSeconds: 600 }]);
    expect(DEFAULT_TIERS.regenerate).toEqual([{ limit: 20, windowSeconds: 600 }]);
    expect(DEFAULT_TIERS.daily).toEqual([{ limit: 60, windowSeconds: 86400 }]);
  });
  it('routes requests to buckets like index.ts', () => {
    expect(bucketKind({})).toBe('generate');
    expect(bucketKind({ isRegeneration: true })).toBe('regenerate');
    expect(bucketKind({ isBatchGeneration: true, formData: { targetExerciseTypes: ['a'] } })).toBe('batch');
    expect(bucketKind({ isBatchGeneration: true, formData: {} })).toBe('generate');
  });
  it('parses env overrides, sorts windows and ignores bad values', () => {
    expect(parseTiers('10:3600, 2:60', [])).toEqual([
      { limit: 2, windowSeconds: 60 },
      { limit: 10, windowSeconds: 3600 },
    ]);
    expect(parseTiers('nonsense', DEFAULT_TIERS.batch)).toEqual(DEFAULT_TIERS.batch);
    expect(parseTiers('0:60', DEFAULT_TIERS.batch)).toEqual(DEFAULT_TIERS.batch);
    expect(parseTiers('off', DEFAULT_TIERS.batch)).toEqual([]);
    expect(tiersFor('batch', env({ ENGINE_RATE_LIMIT_BATCH: '5:60' }))).toEqual([{ limit: 5, windowSeconds: 60 }]);
  });
});

describe('checkRateLimit', () => {
  it('flag off: only the legacy in-memory limiter with the legacy key, no database call', async () => {
    const c = client(allow);
    const m = memory(true);
    expect(await checkRateLimit(base(c), { env: env({ ENGINE_DB_RATE_LIMIT: 'off' }), memory: m })).toEqual({ ok: true });
    expect(c.calls).toHaveLength(0);
    expect(m.calls).toEqual(['legacy']);
    const denied = await checkRateLimit(base(c), { env: env({ ENGINE_DB_RATE_LIMIT: 'off' }), memory: memory(false) });
    expect(denied).toMatchObject({ ok: false, status: 429, body: { error: 'Rate limit exceeded. Please try again later.' } });
    expect((denied as any).retryAfterSeconds).toBeUndefined();
  });
  it('allowed: one RPC per window, shortest first, public callers get no daily bucket', async () => {
    const c = client(allow);
    const m = memory();
    expect(await checkRateLimit(base(c), { env: env(), memory: m })).toEqual({ ok: true });
    expect(c.calls.map((x) => [x.fn, x.args.p_key, x.args.p_bucket, x.args.p_limit, x.args.p_window_seconds])).toEqual([
      ['consume_engine_rate_limit', 'ip:203.0.113.7', 'generate_300', 3, 300],
      ['consume_engine_rate_limit', 'ip:203.0.113.7', 'generate_900', 5, 900],
      ['consume_engine_rate_limit', 'ip:203.0.113.7', 'generate_3600', 10, 3600],
    ]);
    expect(m.calls).toHaveLength(0);
  });
  it('signed-in teacher: user key plus the daily cap; batch and regenerate use their own buckets', async () => {
    const c = client(allow);
    await checkRateLimit(base(c, { userId: USER }), { env: env() });
    expect(c.calls.map((x) => x.args.p_bucket)).toEqual(['generate_300', 'generate_900', 'generate_3600', 'daily_86400']);
    expect(new Set(c.calls.map((x) => x.args.p_key))).toEqual(new Set([`user:${USER}`]));
    const b = client(allow);
    await checkRateLimit(base(b, { userId: USER, isBatchGeneration: true, formData: { targetExerciseTypes: ['x'] } }), {
      env: env(),
    });
    expect(b.calls.map((x) => x.args.p_bucket)).toEqual(['batch_600', 'daily_86400']);
    const r = client(allow);
    await checkRateLimit(base(r, { isRegeneration: true }), { env: env() });
    expect(r.calls.map((x) => x.args.p_bucket)).toEqual(['regenerate_600']);
  });
  it('denied: 429 with Retry-After from the database and no further RPC', async () => {
    const c = client((_f, a) =>
      a.p_bucket === 'generate_300' ? { data: { allowed: false, remaining: 0, retry_after_seconds: 41.2 }, error: null } : allow(),
    );
    const d = await checkRateLimit(base(c), { env: env(), memory: memory() });
    expect(d).toMatchObject({ ok: false, status: 429, retryAfterSeconds: 42 });
    expect(c.calls).toHaveLength(1);
    const res = limitResponse(d as any, { 'Access-Control-Allow-Origin': '*' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });
  it.each([
    ['RPC error', () => ({ data: null, error: { message: 'boom' } })],
    ['unexpected shape', () => ({ data: { nope: 1 }, error: null })],
    [
      'thrown',
      () => {
        throw new Error('network');
      },
    ],
  ])('fails open to the in-memory limiter on %s', async (_n, handler) => {
    const m = memory(true);
    expect(await checkRateLimit(base(client(handler as any)), { env: env(), memory: m })).toEqual({ ok: true });
    expect(m.calls).toEqual(['ip:203.0.113.7']);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('DB rate limiter unavailable'))).toBe(true);
    expect(await checkRateLimit(base(client(handler as any)), { env: env(), memory: memory(false) })).toMatchObject({
      ok: false,
      status: 429,
    });
  });
  it('fails open when the database does not answer within 2 s', async () => {
    vi.useFakeTimers();
    try {
      const never = { rpc: () => new Promise(() => {}) };
      const m = memory(true);
      const p = checkRateLimit(base(never), { env: env(), memory: m });
      await vi.advanceTimersByTimeAsync(2001);
      expect(await p).toEqual({ ok: true });
      expect(m.calls).toHaveLength(1);
      expect(warn.mock.calls.some((c) => String(c[0]).includes('exceeded 2000ms'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('passes an abort signal to the query builder when it supports one', async () => {
    let signal: AbortSignal | undefined;
    const c = {
      rpc: () => ({
        abortSignal: (s: AbortSignal) => {
          signal = s;
          return Promise.resolve(allow());
        },
      }),
    };
    await checkRateLimit(base(c), { env: env(), memory: memory() });
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});

describe('checkBalance', () => {
  const pre = (data: any, error: any = null) => client(() => ({ data, error }));
  const input = (c: any, over: Record<string, unknown> = {}) => ({ client: c, userId: USER, isAnonymous: false, ...over });

  it('maps a refusal to 402 with a code, and frozen to tokens_frozen', async () => {
    const empty = await checkBalance(
      input(pre({ allowed: false, reason: 'insufficient_tokens', available_tokens: 0, frozen: false })),
      { env: env() },
    );
    expect(empty).toMatchObject({ ok: false, status: 402, body: { code: 'insufficient_tokens' } });
    expect(typeof (empty as any).body.error).toBe('string');
    expect(limitResponse(empty as any, {}).status).toBe(402);
    const frozen = await checkBalance(
      input(pre({ allowed: false, reason: 'tokens_frozen', available_tokens: 3, frozen: true })),
      { env: env() },
    );
    expect(frozen).toMatchObject({ ok: false, status: 402, body: { code: 'tokens_frozen' } });
  });
  it('allows and calls engine_pre_check with the user id', async () => {
    const c = pre({ allowed: true, reason: 'available_tokens' });
    expect(await checkBalance(input(c), { env: env() })).toEqual({ ok: true });
    expect(c.calls).toEqual([{ fn: 'engine_pre_check', args: { p_user_id: USER } }]);
  });
  it('never calls the database for public, anonymous, batch or regeneration requests, or with the flag off', async () => {
    const c = pre({ allowed: false, reason: 'insufficient_tokens' });
    expect(await checkBalance(input(c, { userId: null }), { env: env() })).toEqual({ ok: true });
    expect(await checkBalance(input(c, { isAnonymous: true }), { env: env() })).toEqual({ ok: true });
    expect(await checkBalance(input(c, { isRegeneration: true }), { env: env() })).toEqual({ ok: true });
    expect(
      await checkBalance(input(c, { isBatchGeneration: true, formData: { targetExerciseTypes: ['x'] } }), { env: env() }),
    ).toEqual({ ok: true });
    expect(await checkBalance(input(c), { env: env({ ENGINE_BALANCE_PRECHECK: 'off' }) })).toEqual({ ok: true });
    expect(c.calls).toHaveLength(0);
  });
  it.each([
    ['RPC error', () => ({ data: null, error: { message: 'boom' } })],
    ['unexpected shape', () => ({ data: 'x', error: null })],
    [
      'thrown',
      () => {
        throw new Error('network');
      },
    ],
  ])('fails open on %s', async (_n, handler) => {
    expect(await checkBalance(input(client(handler as any)), { env: env() })).toEqual({ ok: true });
    expect(warn.mock.calls.some((c) => String(c[0]).includes('pre-check unavailable'))).toBe(true);
  });
  it('fails open on timeout', async () => {
    vi.useFakeTimers();
    try {
      const p = checkBalance(input({ rpc: () => new Promise(() => {}) }), { env: env() });
      await vi.advanceTimersByTimeAsync(2001);
      expect(await p).toEqual({ ok: true });
    } finally {
      vi.useRealTimers();
    }
  });
});
