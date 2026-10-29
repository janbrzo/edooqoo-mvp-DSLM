/**
 * Characterization of generateWorksheet/streaming.ts (SSE transport and
 * progress counting) and of the shared normalizeWorksheetExercises helper that
 * the engine's readers apply to worksheets. CURRENT behaviour incl. quirks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countExercisesInPartialJSON, createSSEStream, getExpectedExerciseCount } from '../streaming.ts';
import { normalizeExerciseShape, normalizeWorksheetExercises } from '../../_shared/normalizeExercise.ts';

let logs: string[] = [];
beforeEach(() => {
  logs = [];
  for (const level of ['log', 'warn', 'error', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(`${level}: ${a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}`));
  }
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('countExercisesInPartialJSON', () => {
  it.each([
    ['empty', ''],
    ['no types', '{"title":"x"}'],
    ['one exercise', '{"exercises":[{"type":"reading"}'],
    ['whitespace around the colon', '"type"  :   "reading" "type":"x"'],
    ['partial key at the end is not counted', '{"exercises":[{"type":"reading"},{"typ'],
    ['partial value start is counted', '{"type": "'],
    ['nested item types count as exercises (quirk)', '{"exercises":[{"type":"matching","items":[{"type":"noun"},{"type":"verb"}]}]}'],
    ['type inside a text value is counted (quirk)', '{"content":"the \\"type\\": \\"x\\" is"}'],
    ['non-string type values are not counted', '{"type": 3, "type": null}'],
  ])('%s', (_n, input) => {
    expect(countExercisesInPartialJSON(input)).toMatchSnapshot();
  });
});

describe('getExpectedExerciseCount', () => {
  it('maps lesson time to the exercise count', () => {
    expect({
      none: getExpectedExerciseCount(),
      empty: getExpectedExerciseCount(''),
      m45: getExpectedExerciseCount('45min'),
      m60: getExpectedExerciseCount('60min'),
      m30: getExpectedExerciseCount('30min'),
      spaced: getExpectedExerciseCount('45 min'),
    }).toEqual({ none: 8, empty: 8, m45: 6, m60: 8, m30: 8, spaced: 8 });
  });
});

describe('createSSEStream', () => {
  const decode = (chunks: Uint8Array[]) => chunks.map((c) => new TextDecoder().decode(c));

  it('frames events as "event:" + "data:" JSON and closes idempotently', async () => {
    const { readable, send, close } = createSSEStream();
    const reader = readable.getReader();
    const results = [send('start', { a: 1 }), send('progress', { n: 2, text: 'x\ny' })];
    const closed = [close(), close()];
    const sendAfterClose = send('late', {});
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value!);
    }
    expect({ results, closed, sendAfterClose, frames: decode(chunks), logs }).toMatchSnapshot();
  });

  it('a client cancel flips send and close to false', async () => {
    const { readable, send, close } = createSSEStream();
    await readable.cancel();
    expect({ send: send('x', {}), close: close(), logs }).toMatchSnapshot();
  });

  it('emits a keepalive comment frame every 15 seconds until closed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T10:00:00.000Z'));
    const { readable, close } = createSSEStream();
    const reader = readable.getReader();
    await vi.advanceTimersByTimeAsync(15000);
    const first = await reader.read();
    await vi.advanceTimersByTimeAsync(15000);
    const second = await reader.read();
    close();
    await vi.advanceTimersByTimeAsync(60000);
    const end = await reader.read();
    expect({ first: new TextDecoder().decode(first.value), second: new TextDecoder().decode(second.value), endDone: end.done }).toMatchSnapshot();
  });

  it('send logs the event name and payload', () => {
    const { send, close } = createSSEStream();
    send('progress', { exercisesGenerated: 3, expectedTotal: 8 });
    close();
    expect(logs).toMatchSnapshot();
  });
});

describe('normalizeWorksheetExercises / normalizeExerciseShape', () => {
  const cases: Record<string, any> = {
    'matching with pairs word/match': { type: 'matching', pairs: [{ word: 'a', match: 'b' }, { word: 'c', match: 'd' }] },
    'matching with left/right and words': { type: 'matching', words: [{ left: 'a', right: 'b' }] },
    'matching halves': { type: 'matching-halves', halves: [{ left: 'a', right: 'b' }] },
    'matching items plus separate matches merged by term': {
      type: 'matching',
      items: [{ term: 'Apple' }, { term: 'pear' }],
      matches: [{ term: 'apple', definition: 'a fruit', nano_skill: { name: 's' } }, { term: 'pear', definition: 'another fruit' }],
    },
    'matching items plus matches merged by position when terms differ': {
      type: 'matching',
      items: [{ term: 'x' }, { term: 'y' }],
      matches: [{ term: 'p', definition: 'dp' }, { term: 'q', definition: 'dq' }],
    },
    'matching items plus matches with different length stay unmerged': {
      type: 'matching',
      items: [{ term: 'x' }, { term: 'y' }],
      matches: [{ term: 'p', definition: 'dp' }],
    },
    'matching already canonical is returned untouched': { type: 'matching', items: [{ term: 'a', definition: 'b' }] },
    'matching item with question/answer fields': { type: 'matching', items: [{ question: 'q', answer: 'a' }] },
    'matching item with no recognised fields is kept': { type: 'matching', items: [{ foo: 1 }] },
    'matching item that is a string is kept': { type: 'matching', items: ['text'] },
    'synonyms with word/match under pairs': { type: 'synonyms', pairs: [{ word: 'big', match: 'large' }] },
    'antonyms picture suffix': { type: 'antonyms-picture', words: [{ word: 'hot', match: 'cold' }] },
    'categorize words to items and items to words': { type: 'categorize', words: [{ word: 'a' }] },
    'categorize items to words': { type: 'categorize', items: [{ word: 'a' }] },
    'complete-word items to words': { type: 'complete-word', items: [{ word: 'a' }] },
    'negative-prefixes already has words': { type: 'negative-prefixes', words: [{ base_word: 'a' }], items: [{ base_word: 'b' }] },
    'sentence-transformation transformations to sentences': { type: 'sentence-transformation', transformations: [{ original: 'a' }] },
    'gap-text items to sentences': { type: 'gap-text', items: [{ text: 'a' }] },
    'word-order sentences kept': { type: 'word-order', sentences: [{ correct_order: 'a' }], items: [{ correct_order: 'b' }] },
    'paraphrasing items to sentences': { type: 'paraphrasing', items: [{ text: 'a' }] },
    'true-false questions to statements': { type: 'true-false-audio', questions: [{ text: 'a', isTrue: true }] },
    'true-false with empty statements array uses questions': { type: 'true-false', statements: [], questions: [{ text: 'a' }] },
    'unknown type is untouched': { type: 'reading', items: [1] },
    'no type is untouched': { items: [1] },
    'empty arrays are ignored': { type: 'matching', items: [], pairs: [] },
  };

  it.each(Object.entries(cases))('%s', (_n, exercise) => {
    const before = JSON.parse(JSON.stringify(exercise));
    const result = normalizeExerciseShape(exercise);
    expect({ result, sameObject: result === exercise }).toMatchSnapshot();
    expect(exercise).toEqual(before);
  });

  it('non-objects pass through', () => {
    expect([normalizeExerciseShape(null as any), normalizeExerciseShape('x' as any), normalizeExerciseShape(undefined as any)]).toEqual([null, 'x', undefined]);
  });

  it('worksheet level: same object when nothing changes, shallow copy with new exercises otherwise', () => {
    const untouched = { title: 'x', exercises: [{ type: 'reading' }] };
    const touched = { title: 'x', exercises: [{ type: 'reading' }, { type: 'synonyms', pairs: [{ word: 'a', match: 'b' }] }], other: 1 };
    const a = normalizeWorksheetExercises(untouched);
    const b = normalizeWorksheetExercises(touched);
    expect({ aSame: a === untouched, bSame: b === touched, b, firstKept: b.exercises[0] === touched.exercises[0] }).toMatchSnapshot();
    expect([normalizeWorksheetExercises(null as any), normalizeWorksheetExercises({} as any), normalizeWorksheetExercises({ exercises: 'x' } as any)]).toEqual([null, {}, { exercises: 'x' }]);
  });
});
