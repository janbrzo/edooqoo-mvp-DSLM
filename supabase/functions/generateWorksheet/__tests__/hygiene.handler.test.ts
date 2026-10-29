/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Hygiene of the engine at handler level: em dash cleanup of model output and of
 * the context fed back into the prompt, the neutral source count, the stored
 * prompt header, the generic SSE error, the batch response without the system
 * message, and geolocation that does not hold the model call back.
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEACHER_ID, USER_HEADERS, installWorld, jsonRequest, settle, summariseResponse, uninstallWorld, world } from './world';
import { AUDIO, DEFAULT_8, chunked, worksheetFixture } from './fixtures';
import { ENGINE_PROMPT_VERSION } from '../engineVersion';

vi.mock('https://deno.land/std@0.208.0/http/server.ts', async () => (await import('./world')).modules.denoServe());
vi.mock('https://esm.sh/@supabase/supabase-js@2', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/@supabase/supabase-js@2.57.2', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/openai@4.28.0', async () => (await import('./world')).modules.openai());
vi.mock('https://esm.sh/@google/generative-ai@0.21.0', async () => (await import('./world')).modules.gemini());

const DASH = String.fromCharCode(0x2014);

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

const body = (fd: Record<string, any> = {}, over: Record<string, any> = {}) => ({
  prompt: PROMPT,
  formData: { lessonTime: '60min', englishLevel: 'B1/B2', lessonTopic: 'x', lessonGoal: 'y', selectedExercises: DEFAULT_8, ...fd },
  userId: TEACHER_ID,
  enableStreaming: true,
  ...over,
});

const quality = () =>
  world().logs.filter((l) => l.includes('"engine_quality"')).map((l) => JSON.parse(l.slice(l.indexOf('{'))).engine_quality)[0];

async function stream(b = body()) {
  const summary = (await summariseResponse(await handler(jsonRequest(b, USER_HEADERS)))) as any;
  await settle();
  return summary;
}

const dashedSheet = () => {
  const sheet = worksheetFixture(DEFAULT_8, { introduction: `A short introduction ${DASH} with a dash.` });
  (sheet.exercises[0] as any).teacher_tip = `Ask first${DASH}then check.`;
  (sheet.exercises[1] as any).statements[0].text = `Prices rose 5${DASH}10 percent ${DASH}`;
  return sheet;
};

