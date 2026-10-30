import { homeworkState, type HomeworkReviewFields } from '@/lib/homework/reviewState';

export interface HubHomework extends HomeworkReviewFields {
  id: string;
  title: string;
  share_token: string;
  deadline: string | null;
  created_at: string;
  source_worksheet_title: string | null;
  exercises_count: number;
  completed_exercises_count: number;
}

export type HomeworkFilter = 'all' | 'to_do' | 'in_review' | 'reviewed';

export const HOMEWORK_FILTERS: ReadonlyArray<{ value: HomeworkFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'to_do', label: 'To Do' },
  { value: 'in_review', label: 'In Review' },
  { value: 'reviewed', label: 'Reviewed' },
];

/** Read-only projection of the canonical lifecycle, including teacher-closed assignments. */
export function homeworkLifecycle(hw: HomeworkReviewFields & { deadline?: string | null }, now: number) {
  const state = homeworkState(hw);
  const deadline = hw.deadline ? Date.parse(hw.deadline) : NaN;
  return {
    state,
    overdue: state === 'open' && Number.isFinite(deadline) && deadline < now,
    canReadFeedback: state === 'reviewed',
  };
}

export function filterHubHomework<T extends HomeworkReviewFields>(rows: readonly T[], filter: HomeworkFilter): T[] {
  return rows.filter(hw => {
    const state = homeworkState(hw);
    if (filter === 'to_do') return state === 'open';
    if (filter === 'in_review') return state === 'submitted';
    if (filter === 'reviewed') return state === 'reviewed';
    // Teacher-closed assignments stay visible in All, never in the review queue.
    return true;
  });
}