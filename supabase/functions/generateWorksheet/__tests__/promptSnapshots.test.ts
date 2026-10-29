/**
 * Golden prompt snapshots for the protected Worksheet Generation Engine.
 *
 * For each of the 12 golden forms the test drives the REAL handlers with a
 * mocked model and snapshots, as raw text files in ./promptSnapshots/:
 *   - the user part exactly as format-worksheet-prompt returns it,
 *   - the system message and the user message exactly as generateWorksheet
 *     builds them (read back from the row it inserts, and from the messages it
 *     sends to the OpenAI fallback),
 * and asserts the Gemini prompt is their exact concatenation. Batch (add
 * exercise) and regeneration modes get their own snapshots.
 *

 * The saved worksheets.prompt holds a version header with the system message hash
 * instead of the system message, so the system text is read from the Gemini prompt.
 *
 * These files change only with an explicit "update the Worksheet Generation
 * Engine" instruction; any refactor must leave them byte-for-byte identical.
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TEACHER_ID,
  USER_HEADERS,
  installWorld,
  jsonRequest,
  modules,
  summariseResponse,
  uninstallWorld,
  world,
} from './world';
import { AUDIO, GOLDEN_FORMS, IMAGE, chunked, worksheetJson } from './fixtures';
import { ENGINE_PROMPT_VERSION } from '../engineVersion';

vi.mock('https://deno.land/std@0.208.0/http/server.ts', async () => (await import('./world')).modules.denoServe());
vi.mock('https://esm.sh/@supabase/supabase-js@2', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/@supabase/supabase-js@2.45.0', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/@supabase/supabase-js@2.57.2', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/openai@4.28.0', async () => (await import('./world')).modules.openai());
vi.mock('https://esm.sh/@google/generative-ai@0.21.0', async () => (await import('./world')).modules.gemini());

const GEMINI_SEP = '\n\n---\n\nUser Request:\n';
const DB_USER = '\n\nUSER MESSAGE:\n';

type Handler = (req: Request) => Promise<Response>;
let generateHandler: Handler;
let formatHandler: Handler;

beforeEach(async () => {
  installWorld();
  vi.resetModules();
  await import('../../format-worksheet-prompt/index.ts');
  formatHandler = world().handler as Handler;
  world().handler = null;
  await import('../index.ts');
  generateHandler = world().handler as Handler;
});

afterEach(() => uninstallWorld());

async function formatPrompt(formData: Record<string, unknown>): Promise<string> {
  const res = await formatHandler(
    jsonRequest({ formData }, { Authorization: 'Bearer anon-key', 'cf-connecting-ip': '203.0.113.9' }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  return body.prompt as string;
}

/** The saved prompt is a version header plus the user message; the system message is only identified by its hash. */
function splitDbPrompt(prompt: string, geminiPrompt: string) {
  const i = prompt.lastIndexOf(DB_USER);
  const header = prompt.slice(0, i);
  const sep = geminiPrompt.lastIndexOf(GEMINI_SEP);
  const system = geminiPrompt.slice(0, sep);
  expect(header).toBe(`engine_prompt_version=${ENGINE_PROMPT_VERSION}; system_sha256=${createHash('sha256').update(system).digest('hex')}`);
  expect(prompt).not.toContain(system);
  return { system, user: prompt.slice(i + DB_USER.length) };
}

