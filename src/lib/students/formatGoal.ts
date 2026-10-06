/**
 * formatGoal: maps goal codes stored in `students.main_goal` (current
 * dropdown values and legacy codes) to human-readable labels. Free-text goals
 * (e.g. "Business English: meetings") pass through unchanged.
 *
 * Delegates to `formatGoalLabel` so the dashboard, `/students`, the student
 * header and the Learning plan share one mapping.
 */
import { formatGoalLabel } from '@/constants/studentGoals';

export function formatGoal(goal: string | null | undefined): string {
  if (!goal) return '';
  return formatGoalLabel(goal);
}
