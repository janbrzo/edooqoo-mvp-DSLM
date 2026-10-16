import { isClosedExerciseType } from '@/utils/masteryCalculator';

interface AnswerRow {
  exercise_index?: number | null;
  is_completed?: boolean | null;
  ai_evaluation?: unknown;
  exercise_type?: string | null;
}

/**
 * Shared worksheet: correct answers are revealed once the student finished an exercise
 * or an open exercise got its AI evaluation. A closed exercise only carries an
 * `ai_evaluation` for the explanation, which must never unlock answers on its own.
 */
export const hasRevealedAnswers = (rows: AnswerRow[] | null | undefined): boolean =>
  !!rows?.some(
    (r) => !!r.is_completed || (!!r.ai_evaluation && !(r.exercise_type && isClosedExerciseType(r.exercise_type))),
  );

/**
 * Per-exercise reveal: the exercises whose answer key may be shown. An exercise is
 * revealed when the student finished it or when it is an open exercise that got its
 * AI evaluation; other exercises stay hidden, so seeing one key never unlocks the rest.
 */
export const revealedExerciseIndices = (rows: AnswerRow[] | null | undefined): number[] =>
  [...new Set(
    (rows ?? [])
      .filter((r) => typeof r.exercise_index === 'number' && hasRevealedAnswers([r]))
      .map((r) => r.exercise_index as number),
  )];

/** Exercises of an answer map that hold at least one non-empty answer. */
export const answeredExerciseIndices = (answers: Record<number, Record<string | number, unknown>> | null | undefined): number[] =>
  Object.entries(answers ?? {})
    .filter(([, a]) => Object.values(a ?? {}).some((v) => v !== null && v !== undefined && v !== ''))
    .map(([i]) => Number(i))
    .filter(Number.isFinite);
