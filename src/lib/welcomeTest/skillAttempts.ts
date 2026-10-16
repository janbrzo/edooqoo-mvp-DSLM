/**
 * A skill with no attempted question has no score: the results screen shows it as
 * skipped and keeps it out of strongest/weakest (a 0% from nothing answered is not a weak skill).
 */
export interface AttemptQuestion {
  element_type?: string | null;
  student_answer?: unknown;
}

export function skillAttempts(
  questions: ReadonlyArray<AttemptQuestion> | null | undefined,
  skill: string,
): { total: number; attempted: number } {
  const qs = (questions || []).filter(q => (q.element_type || '') === skill);
  const attempted = qs.filter(q => q.student_answer !== null && q.student_answer !== undefined && q.student_answer !== '').length;
  return { total: qs.length, attempted };
}

/** True when the skill has questions but none was attempted. */
export function isSkillSkipped(
  questions: ReadonlyArray<AttemptQuestion> | null | undefined,
  skill: string,
): boolean {
  const { total, attempted } = skillAttempts(questions, skill);
  return total > 0 && attempted === 0;
}
