/**
 * Explicit column list for client reads of `public.homework_assignments`.
 *
 * `prompt` (legacy rows hold the full engine system message) is never selected
 * by the client: SELECT on it is revoked from anon/authenticated, so
 * `select('*')` and a bare `.select()` (RETURNING *) are forbidden on this table
 * (enforced by `src/lib/homework/__tests__/homeworkColumns.test.ts`).
 */

import type { Tables } from '@/integrations/supabase/types';

/** Columns the client must never read. */
export const HOMEWORK_FORBIDDEN_COLUMNS = ['prompt'] as const;

/** Every readable column of `public.homework_assignments` (live schema minus `prompt`). */
export const HOMEWORK_OWNER_VIEW_COLUMNS = [
  'id',
  'teacher_id',
  'student_id',
  'source_worksheet_id',
  'title',
  'selected_exercises',
  'share_token',
  'deadline',
  'reminder_sent_at',
  'viewed_at',
  'view_count',
  'created_at',
  'updated_at',
  'completed_at',
  'completed_by_teacher',
  'reminder_hours',
  'reminder_scheduled_at',
  'reviewed_at',
  'reviewed_by',
  'attempt',
] as const;

/** Comma separated select string for supabase-js. */
export function homeworkColumnList(columns: readonly string[]): string {
  return columns.join(', ');
}

export const HOMEWORK_OWNER_VIEW_SELECT = homeworkColumnList(HOMEWORK_OWNER_VIEW_COLUMNS);

/** Homework row without the forbidden columns. */
export type HomeworkOwnerRow = Omit<
  Tables<'homework_assignments'>,
  (typeof HOMEWORK_FORBIDDEN_COLUMNS)[number]
>;
