import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AiGatewayError,
  GATEWAY_ROLES,
  OPENAI_CHAT_ENDPOINT,
  executeAiCall,
  isFallbackStatus,
  overrideEnvVar,
  resolveChain,
  type GatewayDeps,
} from '../../../supabase/functions/_shared/aiGateway';
import { MODEL_REGISTRY, MODEL_ENV_OVERRIDES } from '../../../supabase/functions/_shared/modelRegistry';

const ENV: Record<string, string> = { OPENAI_API_KEY: 'oa-test', GEMINI_API_KEY: 'gm-test' };
const messages = [
  { role: 'system' as const, content: 'SYSTEM PROMPT' },
  { role: 'user' as const, content: 'Generate now.' },
];

const openAiOk = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const geminiOk = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text }] } }] }), { status: 200 });

function deps(responses: Array<Response | Error>, env: Record<string, string> = ENV) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const logFailure = vi.fn(async () => undefined);
  const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('unexpected fetch');
    if (next instanceof Error) throw next;
    return next;
  });
  const d: Partial<GatewayDeps> = { fetch: fetchFn as unknown as typeof fetch, getEnv: (n) => env[n], logFailure };
  return { d, calls, logFailure };
}

const modelFor = (role: string) => MODEL_REGISTRY.find((e) => e.role === role)!.id;

describe('aiGateway role resolution', () => {
  it('maps every gateway role to a registry entry with a supported provider', () => {
    for (const role of GATEWAY_ROLES) {
      const [primary] = resolveChain(role, () => undefined);
      expect(primary.model).toBe(modelFor(role));
      expect(['openai', 'google']).toContain(primary.provider);
    }
  });

  it('media-passages falls back to chat-primary, chat roles fall back to chat-fallback', () => {
    expect(resolveChain('media-passages', () => undefined).map((t) => t.role)).toEqual(['media-passages', 'chat-primary']);
    expect(resolveChain('chat-primary', () => undefined).map((t) => t.role)).toEqual(['chat-primary', 'chat-fallback']);
    expect(resolveChain('chat-fallback', () => undefined).map((t) => t.role)).toEqual(['chat-fallback']);
    expect(resolveChain('media-passages', () => undefined, false)).toHaveLength(1);
  });

  it('applies a valid env override and ignores a malformed one', () => {
    const env = { [overrideEnvVar('media-passages')]: 'gpt-4.1-mini' };
    expect(resolveChain('media-passages', (n) => env[n])[0]).toMatchObject({ model: 'gpt-4.1-mini', overridden: true });
    const bad = { [overrideEnvVar('media-passages')]: 'x/../evil?key=1' };
    expect(resolveChain('media-passages', (n) => bad[n])[0]).toMatchObject({ model: modelFor('media-passages'), overridden: false });
  });

  it('registers every gateway override env var for the model audit', () => {
    const registered = new Set(MODEL_ENV_OVERRIDES.map((o) => o.envVar));
    for (const role of GATEWAY_ROLES) expect(registered.has(overrideEnvVar(role))).toBe(true);
  });

  it('falls back only on 402, 404, 429 and 5xx', () => {
    for (const s of [402, 404, 429, 500, 503]) expect(isFallbackStatus(s)).toBe(true);
    for (const s of [400, 401, 403, 422]) expect(isFallbackStatus(s)).toBe(false);
  });
});

