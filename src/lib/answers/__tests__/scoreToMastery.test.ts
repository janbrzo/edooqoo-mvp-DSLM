import { describe, it, expect } from 'vitest';
import { scoreToMastery, averageScoredMastery } from '../../../../supabase/functions/_shared/itemMastery';

describe('scoreToMastery', () => {
  it('keeps a real zero as 0 (non-answers must not become 70)', () => {
    expect(scoreToMastery(0)).toBe(0);
    expect(scoreToMastery('0')).toBe(0);
  });

  it('maps 0..1 scores to 0..100 and clamps out-of-range values', () => {
    expect(scoreToMastery(0.85)).toBe(85);
    expect(scoreToMastery(1)).toBe(100);
    expect(scoreToMastery(1.4)).toBe(100);
    expect(scoreToMastery(-0.2)).toBe(0);
  });

  it('returns -1 (unevaluated) for missing or invalid scores instead of a default', () => {
    for (const v of [undefined, null, '', '  ', 'abc', NaN, Infinity, {}, []]) {
      expect(scoreToMastery(v)).toBe(-1);
    }
  });
});

describe('averageScoredMastery', () => {
  it('ignores -1 placeholders and hasValue=false items', () => {
    expect(averageScoredMastery([
      { mastery: 90, hasValue: true },
      { mastery: -1, hasValue: false },
    ])).toBe(90);
    expect(averageScoredMastery([
      { mastery: 65 }, { mastery: 80 }, { mastery: -1 }, { mastery: -1 },
    ])).toBe(73);
  });

  it('counts a real 0', () => {
    expect(averageScoredMastery([{ mastery: 0, hasValue: true }, { mastery: 100, hasValue: true }])).toBe(50);
  });

  it('returns null when nothing was scored', () => {
    expect(averageScoredMastery([])).toBeNull();
    expect(averageScoredMastery([{ mastery: -1, hasValue: false }])).toBeNull();
  });
});
