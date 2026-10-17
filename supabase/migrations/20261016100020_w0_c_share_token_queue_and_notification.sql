-- W0 security hotfix (part c: token-checked queue and notification variants): SECURITY DEFINER functions that never checked their caller.
--
-- 1. consume_token(p_teacher_id, p_worksheet_id) charged any teacher id for any
--    signed-in user (teacher ids are visible in get_test_context_by_share_token,
--    which anon may call). The body is kept byte for byte as consume_token_internal
--    (service role only); consume_token becomes a wrapper that lets a signed-in
--    caller act only for their own id.
-- 2. soft_delete_worksheet trusted a caller-supplied teacher id.
-- 3. get_worksheet_live_answers returned the answers of any worksheet to any
--    signed-in user; it now returns rows only to the worksheet owner.
-- 4. mark_homework_completed trusted p_user_id and let anon complete a homework;
--    same wrapper pattern as consume_token. Students submit through
--    submit_homework_answers_by_share_token.
-- 5. save_teacher_comment / get_homework_comments did not check the teacher
--    (get_homework_comments was readable by anon with a homework id + email).
-- 6. Token-checked variants of queue_worksheet_ai_evaluation, needs_ai_evaluation
--    and insert_homework_submission_notification. The legacy anon-callable names are
--    revoked by 20261017090100 once the client that calls the token variants is live.
--
-- A caller with auth.uid() IS NULL is the service role or a database job
-- (pg_cron); client roles always carry a uid, so a NULL uid is never a client.
--
-- Rollback: ALTER FUNCTION public.consume_token_internal(uuid, uuid) RENAME TO consume_token
-- after dropping the wrapper; mark_homework_completed likewise; re-run the previous
-- definitions of the other functions (20261012090000, 20260807*).

-- Split in idempotent files so each fits the Supabase SQL Editor paste limit
-- (see docs/operational/w0-rollout.md); apply the parts in file-name order.

SET LOCAL lock_timeout = '5s';

-- 6. token-checked variants --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.needs_ai_evaluation_by_share_token(p_share_token text, p_worksheet_id uuid, p_student_email text, p_exercise_index integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_worksheet_student_access(p_share_token, p_worksheet_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for worksheet' USING ERRCODE = '42501';
  END IF;
  RETURN public.needs_ai_evaluation(p_worksheet_id, p_student_email, p_exercise_index);
END;
$function$;

CREATE OR REPLACE FUNCTION public.queue_worksheet_ai_evaluation_by_share_token(p_share_token text, p_worksheet_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_english_level text DEFAULT 'Intermediate'::text, p_context jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_worksheet_student_access(p_share_token, p_worksheet_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for worksheet' USING ERRCODE = '42501';
  END IF;
  IF p_exercise_index IS NULL OR p_exercise_index < 0 OR p_exercise_index > 200
     OR length(coalesce(p_answers::text, '')) > 200000
     OR length(coalesce(p_context::text, '')) > 400000 THEN
    RAISE EXCEPTION 'Invalid evaluation request' USING ERRCODE = '22023';
  END IF;
  RETURN public.queue_worksheet_ai_evaluation(
    p_worksheet_id, p_student_email, p_exercise_index, p_exercise_type, p_answers, p_english_level, p_context
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.insert_homework_submission_notification_by_share_token(p_share_token text, p_homework_id uuid, p_student_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_homework_student_access(p_share_token, p_homework_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for homework' USING ERRCODE = '42501';
  END IF;
  -- At most one unread completion notification per homework (a resubmission after the
  -- teacher read the previous one notifies again); the message is built server side.
  IF EXISTS (
    SELECT 1 FROM public.homework_notifications hn
    WHERE hn.homework_id = p_homework_id AND hn.notification_type = 'completed' AND hn.is_read = FALSE
  ) THEN
    RETURN;
  END IF;
  PERFORM public.insert_homework_submission_notification(p_homework_id, NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.needs_ai_evaluation_by_share_token(text, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_worksheet_ai_evaluation_by_share_token(text, uuid, text, integer, text, jsonb, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_homework_submission_notification_by_share_token(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.needs_ai_evaluation_by_share_token(text, uuid, text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.queue_worksheet_ai_evaluation_by_share_token(text, uuid, text, integer, text, jsonb, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_homework_submission_notification_by_share_token(text, uuid, text) TO anon, authenticated, service_role;
