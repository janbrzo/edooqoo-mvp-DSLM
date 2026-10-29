/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The engine_quality observation at handler level.
 *
 * Proves that ENGINE_GATE_MODE only adds log lines: for every scenario the HTTP
 * response / SSE events, every model call, every database call and inserted
 * row, and every fetch are identical with the variable unset, `off`, `log` and
 * `enforce`, and the console lines differ only by the observation lines. The
 * handler characterization snapshots (taken before this feature) additionally
 * pin the unset behaviour line by line.
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
  summariseText,
  uninstallWorld,
  world,
} from './world';
import { AUDIO, DEFAULT_6, DEFAULT_8, IMAGE, chunked, worksheetFixture, worksheetJson } from './fixtures';
import { ENGINE_PROMPT_VERSION } from '../engineVersion';

vi.mock('https://deno.land/std@0.208.0/http/server.ts', async () => (await import('./world')).modules.denoServe());
vi.mock('https://esm.sh/@supabase/supabase-js@2', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/@supabase/supabase-js@2.57.2', async () => (await import('./world')).modules.supabase());
vi.mock('https://esm.sh/openai@4.28.0', async () => (await import('./world')).modules.openai());
vi.mock('https://esm.sh/@google/generative-ai@0.21.0', async () => (await import('./world')).modules.gemini());

type Handler = (req: Request) => Promise<Response>;
type Scenario = (w: ReturnType<typeof world>) => { body: unknown; headers?: Record<string, string> };

const PROMPT = [
  'lessonTopic: Negotiating a delivery delay with a supplier',
  'lessonGoal: Explain the problem and propose a new date',
  'englishLevel: B1/B2',
  'languageStyle: 3/5 (neutral - balanced style)',
  'selectedExercises: reading, true-false, matching, fill-in-blanks, multiple-choice, dialogue, discussion, error-correction',
].join('\n');

const formData = (over: Record<string, any> = {}) => ({
  lessonTime: '60min',
  englishLevel: 'B1/B2',
  lessonTopic: 'Negotiating a delivery delay with a supplier',
  lessonGoal: 'Explain the problem and propose a new date',
  selectedExercises: DEFAULT_8,
  clientGenerationId: 'gen_abc12345',
  ...over,
});

const streamBody = (over: Record<string, any> = {}, fd: Record<string, any> = {}) => ({
  prompt: PROMPT,
  formData: formData(fd),
  userId: TEACHER_ID,
  studentId: STUDENT_ID,
  enableStreaming: true,
  ...over,
});

const oai = (content: string) => ({ choices: [{ message: { content } }] });
const BROKEN = '{"title": "Broken", "exercises": [ {"type": "reading" bad bad';
const FULL_8 = () => worksheetJson(DEFAULT_8);

/** Runs one scenario against a fresh module graph and returns everything observable. */
async function runScenario(mode: string | undefined, scenario: Scenario) {
  installWorld();
  try {
    if (mode === undefined) delete ENV.ENGINE_GATE_MODE;
    else ENV.ENGINE_GATE_MODE = mode;
    vi.resetModules();
    await import('../index.ts');
    const handler = world().handler as Handler;
    const { body, headers } = scenario(world());
    const response = await handler(jsonRequest(body, headers ?? USER_HEADERS));
    const summary = (await summariseResponse(response)) as any;
    if (summary.body && typeof summary.body.fullPrompt === 'string') {
      summary.body = { ...summary.body, fullPrompt: summariseText(summary.body.fullPrompt) };
    }
    await settle();
    const rec = record(summary);
    return { ...rec, insertRows: world().raw.insertRows };
  } finally {
    await settle();
    uninstallWorld();
    delete ENV.ENGINE_GATE_MODE;
  }
}

const isObservation = (line: string) => line.includes('"engine_quality"') || line.includes('engine_gate_warning');
const qualityOf = (logs: string[]) =>
  logs.filter((l) => l.includes('"engine_quality"')).map((l) => JSON.parse(l.slice(l.indexOf('{'))).engine_quality);

const SCENARIOS: Record<string, Scenario> = {
  'streaming success': (w) => {
    w.geminiStream = () => ({ chunks: chunked(FULL_8(), 4) });
    return { body: streamBody() };
  },
  'streaming, truncated output salvaged': (w) => {
    const text = FULL_8();
    w.geminiStream = () => ({ chunks: chunked(text.slice(0, Math.floor(text.length * 0.8)), 4) });
    return { body: streamBody() };
  },
  'streaming, AI window repair': (w) => {
    w.geminiStream = () => ({ chunks: [BROKEN] });
    w.openai = () => oai(FULL_8());
    return { body: streamBody() };
  },
  'streaming, whole document AI repair': (w) => {
    w.geminiStream = () => ({ chunks: [BROKEN] });
    w.openai = (_params, call) => (call === 1 ? oai('') : oai(FULL_8()));
    return { body: streamBody() };
  },
  'streaming, OpenAI fallback': (w) => {
    w.geminiStream = () => new Error('gemini down');
    w.openai = () => chunked(FULL_8(), 4);
    return { body: streamBody() };
  },
  'streaming with picture and audio, 45 min': (w) => {
    w.geminiStream = () => ({ chunks: chunked(worksheetJson(DEFAULT_6), 4) });
    return { body: streamBody({}, { lessonTime: '45min', selectedImage: IMAGE, selectedAudio: AUDIO, selectedExercises: DEFAULT_6 }) };
  },
  'streaming, invalid structure': (w) => {
    w.geminiStream = () => ({ chunks: [JSON.stringify({ exercises: worksheetFixture(DEFAULT_8).exercises })] });
    return { body: streamBody() };
  },
  'regular success': (w) => {
    w.geminiGenerate = async () => FULL_8();
    return { body: streamBody({ enableStreaming: false }) };
  },
  'regular, count mismatch is still refused': (w) => {
    w.geminiGenerate = async () => worksheetJson(DEFAULT_6);
    return { body: streamBody({ enableStreaming: false }) };
  },
  'regular regeneration': (w) => {
    w.geminiGenerate = async () => worksheetJson(['multiple-choice']);
    return {
      body: streamBody({ enableStreaming: false, isRegeneration: true }, { regenerationMode: true, targetExerciseType: 'multiple-choice' }),
    };
  },
  'batch': (w) => {
    w.geminiGenerate = async () => worksheetJson(['word-order', 'gap-text']);
    return {
      body: {
        prompt: 'Generate a single word-order exercise for the topic: work.',
        formData: { englishLevel: 'B1/B2', targetExerciseTypes: ['word-order', 'gap-text'], exerciseCountPerType: 1 },
        userId: TEACHER_ID,
        isBatchGeneration: true,
      },
    };
  },
};

describe('ENGINE_GATE_MODE only adds log lines', () => {
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    it(`${name}: response, model calls, database calls and inserted rows are identical in every mode`, async () => {
      const unset = await runScenario(undefined, scenario);
      const off = await runScenario('off', scenario);
      const log = await runScenario('log', scenario);
      const enforce = await runScenario('enforce', scenario);

      for (const other of [off, log, enforce]) {
        expect(other.response).toEqual(unset.response);
        expect(other.calls).toEqual(unset.calls);
        expect(other.insertRows).toEqual(unset.insertRows);
      }

      // off: no observation at all. unset, log: the same lines. enforce: log plus one warning.
      expect(off.logs.filter(isObservation)).toEqual([]);
      expect(off.logs.some((l) => l.includes('parse_recovered_early_warning'))).toBe(false);
      expect(log.logs).toEqual(unset.logs);
      const withoutObservation = (logs: string[]) => logs.filter((l) => !isObservation(l) && !l.includes('parse_recovered_early_warning'));
      expect(withoutObservation(unset.logs)).toEqual(off.logs.filter((l) => !l.includes('parse_recovered_early_warning')));
      expect(withoutObservation(enforce.logs)).toEqual(withoutObservation(unset.logs));
      const warnings = enforce.logs.filter((l) => l.includes('engine_gate_warning'));
      // one warning per observed generation (an invalid structure is refused before the observation)
      const expectedWarning = 'warn: {"engine_gate_warning":"enforce_not_implemented","behaving_as":"log"}';
      expect(warnings).toEqual(qualityOf(log.logs).map(() => expectedWarning));
    });
  }
});

