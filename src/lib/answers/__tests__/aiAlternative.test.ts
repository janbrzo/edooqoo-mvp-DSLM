import { describe, it, expect } from 'vitest';
import {
  aiAlternativeMastery,
  calculateExerciseMastery,
  applyAiAlternatives,
  isSelectionType,
} from '../../../../supabase/functions/_shared/itemMastery';
import { isSelectionType as edgeIsSelectionType } from '../../../../supabase/functions/_shared/closedEvaluation';
import { calculateOverallMastery } from '@/utils/masteryCalculator';

describe('aiAlternativeMastery (decision D1)', () => {
  const accepted = { quality_score: 0.9, is_acceptable: true, key_verdict: 'wrong' };

  it('raises a typed answer the key marks wrong when the AI accepts it (boss -> manager)', () => {
    expect(aiAlternativeMastery('fill-in-blanks', 0, accepted)).toBe(90);
    expect(aiAlternativeMastery('gap-text', null, { ...accepted, key_verdict: 'review' })).toBe(90);
  });

  it('caps a raised answer below an exact key match', () => {
    expect(aiAlternativeMastery('fill-in-blanks', 0, { ...accepted, quality_score: 1 })).toBe(95);
  });

  it('never touches selection items', () => {
    for (const t of ['multiple-choice', 'true-false-audio', 'matching', 'categorize', 'odd-one-out']) {
      expect(aiAlternativeMastery(t, 0, accepted)).toBeNull();
    }
  });

  it('never lowers or replaces a key-correct answer', () => {
    expect(aiAlternativeMastery('fill-in-blanks', 100, { quality_score: 0.1, is_acceptable: false })).toBeNull();
    expect(aiAlternativeMastery('fill-in-blanks', 100, accepted)).toBeNull();
  });

  it('needs an explicit acceptance at 0.85 or more', () => {
    expect(aiAlternativeMastery('fill-in-blanks', 0, { quality_score: 0.84, is_acceptable: true })).toBeNull();
    expect(aiAlternativeMastery('fill-in-blanks', 0, { quality_score: 0.9, is_acceptable: false })).toBeNull();
    expect(aiAlternativeMastery('fill-in-blanks', 0, { quality_score: 0.9 })).toBeNull();
    expect(aiAlternativeMastery('fill-in-blanks', 0, null)).toBeNull();
    // the key-only fallback (review, 0.7) can never raise anything
    expect(aiAlternativeMastery('fill-in-blanks', null, { quality_score: 0.7, is_acceptable: true, key_verdict: 'review' })).toBeNull();
  });

  it('client and edge agree on selection types', () => {
    for (const t of ['multiple-choice-picture', 'fill-in-blanks', 'matching-halves', 'word-order']) {
      expect(edgeIsSelectionType(t)).toBe(isSelectionType(t));
    }
  });
});

describe('applyAiAlternatives', () => {
  const items = [
    { question_index: 0, name: 'a', mastery: 100, hasValue: true },
    { question_index: 1, name: 'b', mastery: 0, hasValue: true },
    { question_index: 1, name: 'b2', mastery: 0, hasValue: true },
    { question_index: 2, name: 'c', mastery: -1, hasValue: false },
  ];

  it('raises every rating of the question and recomputes the exercise mastery', () => {
    const r = applyAiAlternatives(items, { 1: 90 });
    expect(r.changed).toBe(true);
    expect(r.items.filter((i) => i.question_index === 1).every((i) => i.mastery === 90 && i.source === 'ai_alternative')).toBe(true);
    expect(r.mastery).toBe(100); // 2 of 2 scored questions now at >= 50
  });

  it('turns an uncertain (review) item into a scored one', () => {
    const r = applyAiAlternatives(items, { 2: 88 });
    expect(r.items.find((i) => i.question_index === 2)).toMatchObject({ mastery: 88, hasValue: true });
    expect(r.mastery).toBe(67); // q0 100, q1 0, q2 88
  });

  it('changes nothing without raised answers', () => {
    const r = applyAiAlternatives(items, {});
    expect(r.changed).toBe(false);
    expect(r.items).toEqual(items);
  });
});

describe('calculateOverallMastery overrides', () => {
  const exercise = { type: 'fill-in-blanks', sentences: [{ text: 'My ___ is nice.', answer: 'boss' }, { text: 'I ___ tea.', answer: 'like' }] };
  const answers = { 0: 'manager', 1: 'like' };

  it('is unchanged without overrides and counts a raised answer as correct', () => {
    expect(calculateOverallMastery('fill-in-blanks', exercise, answers)).toBe(50);
    expect(calculateOverallMastery('fill-in-blanks', exercise, answers, { 0: 90 })).toBe(100);
  });
});

describe('review fixes', () => {
  const accepted = { quality_score: 0.9, is_acceptable: true, key_verdict: 'wrong' };
  it('a single-letter pick in synonyms/antonyms is a selection, never raised', () => {
    expect(aiAlternativeMastery('synonyms-antonyms', 0, accepted, 'B')).toBeNull();
    expect(aiAlternativeMastery('synonyms-antonyms', 0, accepted, 'happy')).toBe(90);
  });

  it('a raise never lowers exercise mastery: mastery is over all items, not only rated ones', () => {
    const ex = { type: 'fill-in-blanks', sentences: [
      { text: 'a', answer: 'one' }, { text: 'b', answer: 'two' }, { text: 'c', answer: 'three' }, { text: 'd', answer: 'four' },
    ] };
    const answers = { 0: 'one', 1: 'two', 2: 'three', 3: 'quatre' };
    expect(calculateExerciseMastery('fill-in-blanks', ex, answers)).toBe(75);
    expect(calculateExerciseMastery('fill-in-blanks', ex, answers, { 3: 90 })).toBe(100);
  });
});
