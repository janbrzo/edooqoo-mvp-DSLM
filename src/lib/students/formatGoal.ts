/**
 * formatGoal — maps legacy short goal codes stored in `students.main_goal`
 * to human-readable labels. Free-text goals (e.g. "Business English — meetings")
 * pass through unchanged.
 *
 * Extracted from `StudentCard` (v6.9.109) so the dashboard, `/students` and
 * Profile can share one mapping.
 */
const GOAL_LABELS: Record<string, string> = {
  work: 'Work/Business',
  exam: 'Exam Preparation',
  general: 'General English',
  travel: 'Travel',
  academic: 'Academic',
};

export function formatGoal(goal: string | null | undefined): string {
  if (!goal) return '';
  return GOAL_LABELS[goal] ?? goal;
}
