import { describe, it, expect } from 'vitest';
import { calculateInitialMasteryForItem, calculateItemMastery } from '@/utils/masteryCalculator';

describe('Mark done prefill (D2): same key verdict as the student pipeline, 0-100 scale', () => {
  const fib = {
    type: 'fill-in-blanks',
    sentences: [{ text: 'She ___ to work.', answer: 'goes' }, { text: 'They ___ tea.', answer: 'drink' }],
  };

  it('closed correct -> 100, wrong -> 0 (not the old 80/30)', () => {
    expect(calculateInitialMasteryForItem(0, { 0: 'goes' }, fib)).toEqual({ mastery: 100, hasValue: true });
    expect(calculateInitialMasteryForItem(1, { 1: 'eat' }, fib)).toEqual({ mastery: 0, hasValue: true });
  });

  it('no answer -> no value', () => {
    expect(calculateInitialMasteryForItem(1, { 0: 'goes' }, fib)).toEqual({ mastery: null, hasValue: false });
  });

  it('AI evaluation wins when present', () => {
    expect(calculateInitialMasteryForItem(0, { 0: 'x' }, { type: 'discussion' }, { 0: 72 })).toEqual({ mastery: 72, hasValue: true });
  });

  it('open item without AI evaluation starts neutral', () => {
    expect(calculateInitialMasteryForItem(0, { 0: 'I think so' }, { type: 'discussion' })).toEqual({ mastery: 50, hasValue: true });
  });

  it('matching-halves uses the seed the student screen uses (matches calculateItemMastery)', () => {
    const ex = {
      type: 'matching-halves',
      worksheetId: 'w1',
      sentence_halves: [
        { first_half: 'If it rains', second_half: 'we stay in' },
        { first_half: 'When I was young', second_half: 'I lived in Rome' },
        { first_half: 'She said', second_half: 'she was tired' },
      ],
    };
    for (const letter of ['A', 'B', 'C']) {
      const expected = calculateItemMastery('matching-halves', ex, 1, letter, { 1: letter });
      expect(calculateInitialMasteryForItem(1, { 1: letter }, ex).mastery).toBe(expected);
    }
  });
});
