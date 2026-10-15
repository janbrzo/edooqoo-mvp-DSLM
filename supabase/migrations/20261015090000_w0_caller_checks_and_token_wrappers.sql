-- W0 security hotfix: SECURITY DEFINER functions that never checked their caller.
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
--    revoked by 20261015090100 once the client that calls the token variants is live.
--
-- A caller with auth.uid() IS NULL is the service role or a database job
-- (pg_cron); client roles always carry a uid, so a NULL uid is never a client.
--
-- Rollback: ALTER FUNCTION public.consume_token_internal(uuid, uuid) RENAME TO consume_token
-- after dropping the wrapper; mark_homework_completed likewise; re-run the previous
-- definitions of the other functions (20261012090000, 20260807*).

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
  -- One completion notification per homework; the message is built server side.
  IF EXISTS (
    SELECT 1 FROM public.homework_notifications hn
    WHERE hn.homework_id = p_homework_id AND hn.notification_type = 'completed'
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
