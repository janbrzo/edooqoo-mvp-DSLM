import { describe, it, expect } from 'vitest';
import {
  shouldSendClosedItemToAi, selectClosedItemsForAi,
} from '../../../../supabase/functions/_shared/closedEvaluation';
import {
  CLOSED_EXERCISE_TYPES, aiAlternativeMastery, calculateItemMastery, isSelectionType,
} from '../../../../supabase/functions/_shared/itemMastery';
import { buildClosedItemContext } from '../closedItemContext';
import { buildClosedAnswersToVerify, computeHomeworkWrite } from '../../../../supabase/functions/process-pending-ai-evaluations/homeworkEval';

describe('closed items sent to the model (decision D9)', () => {
  const table: Array<[string, string, string | undefined, unknown, boolean]> = [
    // type, verdict, unused, raw answer, expected
    ['fill-in-blanks', 'wrong', undefined, 'boss', true],
    ['fill-in-blanks', 'review', undefined, 'manger', true],
    ['gap-text', 'wrong', undefined, 'went', true],
    ['error-correction', 'review', undefined, 'He goes home.', true],
    ['word-order', 'wrong', undefined, 'I home go', true],
    ['complete-word', 'wrong', undefined, 'hapy', true],
    ['fill-in-blanks', 'correct', undefined, 'boss', false],
    ['gap-text', 'correct', undefined, 'went', false],
    ['multiple-choice', 'wrong', undefined, 'B', false],
    ['multiple-choice', 'correct', undefined, 'A', false],
    ['multiple-choice-audio', 'review', undefined, 'A', false],
    ['true-false', 'wrong', undefined, true, false],
    ['true-false-picture', 'correct', undefined, false, false],
    ['matching', 'wrong', undefined, 'C', false],
    ['categorize', 'wrong', undefined, 1, false],
    ['odd-one-out', 'wrong', undefined, 'cat', false],
    ['synonyms', 'wrong', undefined, 'B', false], // a single letter pick cannot be raised
    ['synonyms', 'wrong', undefined, 'big', true],
    ['matching-halves', 'wrong', undefined, 'B', false],
  ];

  it.each(table)('%s / key %s / answer %s -> sent: %s', (type, verdict, _x, raw, expected) => {
    expect(shouldSendClosedItemToAi({ exerciseType: type, keyVerdict: verdict, rawStudentAnswer: raw })).toBe(expected);
  });

  it('a missing verdict (old queue rows) is still sent for typed items', () => {
    expect(shouldSendClosedItemToAi({ exerciseType: 'fill-in-blanks', keyVerdict: undefined, rawStudentAnswer: 'xy' })).toBe(true);
    expect(shouldSendClosedItemToAi({ exerciseType: 'multiple-choice', keyVerdict: undefined, rawStudentAnswer: 'A' })).toBe(false);
  });

  it('selects the expected set from a mixed list, and Mark done (on demand) keeps all', () => {
    const items = [
      { question_index: 0, key_verdict: 'correct' },
      { question_index: 1, key_verdict: 'wrong' },
      { question_index: 2, key_verdict: 'review' },
      { question_index: 3, key_verdict: 'wrong' },
    ];
    const answers = { 0: 'a', 1: 'boss', 2: 'manger', 3: 'C' };
    expect(selectClosedItemsForAi('fill-in-blanks', items, answers).map((i) => i.question_index)).toEqual([1, 2]);
    expect(selectClosedItemsForAi('multiple-choice', items, answers)).toEqual([]);
    expect(selectClosedItemsForAi('fill-in-blanks', items, answers, { onDemand: true })).toHaveLength(4);
  });

  it('whatever the model answers, an item that is not sent can never be raised', () => {
    const responses = [0, 0.2, 0.7, 0.85, 0.9, 1].flatMap((q) =>
      [true, false].flatMap((ok) => ['correct', 'wrong', 'review', undefined].map((kv) => ({ quality_score: q, is_acceptable: ok, key_verdict: kv }))));
    const rawAnswers: unknown[] = ['boss', 'B', 'true', true, 1];
    for (const type of CLOSED_EXERCISE_TYPES) {
      for (const verdict of ['correct', 'wrong', 'review'] as const) {
        const keyMastery = verdict === 'correct' ? 100 : verdict === 'wrong' ? 0 : null;
        for (const raw of rawAnswers) {
          if (shouldSendClosedItemToAi({ exerciseType: type, keyVerdict: verdict, rawStudentAnswer: raw })) continue;
          for (const r of responses) {
            expect(aiAlternativeMastery(type, keyMastery, r, raw)).toBeNull();
          }
        }
      }
    }
  });

  it('a typed wrong item is still sent from a real exercise, a correct one and an MC one are not', () => {
    const ex = { sentences: [{ text: 'She ___ a boss.', answer: 'is', nano_skill: { name: 'g.a' } }, { text: 'He ___ home.', answer: 'went', nano_skill: { name: 'g.b' } }] };
    const answers = { 0: 'is', 1: 'goed' };
    const sent = buildClosedAnswersToVerify({ exercise_index: 0, exercise_type: 'fill-in-blanks' }, ex, answers);
    expect(sent.map((s) => [s.question_index, s.key_verdict])).toEqual([[0, 'correct'], [1, 'wrong']]);
    expect(selectClosedItemsForAi('fill-in-blanks', sent, answers).map((s) => s.question_index)).toEqual([1]);

    const mc = { questions: [{ question: 'q', options: [{ text: 'a', correct: true }, { text: 'b' }] }] };
    const ctx = buildClosedItemContext('multiple-choice', mc, 0, { 0: 'b' });
    expect(ctx?.key_verdict).toBe('wrong');
    expect(selectClosedItemsForAi('multiple-choice', [{ question_index: 0, ...ctx! }], { 0: 'b' })).toEqual([]);
  });

  it('stored result is identical with and without the skipped items (typed exercise)', () => {
    const ex = { sentences: [
      { text: 'She ___ a boss.', answer: 'is', nano_skill: { name: 'g.a' } },
      { text: 'He ___ home.', answer: 'went', nano_skill: { name: 'g.b' } },
      { text: 'My ___ is kind.', answer: 'boss', nano_skill: { name: 'g.c' } },
    ] };
    const answers: Record<string, unknown> = { 0: 'is', 1: 'goed', 2: 'manager' };
    const full = [
      { question_index: 0, quality_score: 1, is_acceptable: true, key_verdict: 'correct', feedback: 'ok' },
      { question_index: 1, quality_score: 0.1, is_acceptable: false, key_verdict: 'wrong', feedback: 'no' },
      { question_index: 2, quality_score: 0.9, is_acceptable: true, key_verdict: 'review', feedback: 'alt' },
    ];
    const sentOnly = full.filter((e) => e.question_index !== 0);
    const mk = (evaluations: any[]) => computeHomeworkWrite({
      exerciseType: 'fill-in-blanks', exercise: ex, answers, evaluations, transcribed: () => false,
    });
    const a = mk(full);
    const b = mk(sentOnly);
    expect(b.mastery).toBe(a.mastery);
    expect(b.item_evaluations).toEqual(a.item_evaluations);
    // no model call at all (every item key-correct) still yields the key mastery
    const none = mk([]);
    expect(none.mastery).toBe(33);
    expect(none.ai_evaluation.question_evaluations).toEqual([]);
    expect(isSelectionType('fill-in-blanks')).toBe(false);
  });
});
