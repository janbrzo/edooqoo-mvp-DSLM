import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import { findItemsToCheck } from '../reviewItems';
import { buildClosedItemEvaluations } from '../../../../supabase/functions/_shared/closedRatings';
import { calculateItemMastery } from '@/utils/masteryCalculator';

const wordOrder = {
  type: 'word-order',
  sentences: [
    { scrambled: ['is', 'she', 'a', 'boss'], correct_order: 'She is a boss', nano_skill: { name: 'grammar.word_order.a' } },
    { scrambled: ['went', 'he', 'home'], correct_order: 'He went home', nano_skill: { name: 'grammar.word_order.b' } },
  ],
};

describe('findItemsToCheck', () => {
  it('lists the questions the key left unrated and skips the decided ones', () => {
    const answers = { 0: 'She is a boss', 1: 'Home went he' };
    const evals = buildClosedItemEvaluations('word-order', wordOrder, answers)!;
    const undecided = evals.filter((e) => e.hasValue === false).map((e) => e.question_index);
    const items = findItemsToCheck('word-order', wordOrder, answers, evals);
    expect(undecided.length).toBeGreaterThan(0);
    expect(items.map((i) => i.questionIndex)).toEqual(undecided);
    for (const i of items) expect(i.studentAnswer).not.toBe('');
  });

  it('skips questions the teacher already rated', () => {
    const rated = [{ question_index: 1, mastery: 0, hasValue: true, source: 'teacher' }];
    expect(findItemsToCheck('word-order', wordOrder, { 1: 'x' }, rated)).toEqual([]);
  });

  it('ignores open exercises and missing ratings', () => {
    expect(findItemsToCheck('reading', {}, {}, [{ question_index: 0, hasValue: false, mastery: -1 }])).toEqual([]);
    expect(findItemsToCheck('word-order', wordOrder, {}, null)).toEqual([]);
  });

  it('is consistent with the key verdict used for the ratings', () => {
    expect(calculateItemMastery('word-order', wordOrder, 0, 'She is a boss', { 0: 'She is a boss' })).toBe(100);
  });
});