describe('executeAiCall', () => {
  it('sends the prompt unchanged to the primary OpenAI model', async () => {
    const { d, calls } = deps([openAiOk(' {"a":1} ')]);
    const r = await executeAiCall('media-passages', { messages, temperature: 0.3, maxOutputTokens: 2000 }, { functionName: 'fn', deps: d });
    expect(r).toEqual({ text: '{"a":1}', role: 'media-passages', provider: 'openai', model: modelFor('media-passages'), usedFallback: false });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(OPENAI_CHAT_ENDPOINT);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer oa-test');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      model: modelFor('media-passages'), messages, temperature: 0.3, max_completion_tokens: 2000,
    });
  });

  it.each([429, 500, 503])('switches to the Gemini fallback once on HTTP %i and logs the failure', async (status) => {
    const { d, calls, logFailure } = deps([new Response('busy', { status }), geminiOk('{"b":2}')]);
    const r = await executeAiCall('media-passages', { messages, temperature: 0.3, maxOutputTokens: 2000 }, { functionName: 'fn', deps: d });
    expect(r).toMatchObject({ text: '{"b":2}', provider: 'google', model: modelFor('chat-primary'), usedFallback: true });
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain(`/${modelFor('chat-primary')}:generateContent`);
    expect(calls[1].url).not.toContain('key=');
    expect((calls[1].init.headers as Record<string, string>)['x-goog-api-key']).toBe('gm-test');
    expect(JSON.parse(calls[1].init.body as string)).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'Generate now.' }] }],
      generation_config: { temperature: 0.3, max_output_tokens: 2000 },
      system_instruction: { parts: [{ text: 'SYSTEM PROMPT' }] },
    });
    expect(logFailure).toHaveBeenCalledWith(expect.objectContaining({ status, provider: 'openai', functionName: 'fn' }));
  });

  it('falls back after a network error', async () => {
    const { d } = deps([new Error('reset'), geminiOk('ok')]);
    const r = await executeAiCall('media-passages', { messages }, { functionName: 'fn', deps: d });
    expect(r.usedFallback).toBe(true);
  });

  it('treats 400 as terminal: no fallback call', async () => {
    const { d, calls } = deps([new Response('bad', { status: 400 })]);
    await expect(executeAiCall('media-passages', { messages }, { functionName: 'fn', deps: d }))
      .rejects.toMatchObject({ name: 'AiGatewayError', status: 400, provider: 'openai' });
    expect(calls).toHaveLength(1);
  });

  it('throws the last error when primary and fallback both fail, never retrying a target', async () => {
    const { d, calls } = deps([new Response('x', { status: 503 }), new Response('y', { status: 500 })]);
    await expect(executeAiCall('media-passages', { messages }, { functionName: 'fn', deps: d }))
      .rejects.toMatchObject({ status: 500, provider: 'google' });
    expect(calls).toHaveLength(2);
  });

  it('uses the fallback when the primary key is missing, and fails with 503 when no key exists', async () => {
    const { d, calls } = deps([geminiOk('ok')], { GEMINI_API_KEY: 'gm' });
    expect((await executeAiCall('media-passages', { messages }, { functionName: 'fn', deps: d })).provider).toBe('google');
    expect(calls).toHaveLength(1);
    const none = deps([], {});
    await expect(executeAiCall('media-passages', { messages }, { functionName: 'fn', deps: none.d })).rejects.toBeInstanceOf(AiGatewayError);
  });

  it('rejects an empty provider answer instead of returning blank text', async () => {
    const { d } = deps([openAiOk('   ')]);
    await expect(executeAiCall('media-passages', { messages }, { functionName: 'fn', deps: d })).rejects.toMatchObject({ status: 502 });
  });

  it('requests JSON mode on both providers when asked', async () => {
    const { d, calls } = deps([new Response('', { status: 429 }), geminiOk('{}')]);
    await executeAiCall('media-passages', { messages, json: true }, { functionName: 'fn', deps: d });
    expect(JSON.parse(calls[0].init.body as string).response_format).toEqual({ type: 'json_object' });
    expect(JSON.parse(calls[1].init.body as string).generation_config.response_mime_type).toBe('application/json');
  });
});

describe('Stage 4.1 boundaries', () => {
  const fn = (p: string) => readFileSync(join(__dirname, '../../../supabase/functions', p), 'utf8');

  it('generate-media-exercises calls the gateway role, not the OpenAI SDK', () => {
    const src = fn('generate-media-exercises/index.ts');
    expect(src).toContain("executeAiCall('media-passages'");
    expect(src).not.toMatch(/npm:openai|new OpenAI\(/);
    expect(src).toContain('Generate the complete picture-based exercise content now.');
  });

  it('the protected Worksheet Generation Engine does not use the gateway', () => {
    for (const p of ['generateWorksheet/index.ts', 'generateWorksheet/clients.ts', 'format-worksheet-prompt/index.ts']) {
      let src = '';
      try { src = fn(p); } catch { continue; }
      expect(src).not.toContain('aiGateway');
    }
  });
});
