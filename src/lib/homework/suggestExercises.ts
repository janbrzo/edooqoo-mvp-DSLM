/**
 * Exercises worth giving as homework after a lesson: the ones the student did not do in class
 * and the ones that went badly. The teacher only confirms, which keeps the 1-minute prep.
 */
export interface ClassAnswerRow {
  exercise_index: number;
  mastery?: number | null;
  answers?: unknown;
}

/** Below this exercise mastery (0-100) an exercise counts as weak in class. */
export const WEAK_IN_CLASS_BELOW = 70;

const hasAnswers = (answers: unknown): boolean =>
  !!answers && typeof answers === 'object' && Object.keys(answers as object).some((k) => !k.startsWith('_'));

/**
 * @param originalIndices worksheet index of each assignable exercise (deleted ones are skipped),
 *   in the order the modal lists them
 * @returns positions in that list to preselect, or [] when the student did nothing in class
 *   (no signal: the teacher picks, nothing is guessed)
 */
export function suggestHomeworkExercises(
  originalIndices: readonly number[],
  rows: readonly ClassAnswerRow[],
): number[] {
  const byIndex = new Map<number, ClassAnswerRow>();
  for (const r of rows) if (hasAnswers(r.answers)) byIndex.set(r.exercise_index, r);
  if (byIndex.size === 0) return [];
  const out: number[] = [];
  originalIndices.forEach((original, position) => {
    const row = byIndex.get(original);
    if (!row) { out.push(position); return; }
    if (typeof row.mastery === 'number' && row.mastery < WEAK_IN_CLASS_BELOW) out.push(position);
  });
  return out;
}