describe('em dash cleanup of model output', () => {
  it('cleans the response, the saved worksheet and the stored model text, and counts the replacements', async () => {
    const w = world();
    const raw = JSON.stringify(dashedSheet());
    w.geminiStream = () => ({ chunks: chunked(raw, 4) });
    const summary = await stream();
    const done = summary.sse.events.at(-1);
    expect(done.event).toBe('done');
    const saved = JSON.parse(w.raw.insertRows[0].html_content);
    for (const text of [JSON.stringify(done.data.worksheet), w.raw.insertRows[0].html_content, w.raw.insertRows[0].ai_response]) {
      expect(text).not.toContain(DASH);
      expect(text).not.toContain('\\u2014');
    }
    expect(saved.introduction).toBe('A short introduction, with a dash.');
    expect(saved.exercises[0].teacher_tip).toBe('Ask first, then check.');
    // a numeric range becomes an en dash, a dash at the end of the text is dropped
    expect(saved.exercises[1].statements[0].text).toBe('Prices rose 5–10 percent');
    expect(quality().em_dash_replaced).toBe(4);
    expect(JSON.parse(w.raw.insertRows[0].ai_response).introduction).toBe('A short introduction, with a dash.');
  });

  it('batch exercises are cleaned too', async () => {
    const w = world();
    const sheet = worksheetFixture(['word-order']);
    (sheet.exercises[0] as any).teacher_tip = `Model it${DASH}then let them try.`;
    w.geminiGenerate = async () => JSON.stringify(sheet);
    const res = await handler(
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
    const json = await res.json();
    expect(json.exercises[0].teacher_tip).toBe('Model it, then let them try.');
    expect(Object.keys(json).sort()).toEqual(['exercises', 'success']);
  });
});

describe('em dash cleanup of context fed back into the prompt', () => {
  it('the audio transcript is cleaned in the prompt, and stored unchanged', async () => {
    const w = world();
    const audio = { ...AUDIO, transcript: `Hello ${DASH} this is Maria${DASH}calling about order 4471.` };
    w.geminiStream = () => ({ chunks: chunked(JSON.stringify(worksheetFixture(DEFAULT_8)), 4) });
    await stream(body({ selectedAudio: audio, selectedExercises: ['listening-comprehension', ...DEFAULT_8.slice(0, 7)] }));
    expect(w.raw.gemini[0]).toContain('Hello, this is Maria, calling about order 4471.');
    // (the unchanged few-shot text of the engine prompt has its own dash; only the transcript is under test)
    expect(w.raw.gemini[0]).not.toContain(`Hello ${DASH} this`);
    expect(w.raw.gemini[0]).not.toContain(`Maria${DASH}calling`);
    expect(w.raw.insertRows[0].audio_transcript).toBe(audio.transcript);
  });
});

describe('neutral source count', () => {
  it('is 0 in the response and in the saved row', async () => {
    const w = world();
    w.geminiStream = () => ({ chunks: chunked(JSON.stringify(worksheetFixture(DEFAULT_8)), 4) });
    const summary = await stream();
    expect(summary.sse.events.at(-1).data.worksheet.sourceCount).toBe(0);
    expect(JSON.parse(w.raw.insertRows[0].html_content).sourceCount).toBe(0);
  });
});

describe('stored prompt', () => {
  it('holds a version header with the system hash and the user message, not the system message', async () => {
    const w = world();
    w.geminiStream = () => ({ chunks: chunked(JSON.stringify(worksheetFixture(DEFAULT_8)), 4) });
    await stream();
    const system = w.raw.gemini[0].slice(0, w.raw.gemini[0].lastIndexOf('\n\n---\n\nUser Request:\n'));
    const stored: string = w.raw.insertRows[0].prompt;
    expect(stored.startsWith(`engine_prompt_version=${ENGINE_PROMPT_VERSION}; system_sha256=${createHash('sha256').update(system).digest('hex')}\n\nUSER MESSAGE:\n`)).toBe(true);
    expect(stored.length).toBeLessThan(system.length / 4);
    expect(stored).not.toContain('SYSTEM MESSAGE');
  });
});

describe('SSE error event', () => {
  it('sends a generic message and a stable code, never the Postgres text', async () => {
    const w = world();
    w.geminiStream = () => ({ chunks: chunked(JSON.stringify(worksheetFixture(DEFAULT_8)), 4) });
    w.insertResult = { data: null, error: { message: 'duplicate key value violates unique constraint "worksheets_pkey"' } };
    const summary = await stream();
    const last = summary.sse.events.at(-1);
    expect(last.event).toBe('error');
    expect(Object.keys(last.data).sort()).toEqual(['code', 'message']);
    expect(last.data.code).toBe('save_failed');
    expect(JSON.stringify(last.data)).not.toMatch(/duplicate|Postgres|worksheets_pkey/);
    // the original text stays in the server log
    expect(w.logs.some((l) => l.includes('duplicate key value'))).toBe(true);
  });

  it('a timeout is reported with its own code', async () => {
    const w = world();
    w.geminiStream = () => new Error('boom');
    w.openai = () => new Error('Request timed out.');
    const summary = await stream();
    const last = summary.sse.events.at(-1);
    expect(last.data.code).toBe('model_timeout');
  });
});

describe('geolocation off the critical path', () => {
  it('the model call starts while the lookup is pending, and the row waits for it', async () => {
    const w = world();
    let release!: () => void;
    w.ipapiGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    w.geminiStream = () => ({ chunks: chunked(JSON.stringify(worksheetFixture(DEFAULT_8)), 4) });
    const pending = handler(jsonRequest(body(), USER_HEADERS)).then((r) => summariseResponse(r));
    for (let i = 0; i < 200 && w.geminiStreamCalls === 0; i++) await new Promise((r) => setTimeout(r, 0));
    expect(w.geminiStreamCalls).toBe(1);
    expect(w.raw.insertRows).toHaveLength(0);
    release();
    const summary = (await pending) as any;
    expect(summary.sse.events.at(-1).event).toBe('done');
    expect(w.raw.insertRows[0]).toMatchObject({ country: 'Poland', city: 'Warsaw' });
  });
});