describe('engine_quality log line', () => {
  it('is one single-line JSON object with the documented keys (streaming success)', async () => {
    const run = await runScenario(undefined, SCENARIOS['streaming success']);
    const lines = run.logs.filter((l) => l.includes('"engine_quality"'));
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith('log: {"engine_quality":')).toBe(true);
    expect(lines[0]).not.toContain('\n');
    const q = qualityOf(run.logs)[0];
    expect(Object.keys(q)).toEqual([
      'schema', 'engine_prompt_version', 'gate_mode', 'mode', 'model', 'fallback_used', 'repair_method',
      'repair_detail', 'generation_ms', 'worksheet_id', 'client_generation_id', 'has_media', 'checks', 'defects',
      'finish_reason', 'truncated', 'primary_failure', 'fallback_skipped', 'em_dash_replaced',
    ]);
    expect(q).toMatchObject({
      schema: 1,
      engine_prompt_version: ENGINE_PROMPT_VERSION,
      gate_mode: 'log',
      mode: 'streaming',
      model: 'gemini-2.5-flash',
      fallback_used: false,
      repair_method: 'none',
      repair_detail: 'none',
      generation_ms: 0,
      worksheet_id: null,
      client_generation_id: 'gen_abc12345',
      has_media: false,
    });
    expect(q.checks.exercise_count).toEqual({ applicable: true, expected: 8, actual: 8, match: true });
    expect(q.checks.type_order).toMatchObject({ applicable: true, same_set: true, exact_order: true });
    expect(Object.keys(q.checks)).toEqual([
      'exercise_count', 'type_order', 'word_order', 'multiple_choice', 'fill_in_blanks', 'gap_text',
      'em_dash', 'nano_skill', 'register',
    ]);
    expect(Array.isArray(q.defects)).toBe(true);
  });

  it('is logged once per generation in every mode', async () => {
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
      if (name === 'streaming, invalid structure') continue;
      const run = await runScenario(undefined, scenario);
      expect(qualityOf(run.logs), name).toHaveLength(1);
    }
    const invalid = await runScenario(undefined, SCENARIOS['streaming, invalid structure']);
    expect(qualityOf(invalid.logs)).toHaveLength(0);
  });

  it('never contains worksheet text, prompts, names, emails or ids of people', async () => {
    const run = await runScenario(undefined, SCENARIOS['streaming success']);
    const line = run.logs.find((l) => l.includes('"engine_quality"')) as string;
    for (const forbidden of [
      'teacher@example.test', TEACHER_ID, STUDENT_ID, 'Negotiating', 'delivery', 'supplier', 'lessonTopic', 'SYSTEM MESSAGE', '203.0.113.7', 'Poland', 'Warsaw',
    ]) {
      expect(line).not.toContain(forbidden);
    }
    expect(line).not.toContain(String.fromCharCode(0x2014));
  });

  it('reports order, media, mode and the fallback model', async () => {
    const media = qualityOf((await runScenario(undefined, SCENARIOS['streaming with picture and audio, 45 min'])).logs)[0];
    expect(media).toMatchObject({ mode: 'streaming', has_media: true });
    expect(media.checks.exercise_count).toMatchObject({ expected: 6, actual: 6, match: true });
    expect(media.checks.type_order.exact_order_media_sorted).not.toBeNull();

    const fallback = qualityOf((await runScenario(undefined, SCENARIOS['streaming, OpenAI fallback'])).logs)[0];
    expect(fallback).toMatchObject({ model: 'gpt-5.6-terra', fallback_used: true });

    const regular = qualityOf((await runScenario(undefined, SCENARIOS['regular success'])).logs)[0];
    expect(regular).toMatchObject({ mode: 'regular', model: 'gemini-2.5-flash', fallback_used: false });

    const batch = qualityOf((await runScenario(undefined, SCENARIOS.batch)).logs)[0];
    expect(batch).toMatchObject({ mode: 'batch', client_generation_id: null });
    expect(batch.checks.exercise_count).toEqual({ applicable: true, expected: 2, actual: 2, match: true });
  });

  it('observes a count mismatch that the regular gate still refuses', async () => {
    const run = await runScenario(undefined, SCENARIOS['regular, count mismatch is still refused']);
    expect(qualityOf(run.logs)[0].checks.exercise_count).toEqual({ applicable: true, expected: 8, actual: 6, match: false });
    expect(qualityOf(run.logs)[0].defects).toContain('exercise_count_mismatch');
    expect((run.response as any).status).toBe(500);
    expect(run.insertRows).toHaveLength(0);
  });

  it('skips count and order for single-exercise regeneration', async () => {
    const q = qualityOf((await runScenario(undefined, SCENARIOS['regular regeneration'])).logs)[0];
    expect(q.checks.exercise_count.applicable).toBe(false);
    expect(q.checks.type_order.applicable).toBe(false);
  });

  it('treats an unknown ENGINE_GATE_MODE value as log', async () => {
    const run = await runScenario('shadow', SCENARIOS['streaming success']);
    expect(qualityOf(run.logs)).toHaveLength(1);
    expect(run.logs.filter((l) => l.includes('engine_gate_warning'))).toEqual([]);
  });
});

