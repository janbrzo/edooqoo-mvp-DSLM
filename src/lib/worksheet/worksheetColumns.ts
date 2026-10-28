/**
 * Explicit column lists for client reads of `public.worksheets`.
 *
 * `prompt` (the full model prompt) and `ip_address` are never selected by the
 * client: a column-level REVOKE of SELECT on them must not break any query, so
 * `select('*')` and a bare `.select()` (RETURNING *) are forbidden on this table
 * (enforced by `src/lib/worksheet/__tests__/worksheetColumns.test.ts`).
 */

import type { Tables } from '@/integrations/supabase/types';

/** Columns the client must never read. */
export const WORKSHEET_FORBIDDEN_COLUMNS = ['prompt', 'ip_address'] as const;

/** Every readable column of `public.worksheets` (live schema minus the forbidden ones). */
export const OWNER_VIEW_COLUMNS = [
  'id',
  'form_data',
  'ai_response',
  'html_content',
  'user_id',
  'status',
  'generation_time_seconds',
  'title',
  'created_at',
  'last_modified_at',
  'download_count',
  'student_id',
  'teacher_id',
  'teacher_email',
  'share_token',
  'deleted_at',
  'sequence_number',
  'user_agent',
  'session_id',
  'referrer_url',
  'country',
  'city',
  'media_metadata',
  'selected_image',
  'audio_url',
  'audio_transcript',
  'audio_duration',
  'audio_voice',
  'selected_audio',
  'share_recipient_email',
  'share_expires_at',
  'is_public',
  'public_slug',
  'published_at',
  'public_view_count',
  'public_topic',
  'public_level',
  'public_exercise_types',
  'last_shared_at',
] as const;

/** Paged worksheet list rows (cards, tables): no bodies, only what the list renders. */
export const LIST_COLUMNS = [
  'id',
  'title',
  'created_at',
  'student_id',
  'generation_time_seconds',
  'form_data',
  'audio_url',
  'audio_duration',
  'audio_voice',
  'selected_audio',
  'selected_image',
  'media_metadata',
  'share_token',
] as const;

/** Trash list rows: the list columns plus `deleted_at`, without the share token. */
export const DELETED_LIST_COLUMNS = [
  'id',
  'title',
  'created_at',
  'deleted_at',
  'student_id',
  'generation_time_seconds',
  'form_data',
  'audio_url',
  'audio_duration',
  'audio_voice',
  'selected_audio',
  'selected_image',
  'media_metadata',
] as const;

/** Comma separated select string for supabase-js (`.select(columnList(OWNER_VIEW_COLUMNS))`). */
export function columnList(columns: readonly string[]): string {
  return columns.join(', ');
}

export const OWNER_VIEW_SELECT = columnList(OWNER_VIEW_COLUMNS);
export const LIST_SELECT = columnList(LIST_COLUMNS);
export const DELETED_LIST_SELECT = columnList(DELETED_LIST_COLUMNS);

/** Row shape returned by `OWNER_VIEW_SELECT` (the table row without the forbidden columns). */
export type WorksheetOwnerRow = Omit<Tables<'worksheets'>, (typeof WORKSHEET_FORBIDDEN_COLUMNS)[number]>;
