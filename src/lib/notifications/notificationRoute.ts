/**
 * Where a click on a teacher notification goes. One rule for both bells
 * (UnifiedBell and the legacy HomeworkNotificationBadge): a submitted homework
 * opens the review page by id (never the student share link, which counts as a
 * student view and shows the homework without the teacher's tools).
 */
import { homeworkReviewPath } from '@/lib/homework/reviewState';

export interface NotificationRouteFields {
  notification_type: string;
  homework_id?: string | null;
  student_id?: string | null;
}

export function notificationPath(n: NotificationRouteFields): string {
  if (n.notification_type === 'welcome_test_completed' && n.student_id) {
    return `/student/${n.student_id}?tab=tests`;
  }
  if (n.notification_type === 'completed' && n.homework_id) {
    return homeworkReviewPath(n.homework_id);
  }
  // viewed / overdue: nothing to review yet, show the student's homework.
  if (n.student_id) return `/student/${n.student_id}?tab=homework`;
  return '/dashboard';
}
