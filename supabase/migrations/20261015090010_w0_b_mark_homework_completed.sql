-- W0 security hotfix (part b: mark_homework_completed): SECURITY DEFINER functions that never checked their caller.
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
--    revoked by 20261016090100 once the client that calls the token variants is live.
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

-- 4. mark_homework_completed -------------------------------------------------------

DO $rename$
BEGIN
  IF to_regprocedure('public.mark_homework_completed_internal(uuid, uuid, boolean)') IS NULL THEN
    ALTER FUNCTION public.mark_homework_completed(uuid, uuid, boolean) RENAME TO mark_homework_completed_internal;
  END IF;
END
$rename$;

REVOKE ALL ON FUNCTION public.mark_homework_completed_internal(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_homework_completed_internal(uuid, uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_homework_completed(p_homework_id uuid, p_user_id uuid, p_is_teacher boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT p_is_teacher THEN
      RAISE EXCEPTION 'Students submit homework through submit_homework_answers_by_share_token' USING ERRCODE = '42501';
    END IF;
    v_owner := (SELECT ha.teacher_id FROM public.homework_assignments ha WHERE ha.id = p_homework_id);
    IF v_owner IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Not allowed to complete this homework' USING ERRCODE = '42501';
    END IF;
    RETURN public.mark_homework_completed_internal(p_homework_id, auth.uid(), TRUE);
  END IF;
  RETURN public.mark_homework_completed_internal(p_homework_id, p_user_id, p_is_teacher);
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_homework_completed(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_homework_completed(uuid, uuid, boolean) TO authenticated, service_role;
