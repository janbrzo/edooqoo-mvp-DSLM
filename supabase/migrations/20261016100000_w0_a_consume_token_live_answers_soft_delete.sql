-- W0 security hotfix (part a: consume_token, soft_delete_worksheet, get_worksheet_live_answers): SECURITY DEFINER functions that never checked their caller.
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

-- 1. consume_token ---------------------------------------------------------------

DO $rename$
BEGIN
  IF to_regprocedure('public.consume_token_internal(uuid, uuid)') IS NULL THEN
    ALTER FUNCTION public.consume_token(uuid, uuid) RENAME TO consume_token_internal;
  END IF;
END
$rename$;

REVOKE ALL ON FUNCTION public.consume_token_internal(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_token_internal(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_token(p_teacher_id uuid, p_worksheet_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_teacher_id THEN
    RAISE EXCEPTION 'Not allowed to consume tokens for another teacher' USING ERRCODE = '42501';
  END IF;
  RETURN public.consume_token_internal(p_teacher_id, p_worksheet_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_token(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_token(uuid, uuid) TO authenticated, service_role;

-- 2. soft_delete_worksheet ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_worksheet(p_worksheet_id uuid, p_teacher_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_teacher_id THEN
    RAISE EXCEPTION 'Not allowed to delete a worksheet of another teacher' USING ERRCODE = '42501';
  END IF;

  UPDATE public.worksheets
  SET deleted_at = NOW()
  WHERE id = p_worksheet_id
    AND teacher_id = p_teacher_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$function$;

-- 3. get_worksheet_live_answers ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_worksheet_live_answers(p_worksheet_id uuid)
 RETURNS TABLE(id uuid, student_email text, exercise_index integer, exercise_type text, answers jsonb, last_saved_at timestamp with time zone, item_evaluations jsonb, mastery integer, audio_answers jsonb, ai_evaluation jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    wsa.id,
    wsa.student_email,
    wsa.exercise_index,
    wsa.exercise_type,
    wsa.answers,
    wsa.last_saved_at,
    wsa.item_evaluations,
    wsa.mastery,
    wsa.audio_answers,
    wsa.ai_evaluation
  FROM worksheet_student_answers wsa
  WHERE wsa.worksheet_id = p_worksheet_id
    AND EXISTS (
      SELECT 1 FROM public.worksheets w
      WHERE w.id = p_worksheet_id
        AND auth.uid() IS NOT NULL
        AND (w.teacher_id = auth.uid() OR w.user_id = auth.uid())
    )
  ORDER BY wsa.exercise_index;
END;
$function$;
