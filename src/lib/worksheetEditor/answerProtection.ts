/**
 * Protection for editing worksheets that already have student answers.
 *
 * Student answers (`worksheet_student_answers`) and the DSLM events built from
 * them are keyed by position: `exercise_index` (index in the stored exercises
 * array, soft-deleted ones included) plus `exercise_type`. Swapping two
 * exercises, or replacing one, silently attaches the answers to different
 * content. Deleting (soft) and appending are safe and are never blocked.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- exercises are untyped JSON */

export type AnsweredIndexes = ReadonlySet<number>;

export const MOVE_BLOCKED_REASON =
  'Students have already answered this exercise. Moving it would attach their answers to a different exercise.';

export const SUBSTANTIAL_EDIT_WARNING =
  'Students have already answered this exercise. Changing its questions or answer key does not update their saved answers, so existing answers and scores may no longer match the new content.';

export const REGENERATE_WARNING =
  'Students have already answered this exercise. The new exercise replaces the old one, but their saved answers and scores stay attached to this position and will not match the new content.';

/** Fields that never change what a student answered. */
const PRESENTATION_FIELDS = new Set([
  'title',
  'instructions',
  'teacher_tip',
  'time',
  'estimated_time',
  'icon',
]);

/** True when `next` changes more than presentation text compared to `prev`. */
export function isSubstantialExerciseEdit(prev: any, next: any): boolean {
  if (!prev || !next || prev === next) return false;
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    if (PRESENTATION_FIELDS.has(key)) continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) return true;
  }
  return false;
}

/**
 * Display rank used by the owner view: exercises with a picture first, then
 * audio ones, then the rest (stable inside a rank).
 */
export function displayRank(exercise: any): number {
  const isPicture = Boolean(exercise?.type?.includes('-picture') || exercise?.image_url || exercise?.media_url);
  const isAudio = Boolean(exercise?.type?.includes('-audio') || exercise?.type === 'listening-comprehension');
  return (isPicture ? 0 : 2) + (isAudio ? 0 : 1);
}

/** Active exercises in the order the teacher sees them. */
export function sortForDisplay<T>(activeExercises: T[]): T[] {
  return activeExercises
    .map((exercise, order) => ({ exercise, order, rank: displayRank(exercise) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map((entry) => entry.exercise);
}

export interface MovePlan {
  /** Raw indices (in the stored exercises array) whose slots are swapped. */
  rawIndexA: number;
  rawIndexB: number;
}

/**
 * Plans a move on the displayed order: the neighbour is the next visible
 * exercise, not the next raw array element. Returns null when there is no
 * neighbour or it sits in another display group (the view would not change).
 */
export function planDisplayedMove(exercises: any[], rawIndex: number, direction: -1 | 1): MovePlan | null {
  const active = exercises.filter((exercise) => !exercise?.deleted);
  const displayed = sortForDisplay(active);
  const current = exercises[rawIndex];
  const position = displayed.indexOf(current);
  if (position < 0) return null;

  const neighbour = displayed[position + direction];
  if (!neighbour || displayRank(neighbour) !== displayRank(current)) return null;

  const neighbourRaw = exercises.indexOf(neighbour);
  if (neighbourRaw < 0) return null;
  return { rawIndexA: rawIndex, rawIndexB: neighbourRaw };
}

/** True when moving would change the position of an exercise that has answers. */
export function isMoveBlockedByAnswers(answered: AnsweredIndexes | undefined, plan: MovePlan): boolean {
  if (!answered || answered.size === 0) return false;
  return answered.has(plan.rawIndexA) || answered.has(plan.rawIndexB);
}

/** Swaps two exercise slots without mutating the input. */
export function swapExercises<T>(exercises: T[], plan: MovePlan): T[] {
  const next = [...exercises];
  [next[plan.rawIndexA], next[plan.rawIndexB]] = [next[plan.rawIndexB], next[plan.rawIndexA]];
  return next;
}

/**
 * Indices that have a stored answer row (answers, audio, teacher ratings or AI
 * evaluation): any row keyed to the exercise counts, to stay on the safe side.
 */
export function answeredIndexesFromRows(rows: Array<{ exercise_index?: unknown }> | null | undefined): Set<number> {
  const indexes = new Set<number>();
  for (const row of rows ?? []) {
    if (typeof row.exercise_index === 'number') indexes.add(row.exercise_index);
  }
  return indexes;
}
