import { describe, it, expect } from 'vitest';
import { buildClosedItemContext } from '../closedItemContext';
import { hasRevealedAnswers } from '../revealState';
import {
  calculateItemMastery,
  calculateOverallMastery,
  CLOSED_EXERCISE_TYPES,
} from '@/utils/masteryCalculator';
import {
  applyClosedKeyRules,
  fallbackClosedEvaluation,
} from '../../../../supabase/functions/_shared/closedEvaluation';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Brute force the letter the renderer shuffle maps to the right (or a wrong) definition. */
const letterWhere = (type: string, data: any, idx: number, expected: 100 | 0): string => {
  const found = LETTERS.find((l) => calculateItemMastery(type, data, idx, l, { [idx]: l }) === expected);
  if (!found) throw new Error(`no letter with mastery ${expected} for ${type}`);
  return found;
};

interface Fixture {
  type: string;
  data: any;
  correct: any;
  wrong: any;
}

const mcData = {
  questions: [{ text: 'She ___ tea.', options: [{ text: 'drink' }, { text: 'drinks', correct: true }] }],
};
const tfData = { statements: [{ text: 'The sky is green', isTrue: false }] };
const matchingData = {
  items: [
    { term: 'cat', correct_match: 'a small pet' },
    { term: 'sun', correct_match: 'a star' },
    { term: 'car', correct_match: 'a vehicle' },
    { term: 'pen', correct_match: 'a writing tool' },
  ],
};
const halvesData = {
  sentence_halves: [
    { first_half: 'I go to school', second_half: 'by bus.' },
    { first_half: 'She likes tea', second_half: 'with milk.' },
    { first_half: 'They live', second_half: 'in London.' },
    { first_half: 'We play', second_half: 'football on Sundays.' },
  ],
};
const synData = {
  items: [
    { term: 'big', definition: 'large' },
    { term: 'fast', definition: 'quick' },
    { term: 'happy', definition: 'glad' },
    { term: 'small', definition: 'tiny' },
  ],
};

const fixtures = (): Fixture[] => [
  { type: 'multiple-choice', data: mcData, correct: 'drinks', wrong: 'drink' },
  { type: 'multiple-choice-audio', data: mcData, correct: 'drinks', wrong: 'drink' },
  { type: 'multiple-choice-picture', data: mcData, correct: 'drinks', wrong: 'drink' },
  { type: 'true-false', data: tfData, correct: false, wrong: true },
  { type: 'true-false-audio', data: tfData, correct: false, wrong: true },
  { type: 'true-false-picture', data: tfData, correct: false, wrong: true },
  {
    type: 'matching',
    data: matchingData,
    correct: letterWhere('matching', matchingData, 0, 100),
    wrong: letterWhere('matching', matchingData, 0, 0),
  },
  {
    type: 'matching-halves',
    data: halvesData,
    correct: letterWhere('matching-halves', halvesData, 0, 100),
    wrong: letterWhere('matching-halves', halvesData, 0, 0),
  },
  { type: 'fill-in-blanks', data: { sentences: [{ text: 'I ___ home.', answer: 'went' }] }, correct: 'went', wrong: 'banana' },
  {
    type: 'fill-in-blanks-audio',
    data: { sentences: [{ text: 'I ___ home.' }], answers: ['went'] },
    correct: 'went',
    wrong: 'banana',
  },
  {
    type: 'categorize',
    data: { categories: [{ name: 'Fruit', correct_items: ['apple'] }, { name: 'Veg', correct_items: ['leek'] }], items: ['apple'] },
    correct: 0,
    wrong: 1,
  },
  { type: 'complete-word', data: { words: [{ word: 'beautiful', incomplete: 'beau_iful' }] }, correct: 'beautiful', wrong: 'elephant' },
  { type: 'negative-prefixes', data: { words: [{ word: 'happy', prefix: 'un' }] }, correct: 'un', wrong: 'zebra' },
  { type: 'odd-one-out', data: { questions: [{ options: ['cat', 'dog', 'table'], odd_word: 'table' }] }, correct: 'table', wrong: 'cat' },
  {
    type: 'synonyms-antonyms',
    data: synData,
    correct: letterWhere('synonyms-antonyms', synData, 0, 100),
    wrong: letterWhere('synonyms-antonyms', synData, 0, 0),
  },
  {
    type: 'synonyms',
    data: synData,
    correct: letterWhere('synonyms', synData, 0, 100),
    wrong: letterWhere('synonyms', synData, 0, 0),
  },
  { type: 'antonyms', data: { items: [{ term: 'hot', answer: 'cold' }] }, correct: 'cold', wrong: 'elephant' },
  {
    type: 'error-correction',
    data: { sentences: [{ incorrect: 'She go to school.', answer: 'She goes to school.' }] },
    correct: 'She goes to school.',
    wrong: 'Purple monkeys dishwasher.',
  },
  { type: 'gap-text', data: { sentences: [{ text: 'I ___ home.', answer: 'went' }] }, correct: 'went', wrong: 'banana' },
  {
    type: 'word-order',
    data: { sentences: [{ scrambled_words: 'tea / likes / She', correct_order: 'She likes tea.' }] },
    correct: 'She likes tea.',
    wrong: 'Tea tea tea tea.',
  },
];

