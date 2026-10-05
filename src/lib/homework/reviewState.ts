/**
 * reviewState — the single rule for "homework waiting for the teacher's review".
 *
 * The Today dashboard, the Student Workspace timeline, the homework list and
 * the attention dots all ask the same question; before this helper each one
 * answered it differently (one ignored `reviewed_at`, another counted homework
 * the teacher had marked done themselves).
 *
 * No React, no Supabase, no globals — every rule here is unit-testable.
 */

export interface HomeworkReviewFields {
  completed_at?: string | null;
  reviewed_at?: string | null;
  completed_by_teacher?: boolean | null;
}

/** Returned by the student and not reviewed yet. Teacher "Mark done" never waits for review. */
export function isHomeworkAwaitingReview(hw: HomeworkReviewFields): boolean {
  return !!hw.completed_at && !hw.reviewed_at && hw.completed_by_teacher !== true;
}

/** Returned by the student, reviewed or not — the review page has something to show. */
export function hasStudentReturnedHomework(hw: HomeworkReviewFields): boolean {
  return !!hw.completed_at && hw.completed_by_teacher !== true;
}

/** Teacher review page for one homework assignment (by id, never the student share token). */
export function homeworkReviewPath(homeworkId: string): string {
  return `/homework/${homeworkId}/review`;
}
