/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * P2.3 canonical save at handler level: a new row stores the canonical worksheet
 * as ai_response AND html_content, the untouched model text as ai_response_raw,
 * the response carries the same ids, batch exercises are canonical too, and the
 * CANONICAL_SAVE flag restores the previous row shape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENV, TEACHER_ID, USER_HEADERS, WORKSHEET_ID, installWorld, jsonRequest, settle, summariseResponse, uninstallWorld, world } from './world';
import { DEFAULT_8, chunked, worksheetFixture } from './fixtures';

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
  delete ENV.CANONICAL_SAVE;
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

async function stream(b = body()) {
  const summary = (await summariseResponse(await handler(jsonRequest(b, USER_HEADERS)))) as any;
  await settle();
  return summary;
}

const EX_ID = /^ex_[0-9a-f-]{36}$/;

describe('canonical save (flag on, default)', () => {
  it('stores one canonical worksheet in ai_response and html_content and the model text in ai_response_raw', async () => {
    const w = world();
    const rawText = JSON.stringify(worksheetFixture(DEFAULT_8));
    w.geminiStream = () => ({ chunks: chunked(rawText, 4) });
    const summary = await stream();
    const done = summary.sse.events.at(-1);
    expect(done.event).toBe('done');

    const row = w.raw.insertRows[0];
    expect(row.ai_response).toBe(row.html_content);
    const saved = JSON.parse(row.html_content);
    expect(saved.canonical_version).toBe(1);
    expect(saved.exercises).toHaveLength(8);
    saved.exercises.forEach((exercise: any, index: number) => {
      expect(exercise.id).toMatch(EX_ID);
      expect(exercise.canonical_version).toBe(1);
      expect(exercise.title.startsWith(`Exercise ${index + 1}: `)).toBe(true);
    });
    expect(new Set(saved.exercises.map((e: any) => e.id)).size).toBe(8);
    // 60 min, no grammar focus in teachingPreferences: reading is 9 minutes, discussion 9
    expect(saved.exercises[0].time).toBe(9);

    // the stored model text is the untouched answer, not the canonical worksheet
    expect(row.ai_response_raw).toBe(rawText);
    expect(row.ai_response_raw).not.toBe(row.ai_response);
    expect(JSON.parse(row.ai_response_raw).exercises[0].id).toBeUndefined();

    // the card that generated the worksheet sees the same ids as the saved row
    expect(done.data.worksheet.exercises.map((e: any) => e.id)).toEqual(saved.exercises.map((e: any) => e.id));
  });

  it('regular mode saves and returns the same canonical exercises', async () => {
    const w = world();
    w.geminiGenerate = async () => JSON.stringify(worksheetFixture(DEFAULT_8));
    const res = (await summariseResponse(await handler(jsonRequest(body({}, { enableStreaming: false }), USER_HEADERS)))) as any;
    await settle();
    const row = w.raw.insertRows[0];
    expect(row.ai_response).toBe(row.html_content);
    const returned = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    expect(returned.id).toBe(WORKSHEET_ID);
    expect(returned.exercises.map((e: any) => e.id)).toEqual(JSON.parse(row.html_content).exercises.map((e: any) => e.id));
  });

  it('a canonical ai_response is never truncated, the raw copy keeps the 200000 character cap', async () => {
    const w = world();
    const sheet: any = worksheetFixture(DEFAULT_8);
    sheet.padding = 'x'.repeat(230000);
    w.geminiStream = () => ({ chunks: [JSON.stringify(sheet)] });
    await stream();
    const row = w.raw.insertRows[0];
    expect(row.ai_response_raw.length).toBe(200000);
    expect(row.ai_response.length).toBeGreaterThan(200000);
    expect(() => JSON.parse(row.ai_response)).not.toThrow();
  });

  it('saves without the raw copy when the migration is not applied yet', async () => {
    const w = world();
    w.geminiStream = () => ({ chunks: chunked(JSON.stringify(worksheetFixture(DEFAULT_8)), 4) });
    const ok = w.insertResult;
    Object.defineProperty(w, 'insertResult', {
      get: () =>
        world().raw.insertRows.length === 1
          ? { data: null, error: { message: "Could not find the 'ai_response_raw' column of 'worksheets' in the schema cache" } }
          : ok,
    });
    const summary = await stream();
    expect(summary.sse.events.at(-1).event).toBe('done');
    expect(w.raw.insertRows).toHaveLength(2);
    expect('ai_response_raw' in w.raw.insertRows[0]).toBe(true);
    expect('ai_response_raw' in w.raw.insertRows[1]).toBe(false);
    expect(w.raw.insertRows[1].ai_response).toBe(w.raw.insertRows[1].html_content);
  });

  it('batch exercises get ids, versions and per-type time, and keep the model titles', async () => {
    const w = world();
    const sheet: any = worksheetFixture(['word-order', 'gap-text']);
    sheet.exercises[0].title = 'Word order warm up';
    w.geminiGenerate = async () => JSON.stringify(sheet);
    const res = (await summariseResponse(
      await handler(jsonRequest({
        prompt: 'Generate a single word-order exercise for the topic: delivery delays.\nLevel: B1/B2.\n',
        formData: { englishLevel: 'B1/B2', lessonTopic: 'delivery delays', lessonTime: '45min', teachingPreferences: 'Present perfect', targetExerciseTypes: ['word-order', 'gap-text'], exerciseCountPerType: 1 },
        userId: TEACHER_ID,
        isBatchGeneration: true,
      }, USER_HEADERS)),
    )) as any;
    const payload = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    expect(payload.exercises).toHaveLength(2);
    expect(payload.exercises.map((e: any) => e.id)).toSatisfy((ids: string[]) => ids.every((id) => EX_ID.test(id)) && new Set(ids).size === 2);
    expect(payload.exercises.map((e: any) => e.canonical_version)).toEqual([1, 1]);
    // 45 min with grammar: word-order 4, gap-text 4
    expect(payload.exercises.map((e: any) => e.time)).toEqual([4, 4]);
    expect(payload.exercises[0].title).toBe('Word order warm up');
    expect(w.raw.insertRows).toHaveLength(0);
  });
});

describe('CANONICAL_SAVE=off', () => {
  it('writes the row exactly as before: raw text in ai_response, no raw column, no ids', async () => {
    ENV.CANONICAL_SAVE = 'off';
    const w = world();
    const rawText = JSON.stringify(worksheetFixture(DEFAULT_8));
    w.geminiStream = () => ({ chunks: chunked(rawText, 4) });
    await stream();
    const row = w.raw.insertRows[0];
    expect('ai_response_raw' in row).toBe(false);
    expect(row.ai_response).toBe(rawText);
    const saved = JSON.parse(row.html_content);
    expect(saved.canonical_version).toBeUndefined();
    expect(saved.exercises[0].id).toBeUndefined();
  });
});
