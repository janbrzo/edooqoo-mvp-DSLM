import { describe, it, expect } from 'vitest';
import { calculateItemMastery, averageScoredMastery, applyAiAlternatives } from '../../../../supabase/functions/_shared/itemMastery';
import { calculateInitialMasteryForItem } from '@/utils/masteryCalculator';

describe('multi-blank gap-text (M13)', () => {
  const split = { sentences: [{ text: 'I ___ to the ___ every day.', answer: 'go / shop' }] };
  const unsplit = { sentences: [{ text: 'I ___ to the ___ every day.', answer: 'go shop' }] };

  it('fully answered behaves as before', () => {
    expect(calculateItemMastery('gap-text', split, 0, undefined, { '0_0': 'go', '0_1': 'shop' })).toBe(100);
    expect(calculateItemMastery('gap-text', split, 0, undefined, { '0_0': 'go', '0_1': 'bank' })).toBe(0);
  });

  it('any empty blank leaves the item unevaluated, not 0', () => {
    expect(calculateItemMastery('gap-text', split, 0, undefined, { '0_0': 'go' })).toBeNull();
    expect(calculateItemMastery('gap-text', split, 0, undefined, { '0_0': 'go', '0_1': '  ' })).toBeNull();
    expect(calculateItemMastery('gap-text', split, 0, undefined, { '0_0': '', '0_1': 'shop' })).toBeNull();
  });

  it('a key that cannot be split into one part per blank is unevaluated', () => {
    expect(calculateItemMastery('gap-text', unsplit, 0, undefined, { '0_0': 'go', '0_1': 'shop' })).toBeNull();
  });
});

describe('Mark done prefill: key review is unrated (M12)', () => {
  it('a typo-like answer the key cannot decide gets hasValue false, not 50', () => {
    const ex = { type: 'fill-in-blanks', sentences: [{ text: 'She ___ to work.', answer: 'organized' }] };
    expect(calculateItemMastery('fill-in-blanks', ex, 0, 'organised', { 0: 'organised' })).toBeNull();
    expect(calculateInitialMasteryForItem(0, { 0: 'organised' }, ex)).toEqual({ mastery: null, hasValue: false });
  });
});

describe('homework row mastery equals the mean of the final item evaluations', () => {
  it('includes ai_alternative raises (100 share vs 96 mean)', () => {
    const items = [100, 100, 100, 0, 0, 100, 0].map((m, i) => ({ question_index: i, mastery: m, hasValue: true }));
    const { items: raised } = applyAiAlternatives(items, { 3: 90, 4: 90, 6: 95 });
    expect(averageScoredMastery(raised)).toBe(96);
  });
});
