import { isClosedExerciseType } from '@/utils/masteryCalculator';

interface AnswerRow {
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
