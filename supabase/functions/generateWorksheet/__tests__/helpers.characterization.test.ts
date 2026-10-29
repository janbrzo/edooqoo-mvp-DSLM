/**
 * Characterization of generateWorksheet/helpers.ts: JSON extraction, repair
 * layers, parseAIResponse and the exercise type helpers. Records CURRENT
 * behaviour including quirks; nothing here asserts that behaviour is right.
 * Model output is fixture text, no network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXERCISE_TYPE_NAMES,
  extractJSONString,
  getExerciseTypesForCount,
  getExerciseTypesForMissing,
  getIconForType,
  getOfficialExerciseName,
  normalizeExerciseId,
  parseAIResponse,
  repairJSONStringDeterministic,
  repairUnescapedQuotes,
  truncateToLastCompleteExercise,
  validateAndFilterExercises,
} from '../helpers.ts';

beforeEach(() => {
  for (const level of ['log', 'info', 'warn', 'error'] as const) vi.spyOn(console, level).mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const outcome = (fn: () => unknown) => {
  try {
    return { ok: fn() };
  } catch (e) {
    const err = e as any;
    return { threw: err.message, errorPosition: err.errorPosition, rawLength: err.rawLength, hasRawContent: typeof err.rawContent === 'string' };
  }
};

describe('extractJSONString', () => {
  const cases: Record<string, string> = {
    plain: '{"a":1}',
    'json fence': '```json\n{"a":1}\n```',
    'bare fence': '```\n{"a":1}\n```',
    'upper-case JSON fence': '```JSON\n{"a":1}\n```',
    bom: '﻿{"a":1}',
    'text around the object': 'Here is the worksheet: {"a":1} Hope this helps!',
    'no braces at all': 'no json here',
    'only closing brace before opening': '} text {',
    'single opening brace': '{ never closed',
    'smart double quotes inside a valid string (quirk: corrupts valid JSON)': '{"a":"He said “hello”"}',
    'smart single quotes become straight apostrophes': '{"a":"it’s ‘fine’"}',
    'smart quotes used as JSON delimiters': '{“a”: “b”}',
    'low and prime quotes': '{"a":"„ x ‟ ″ ‶ ‚ ‛ ′ ‵"}',
    'control characters removed, newline and tab kept': '{"a":"x\u0000y\u0007z\n\t"}',
    'DEL removed': '{"a":"x\u007Fy"}',
    'two objects: first brace to last brace': '{"a":1} {"b":2}',
    empty: '',
  };
  it.each(Object.entries(cases))('%s', (_name, input) => {
    expect(extractJSONString(input)).toMatchSnapshot();
  });

  it('fence removal only touches the start and the end of the text', () => {
    expect(extractJSONString('{"a":"```json x ```"}')).toBe('{"a":"```json x ```"}');
  });
});

describe('repairJSONStringDeterministic', () => {
  const cases: Record<string, string> = {
    'valid JSON is unchanged': '{"a":[1,2],"b":{"c":"d"}}',
    'trailing comma in object': '{"a":1,}',
    'trailing comma in array': '{"a":[1,2,]}',
    'missing comma between objects': '{"a":[{"x":1}{"y":2}]}',
    'missing comma between arrays': '{"a":[[1][2]]}',
    'missing colon before an object': '{"a" {"b":1}}',
    'missing colon before an array': '{"a" [1,2]}',
    'missing colon before a boolean': '{"a" true}',
    'missing colon before a number': '{"a" 12}',
    'missing colon between key and string on the same line': '{"a" "b"}',
    'missing colon with key and value on separate lines': '{"a"\n"b"}',
    'adjacent strings in an array become a key value pair (quirk)': '{"words":["alpha" "beta", "gamma"]}',
    'adjacent long strings are left alone': `{"words":["${'x'.repeat(60)}" "beta"]}`,
    'string containing a comma between adjacent strings is left alone': '{"words":["a, b" "c"]}',
    'unclosed brackets and braces are appended': '{"a":[{"b":1',
    'unbalanced closers are not removed': '{"a":1}}]',
    'braces inside strings are counted (quirk)': '{"a":"{ not a brace"}',
    'brackets inside strings are counted (quirk)': '{"a":"[ open"}',
  };
  it.each(Object.entries(cases))('%s', (_name, input) => {
    expect(repairJSONStringDeterministic(input)).toMatchSnapshot();
  });
});

describe('repairUnescapedQuotes', () => {
  const cases: Record<string, string> = {
    'valid JSON is unchanged': '{"a":"b","c":["d","e"]}',
    'stray quote inside a value': '{"a":"He said "hello" to me","b":1}',
    'stray quote before a comma inside text is taken as the closing quote (quirk)': '{"a":"say "yes", then go","b":1}',
    'raw newline inside a string': '{"a":"line1\nline2"}',
    'carriage return inside a string is dropped': '{"a":"x\r\ny"}',
    'tab inside a string': '{"a":"x\ty"}',
    'already escaped quote and backslash': '{"a":"x \\"y\\" \\\\"}',
    'closing quote at the end of input': '{"a":"b"',
    'whitespace between closing quote and colon': '{"a" : "b"}',
    'newline outside strings is preserved': '{\n"a": 1\n}',
    'unterminated string': '{"a":"never closed',
  };
  it.each(Object.entries(cases))('%s', (_name, input) => {
    expect(repairUnescapedQuotes(input)).toMatchSnapshot();
  });
});

describe('truncateToLastCompleteExercise', () => {
  const ex = (n: number) => `{"type":"reading","title":"T${n}","questions":[{"q":"a{b"},{"q":"]"}]}`;
  const cases: Record<string, string> = {
    'no exercises key': '{"title":"x"}',
    'exercises is not an array': '{"exercises":"nope"}',
    'complete document keeps only the exercises (drops later properties, quirk)': `{"title":"x","exercises":[${ex(1)},${ex(2)}],"vocabulary_sheet":[{"term":"a"}]}`,
    'cut in the middle of the third exercise': `{"title":"x","exercises":[${ex(1)},${ex(2)},{"type":"read`,
    'cut right after a complete exercise': `{"title":"x","exercises":[${ex(1)},${ex(2)},`,
    'no exercise ever completes': '{"title":"x","exercises":[{"type":"read',
    'empty exercises array': '{"exercises":[]}',
    'braces and brackets inside strings do not confuse the scan': `{"exercises":[${ex(1)},{"type":"x","t":"}}]]`,
    'escaped quotes inside strings': '{"exercises":[{"a":"he said \\"}\\" "},{"b":1',
    'array elements that are not objects are not counted as complete': '{"exercises":["a","b"',
    'whitespace before the colon': `{"exercises" :  [${ex(1)}, {"type":`,
  };
  it.each(Object.entries(cases))('%s', (_name, input) => {
    expect(truncateToLastCompleteExercise(input)).toMatchSnapshot();
  });
});

describe('parseAIResponse', () => {
  const ex = (n: number) => `{"type":"reading","title":"T${n}"}`;
  const cases: Record<string, string> = {
    'clean JSON': `{"title":"x","exercises":[${ex(1)}]}`,
    'fenced JSON': `\`\`\`json\n{"title":"x","exercises":[${ex(1)}]}\n\`\`\``,
    'text around the JSON': `Sure! {"title":"x","exercises":[${ex(1)}]} Done.`,
    'trailing commas (deterministic layer)': `{"title":"x","exercises":[${ex(1)},],}`,
    'missing comma between exercises (deterministic layer)': `{"title":"x","exercises":[${ex(1)}${ex(2)}]}`,
    'stray quotes (escape-scan layer)': '{"title":"x","exercises":[{"type":"reading","title":"He said "hi" there"}]}',
    'unescaped newline in a value (escape-scan layer)': '{"title":"x","exercises":[{"type":"reading","title":"a\nb"}]}',
    'smart quotes inside a value corrupt valid JSON and are then repaired (quirk)': '{"title":"x","exercises":[{"type":"reading","title":"He said “hi”"}]}',
    'truncated document is silently cut to the complete exercises (quirk)': `{"title":"x","exercises":[${ex(1)},${ex(2)},{"type":"read`,
    'truncated before any exercise completes': '{"title":"x","exercises":[{"type":"read',
    'document missing its closing braces is balanced': `{"title":"x","exercises":[${ex(1)}`,
    'unrecoverable text': '{"title": nonsense here',
    'no JSON at all': 'I cannot help with that.',
    'empty string': '',
    'JSON array at the top level is not recoverable because the extraction cuts from the first to the last brace (quirk)': '[{"a":1},{"b":2}]',
    'JSON with only whitespace': '   \n ',
    'nested exercises key inside a string is ignored by JSON.parse but not by truncation': '{"title":"exercises: [","exercises":[{"type":"a"}]}',
    'value true instead of object parses as is': '{"exercises":true}',
  };
  it.each(Object.entries(cases))('%s', (_name, input) => {
    expect(outcome(() => parseAIResponse(input))).toMatchSnapshot();
  });

  it('the error thrown for unrecoverable input carries the extracted text and the first error position', () => {
    const result = outcome(() => parseAIResponse('{"title": nonsense here')) as any;
    expect(result.hasRawContent).toBe(true);
    expect(typeof result.errorPosition).toBe('number');
  });
});

describe('exercise type helpers', () => {
  it('getExerciseTypesForCount', () => {
    expect({
      default8: getExerciseTypesForCount(8),
      default6: getExerciseTypesForCount(6),
      default1: getExerciseTypesForCount(1),
      default12: getExerciseTypesForCount(12),
      default0: getExerciseTypesForCount(0),
      emptySelected: getExerciseTypesForCount(6, []),
      selected: getExerciseTypesForCount(3, ['gap-text', 'word-order', 'reading', 'dialogue']),
      selectedWithInvalid: getExerciseTypesForCount(8, ['gap-text', 'nonsense', 'writing-task', 'reading']),
      selectedAllInvalid: getExerciseTypesForCount(8, ['nonsense']),
      pictureAndAudio: getExerciseTypesForCount(8, ['describe-picture', 'listening-comprehension', 'matching-picture', 'true-false-audio', 'fill-in-blanks-picture']),
    }).toMatchSnapshot();
  });

  it('validateAndFilterExercises filters first and slices after (a rejected type does not free a slot)', () => {
    expect(validateAndFilterExercises(['nonsense', 'reading', 'gap-text'], 2)).toEqual(['reading', 'gap-text']);
    expect(validateAndFilterExercises(['reading', 'reading', 'reading'], 8)).toEqual(['reading', 'reading', 'reading']);
    expect(validateAndFilterExercises(['reading'], 0)).toEqual([]);
  });

  it('normalizeExerciseId', () => {
    expect(
      Object.fromEntries(
        ['reading', 'describe-picture', 'true-false-picture', 'multiple-choice-audio', 'listening-comprehension', 'picture-x', 'x-audio-y', 'answer-questions-picture', ''].map((id) => [
          id || '(empty)',
          normalizeExerciseId(id),
        ]),
      ),
    ).toMatchSnapshot();
  });

  it('getExerciseTypesForMissing', () => {
    expect(getExerciseTypesForMissing([{ type: 'a' }, { type: 'c' }, {}], ['a', 'b', 'c', 'd'])).toEqual(['b', 'd']);
    expect(getExerciseTypesForMissing([], ['a'])).toEqual(['a']);
  });

  it('getIconForType', () => {
    const types = [...Object.keys(EXERCISE_TYPE_NAMES), 'unknown-type'];
    expect(Object.fromEntries(types.map((t) => [t, getIconForType(t)]))).toMatchSnapshot();
  });

  it('EXERCISE_TYPE_NAMES and getOfficialExerciseName (including the capitalising fallback)', () => {
    expect(EXERCISE_TYPE_NAMES).toMatchSnapshot();
    expect({
      known: getOfficialExerciseName('gap-text'),
      fallback: getOfficialExerciseName('my-new-type'),
      fallbackSingle: getOfficialExerciseName('essay-x'),
      empty: getOfficialExerciseName(''),
    }).toMatchSnapshot();
  });
});
