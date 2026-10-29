import { describe, it, expect } from 'vitest';
import { suggestHomeworkExercises } from '../suggestExercises';

describe('suggestHomeworkExercises', () => {
  const originals = [0, 1, 3, 4]; // worksheet index 2 was deleted

  it('preselects exercises not done in class and the weak ones', () => {
    const rows = [
      { exercise_index: 0, mastery: 90, answers: { 0: 'a' } },
      { exercise_index: 1, mastery: 40, answers: { 0: 'a' } },
      { exercise_index: 3, mastery: null, answers: { 0: 'a' } },
    ];
    // position 1 (worksheet 1) is weak, position 3 (worksheet 4) was not done; worksheet 3 has no score yet
    expect(suggestHomeworkExercises(originals, rows)).toEqual([1, 3]);
  });

  it('guesses nothing when the student did nothing in class', () => {
    expect(suggestHomeworkExercises(originals, [])).toEqual([]);
    expect(suggestHomeworkExercises(originals, [{ exercise_index: 0, mastery: 10, answers: {} }])).toEqual([]);
  });

  it('ignores internal keys when deciding whether an exercise was done', () => {
    expect(suggestHomeworkExercises([0, 1], [
      { exercise_index: 0, mastery: 100, answers: { 0: 'x' } },
      { exercise_index: 1, mastery: 0, answers: { _transcription_0: 'only internal' } },
    ])).toEqual([1]);
  });
});
