-- W0 security hotfix (part b: teacher comments): SECURITY DEFINER functions that never checked their caller.
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

-- 5. teacher comments --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_teacher_comment(p_homework_id uuid, p_exercise_index integer, p_student_email text, p_teacher_id uuid, p_comment_text text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_comment_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF auth.uid() IS DISTINCT FROM p_teacher_id
       OR NOT EXISTS (SELECT 1 FROM public.homework_assignments ha WHERE ha.id = p_homework_id AND ha.teacher_id = auth.uid()) THEN
      RAISE EXCEPTION 'Not allowed to comment on this homework' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_comment_id := (
    SELECT htc.id FROM public.homework_teacher_comments htc
    WHERE htc.homework_id = p_homework_id
      AND htc.exercise_index = p_exercise_index
      AND htc.student_email = p_student_email
      AND htc.teacher_id = p_teacher_id
    LIMIT 1
  );

  IF v_comment_id IS NOT NULL THEN
    UPDATE public.homework_teacher_comments
    SET comment_text = p_comment_text, updated_at = NOW()
    WHERE id = v_comment_id;
  ELSE
    INSERT INTO public.homework_teacher_comments (homework_id, exercise_index, student_email, teacher_id, comment_text)
    VALUES (p_homework_id, p_exercise_index, p_student_email, p_teacher_id, p_comment_text)
    RETURNING id INTO v_comment_id;
  END IF;

  RETURN v_comment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_homework_comments(p_homework_id uuid, p_student_email text)
 RETURNS TABLE(id uuid, exercise_index integer, comment_text text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT htc.id, htc.exercise_index, htc.comment_text, htc.created_at, htc.updated_at
  FROM public.homework_teacher_comments htc
  WHERE htc.homework_id = p_homework_id
    AND htc.student_email = p_student_email
    AND EXISTS (
      SELECT 1 FROM public.homework_assignments ha
      WHERE ha.id = p_homework_id AND auth.uid() IS NOT NULL AND ha.teacher_id = auth.uid()
    )
  ORDER BY htc.exercise_index;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_homework_comments(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_homework_comments(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_teacher_comment(uuid, integer, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_teacher_comment(uuid, integer, text, uuid, text) TO authenticated, service_role;
