/**
 * The teacher's decision on an answer the key could not judge (`set_homework_item_verdict`)
 * reaches the exercise renderers through this context, so a decided item stops showing
 * "Needs teacher review". Only a `review` verdict is ever replaced: the key result is never
 * contradicted. Outside the homework review page the context is empty and nothing changes.
 */
import { createContext, useContext } from 'react';
import type { MatchVerdict } from '@/lib/answers/matchAnswer';

export type TeacherVerdicts = Readonly<Record<number, 'correct' | 'wrong'>>;

const EMPTY: TeacherVerdicts = {};

export const TeacherVerdictsContext = createContext<TeacherVerdicts>(EMPTY);

export const useTeacherVerdicts = (): TeacherVerdicts => useContext(TeacherVerdictsContext);

export function applyTeacherVerdict<V extends MatchVerdict | string>(
  verdicts: TeacherVerdicts, questionIndex: number, verdict: V,
): V | 'correct' | 'wrong' {
  const decided = verdicts[questionIndex];
  return verdict === 'review' && decided ? decided : verdict;
}

/** AI feedback of the questions the teacher decided is dropped: it would contradict the decision. */
export function withoutDecidedEvaluations<T>(
  evaluations: Record<number, T> | undefined, verdicts: TeacherVerdicts | undefined,
): Record<number, T> | undefined {
  if (!evaluations || !verdicts) return evaluations;
  return Object.fromEntries(
    Object.entries(evaluations).filter(([q]) => !(Number(q) in verdicts)),
  ) as Record<number, T>;
}
