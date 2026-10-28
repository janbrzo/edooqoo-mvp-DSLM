import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  loadWorksheetJson, resolveAudioTranscript,
} from '../../../../supabase/functions/_shared/worksheetContent';
import { buildOpenAnswerContext } from '../../../../supabase/functions/_shared/openAnswerContext';

const sheet = { title: 'T', exercises: [{ type: 'listening-comprehension', questions: [{ question: 'Who speaks?', answer: 'Tom' }] }] };

afterEach(() => vi.restoreAllMocks());

describe('loadWorksheetJson', () => {
  it('returns the parsed ai_response unchanged for a valid row', () => {
    const r = loadWorksheetJson({ id: 'a', ai_response: JSON.stringify(sheet), html_content: '<div>x</div>' });
    expect(r).toEqual({ data: sheet, source: 'ai_response', degraded: false });
  });
  it('accepts an already parsed jsonb ai_response', () => {
    expect(loadWorksheetJson({ ai_response: sheet }).data).toBe(sheet);
  });
  it('falls back to html_content JSON when ai_response is not parseable', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = loadWorksheetJson({ id: 'b', ai_response: '{"exercises": [ {"type"', html_content: JSON.stringify(sheet) });
    expect(r.source).toBe('html_content');
    expect(r.degraded).toBe(true);
    expect(r.data.exercises).toHaveLength(1);
  });
  it('tolerates markdown fences around ai_response', () => {
    const r = loadWorksheetJson({ ai_response: '```json\n' + JSON.stringify(sheet) + '\n```' });
    expect(r.source).toBe('ai_response');
    expect(r.data.title).toBe('T');
  });
  it('ignores html_content that is HTML or has no exercises array, and never throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadWorksheetJson({ ai_response: 'garbage', html_content: '<div>hi</div>' })).toEqual({ data: null, source: null, degraded: true });
    expect(loadWorksheetJson({ ai_response: 'garbage', html_content: '{"title":"x"}' }).data).toBeNull();
    expect(loadWorksheetJson({ ai_response: '[1,2]' }).data).toBeNull();
    expect(loadWorksheetJson(null).data).toBeNull();
    expect(loadWorksheetJson({}).degraded).toBe(true);
    expect(() => loadWorksheetJson({ ai_response: 12 as any, html_content: Symbol('x') as any })).not.toThrow();
  });
});

describe('resolveAudioTranscript (P1.6)', () => {
  it('prefers the column over the JSON key', () => {
    expect(resolveAudioTranscript({ audio_transcript: 'column text' }, { audio_transcript: 'json text' })).toBe('column text');
  });
  it('falls back to selected_audio, then to the JSON keys', () => {
    expect(resolveAudioTranscript({ selected_audio: { transcript: 'sel' } }, {})).toBe('sel');
    expect(resolveAudioTranscript({ selected_audio: JSON.stringify({ transcript: 'str' }) }, {})).toBe('str');
    expect(resolveAudioTranscript({ audio_transcript: '  ' }, { audio_transcript: 'json text' })).toBe('json text');
    expect(resolveAudioTranscript({}, { selected_audio: { transcript: 'js' } })).toBe('js');
    expect(resolveAudioTranscript(null, {})).toBeNull();
  });
  it('the transcript reaches the open answer context when only the column has it', () => {
    const row = { id: 'w', ai_response: JSON.stringify(sheet), audio_transcript: 'Tom says hello to Anna.', selected_audio: null };
    const parsed = loadWorksheetJson(row).data;
    expect(parsed.audio_transcript).toBeUndefined();
    const transcript = resolveAudioTranscript(row, parsed);
    const ctx = buildOpenAnswerContext({ exercise: parsed.exercises[0], questionIndex: 0, worksheetAudioTranscript: transcript });
    expect(ctx.source_context).toBe('Audio transcript: Tom says hello to Anna.');
    const without = buildOpenAnswerContext({ exercise: parsed.exercises[0], questionIndex: 0, worksheetAudioTranscript: resolveAudioTranscript({}, parsed) });
    expect(without.source_context).toBe('');
  });
});

describe('server consumers use the loader', () => {
  const files = [
    'process-pending-ai-evaluations/index.ts', 'process-pending-ai-evaluations/homeworkEval.ts',
    'publish-worksheet/index.ts', 'bulk-publish-worksheets/index.ts',
    'get-student-hub-data/index.ts', 'generate-media-exercises/index.ts',
  ];
  it.each(files)('%s has no bare JSON.parse of ai_response', (f) => {
    const src = readFileSync(`supabase/functions/${f}`, 'utf8');
    expect(src).toContain('loadWorksheetJson');
    expect(src).not.toMatch(/JSON\.parse\([^)]*ai_response/);
  });
});