describe('key_verdict parity with calculateItemMastery', () => {
  const all = fixtures();

  it('covers every closed exercise type', () => {
    expect(CLOSED_EXERCISE_TYPES).toHaveLength(20);
    expect(all.map((f) => f.type).sort()).toEqual([...CLOSED_EXERCISE_TYPES].sort());
  });

  for (const f of all) {
    it(`${f.type}: correct answer is 'correct'`, () => {
      const mastery = calculateItemMastery(f.type, f.data, 0, f.correct, { 0: f.correct });
      expect(mastery).toBe(100);
      const ctx = buildClosedItemContext(f.type, f.data, 0, { 0: f.correct });
      expect(ctx).not.toBeNull();
      expect(ctx!.key_verdict).toBe('correct');
    });

    it(`${f.type}: incorrect answer is 'wrong'`, () => {
      const mastery = calculateItemMastery(f.type, f.data, 0, f.wrong, { 0: f.wrong });
      expect(mastery).toBe(0);
      const ctx = buildClosedItemContext(f.type, f.data, 0, { 0: f.wrong });
      expect(ctx).not.toBeNull();
      expect(ctx!.key_verdict).toBe('wrong');
    });
  }

  describe('typed cases the matcher accepts but exact match does not', () => {
    it('"do not" vs key "don\'t"', () => {
      const data = { sentences: [{ text: 'I ___ like it.', answer: "don't" }] };
      expect(buildClosedItemContext('fill-in-blanks', data, 0, { 0: 'do not' })!.key_verdict).toBe('correct');
    });

    it('"an" vs key "a / an"', () => {
      const data = { sentences: [{ text: 'She ate ___ apple.', answer: 'a / an' }] };
      expect(buildClosedItemContext('fill-in-blanks', data, 0, { 0: 'an' })!.key_verdict).toBe('correct');
    });

    it('error-correction key "This sentence is correct" with source sentence as answer', () => {
      const source = 'She goes to school every day.';
      const data = { sentences: [{ incorrect: source, answer: 'This sentence is correct' }] };
      expect(buildClosedItemContext('error-correction', data, 0, { 0: source })!.key_verdict).toBe('correct');
    });
  });

  it('review verdict mirrors a null mastery', () => {
    // Find a typed answer the matcher cannot decide; fall back to skipping if none is found.
    const data = { sentences: [{ text: 'I ___ home.', answer: 'went' }] };
    const candidates = ['wen', 'wennt', 'goed', 'wents', 'wend'];
    for (const c of candidates) {
      const m = calculateItemMastery('fill-in-blanks', data, 0, c, { 0: c });
      const v = buildClosedItemContext('fill-in-blanks', data, 0, { 0: c })!.key_verdict;
      expect(v).toBe(m === 100 ? 'correct' : m === 0 ? 'wrong' : 'review');
    }
  });
});

describe('extractor question text', () => {
  it('multiple-choice lists option texts without letters', () => {
    const ctx = buildClosedItemContext('multiple-choice', mcData, 0, { 0: 'drink' })!;
    expect(ctx.question_text).toContain('Options: drink; drinks');
    expect(ctx.question_text).not.toMatch(/\b[A-D][.)]\s/);
  });

  it('odd-one-out reads options', () => {
    const data = { questions: [{ options: ['cat', 'dog', 'table'], odd_word: 'table' }] };
    const ctx = buildClosedItemContext('odd-one-out', data, 0, { 0: 'cat' })!;
    expect(ctx.question_text).toContain('cat, dog, table');
  });

  it('odd-one-out falls back to words', () => {
    const data = { questions: [{ words: ['red', 'blue', 'chair'], odd_word: 'chair' }] };
    const ctx = buildClosedItemContext('odd-one-out', data, 0, { 0: 'red' })!;
    expect(ctx.question_text).toContain('red, blue, chair');
  });

  it('word-order reads scrambled_words', () => {
    const data = { sentences: [{ scrambled_words: 'tea / likes / She', correct_order: 'She likes tea.' }] };
    const ctx = buildClosedItemContext('word-order', data, 0, { 0: 'She likes tea.' })!;
    expect(ctx.question_text).toContain('tea / likes / She');
  });
});