describe('golden prompt snapshots (streaming pipeline)', () => {
  it.each(GOLDEN_FORMS)('$id: format-worksheet-prompt, system and user message', async ({ id, formData, exerciseCount }) => {
    const prompt = await formatPrompt(formData);
    await expect(prompt).toMatchFileSnapshot(`./promptSnapshots/${id}.format-worksheet-prompt.txt`);

    const w = world();
    const types = formData.selectedExercises as string[];
    w.geminiStream = () => ({ chunks: chunked(worksheetJson(types)) });
    const response = await generateHandler(
      jsonRequest({ prompt, formData, userId: TEACHER_ID, enableStreaming: true }, USER_HEADERS),
    );
    const summary = (await summariseResponse(response)) as any;
    const events = summary.sse.events.map((e: any) => e.event);
    expect(events[0]).toBe('start');
    expect(events[events.length - 1]).toBe('done');

    expect(w.raw.insertRows).toHaveLength(1);
    const { system, user } = splitDbPrompt(w.raw.insertRows[0].prompt, w.raw.gemini[0]);

    // The Gemini prompt is exactly system + separator + user.
    expect(w.raw.gemini).toHaveLength(1);
    expect(w.raw.gemini[0]).toBe(`${system}${GEMINI_SEP}${user}`);

    // The user message is the format-worksheet-prompt text after sanitizeInput
    // (< and > removed, "javascript:" and "on...=" removed, 5000 chars max).
    expect(user).toBe(
      prompt
        .trim()
        .slice(0, 5000)
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, ''),
    );
    expect(system).toContain(`Create EXACTLY ${exerciseCount} exercises`);

    await expect(system).toMatchFileSnapshot(`./promptSnapshots/${id}.system-message.txt`);
    await expect(user).toMatchFileSnapshot(`./promptSnapshots/${id}.user-message.txt`);
  });

  it.each(GOLDEN_FORMS)('$id: OpenAI fallback receives the same system and user message', async ({ id, formData }) => {
    const prompt = await formatPrompt(formData);
    const w = world();
    const types = formData.selectedExercises as string[];
    // Run 1: Gemini ok, to read the saved system/user pair.
    w.geminiStream = () => ({ chunks: chunked(worksheetJson(types)) });
    await summariseResponse(
      await generateHandler(jsonRequest({ prompt, formData, userId: TEACHER_ID, enableStreaming: true }, USER_HEADERS)),
    );
    const saved = splitDbPrompt(w.raw.insertRows[0].prompt, w.raw.gemini[0]);

    // Run 2 (fresh module state): Gemini fails at once, OpenAI streams.
    w.raw.gemini.length = 0;
    w.raw.openai.length = 0;
    w.raw.insertRows.length = 0;
    vi.resetModules();
    await import('../index.ts');
    generateHandler = w.handler as Handler;
    w.geminiStream = () => new Error('gemini down');
    w.openai = () => chunked(worksheetJson(types));
    await summariseResponse(
      await generateHandler(
        jsonRequest({ prompt, formData, userId: TEACHER_ID, enableStreaming: true }, { ...USER_HEADERS, 'x-forwarded-for': '203.0.113.8' }),
      ),
    );
    expect(w.raw.openai).toHaveLength(1);
    expect(w.raw.openai[0].messages).toEqual([
      { role: 'system', content: saved.system },
      { role: 'user', content: saved.user },
    ]);
    expect(id).toBeTruthy();
  });
});

