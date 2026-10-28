/**
 * Characterization of generateWorksheet/validators.ts. The engine calls
 * validateExercise and swallows every exception, so the validators only log
 * (and, for unknown or basic types, mutate the exercise with default time and
 * icon). The snapshots record, per type and fixture, whether the validator
 * throws, the message, and the exercise after validation. CURRENT behaviour,
 * including mismatches with the prompt schema, is recorded as is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateExercise } from '../validators.ts';
import { exerciseFixture } from './fixtures';

let warnings: string[] = [];
beforeEach(() => {
  warnings = [];
  vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => void warnings.push(a.join(' ')));
  vi.spyOn(console, 'info').mockImplementation((...a: unknown[]) => void warnings.push(a.join(' ')));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function check(exercise: any) {
  const copy = exercise && typeof exercise === 'object' ? JSON.parse(JSON.stringify(exercise)) : exercise;
  warnings = [];
  let threw: string | null = null;
  try {
    validateExercise(copy);
  } catch (e) {
    threw = (e as Error).message;
  }
  return { threw, warnings: [...warnings], after: copy };
}

const mk = (type: string, over: Record<string, any> = {}) => ({ ...exerciseFixture(type, 0), ...over });

describe('validateExercise: structural checks', () => {
  it.each([
    ['null', null],
    ['string', 'x'],
    ['undefined', undefined],
    ['no type', {}],
    ['numeric type', { type: 4 }],
  ])('rejects %s', (_n, value) => {
    expect(check(value)).toMatchSnapshot();
  });

  it('unknown type is allowed and gets default time and icon', () => {
    expect(check({ type: 'brand-new-type' })).toMatchSnapshot();
    expect(check({ type: 'brand-new-type', time: 'ten', icon: 'fa-x' })).toMatchSnapshot();
  });
});

describe('validateExercise: every known type, valid and broken fixtures', () => {
  const types = [
    'reading',
    'matching',
    'fill-in-blanks',
    'multiple-choice',
    'dialogue',
    'true-false',
    'discussion',
    'error-correction',
    'odd-one-out',
    'synonyms',
    'antonyms',
    'synonyms-antonyms',
    'sentence-transformation',
    'word-order',
    'gap-text',
    'negative-prefixes',
    'paraphrasing',
    'complete-word',
    'categorize',
    'matching-halves',
    'describe-picture',
    'answer-questions',
    'multiple-choice-picture',
    'true-false-picture',
    'answer-questions-picture',
    'listening-comprehension',
    'multiple-choice-audio',
    'true-false-audio',
    'fill-in-blanks-audio',
    'answer-questions-audio',
  ];

  it.each(types)('%s: generator-shaped fixture', (type) => {
    expect(check(mk(type))).toMatchSnapshot();
  });

  it.each(types)('%s: bare exercise with only a type', (type) => {
    expect(check({ type })).toMatchSnapshot();
  });
});

describe('validateExercise: specific rules and quirks', () => {
  it('reading: short content only warns, fewer than 5 questions throws', () => {
    expect(check(mk('reading', { content: 'too short' }))).toMatchSnapshot();
    expect(check(mk('reading', { questions: [1, 2, 3, 4] }))).toMatchSnapshot();
    expect(check(mk('reading', { content: 42 }))).toMatchSnapshot();
  });

  it('matching: term and definition required for every item', () => {
    expect(check(mk('matching', { items: [...mk('matching').items.slice(0, 9), { term: 'x' }] }))).toMatchSnapshot();
  });

  it('matching does not read the `pairs`/`matches` shapes that the normalizer accepts', () => {
    expect(check({ type: 'matching', pairs: mk('matching').items })).toMatchSnapshot();
  });

  it('multiple-choice: exactly four options and exactly one correct', () => {
    const q = mk('multiple-choice').questions;
    expect(check(mk('multiple-choice', { questions: [...q.slice(0, 9), { text: 'x', options: [{ correct: true }, { correct: true }, {}, {}] }] }))).toMatchSnapshot();
    expect(check(mk('multiple-choice', { questions: [...q.slice(0, 9), { text: 'x', options: [{ correct: true }] }] }))).toMatchSnapshot();
    expect(check(mk('multiple-choice', { questions: [...q.slice(0, 9), { text: 'x', options: [{}, {}, {}, {}] }] }))).toMatchSnapshot();
  });

  it('true-false: isTrue must be a boolean; the prompt schema statement shape is checked as is', () => {
    expect(check(mk('true-false', { statements: [...mk('true-false').statements.slice(0, 9), { text: 'x', isTrue: 'true' }] }))).toMatchSnapshot();
    expect(check(mk('true-false', { statements: undefined, questions: mk('true-false').statements }))).toMatchSnapshot();
  });

  it('fill-in-blanks needs a word bank of at least 5 (word bank absent throws)', () => {
    expect(check(mk('fill-in-blanks', { word_bank: undefined }))).toMatchSnapshot();
    expect(check(mk('fill-in-blanks', { word_bank: ['a', 'b'] }))).toMatchSnapshot();
  });

  it('negative-prefixes reads base_word although the prompt asks for word (known mismatch, lenient so only a warning)', () => {
    expect(check({ type: 'negative-prefixes', words: Array.from({ length: 10 }, (_, i) => ({ word: `w${i}`, answer: `unw${i}` })) })).toMatchSnapshot();
    expect(check({ type: 'negative-prefixes', words: Array.from({ length: 10 }, (_, i) => ({ base_word: `w${i}` })) })).toMatchSnapshot();
  });

  it('fill-in-blanks-audio requires transcript_with_blanks and full_transcript although the prompt forbids them (known mismatch, lenient)', () => {
    expect(
      check({
        type: 'fill-in-blanks-audio',
        sentences: Array.from({ length: 10 }, (_, i) => ({ text: `s ${i} _____`, answer: `a${i}` })),
        word_bank: Array.from({ length: 10 }, (_, i) => `a${i}`),
      }),
    ).toMatchSnapshot();
  });

  it('odd-one-out: a wrong question count only warns, a wrong option count throws (but lenient mode swallows it)', () => {
    expect(check(mk('odd-one-out', { questions: mk('odd-one-out').questions.slice(0, 3) }))).toMatchSnapshot();
    expect(check(mk('odd-one-out', { questions: [{ options: ['a', 'b'], correct_answer: 'a' }] }))).toMatchSnapshot();
    expect(check(mk('odd-one-out', { questions: [{ options: ['a', 'b', 'c', 'd', 'e'] }] }))).toMatchSnapshot();
  });

  it('synonyms/antonyms accepts items or pairs and both field-name styles', () => {
    expect(check({ type: 'synonyms', pairs: Array.from({ length: 5 }, (_, i) => ({ word: `w${i}`, match: `m${i}` })) })).toMatchSnapshot();
    expect(check({ type: 'antonyms', items: Array.from({ length: 5 }, (_, i) => ({ term: `w${i}`, definition: `m${i}` })) })).toMatchSnapshot();
    expect(check({ type: 'synonyms-antonyms', items: Array.from({ length: 5 }, () => ({ word: 'only word' })) })).toMatchSnapshot();
  });

  it('sentence-transformation accepts transformations or sentences', () => {
    expect(check({ type: 'sentence-transformation', sentences: Array.from({ length: 5 }, (_, i) => ({ original: `o${i}` })) })).toMatchSnapshot();
    expect(check({ type: 'sentence-transformation', sentences: Array.from({ length: 5 }, () => ({})) })).toMatchSnapshot();
  });

  it('word-order accepts scrambled_words or correct_order alone', () => {
    expect(check({ type: 'word-order', sentences: Array.from({ length: 5 }, () => ({ correct_order: 'A b c.' })) })).toMatchSnapshot();
    expect(check({ type: 'word-order', sentences: Array.from({ length: 5 }, () => ({})) })).toMatchSnapshot();
  });

  it('describe-picture accepts instructions or description and logs the missing image_url', () => {
    expect(check({ type: 'describe-picture', instructions: 'Describe it.' })).toMatchSnapshot();
    expect(check({ type: 'describe-picture', description: 'x', image_url: 'https://x.test/i.jpg' })).toMatchSnapshot();
    expect(check({ type: 'describe-picture' })).toMatchSnapshot();
  });

  it('answer-questions accepts question or text; fewer than 3 questions throws (lenient for picture and audio variants only)', () => {
    expect(check({ type: 'answer-questions', questions: [{ text: 'a' }, { question: 'b' }, { text: 'c' }] })).toMatchSnapshot();
    expect(check({ type: 'answer-questions', questions: [{ text: 'a' }] })).toMatchSnapshot();
    expect(check({ type: 'answer-questions-picture', questions: [{ text: 'a' }] })).toMatchSnapshot();
  });

  it('listening-comprehension needs 8 questions with text and answer strings', () => {
    expect(check({ type: 'listening-comprehension', questions: Array.from({ length: 7 }, () => ({ text: 't', answer: 'a' })) })).toMatchSnapshot();
    expect(check({ type: 'listening-comprehension', questions: Array.from({ length: 8 }, () => ({ text: 't' })) })).toMatchSnapshot();
  });

  it('basic structure types set default time and icon only when missing or wrong', () => {
    expect(check({ type: 'paraphrasing' })).toMatchSnapshot();
    expect(check({ type: 'categorize', time: '5', icon: '' })).toMatchSnapshot();
    expect(check({ type: 'complete-word', time: 7, icon: 'fa-custom' })).toMatchSnapshot();
  });

  it('established types are strict (throw), new types lenient (warn): count by type', () => {
    const strict = ['reading', 'matching', 'fill-in-blanks', 'multiple-choice', 'dialogue', 'true-false', 'discussion', 'error-correction', 'answer-questions'];
    const lenient = ['odd-one-out', 'word-order', 'gap-text', 'listening-comprehension', 'multiple-choice-picture', 'true-false-audio', 'fill-in-blanks-audio'];
    const result = (types: string[]) => Object.fromEntries(types.map((t) => [t, check({ type: t, questions: [], sentences: [], items: [], statements: [] }).threw]));
    expect({ strict: result(strict), lenient: result(lenient) }).toMatchSnapshot();
    expect(Object.values(result(strict)).every((v) => v !== null)).toBe(true);
    expect(Object.values(result(lenient)).every((v) => v === null)).toBe(true);
  });
});