describe('repair telemetry', () => {
  it('reports a truncated and salvaged answer as truncate while repairMethod stays none', async () => {
    const run = await runScenario(undefined, SCENARIOS['streaming, truncated output salvaged']);
    const q = qualityOf(run.logs)[0];
    expect(q.repair_method).toBe('none');
    expect(q.repair_detail).toBe('truncate');
    expect(q.checks.exercise_count.match).toBe(false);
    // the legacy log line is unchanged: no "repaired using" line for a local repair
    expect(run.logs.some((l) => l.includes('JSON was repaired using'))).toBe(false);
  });

  it('logs ai-window repairs: repair_method, early warning line, legacy line, and no alert email', async () => {
    const run = await runScenario(undefined, SCENARIOS['streaming, AI window repair']);
    const q = qualityOf(run.logs)[0];
    expect(q).toMatchObject({ repair_method: 'ai-window', repair_detail: 'ai-window' });
    expect(run.logs).toContain('log: 🔧 [STREAMING] JSON was repaired using: ai-window');
    expect(run.logs).toContain(
      'warn: {"parse_recovered_early_warning":{"mode":"streaming","repair_method":"ai-window","repair_detail":"ai-window"}}',
    );
    // the alert email stays reserved for 'ai' and 'ai-fallback'
    expect(run.calls.filter((c: any) => c.kind === 'fetch' && String(c.url).includes('notify-generation-failure'))).toEqual([]);
  });

  it('keeps the parse_recovered alert email for the whole-document AI repair', async () => {
    const run = await runScenario(undefined, SCENARIOS['streaming, whole document AI repair']);
    expect(qualityOf(run.logs)[0]).toMatchObject({ repair_method: 'ai', repair_detail: 'ai' });
    const alerts = run.calls.filter((c: any) => c.kind === 'fetch' && String(c.url).includes('notify-generation-failure'));
    expect(alerts).toHaveLength(1);
    expect((alerts[0] as any).body.errorType).toBe('parse_recovered');
  });

  it('parses valid JSON with typographic quotes without a repair step and flattens them per value', async () => {
    const scenario: Scenario = (w) => {
      const sheet = worksheetFixture(DEFAULT_8);
      (sheet.exercises[0] as any).content = 'He said “please wait” and it’s fine.';
      w.geminiStream = () => ({ chunks: [JSON.stringify(sheet)] });
      return { body: streamBody() };
    };
    const run = await runScenario(undefined, scenario);
    const q = qualityOf(run.logs)[0];
    expect(q.repair_method).toBe('none');
    expect(q.repair_detail).toBe('none');
    expect(JSON.parse(run.insertRows[0].html_content).exercises[0].content).toBe('He said "please wait" and it\'s fine.');
  });

  it('still names the curly quote handling when the document needed a repair', async () => {
    const scenario: Scenario = (w) => {
      const text = JSON.stringify(worksheetFixture(DEFAULT_8)).replace('"Hello', '“Hello').replace(/,\s*"type":"reading"/, '');
      // a stray straight quote inside a string forces the repair layers, curly quotes are still normalised first
      const broken = text.replace(/"title":"([^"]*)"/, '"title":"He said "$1" it’s"');
      w.geminiStream = () => ({ chunks: [broken] });
      return { body: streamBody() };
    };
    const run = await runScenario(undefined, scenario);
    const q = qualityOf(run.logs)[0];
    expect(q.repair_detail).toContain('curly-apostrophes');
    expect(q.repair_detail).toContain('escape-scan');
  });
});
