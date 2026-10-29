/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Provider error classification and finish-reason handling at handler level:
 * which Gemini failures reach the OpenAI fallback, what the client gets when
 * they do not, and how a truncated answer is routed and logged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEACHER_ID, USER_HEADERS, installWorld, jsonRequest, settle, summariseResponse, uninstallWorld, world } from './world';
import { DEFAULT_8, chunked, worksheetJson } from './fixtures';

vi.mock('https://deno.land/std@0.208.0/http/server.ts', async () => (await import('./world')).modules.denoServe());
vi.mock('https://esm.sh/@supabase/supabase-js@2', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/@supabase/supabase-js@2.57.2', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/openai@4.28.0', async () => (await import('./world')).modules.openai());
vi.mock('https://esm.sh/@google/generative-ai@0.21.0', async () => (await import('./world')).modules.gemini());

type Handler = (req: Request) => Promise<Response>;
let handler: Handler;

beforeEach(async () => {
  installWorld();
  vi.resetModules();
  await import('../index.ts');
  handler = world().handler as Handler;
});

afterEach(async () => {
  await settle();
  uninstallWorld();
});

const PROMPT = [
  'lessonTopic: Negotiating a delivery delay with a supplier',
  'lessonGoal: Explain the problem and propose a new date',
  'englishLevel: B1/B2',
  'selectedExercises: reading, true-false, matching, fill-in-blanks, multiple-choice, dialogue, discussion, error-correction',
].join('\n');

const streamBody = () => ({
  prompt: PROMPT,
  formData: { lessonTime: '60min', englishLevel: 'B1/B2', lessonTopic: 'x', lessonGoal: 'y', selectedExercises: DEFAULT_8 },
  userId: TEACHER_ID,
  enableStreaming: true,
});

const providerError = (status: number, message: string) => Object.assign(new Error(message), { status });
const FULL_8 = () => worksheetJson(DEFAULT_8);
const quality = () =>
  world().logs.filter((l) => l.includes('"engine_quality"')).map((l) => JSON.parse(l.slice(l.indexOf('{'))).engine_quality)[0];

async function stream() {
  const response = await handler(jsonRequest(streamBody(), USER_HEADERS));
  const summary = (await summariseResponse(response)) as any;
  await settle();
  return summary;
}

describe('provider error classification before the OpenAI fallback', () => {
  it('a 400 caused by our own request does not reach OpenAI and ends in an error event', async () => {
    const w = world();
    w.geminiStream = () => providerError(400, '[400 Bad Request] Invalid JSON payload received');
    const summary = await stream();
    expect(w.openaiCalls).toBe(0);
    expect(summary.sse.events.at(-1).event).toBe('error');
    expect(w.raw.insertRows).toHaveLength(0);
  });

  it('a 400 about the API key is a provider-side problem and still falls back', async () => {
    const w = world();
    w.geminiStream = () => providerError(400, '[400 Bad Request] API key not valid. Please pass a valid API key.');
    w.openai = () => chunked(FULL_8(), 6);
    const summary = await stream();
    expect(w.openaiCalls).toBe(1);
    expect(summary.sse.events.at(-1).event).toBe('done');
    expect(quality().primary_failure).toBe('config');
  });

  it.each([429, 500, 503])('a %i falls back to OpenAI', async (status) => {
    const w = world();
    w.geminiStream = () => providerError(status, `[${status}] provider trouble`);
    w.openai = () => chunked(FULL_8(), 6);
    const summary = await stream();
    expect(w.openaiCalls).toBe(1);
    expect(summary.sse.events.at(-1).event).toBe('done');
    expect(quality().fallback_used).toBe(true);
  });

  it('batch: a request error is returned with the provider status, no fallback', async () => {
    const w = world();
    w.geminiGenerate = async () => {
      throw providerError(400, '[400 Bad Request] Invalid argument');
    };
    const response = await handler(
      jsonRequest(
        {
          prompt: 'Generate a single word-order exercise for the topic: delivery delays.\nLevel: B1/B2.\n',
          formData: { englishLevel: 'B1/B2', lessonTopic: 'delivery delays', targetExerciseTypes: ['word-order'], exerciseCountPerType: 1 },
          userId: TEACHER_ID,
          isBatchGeneration: true,
        },
        USER_HEADERS,
      ),
    );
    expect(response.status).toBe(400);
    expect(w.openaiCalls).toBe(0);
  });
});

describe('finish reason', () => {
  it('MAX_TOKENS with every exercise already delivered is salvaged without a fallback and logged', async () => {
    const w = world();
    w.geminiStream = () => ({ chunks: chunked(FULL_8(), 4), finishReason: 'MAX_TOKENS' });
    const summary = await stream();
    expect(w.openaiCalls).toBe(0);
    expect(summary.sse.events.at(-1).event).toBe('done');
    expect(quality()).toMatchObject({ finish_reason: 'MAX_TOKENS', truncated: true });
  });

  it('MAX_TOKENS with missing exercises goes to the OpenAI fallback', async () => {
    const w = world();
    const text = FULL_8();
    w.geminiStream = () => ({ chunks: chunked(text.slice(0, Math.floor(text.length * 0.6)), 4), finishReason: 'MAX_TOKENS' });
    w.openai = () => chunked(FULL_8(), 6);
    const summary = await stream();
    expect(w.openaiCalls).toBe(1);
    expect(summary.sse.events.at(-1).event).toBe('done');
    expect(quality()).toMatchObject({ primary_failure: 'truncated', fallback_used: true });
  });

  it('a normal STOP is logged and does not change the flow', async () => {
    const w = world();
    w.geminiStream = () => ({ chunks: chunked(FULL_8(), 4), finishReason: 'STOP' });
    await stream();
    expect(w.openaiCalls).toBe(0);
    expect(quality()).toMatchObject({ finish_reason: 'STOP', truncated: false, primary_failure: null });
  });
});
