import { describe, it, expect } from 'vitest';
import {
  answeredIndexesFromRows,
  displayRank,
  isMoveBlockedByAnswers,
  isSubstantialExerciseEdit,
  planDisplayedMove,
  sortForDisplay,
  swapExercises,
} from '../answerProtection';

const ex = (type: string, extra: Record<string, unknown> = {}) => ({ type, title: type, ...extra });

describe('displayed order', () => {
  it('ranks picture, then audio, then the rest, stable inside a rank', () => {
    const list = [ex('reading'), ex('describe-picture'), ex('matching'), ex('listening-comprehension'), ex('true-false-picture')];
    expect(sortForDisplay(list).map((e) => e.type)).toEqual([
      'describe-picture',
      'true-false-picture',
      'listening-comprehension',
      'reading',
      'matching',
    ]);
    expect(displayRank(ex('reading'))).toBeGreaterThan(displayRank(ex('x-audio')));
  });
});

describe('planDisplayedMove', () => {
  // raw order: 0 reading, 1 deleted, 2 picture, 3 matching, 4 gap-text
  const raw = [ex('reading'), ex('dialogue', { deleted: true }), ex('describe-picture'), ex('matching'), ex('gap-text')];

  it('moves relative to the visible neighbour, skipping soft-deleted slots', () => {
    // displayed: picture(2), reading(0), matching(3), gap-text(4); matching up -> swaps with reading
    expect(planDisplayedMove(raw, 3, -1)).toEqual({ rawIndexA: 3, rawIndexB: 0 });
    expect(planDisplayedMove(raw, 0, 1)).toEqual({ rawIndexA: 0, rawIndexB: 3 });
  });

  it('refuses a move across display groups and past the ends', () => {
    expect(planDisplayedMove(raw, 0, -1)).toBeNull(); // picture group above
    expect(planDisplayedMove(raw, 2, -1)).toBeNull();
    expect(planDisplayedMove(raw, 4, 1)).toBeNull();
  });

  it('swapExercises does not mutate', () => {
    const swapped = swapExercises(raw, { rawIndexA: 3, rawIndexB: 0 });
    expect(swapped[0].type).toBe('matching');
    expect(raw[0].type).toBe('reading');
  });
});

describe('isMoveBlockedByAnswers', () => {
  const plan = { rawIndexA: 3, rawIndexB: 0 };

  it('blocks when either swapped exercise has answers', () => {
    expect(isMoveBlockedByAnswers(new Set([0]), plan)).toBe(true);
    expect(isMoveBlockedByAnswers(new Set([3]), plan)).toBe(true);
  });

  it('allows the move when the answers belong to other exercises or there are none', () => {
    expect(isMoveBlockedByAnswers(new Set([4]), plan)).toBe(false);
    expect(isMoveBlockedByAnswers(new Set(), plan)).toBe(false);
    expect(isMoveBlockedByAnswers(undefined, plan)).toBe(false);
  });
});

describe('isSubstantialExerciseEdit', () => {
  const before = { type: 'fill-in-blanks', title: 'T', instructions: 'I', teacher_tip: 'tip', items: [{ text: 'a', answer: 'x' }] };

  it('treats presentation text as non-substantial', () => {
    expect(isSubstantialExerciseEdit(before, { ...before, title: 'New', instructions: 'New', teacher_tip: 'New' })).toBe(false);
  });

  it('treats questions, items and answer keys as substantial', () => {
    expect(isSubstantialExerciseEdit(before, { ...before, items: [{ text: 'a', answer: 'y' }] })).toBe(true);
    expect(isSubstantialExerciseEdit(before, { ...before, type: 'matching' })).toBe(true);
  });

  it('ignores identical or missing exercises', () => {
    expect(isSubstantialExerciseEdit(before, before)).toBe(false);
    expect(isSubstantialExerciseEdit(undefined, before)).toBe(false);
  });
});

describe('answeredIndexesFromRows', () => {
  it('collects every keyed row and ignores malformed ones', () => {
    expect(answeredIndexesFromRows([{ exercise_index: 2 }, { exercise_index: 5 }, { exercise_index: 'x' }, {}])).toEqual(new Set([2, 5]));
    expect(answeredIndexesFromRows(null)).toEqual(new Set());
  });
});
