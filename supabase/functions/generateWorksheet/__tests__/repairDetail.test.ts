/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Repair telemetry of the local JSON recovery steps: the detailed report is
 * additive, the repaired output is exactly what parseAIResponse returns.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_8, worksheetJson } from './fixtures';
import { detectCurlyQuotes, joinRepairDetail, parseAIResponse, parseAIResponseDetailed } from '../helpers';

const sheet = (n: number) => ({
  title: 'T',
  exercises: Array.from({ length: n }, (_, i) => ({ type: 'reading', title: `E${i}`, content: `Text ${i}` })),
});

describe('parseAIResponseDetailed', () => {
  const cases: Array<[string, string, string]> = [
    ['valid JSON', JSON.stringify(sheet(3)), 'none'],
    ['fenced JSON', '```json\n' + JSON.stringify(sheet(3)) + '\n```', 'none'],
    ['trailing comma', '{"title":"T","exercises":[{"type":"reading","content":"a"},]}', 'deterministic'],
    ['missing comma between objects', '{"title":"T","exercises":[{"type":"reading"}{"type":"matching"}]}', 'deterministic'],
    ['stray quote inside a string', '{"title":"T","exercises":[{"type":"reading","content":"He said "hello" to me"}]}', 'escape-scan'],
  ];

  for (const [name, input, step] of cases) {
    it(`${name}: step ${step}, same data as parseAIResponse`, () => {
      const detailed = parseAIResponseDetailed(input);
      expect(detailed.step).toBe(step);
      expect(detailed.data).toEqual(parseAIResponse(input));
    });
  }

  it('reports truncate when a cut-off answer is salvaged to its complete exercises', () => {
    const full = worksheetJson(DEFAULT_8);
    const input = full.slice(0, Math.floor(full.length * 0.8));
    const detailed = parseAIResponseDetailed(input);
    expect(detailed.step).toBe('truncate');
    expect(detailed.data.exercises.length).toBeGreaterThan(0);
    expect(detailed.data.exercises.length).toBeLessThan(8);
    // the report never changes the repaired output
    expect(detailed.data).toEqual(parseAIResponse(input));
  });

  it('throws exactly like parseAIResponse and carries the context for the AI repair', () => {
    const input = '{"title": nonsense here';
    let a: any;
    let b: any;
    try { parseAIResponse(input); } catch (e) { a = e; }
    try { parseAIResponseDetailed(input); } catch (e) { b = e; }
    expect(b.message).toBe(a.message);
    expect(b.rawContent).toBe(a.rawContent);
    expect(b.errorPosition).toBe(a.errorPosition);
  });
});

describe('typographic quotes are rewritten only when the parse fails', () => {
  it('valid JSON with curly quotes and apostrophes is returned untouched with no repair step', () => {
    const input = JSON.stringify({ title: 'He said “hi” and it’s fine', exercises: [] });
    const detailed = parseAIResponseDetailed(input);
    expect(detailed.step).toBe('none');
    expect(detailed.curly).toEqual([]);
    expect(detailed.data.title).toBe('He said “hi” and it’s fine');
  });

  it('JSON broken by curly double quotes is normalised and repaired as before', () => {
    const input = '{"title":"x","exercises":[{"type":"reading","content":"He said "hi" and “ok” now"}]}';
    const detailed = parseAIResponseDetailed(input);
    expect(detailed.curly).toEqual(['curly-quotes']);
    expect(detailed.step).toBe('escape-scan');
    expect(detailed.data.exercises[0].content).toBe('He said "hi" and "ok" now');
  });
});

describe('detectCurlyQuotes and joinRepairDetail', () => {
  it('names the curly-quote normalisation that will be applied', () => {
    expect(detectCurlyQuotes('{"a":"plain"}')).toEqual([]);
    expect(detectCurlyQuotes('{"a":"it’s"}')).toEqual(['curly-apostrophes']);
    expect(detectCurlyQuotes('{"a":"“quoted”"}')).toEqual(['curly-quotes']);
    expect(detectCurlyQuotes('“ ‘')).toEqual(['curly-quotes', 'curly-apostrophes']);
  });

  it('joins the applied steps and drops none', () => {
    expect(joinRepairDetail([])).toBe('none');
    expect(joinRepairDetail(['none'])).toBe('none');
    expect(joinRepairDetail(['curly-apostrophes', 'none'])).toBe('curly-apostrophes');
    expect(joinRepairDetail(['curly-quotes', 'truncate'])).toBe('curly-quotes+truncate');
    expect(joinRepairDetail(['ai-window', 'deterministic'])).toBe('ai-window+deterministic');
  });
});
