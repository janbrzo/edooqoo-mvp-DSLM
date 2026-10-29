/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * limits.ts at handler level. With ENGINE_DB_RATE_LIMIT and ENGINE_BALANCE_PRECHECK
 * off (the snapshot configuration) nothing changes; with both on and every check
 * allowed, the response, model calls, database calls and rows are identical and
 * only the RPC calls are added. Refusals happen before any model call or write.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ENV,
  STUDENT_ID,
  TEACHER_ID,
  USER_HEADERS,
  installWorld,
  jsonRequest,
  record,
  settle,
  summariseResponse,
  uninstallWorld,
  world,
} from './world';
import { DEFAULT_8, chunked, worksheetJson } from './fixtures';

vi.mock('https://deno.land/std@0.208.0/http/server.ts', async () => (await import('./world')).modules.denoServe());
vi.mock('https://esm.sh/@supabase/supabase-js@2', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/@supabase/supabase-js@2.57.2', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/openai@4.28.0', async () => (await import('./world')).modules.openai());
vi.mock('https://esm.sh/@google/generative-ai@0.21.0', async () => (await import('./world')).modules.gemini());

const PROMPT = [
  'lessonTopic: Negotiating a delivery delay with a supplier',
  'lessonGoal: Explain the problem and propose a new date',
  'englishLevel: B1/B2',
  'languageStyle: 3/5 (neutral - balanced style)',
  'selectedExercises: reading, true-false, matching, fill-in-blanks, multiple-choice, dialogue, discussion, error-correction',
].join('\n');
const formData = () => ({
  lessonTime: '60min',
  englishLevel: 'B1/B2',
  lessonTopic: 'Negotiating a delivery delay with a supplier',
  lessonGoal: 'Explain the problem and propose a new date',
  selectedExercises: DEFAULT_8,
  clientGenerationId: 'gen_abc12345',
});
const body = (over: Record<string, any> = {}) => ({
  prompt: PROMPT,
  formData: formData(),
  userId: TEACHER_ID,
  studentId: STUDENT_ID,
  enableStreaming: true,
  ...over,
});

type Rpc = (name: string, args: any) => { data: unknown; error: unknown };
const ALLOW_ALL: Rpc = (name) =>
  name === 'engine_pre_check'
    ? { data: { allowed: true, reason: 'available_tokens', available_tokens: 5, frozen: false }, error: null }
    : { data: { allowed: true, remaining: 1, retry_after_seconds: 0 }, error: null };
const PRECHECK_REFUSES = (reason: string, frozen: boolean): Rpc => (name, args) =>
  name === 'engine_pre_check'
    ? { data: { allowed: false, reason, available_tokens: 0, frozen }, error: null }
    : ALLOW_ALL(name, args);

async function run(
  flags: Record<string, string>,
  rpc: Rpc | null,
  reqBody: unknown = body(),
  headers: Record<string, string> = USER_HEADERS,
) {
  installWorld();
  try {
    for (const [k, v] of Object.entries(flags)) {
      if (v === 'unset') delete ENV[k];
      else ENV[k] = v;
    }
    vi.resetModules();
    await import('../index.ts');
    const w = world();
    w.geminiStream = () => ({ chunks: chunked(worksheetJson(DEFAULT_8), 4) });
    w.geminiGenerate = async () => worksheetJson(DEFAULT_8);
    if (rpc) w.rpc = async (n, a) => rpc(n, a);
    const response: Response = await (w.handler as any)(jsonRequest(reqBody, headers));
    const summary = await summariseResponse(response);
    await settle();
    return { ...record(summary), insertRows: w.raw.insertRows, headers: response.headers };
  } finally {
    await settle();
    uninstallWorld();
    ENV.ENGINE_DB_RATE_LIMIT = 'off';
    ENV.ENGINE_BALANCE_PRECHECK = 'off';
  }
}
const OFF = { ENGINE_DB_RATE_LIMIT: 'off', ENGINE_BALANCE_PRECHECK: 'off' };
const ON = { ENGINE_DB_RATE_LIMIT: 'on', ENGINE_BALANCE_PRECHECK: 'on' };
const rpcCalls = (calls: any[]) => calls.filter((c) => c.kind === 'rpc');
const withoutRpc = (calls: any[]) => calls.filter((c) => c.kind !== 'rpc');
const modelCalls = (calls: any[]) => calls.filter((c) => /gemini|openai/.test(String(c.kind)));

