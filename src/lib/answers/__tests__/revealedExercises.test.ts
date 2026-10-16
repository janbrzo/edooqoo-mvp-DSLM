import { describe, it, expect } from 'vitest';
import { revealedExerciseIndices, answeredExerciseIndices } from '../revealState';

describe('per-exercise reveal of the answer key', () => {
  it('reveals a finished exercise and an evaluated open exercise, nothing else', () => {
    const rows = [
      { exercise_index: 0, is_completed: true, exercise_type: 'multiple-choice' },
      { exercise_index: 1, ai_evaluation: { items: [] }, exercise_type: 'reading' },
      { exercise_index: 2, ai_evaluation: { explanation: 'x' }, exercise_type: 'multiple-choice' }, // explanation only
      { exercise_index: 3, exercise_type: 'true-false' },
    ];
    expect(revealedExerciseIndices(rows).sort()).toEqual([0, 1]);
  });

  it('seeing one key never reveals an untouched exercise', () => {
    const rows = [{ exercise_index: 4, ai_evaluation: { items: [] }, exercise_type: 'discussion' }];
    expect(revealedExerciseIndices(rows)).toEqual([4]);
    expect(revealedExerciseIndices(rows)).not.toContain(5);
  });

  it('ignores rows without an exercise index and tolerates empty input', () => {
    expect(revealedExerciseIndices([{ is_completed: true }])).toEqual([]);
    expect(revealedExerciseIndices(null)).toEqual([]);
  });

  it('the 10-minute timer reveals only exercises the student answered', () => {
    expect(
      answeredExerciseIndices({ 0: { 0: 'a' }, 1: { 0: '' }, 2: {}, 3: { '1_0': 'x' } }).sort(),
    ).toEqual([0, 3]);
    expect(answeredExerciseIndices(null)).toEqual([]);
  });
});
