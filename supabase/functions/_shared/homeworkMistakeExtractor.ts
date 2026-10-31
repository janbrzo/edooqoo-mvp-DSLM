/** Read-only projection of saved homework evidence. Never grades or writes learning state. */
import { buildClosedItemContext } from './closedItemContext.ts';
import { buildOpenAnswerContext, openExerciseItems } from './openAnswerContext.ts';
import { isClosedExerciseType, isOpenExerciseType } from './itemMastery.ts';

export interface MistakeCard {
  exercise_index: number;
  question_index: number;
  front_text: string;
  back_text: string;
  front_example: string | null;
}
export interface MistakeAnswerRow {
  exercise_index: number;
  exercise_type: string;
  answers: unknown;
  is_submitted: boolean;
  eval_trigger?: string | null;
  item_evaluations?: unknown;
}
export const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const validText = (value: string): boolean => !!value && value.length <= 4000 && !value.includes('\u0000') && !value.includes('[object Object]');
const index = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function extractHomeworkMistakes(exercises: unknown, rows: readonly MistakeAnswerRow[]): MistakeCard[] {
  if (!Array.isArray(exercises)) return [];
  const out = new Map<string, MistakeCard>();
  for (const row of rows) {
    if (!row || row.is_submitted !== true || !row.eval_trigger || !index(row.exercise_index)) continue;
    const exercise = record(exercises[row.exercise_index]);
    const answers = record(row.answers);
    if (!exercise || !answers || typeof exercise.type !== 'string' || exercise.type !== row.exercise_type || !Array.isArray(row.item_evaluations)) continue;
    const groups = new Map<number, Record<string, unknown>[]>();
    for (const value of row.item_evaluations) {
      const rating = record(value);
      if (!rating || !index(rating.question_index)) continue;
      groups.set(rating.question_index, [...(groups.get(rating.question_index) ?? []), rating]);
    }
    for (const [question, ratings] of groups) {
      const teacher = ratings.filter(rating => rating.source === 'teacher');
      const authoritative = teacher.length ? teacher : ratings;
      if (!authoritative.every(rating => rating.hasValue === true && typeof rating.mastery === 'number'
        && Number.isFinite(rating.mastery) && rating.mastery >= 0 && rating.mastery < 50)) continue;
      let front = '';
      let back = '';
      if (isClosedExerciseType(row.exercise_type)) {
        // Audio/image-dependent questions cannot become self-contained text cards.
        if (row.exercise_type.includes('-audio') || row.exercise_type.includes('-picture')) continue;
        const context = buildClosedItemContext(row.exercise_type, exercise, question, answers);
        if (!context || (!teacher.length && context.key_verdict !== 'wrong')) continue;
        // Multi-blank ambiguity is left for the teacher, not converted from a zero aggregate.
        if (!teacher.length && (row.exercise_type === 'gap-text' || row.exercise_type === 'fill-in-blanks')
          && Object.keys(answers).some(key => key.startsWith(`${question}_`))) continue;
        front = context.question_text;
        back = context.suggested_answer;
      } else if (isOpenExerciseType(row.exercise_type)) {
        // A low score is not a correction. Only a real source item with a saved model answer qualifies.
        const item = openExerciseItems(exercise)[question];
        const written = text(answers[question]) || text(answers[`_transcription_${question}`]);
        if (!record(item) || !written || row.exercise_type === 'speaking' || row.exercise_type.includes('-picture') || row.exercise_type.includes('-audio')) continue;
        const context = buildOpenAnswerContext({ exercise, questionIndex: question });
        if (context.source_context || context.question_text === `Question ${question + 1}`) continue;
        front = context.question_text;
        back = context.suggested_answer ? `Suggested answer: ${context.suggested_answer}` : '';
      } else continue;
      if (!validText(front) || !validText(back)) continue;
      out.set(`${row.exercise_index}:${question}`, {
        exercise_index: row.exercise_index, question_index: question,
        front_text: front, back_text: back, front_example: null,
      });
    }
  }
  return [...out.values()].sort((a, b) => a.exercise_index - b.exercise_index || a.question_index - b.question_index);
}