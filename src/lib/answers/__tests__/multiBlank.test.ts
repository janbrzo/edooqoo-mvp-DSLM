import { describe, it, expect } from 'vitest';
import { calculateItemMastery } from '../../../../supabase/functions/_shared/itemMastery';
import { buildClosedItemContext } from '../../../../supabase/functions/_shared/closedItemContext';
import { calculateInitialMasteryForItem } from '@/utils/masteryCalculator';

/**
 * Fill-in-blanks sentences with several blanks used to share ONE answer slot:
 * typing "am" and "new" stored only "new", and one word scored 100 on every blank
 * (audit 2026-10, L1-7). Each blank now has its own key `${sentence}_${blank}`.
 */
const exercise = {
  type: 'fill-in-blanks',
  word_bank: ['am', 'new', 'is', 'team'],
  sentences: [
    { text: 'I ___ a ___ member.', answer: 'am / new' },
    { text: 'She ___ my friend.', answer: 'is' },
    { text: 'We ___ the ___ tomorrow.', answer: 'discuss / agenda' },
  ],
};

describe('fill-in-blanks with several blanks', () => {
  it('scores each blank on its own: share of correct blanks', () => {
    expect(calculateItemMastery('fill-in-blanks', exercise, 0, undefined, { '0_0': 'am', '0_1': 'new' })).toBe(100);
    expect(calculateItemMastery('fill-in-blanks', exercise, 0, undefined, { '0_0': 'am', '0_1': 'old' })).toBe(50);
    expect(calculateItemMastery('fill-in-blanks', exercise, 0, undefined, { '0_0': 'is', '0_1': 'old' })).toBe(0);
  });

  it('an empty blank counts as wrong, an uncertain blank is left out', () => {
    expect(calculateItemMastery('fill-in-blanks', exercise, 0, undefined, { '0_0': 'am', '0_1': '' })).toBe(50);
    // a near-miss typo is "review", never counted as wrong
    expect(calculateItemMastery('fill-in-blanks', exercise, 2, undefined, { '2_0': 'discuss', '2_1': 'agneda' })).toBe(100);
  });

  it('one word typed into only the first blank no longer scores 100', () => {
    expect(calculateItemMastery('fill-in-blanks', exercise, 0, undefined, { '0_0': 'new' })).toBe(0);
  });

  it('single-blank sentences keep the plain key', () => {
    expect(calculateItemMastery('fill-in-blanks', exercise, 1, 'is', { 1: 'is' })).toBe(100);
    expect(calculateItemMastery('fill-in-blanks', exercise, 1, 'was', { 1: 'was' })).toBe(0);
  });

  it('a single string saved before blanks had their own keys is left unscored, not 100', () => {
    expect(calculateItemMastery('fill-in-blanks', exercise, 0, 'new', { 0: 'new' })).toBeNull();
  });

  it('prefills the Mark done modal from the blank-by-blank answers', () => {
    const res = calculateInitialMasteryForItem(0, { '0_0': 'am', '0_1': 'new' } as any, exercise);
    expect(res).toEqual({ mastery: 100, hasValue: true });
  });

  it('gives the AI the answers in order with the full key', () => {
    const ctx = buildClosedItemContext('fill-in-blanks', exercise, 0, { '0_0': 'am', '0_1': 'old' });
    expect(ctx?.student_answer).toBe('am / old');
    expect(ctx?.suggested_answer).toBe('am / new');
    expect(ctx?.key_verdict).toBe('review');
  });
});
