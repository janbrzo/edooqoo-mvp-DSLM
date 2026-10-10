import { describe, it, expect } from 'vitest';
import { buildClosedItemContext } from '../closedItemContext';
import { buildAnswersToVerify } from '@/utils/audioEvalUtils';

describe('buildClosedItemContext', () => {
  it('multiple choice: options listed, key as ground truth', () => {
    const data = { questions: [{ text: 'She ___ tea.', options: [{ text: 'drink' }, { text: 'drinks', correct: true }] }] };
    const ctx = buildClosedItemContext('multiple-choice', data, 0, { 0: 'drink' })!;
    expect(ctx.question_text).toContain('Options: drink; drinks');
    expect(ctx.student_answer).toBe('drink');
    expect(ctx.suggested_answer).toBe('drinks');
  });

  it('true/false maps booleans', () => {
    const ctx = buildClosedItemContext('true-false', { statements: [{ text: 'Sky is green', isTrue: false }] }, 0, { 0: true })!;
    expect(ctx).toMatchObject({ student_answer: 'True', suggested_answer: 'False' });
  });

  it('fill-in-blanks uses sentence.answer', () => {
    const ctx = buildClosedItemContext('fill-in-blanks', { sentences: [{ text: 'I ___ home.', answer: 'went' }] }, 0, { 0: 'go' })!;
    expect(ctx.suggested_answer).toBe('went');
  });

  it('multi-blank gap text joins composite keys', () => {
    const data = { sentences: [{ text: 'I ___ and ___.', answer: 'ran / jumped' }] };
    const ctx = buildClosedItemContext('gap-text', data, 0, { '0_0': 'ran', '0_1': 'hop' })!;
    expect(ctx.student_answer).toBe('ran / hop');
  });

  it('categorize resolves category index to name', () => {
    const data = { categories: [{ name: 'Fruit', correct_items: ['apple'] }, { name: 'Veg', correct_items: ['leek'] }], items: ['apple'] };
    const ctx = buildClosedItemContext('categorize', data, 0, { 0: 1 })!;
    expect(ctx).toMatchObject({ student_answer: 'Veg', suggested_answer: 'Fruit' });
  });

  it('returns null without answer or key', () => {
    expect(buildClosedItemContext('true-false', { statements: [{ text: 'x' }] }, 0, { 0: true })).toBeNull();
    expect(buildClosedItemContext('odd-one-out', { questions: [{ odd_word: 'cat' }] }, 0, {})).toBeNull();
  });
});

describe('buildAnswersToVerify', () => {
  it('closed type emits ground-truth payload', () => {
    const out = buildAnswersToVerify({
      savedAnswer: { exercise_index: 2, exercise_type: 'true-false', answers: { 0: false, 1: true } },
      exerciseData: { statements: [{ text: 'A', isTrue: false }, { text: 'B', isTrue: false }] },
      audioAnswers: {},
      transcriptionCache: {},
    });
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ exercise_index: 2, question_index: 1, suggested_answer: 'False' });
  });

  it('open type unchanged', () => {
    const out = buildAnswersToVerify({
      savedAnswer: { exercise_index: 0, exercise_type: 'answer-questions', answers: { 0: 'Yes' } },
      exerciseData: { questions: [{ question: 'Do you?' }] },
      audioAnswers: {},
      transcriptionCache: {},
    });
    expect(out[0]).toMatchObject({ question_text: 'Do you?', student_answer: 'Yes' });
  });
});

import { shuffleArrayWithSeed as sharedShuffle } from '../closedItemContext';
import { shuffleArrayWithSeed as clientShuffle } from '@/utils/masteryCalculator';

describe('shared shuffle parity', () => {
  it('Edge copy matches masteryCalculator shuffle', () => {
    for (const seed of ['a|b|c', 'syn-x|y', 'longer seed with spaces', '']) {
      const arr = Array.from({ length: 9 }, (_, i) => i);
      expect(sharedShuffle(arr, seed)).toEqual(clientShuffle(arr, seed));
    }
  });
});
