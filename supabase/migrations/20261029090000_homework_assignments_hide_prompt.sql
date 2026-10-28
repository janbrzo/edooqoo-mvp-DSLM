-- PROBLEM: public.homework_assignments.prompt held the full Worksheet Generation Engine
--   system message for 26 legacy batch-mode rows (2001-27783 chars, engine text only) and
--   was readable by anon and authenticated through the table-level SELECT grant (RLS
--   filters rows, not columns), so the owning teacher could read it over REST. Same
--   exposure 20261028120000 closed for public.worksheets.prompt.
-- SOLUTION: the client selects explicit columns only and no longer writes the prompt
--   (src/lib/homework/homeworkColumns.ts, CreateHomeworkModal writes prompt: null).
--   REVOKE SELECT ON TABLE first (a column-level REVOKE is a no-op while a table-level
--   grant exists), then GRANT SELECT on every column except prompt. INSERT/UPDATE/DELETE
--   grants are untouched; service_role and SECURITY DEFINER functions keep full access.
--   Then blank the stored engine system messages (length > 2000 and the engine marker;
--   the 3 short user-only prompts stay). The BEFORE UPDATE triggers that rewrite
--   reminder_scheduled_at / updated_at are disabled for that one UPDATE and re-enabled
--   in the same transaction. Idempotent: a re-run matches 0 rows. No DROP.
--   A new homework_assignments column is NOT readable by anon/authenticated until it is
--   added to the GRANT SELECT list below (see supabase/AGENTS.md).
-- BEFORE APPLYING: the operator runs scripts/dslm/backup-homework-prompt-before-hide.sql
--   (copies id + prompt of the rows blanked here into a service-only table).
-- ROLLBACK: GRANT SELECT ON public.homework_assignments TO anon, authenticated;
--   blanked prompts can be restored from public.homework_prompt_backup_20261029.

REVOKE SELECT ON public.homework_assignments FROM anon, authenticated;

GRANT SELECT (
  id, teacher_id, student_id, source_worksheet_id, title, selected_exercises, share_token,
  deadline, reminder_sent_at, viewed_at, view_count, created_at, updated_at, completed_at,
  completed_by_teacher, reminder_hours, reminder_scheduled_at, reviewed_at, reviewed_by,
  attempt
) ON public.homework_assignments TO anon, authenticated;

ALTER TABLE public.homework_assignments DISABLE TRIGGER trigger_set_reminder_scheduled_at;
ALTER TABLE public.homework_assignments DISABLE TRIGGER update_homework_assignments_updated_at;
ALTER TABLE public.homework_assignments DISABLE TRIGGER update_homework_updated_at;

-- 26 rows expected in prod: engine system messages only.
UPDATE public.homework_assignments
SET prompt = NULL
WHERE prompt IS NOT NULL
  AND length(prompt) > 2000
  AND prompt ~ 'RETURN ONLY VALID JSON';

ALTER TABLE public.homework_assignments ENABLE TRIGGER trigger_set_reminder_scheduled_at;
ALTER TABLE public.homework_assignments ENABLE TRIGGER update_homework_assignments_updated_at;
ALTER TABLE public.homework_assignments ENABLE TRIGGER update_homework_updated_at;