describe('applyClosedKeyRules', () => {
  it('key correct overrides a low AI score to 1.0', () => {
    expect(applyClosedKeyRules({ aiScore: 0.1, exerciseType: 'fill-in-blanks', keyVerdict: 'correct' })).toEqual({
      qualityScore: 1.0,
      keyVerdict: 'correct',
    });
  });

  it('selection + wrong caps at 0.2', () => {
    const r = applyClosedKeyRules({ aiScore: 0.9, exerciseType: 'multiple-choice', student: 'a', key: 'b', keyVerdict: 'wrong' });
    expect(r.qualityScore).toBe(0.2);
    expect(r.keyVerdict).toBe('wrong');
  });

  it('selection + wrong keeps a lower AI score', () => {
    expect(
      applyClosedKeyRules({ aiScore: 0.05, exerciseType: 'true-false', student: 'True', key: 'False', keyVerdict: 'wrong' }).qualityScore,
    ).toBe(0.05);
  });

  it('typed + wrong leaves the AI score', () => {
    const r = applyClosedKeyRules({ aiScore: 0.9, exerciseType: 'fill-in-blanks', student: 'x', key: 'y', keyVerdict: 'wrong' });
    expect(r.qualityScore).toBe(0.9);
  });

  it('verdict review on selection leaves the AI score', () => {
    const r = applyClosedKeyRules({ aiScore: 0.8, exerciseType: 'odd-one-out', student: 'x', key: 'y', keyVerdict: 'review' });
    expect(r).toEqual({ qualityScore: 0.8, keyVerdict: 'review' });
  });

  it('no verdict + exact match => 1.0', () => {
    const r = applyClosedKeyRules({ aiScore: 0.3, exerciseType: 'multiple-choice', student: 'Drinks.', key: 'drinks' });
    expect(r.qualityScore).toBe(1.0);
  });

  it('no verdict + selection + mismatch => <= 0.2', () => {
    const r = applyClosedKeyRules({ aiScore: 0.9, exerciseType: 'categorize', student: 'Veg', key: 'Fruit' });
    expect(r.qualityScore).toBeLessThanOrEqual(0.2);
  });
});

describe('fallbackClosedEvaluation', () => {
  const base = { exercise_index: 0, question_index: 0 };

  it('correct', () => {
    const r = fallbackClosedEvaluation({ ...base, exercise_type: 'fill-in-blanks', key_verdict: 'correct' });
    expect(r).toMatchObject({ key_verdict: 'correct', quality_score: 1.0, is_acceptable: true });
  });

  it('selection wrong', () => {
    const r = fallbackClosedEvaluation({
      ...base,
      exercise_type: 'multiple-choice',
      student_answer: 'drink',
      suggested_answer: 'drinks',
      key_verdict: 'wrong',
    });
    expect(r).toMatchObject({ key_verdict: 'wrong', quality_score: 0, is_acceptable: false });
    expect(r.feedback).toContain('drinks');
  });

  it('typed wrong', () => {
    const r = fallbackClosedEvaluation({
      ...base,
      exercise_type: 'fill-in-blanks',
      student_answer: 'go',
      suggested_answer: 'went',
      key_verdict: 'wrong',
    });
    expect(r).toMatchObject({ key_verdict: 'wrong', quality_score: 0.2, is_acceptable: false });
    expect(r.feedback).toContain('went');
  });

  it('review', () => {
    const r = fallbackClosedEvaluation({
      ...base,
      exercise_type: 'fill-in-blanks',
      student_answer: 'wen',
      suggested_answer: 'went',
      key_verdict: 'review',
    });
    expect(r).toMatchObject({ key_verdict: 'review', is_acceptable: true });
    expect(r.quality_score).toBeGreaterThan(0.2);
    expect(r.quality_score).toBeLessThan(1);
  });
});

describe('hasRevealedAnswers', () => {
  it('closed row with ai_evaluation only => false', () => {
    expect(hasRevealedAnswers([{ exercise_type: 'multiple-choice', ai_evaluation: { x: 1 } }])).toBe(false);
  });
  it('open row with ai_evaluation => true', () => {
    expect(hasRevealedAnswers([{ exercise_type: 'answer-questions', ai_evaluation: { x: 1 } }])).toBe(true);
  });
  it('is_completed => true', () => {
    expect(hasRevealedAnswers([{ exercise_type: 'multiple-choice', is_completed: true }])).toBe(true);
  });
  it('null / empty => false', () => {
    expect(hasRevealedAnswers(null)).toBe(false);
    expect(hasRevealedAnswers(undefined)).toBe(false);
    expect(hasRevealedAnswers([])).toBe(false);
  });
});

describe('homework mastery formula', () => {
  it('3 correct + 1 unsure item => 100 (uncertain excluded)', () => {
    const data = {
      sentences: [
        { text: 'a ___', answer: 'went' },
        { text: 'b ___', answer: 'ate' },
        { text: 'c ___', answer: 'saw' },
        { text: 'd ___', answer: 'went' },
      ],
    };
    const answers: Record<number, string> = { 0: 'went', 1: 'ate', 2: 'saw', 3: 'wen' };
    // The fourth answer must be uncertain for this scenario to be meaningful.
    expect(calculateItemMastery('fill-in-blanks', data, 3, answers[3], answers)).toBeNull();
    expect(buildClosedItemContext('fill-in-blanks', data, 3, answers)!.key_verdict).toBe('review');
    expect(calculateOverallMastery('fill-in-blanks', data, answers)).toBe(100);
  });
});