describe('generateWorksheet limits at handler level', () => {
  for (const [name, over] of [
    ['streaming', {}],
    ['regular', { enableStreaming: false }],
  ] as const) {
    it(`${name}: everything allowed leaves response, model calls, rows and logs unchanged`, async () => {
      const off = await run(OFF, null, body(over));
      const on = await run(ON, ALLOW_ALL, body(over));
      expect(on.response).toEqual(off.response);
      expect(withoutRpc(on.calls)).toEqual(off.calls);
      expect(on.logs).toEqual(off.logs);
      expect(on.insertRows).toEqual(off.insertRows);
      expect(rpcCalls(on.calls).map((c: any) => c.name)).toEqual([
        'consume_engine_rate_limit',
        'consume_engine_rate_limit',
        'consume_engine_rate_limit',
        'consume_engine_rate_limit',
        'engine_pre_check',
      ]);
    });
  }

  it('flags unset behave as on', async () => {
    const r = await run({ ENGINE_DB_RATE_LIMIT: 'unset', ENGINE_BALANCE_PRECHECK: 'unset' }, ALLOW_ALL);
    expect(rpcCalls(r.calls).length).toBeGreaterThan(0);
  });

  it('flags off: no RPC at all', async () => {
    const r = await run(OFF, () => {
      throw new Error('must not be called');
    });
    expect(rpcCalls(r.calls)).toHaveLength(0);
  });

  it('a database that is down fails open: same response and model calls, one warning per check', async () => {
    const off = await run(OFF, null);
    const down = await run(ON, () => {
      throw new Error('db down');
    });
    expect(down.response).toEqual(off.response);
    expect(modelCalls(down.calls)).toEqual(modelCalls(off.calls));
    expect(down.logs.filter((l: string) => l.includes('[limits]'))).toHaveLength(2);
  });

  it('balance 0 gives 402 before geolocation, any model call or database write', async () => {
    const r = await run(ON, PRECHECK_REFUSES('insufficient_tokens', false));
    expect((r.response as any).status).toBe(402);
    expect((r.response as any).body.code).toBe('insufficient_tokens');
    expect(modelCalls(r.calls)).toEqual([]);
    expect(r.calls.filter((c: any) => c.kind === 'fetch')).toEqual([]);
    expect(r.calls.filter((c: any) => c.kind === 'db' && c.op === 'insert')).toEqual([]);
    expect(r.insertRows).toEqual([]);
  });

  it('frozen tokens give 402 tokens_frozen', async () => {
    const r = await run(ON, PRECHECK_REFUSES('tokens_frozen', true));
    expect((r.response as any).status).toBe(402);
    expect((r.response as any).body.code).toBe('tokens_frozen');
  });

  it('rate limit denial gives 429 with Retry-After, before the pre-check', async () => {
    const r = await run(ON, (n, a) =>
      n === 'engine_pre_check' ? ALLOW_ALL(n, a) : { data: { allowed: false, remaining: 0, retry_after_seconds: 120 }, error: null },
    );
    expect((r.response as any).status).toBe(429);
    expect((r.response as any).body).toEqual({ error: 'Rate limit exceeded. Please try again later.' });
    expect(r.headers.get('Retry-After')).toBe('120');
    expect(r.calls.some((c: any) => c.name === 'engine_pre_check')).toBe(false);
    expect(modelCalls(r.calls)).toEqual([]);
  });

  it('validation (400) still comes before the rate limit', async () => {
    const r = await run(ON, ALLOW_ALL, body({ prompt: '' }));
    expect((r.response as any).status).toBe(400);
    expect(rpcCalls(r.calls)).toHaveLength(0);
  });

  it('public callers: IP key from the first forwarded element, no pre-check', async () => {
    const r = await run(ON, ALLOW_ALL, body({ userId: null, studentId: null }), {
      'x-forwarded-for': '198.51.100.4, 6.6.6.6',
    });
    const rl = rpcCalls(r.calls).filter((c: any) => c.name === 'consume_engine_rate_limit');
    expect(rl).toHaveLength(3);
    expect(new Set(rl.map((c: any) => c.args.p_key))).toEqual(new Set(['ip:198.51.100.4']));
    expect(r.calls.some((c: any) => c.name === 'engine_pre_check')).toBe(false);
  });

  it('regeneration is bucketed separately and never pre-checked', async () => {
    const reg = await run(ON, ALLOW_ALL, body({ enableStreaming: false, isRegeneration: true }));
    expect(rpcCalls(reg.calls).map((c: any) => c.args.p_bucket)).toEqual(['regenerate_600', 'daily_86400']);
  });
});
