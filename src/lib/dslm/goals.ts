/**
 * goals — pure predicates shared by the Learning plan and GoalsView.
 */
import type { ProgressGoal } from '@/types/studentProgress';

/** Not achieved and not archived. */
export const isActiveGoal = (goal: Pick<ProgressGoal, 'is_achieved' | 'archived_at'>): boolean =>
  !goal.is_achieved && !goal.archived_at;

/** Goals proposed by the Welcome Test that the teacher has not accepted yet. */
export const isSuggestedGoal = (
  goal: Pick<ProgressGoal, 'is_achieved' | 'archived_at' | 'source' | 'accepted_at'>,
): boolean => goal.source === 'welcome_test_auto' && !goal.accepted_at && isActiveGoal(goal);