describe('golden prompt snapshots (batch and regeneration pipelines)', () => {
  const batchCases = [
    {
      id: 'batch01-single-type',
      prompt: 'Generate a single word-order exercise for the topic: Booking a medical appointment.\nLevel: A1/A2.\n\n',
      formData: { englishLevel: 'A1/A2', lessonTopic: 'Booking a medical appointment', targetExerciseTypes: ['word-order'], exerciseCountPerType: 1 },
    },
    {
      id: 'batch02-two-types-grammar',
      prompt:
        'Generate exercises for the topic: Negotiating a delivery delay with a supplier.\nLevel: B1/B2.\nGrammar focus: Present perfect vs past simple.\nAdditional instructions: keep it short',
      formData: {
        englishLevel: 'B1/B2',
        lessonTopic: 'Negotiating a delivery delay with a supplier',
        targetExerciseTypes: ['gap-text', 'fill-in-blanks'],
        exerciseCountPerType: 2,
      },
    },
    {
      id: 'batch03-picture',
      prompt: 'Generate a single describe-picture exercise for the topic: Ordering at a bakery.\nLevel: A1/A2.\n\n',
      formData: {
        englishLevel: 'A1/A2',
        lessonTopic: 'Ordering at a bakery',
        targetExerciseTypes: ['describe-picture', 'reading'],
        exerciseCountPerType: 1,
        selectedImage: IMAGE,
        selectedAudio: AUDIO,
      },
    },
    {
      id: 'batch04-audio',
      prompt: 'Generate a single listening-comprehension exercise for the topic: Small talk before a video call.\nLevel: C1/C2.\n\n',
      formData: {
        englishLevel: 'C1/C2',
        lessonTopic: 'Small talk before a video call',
        targetExerciseTypes: ['listening-comprehension', 'multiple-choice-audio'],
        exerciseCountPerType: 1,
        selectedImage: IMAGE,
        selectedAudio: AUDIO,
      },
    },
  ];

  it.each(batchCases)('$id: system message is built but not returned to the browser', async ({ id, prompt, formData }) => {
    const w = world();
    w.geminiGenerate = async () => worksheetJson(formData.targetExerciseTypes);
    const response = await generateHandler(
      jsonRequest({ prompt, formData, userId: TEACHER_ID, isBatchGeneration: true }, USER_HEADERS),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(w.raw.gemini).toHaveLength(1);
    const sep = w.raw.gemini[0].lastIndexOf(GEMINI_SEP);
    const system = w.raw.gemini[0].slice(0, sep);
    const user = w.raw.gemini[0].slice(sep + GEMINI_SEP.length);
    expect(body).toEqual({ exercises: expect.any(Array), success: true });
    expect(JSON.stringify(body)).not.toContain(system.slice(0, 200));
    await expect(system).toMatchFileSnapshot(`./promptSnapshots/${id}.system-message.txt`);
    await expect(user).toMatchFileSnapshot(`./promptSnapshots/${id}.user-message.txt`);
  });

  const regenCases = [
    {
      id: 'regen01-word-order',
      prompt: 'Lesson Topic: Booking a medical appointment\nLesson Goal: Phone the clinic\nEnglish Level: A1/A2\nLesson Duration: 45min\n',
      formData: {
        lessonTime: '45min',
        englishLevel: 'A1/A2',
        lessonTopic: 'Booking a medical appointment',
        lessonGoal: 'Phone the clinic',
        selectedExercises: ['reading', 'true-false', 'word-order', 'gap-text', 'matching', 'dialogue'],
        regenerationMode: true,
        targetExerciseType: 'word-order',
        exerciseIndex: 2,
      },
    },
    {
      id: 'regen02-listening',
      prompt: 'Lesson Topic: Chasing a late order\nLesson Goal: Understand a voicemail\nEnglish Level: B1/B2\nLesson Duration: 60min\nAudio transcript: Hello...',
      formData: {
        lessonTime: '60min',
        englishLevel: 'B1/B2',
        lessonTopic: 'Chasing a late order',
        lessonGoal: 'Understand a voicemail',
        teachingPreferences: 'Past simple vs present perfect',
        selectedExercises: ['listening-comprehension', 'reading'],
        selectedAudio: AUDIO,
        regenerationMode: true,
        targetExerciseType: 'listening-comprehension',
        exerciseIndex: 0,
      },
    },
  ];

  it.each(regenCases)('$id: regeneration (regular mode) system and user message', async ({ id, prompt, formData }) => {
    const w = world();
    w.geminiGenerate = async () => worksheetJson([formData.targetExerciseType]);
    const response = await generateHandler(
      jsonRequest({ prompt, formData, userId: TEACHER_ID, isRegeneration: true }, USER_HEADERS),
    );
    expect(response.status).toBe(200);
    expect(w.raw.insertRows).toHaveLength(0);
    expect(w.raw.gemini).toHaveLength(1);
    const sep = w.raw.gemini[0].lastIndexOf(GEMINI_SEP);
    await expect(w.raw.gemini[0].slice(0, sep)).toMatchFileSnapshot(`./promptSnapshots/${id}.system-message.txt`);
    await expect(w.raw.gemini[0].slice(sep + GEMINI_SEP.length)).toMatchFileSnapshot(`./promptSnapshots/${id}.user-message.txt`);
  });
});
