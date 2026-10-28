/**
 * Closed homework items the answer key could not decide ("review": word order, uncertain typed
 * answers). Their skill ratings are stored unrated, so neither the DSLM nor the exercise mastery
 * counts them until the teacher marks the question correct or incorrect on the review page
 * (`set_homework_item_verdict`).
 */
import { supabase } from '@/integrations/supabase/client';
import { buildClosedItemContext } from '@/lib/answers/closedItemContext';
import { isClosedExerciseType } from '@/utils/masteryCalculator';

export interface StoredItemRating {
  question_index: number;
  mastery?: number;
  hasValue?: boolean;
  source?: string;
}

export interface ItemToCheck {
  questionIndex: number;
  questionText: string;
  studentAnswer: string;
  expectedAnswer: string;
}

const isUnrated = (r: StoredItemRating): boolean =>
  r.hasValue === false || typeof r.mastery !== 'number' || r.mastery < 0;

/** Questions of one closed exercise whose every stored rating is unrated, with what the teacher needs to decide. */
export function findItemsToCheck(
  exerciseType: string,
  exercise: unknown,
  answers: Record<string | number, unknown>,
  itemEvaluations: ReadonlyArray<StoredItemRating> | null | undefined,
): ItemToCheck[] {
  if (!isClosedExerciseType(exerciseType) || !Array.isArray(itemEvaluations)) return [];
  const byQuestion = new Map<number, StoredItemRating[]>();
  for (const r of itemEvaluations) {
    if (typeof r?.question_index !== 'number') continue;
    byQuestion.set(r.question_index, [...(byQuestion.get(r.question_index) ?? []), r]);
  }
  const out: ItemToCheck[] = [];
  for (const [questionIndex, ratings] of [...byQuestion.entries()].sort((a, b) => a[0] - b[0])) {
    if (!ratings.every(isUnrated)) continue;
    const ctx = buildClosedItemContext(exerciseType, exercise, questionIndex, answers as Record<string | number, any>);
    if (!ctx) continue;
    out.push({
      questionIndex,
      questionText: ctx.question_text,
      studentAnswer: ctx.student_answer,
      expectedAnswer: ctx.suggested_answer,
    });
  }
  return out;
}

export interface ItemVerdictResult {
  success: boolean;
  error?: string;
  mastery?: number | null;
  item_evaluations?: StoredItemRating[];
}

/** Marks one question correct or incorrect (owner teacher only; the server rewrites its ratings and the exercise mastery). */
export async function setHomeworkItemVerdict(
  homeworkId: string, exerciseIndex: number, questionIndex: number, correct: boolean,
): Promise<ItemVerdictResult> {
  const { data, error } = await supabase.rpc('set_homework_item_verdict', {
    p_homework_id: homeworkId,
    p_exercise_index: exerciseIndex,
    p_question_index: questionIndex,
    p_correct: correct,
  });
  if (error) throw error;
  return data as unknown as ItemVerdictResult;
}
