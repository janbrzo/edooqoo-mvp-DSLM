import { describe, it, expect } from 'vitest';
import { normalizeExerciseShape } from '../normalizeExercise';
import { calculateItemMastery } from '../../../../supabase/functions/_shared/itemMastery';
import { buildClosedItemContext } from '../../../../supabase/functions/_shared/closedItemContext';

const canonical = {
  type: 'matching',
  title: 'Match',
  items: [
    { term: 'deadline', definition: 'the latest time to finish', nano_skill: 'vocab_a' },
    { term: 'agenda', definition: 'a list of topics for a meeting', nano_skill: 'vocab_b' },
    { term: 'invoice', definition: 'a bill for goods or services', nano_skill: 'vocab_c' },
  ],
};

// Shape seen in production (worksheet 118a3ec2): terms in items, definitions in `matches`.
const drifted = {
  type: 'matching',
  title: 'Match',
  items: [{ term: 'deadline' }, { term: 'agenda' }, { term: 'invoice' }],
  matches: canonical.items.map((i) => ({ ...i })).reverse(),
};

describe('normalizeExerciseShape: matching with a separate `matches` list', () => {
  it('merges definitions into items by term, not by position', () => {
    const out = normalizeExerciseShape(drifted);
    expect(out.items.map((i: any) => [i.term, i.definition])).toEqual(
      canonical.items.map((i) => [i.term, i.definition]),
    );
    expect((out.items[0] as { nano_skill?: string }).nano_skill).toBe('vocab_a');
  });

  it('falls back to position when terms differ only by wording', () => {
    const out = normalizeExerciseShape({
      type: 'matching',
      items: [{ term: 'A' }, { term: 'B' }],
      matches: [{ term: 'x', definition: 'first' }, { term: 'y', definition: 'second' }],
    });
    expect(out.items.map((i: any) => i.definition)).toEqual(['first', 'second']);
  });

  it('keeps definitions that already exist', () => {
    const out = normalizeExerciseShape({ ...canonical, matches: [{ term: 'deadline', definition: 'other' }] });
    expect(out.items[0].definition).toBe('the latest time to finish');
  });

  it('does not touch exercises without a matches list', () => {
    const out = normalizeExerciseShape(canonical);
    expect(out.items.map((i: any) => i.definition)).toEqual(canonical.items.map((i) => i.definition));
  });
});

describe('scorers read the same shape the student sees', () => {
  it.each(['A', 'B', 'C'])('calculateItemMastery agrees for canonical and drifted matching (answer %s)', (letter) => {
    const answers = { 0: letter, 1: letter, 2: letter };
    for (let i = 0; i < 3; i++) {
      expect(calculateItemMastery('matching', drifted, i, letter, answers)).toBe(
        calculateItemMastery('matching', canonical, i, letter, answers),
      );
    }
  });

  it('builds the answer key context for the drifted shape', () => {
    const ctx = buildClosedItemContext('matching', drifted, 0, { 0: 'A' });
    const ref = buildClosedItemContext('matching', canonical, 0, { 0: 'A' });
    expect(ctx).not.toBeNull();
    expect(ctx).toEqual(ref);
  });
});
