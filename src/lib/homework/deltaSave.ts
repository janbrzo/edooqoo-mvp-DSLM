/**
 * What a homework autosave sends for one exercise: only the answer keys and
 * recordings changed since the last confirmed save, and the DSLM ratings of the
 * questions those keys belong to. The server merges by key (save_homework_answer),
 * so a stale tab or a blur without edits can no longer replace a newer exercise
 * snapshot with an older one.
 */
import { buildItemEvaluations, calculateOverallMastery, type ItemEvaluation } from '@/utils/masteryCalculator';
import { questionIndexOfKey } from '@/lib/answers/answerKeys';
import type { AiEvaluation } from '@/components/homework/AiEvaluationBadge';

export interface HomeworkDeltaInput {
  exerciseData: any;
  exerciseType: string;
  /** Full local answer map of the exercise (used to read the dirty keys and rate their questions). */
  answers: Record<string, any>;
  /** Full local recordings of the exercise by question index. */
  audio: Record<number, string>;
  dirtyKeys: Iterable<string>;
  dirtyAudio: Iterable<number>;
}

export interface HomeworkDelta {
  answers: Record<string, any>;
  audio: Record<number, string> | null;
  mastery: number | null;
  itemEvaluations: ItemEvaluation[] | null;
  /** Answer keys / recordings this delta carries; cleared once the server confirmed them. */
  keys: string[];
  audioKeys: number[];
}

export function buildHomeworkDelta(input: HomeworkDeltaInput): HomeworkDelta | null {
  const keys = [...input.dirtyKeys];
  const audioKeys = [...input.dirtyAudio];
  if (keys.length === 0 && audioKeys.length === 0) return null;

  const answers: Record<string, any> = {};
  for (const k of keys) answers[k] = input.answers[k] ?? '';
  const audio: Record<number, string> = {};
  for (const q of audioKeys) if (input.audio[q]) audio[q] = input.audio[q];

  const changedQuestions = new Set<number>(audioKeys);
  for (const k of keys) {
    const q = questionIndexOfKey(k);
    if (q !== null) changedQuestions.add(q);
  }
  const ratings = (buildItemEvaluations(
    input.exerciseData, input.answers, input.exerciseType, null, input.audio,
  ) || []).filter((e) => changedQuestions.has(e.question_index));

  return {
    answers,
    audio: Object.keys(audio).length > 0 ? audio : null,
    mastery: calculateOverallMastery(input.exerciseType, input.exerciseData, input.answers),
    itemEvaluations: ratings.length > 0 ? ratings : null,
    keys,
    audioKeys,
  };
}

/** Per-question AI evaluations of stored answer rows (what the student page shows after grading). */
export function parseAiEvaluations(rows: Array<{ exercise_index: number; ai_evaluation?: any }> | null | undefined): Record<number, Record<number, AiEvaluation>> {
  const out: Record<number, Record<number, AiEvaluation>> = {};
  for (const row of rows ?? []) {
    const evalData = row.ai_evaluation;
    if (!evalData) continue;
    if (Array.isArray(evalData.question_evaluations)) {
      out[row.exercise_index] = {};
      for (const qEval of evalData.question_evaluations) out[row.exercise_index][qEval.question_index] = qEval;
    } else if (evalData.is_acceptable !== undefined) {
      out[row.exercise_index] = { 0: evalData as AiEvaluation };
    }
  }
  return out;
}
