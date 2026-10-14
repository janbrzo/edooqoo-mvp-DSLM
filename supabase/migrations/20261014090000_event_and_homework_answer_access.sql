-- Iteration 7: close the DSLM write paths that skipped an ownership check.
--
-- 1. add_student_event is SECURITY DEFINER and only RLS checked teacher_id,
--    which SECURITY DEFINER bypasses: any signed-in user could write events
--    (and so skill metrics) for another teacher's student. The body moves to
--    add_student_event_internal (service role only) and add_student_event
--    becomes a checked wrapper. The SQL wrappers that already authorise their
--    caller (homework email, Welcome Test share token, Mark done teacher) call
--    the internal function, because anonymous students fail the teacher check.
-- 2. The student_events INSERT policy also requires the student to belong to
--    the teacher.
-- 3. update_homework_answer_by_share_token checked only the link token, so
--    anyone with the link could overwrite any student's mastery; it now uses
--    has_homework_student_access (token + assigned email, owner teacher passes).
-- 4. submit_homework_answers authorised nothing; it is now versioned here and
--    the client calls submit_homework_answers_by_share_token. The legacy name
--    is revoked from client roles in 20261014090100 (apply after the client).
-- 5. mark_ai_evaluation_done (no caller) is revoked from client roles: anon
--    could suppress AI evaluation of any answer.
-- 6. The dead trigger trigger_update_homework_ai_evaluation is dropped: it only
--    updated 'homework_answer_submitted' events, which no code writes (0 rows).
--
-- Rollback: re-run the previous definitions from 20261012090000 (add_student_event,
-- policy), 20261006090000 / 20261006120000 (log_* wrappers) and
-- 20261012120000 (save_mark_done_evaluation).

SET LOCAL lock_timeout = '5s';

-- 1. add_student_event ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_student_event_internal(p_student_id uuid, p_teacher_id uuid, p_event_type text, p_event_source text, p_source_id uuid DEFAULT NULL::uuid, p_event_payload jsonb DEFAULT '{}'::jsonb, p_skill_ids text[] DEFAULT NULL::text[], p_element_type text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id UUID;
  v_mastery numeric;
BEGIN
  -- Auto-extract mastery from nano_skill_ratings if present and has values
  IF p_event_payload ? 'nano_skill_ratings'
     AND jsonb_array_length(p_event_payload->'nano_skill_ratings') > 0 THEN
    SELECT ROUND(AVG((elem->>'mastery')::numeric))
    INTO v_mastery
    FROM jsonb_array_elements(p_event_payload->'nano_skill_ratings') AS elem
    WHERE elem->>'mastery' IS NOT NULL
      AND (elem->>'mastery')::numeric >= 0
      AND (elem ? 'hasValue' AND (elem->>'hasValue')::boolean = true);
  END IF;

  -- Fallback: extract from is_correct for simple MC questions
  IF v_mastery IS NULL AND p_event_payload ? 'is_correct' AND (p_event_payload->>'is_correct') IS NOT NULL THEN
    v_mastery := CASE
      WHEN (p_event_payload->>'is_correct')::boolean = true THEN 100
      WHEN (p_event_payload->>'is_correct')::boolean = false THEN 0
      ELSE NULL
    END;
  END IF;

  INSERT INTO public.student_events (
    student_id, teacher_id, event_type, event_source,
    source_id, event_payload, skill_ids, element_type,
    session_id, mastery
  ) VALUES (
    p_student_id, p_teacher_id, p_event_type, p_event_source,
    p_source_id, p_event_payload, p_skill_ids, p_element_type,
    p_session_id, v_mastery
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.add_student_event_internal(uuid, uuid, text, text, uuid, jsonb, text[], text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_student_event_internal(uuid, uuid, text, text, uuid, jsonb, text[], text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.add_student_event(p_student_id uuid, p_teacher_id uuid, p_event_type text, p_event_source text, p_source_id uuid DEFAULT NULL::uuid, p_event_payload jsonb DEFAULT '{}'::jsonb, p_skill_ids text[] DEFAULT NULL::text[], p_element_type text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role (Edge Functions) and direct database sessions (migrations,
  -- SQL editor, pg_cron) are trusted. API callers come in through PostgREST,
  -- whose session user is 'authenticator', and must be the student's teacher.
  IF NOT (
    coalesce(auth.role(), '') = 'service_role'
    OR session_user <> 'authenticator'
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid() = p_teacher_id
      AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = p_student_id AND s.teacher_id = p_teacher_id
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN public.add_student_event_internal(
    p_student_id, p_teacher_id, p_event_type, p_event_source, p_source_id,
    p_event_payload, p_skill_ids, p_element_type, p_session_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.add_student_event(uuid, uuid, text, text, uuid, jsonb, text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_student_event(uuid, uuid, text, text, uuid, jsonb, text[], text, text) TO authenticated, service_role;

-- Wrappers that authorise their own caller now call the internal function.

CREATE OR REPLACE FUNCTION public.log_homework_submitted_event(p_homework_id uuid, p_student_email text, p_event_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  h record;
BEGIN
  SELECT ha.id, ha.student_id, ha.teacher_id INTO h
  FROM public.homework_assignments ha
  JOIN public.students s ON s.id = ha.student_id
  WHERE ha.id = p_homework_id
    AND ha.completed_at IS NOT NULL
    AND lower(s.student_email) = lower(trim(p_student_email))
  LIMIT 1;
  IF h.id IS NULL THEN
    RAISE EXCEPTION 'Homework not found';
  END IF;

  -- Idempotent: one homework_submitted event per homework.
  DELETE FROM public.student_events
  WHERE source_id = h.id AND event_type = 'homework_submitted';

  RETURN public.add_student_event_internal(
    p_student_id => h.student_id,
    p_teacher_id => h.teacher_id,
    p_event_type => 'homework_submitted',
    p_event_source => 'homework',
    p_source_id => h.id,
    p_event_payload => p_event_payload
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_welcome_test_event_by_share_token(p_share_token text, p_event_type text, p_answer_id text, p_legacy_answer_id text, p_event_payload jsonb, p_element_type text DEFAULT NULL::text, p_skill_ids text[] DEFAULT NULL::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t record;
BEGIN
  IF p_event_type NOT IN ('test_answer_submitted', 'test_answer_skipped') THEN
    RAISE EXCEPTION 'Unsupported event type';
  END IF;

  SELECT id, student_id, teacher_id INTO t
  FROM public.student_tests
  WHERE share_token = p_share_token
    AND deleted_at IS NULL
    AND status IN ('assigned', 'in_progress', 'completed')
  LIMIT 1;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Test not found';
  END IF;

  DELETE FROM public.student_events
  WHERE student_id = t.student_id
    AND source_id = t.id
    AND event_type = p_event_type
    AND (
      event_payload->>'answer_id' = p_answer_id
      OR (event_payload->>'answer_id' = p_legacy_answer_id
          AND NOT (event_payload ? 'legacy_answer_id'))
    );

  RETURN public.add_student_event_internal(
    p_student_id => t.student_id,
    p_teacher_id => t.teacher_id,
    p_event_type => p_event_type,
    p_event_source => 'welcome_test',
    p_source_id => t.id,
    p_event_payload => p_event_payload,
    p_skill_ids => p_skill_ids,
    p_element_type => p_element_type
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_mark_done_evaluation(p_student_id uuid, p_worksheet_id uuid, p_exercise_index integer, p_element_type text, p_exercise_title text, p_ratings jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher_id uuid := auth.uid();
  v_event_id uuid;
  v_payload jsonb;
  v_skill_ids text[];
  v_mastery numeric;
BEGIN
  IF v_teacher_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.teacher_id = v_teacher_id
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_ratings) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_ratings must be an array' USING ERRCODE = '22023';
  END IF;

  v_payload := jsonb_build_object(
    'exercise_index', p_exercise_index,
    'exercise_title', p_exercise_title,
    'nano_skill_ratings', p_ratings
  );
  SELECT array_agg(elem->>'name') INTO v_skill_ids
  FROM jsonb_array_elements(p_ratings) AS elem WHERE elem->>'name' IS NOT NULL;
  SELECT ROUND(AVG((elem->>'mastery')::numeric)) INTO v_mastery
  FROM jsonb_array_elements(p_ratings) AS elem
  -- Same rule as add_student_event and the metric trigger: only rated items count.
  WHERE elem->>'mastery' IS NOT NULL AND (elem->>'mastery')::numeric >= 0
    AND (elem ? 'hasValue' AND (elem->>'hasValue')::boolean = true);

  SELECT se.id INTO v_event_id
  FROM public.student_events se
  WHERE se.student_id = p_student_id AND se.teacher_id = v_teacher_id
    AND se.source_id IS NOT DISTINCT FROM p_worksheet_id AND se.event_type = 'mark_done_evaluation'
    AND (se.event_payload->>'exercise_index')::int = p_exercise_index
  ORDER BY se.created_at DESC
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    UPDATE public.student_events
       SET event_payload = v_payload, skill_ids = v_skill_ids, mastery = v_mastery, element_type = p_element_type
     WHERE id = v_event_id;
    RETURN v_event_id;
  END IF;

  RETURN public.add_student_event_internal(
    p_student_id, v_teacher_id, 'mark_done_evaluation', 'teacher', p_worksheet_id,
    v_payload, v_skill_ids, p_element_type, NULL
  );
END;
$function$;

-- 2. student_events INSERT policy -----------------------------------------

DROP POLICY IF EXISTS "Teachers can insert events for their students" ON public.student_events;
CREATE POLICY "Teachers can insert events for their students" ON public.student_events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_events.student_id AND s.teacher_id = auth.uid()
    )
  );

-- 3. update_homework_answer_by_share_token --------------------------------

CREATE OR REPLACE FUNCTION public.update_homework_answer_by_share_token(p_share_token text, p_homework_id uuid, p_student_email text, p_exercise_index integer, p_answers jsonb DEFAULT NULL::jsonb, p_ai_evaluation jsonb DEFAULT NULL::jsonb, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_mastery integer DEFAULT NULL::integer, p_eval_trigger text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Token + assigned email (owner teacher always passes), as the other
  -- *_by_share_token RPCs; the token alone let any link holder write any row.
  IF NOT public.has_homework_student_access(p_share_token, p_homework_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for homework' USING ERRCODE = '42501';
  END IF;

  UPDATE public.homework_student_answers
     SET answers          = COALESCE(p_answers, answers),
         ai_evaluation    = COALESCE(p_ai_evaluation, ai_evaluation),
         item_evaluations = COALESCE(p_item_evaluations, item_evaluations),
         mastery          = COALESCE(p_mastery, mastery),
         eval_trigger     = COALESCE(p_eval_trigger, eval_trigger)
   WHERE homework_id = p_homework_id
     AND lower(student_email) = lower(trim(p_student_email))
     AND exercise_index = p_exercise_index;

  RETURN FOUND;
END;
$function$;

-- 4. submit_homework_answers ----------------------------------------------

-- Production body (it existed only in the database), with the email compared
-- case-insensitively like has_homework_student_access.
CREATE OR REPLACE FUNCTION public.submit_homework_answers(p_homework_id uuid, p_student_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Mark all answers as submitted
  UPDATE public.homework_student_answers
  SET
    is_submitted = true,
    submitted_at = NOW()
  WHERE homework_id = p_homework_id
    AND lower(student_email) = lower(trim(p_student_email))
    AND is_submitted = false;

  -- Also mark the homework assignment as completed
  UPDATE public.homework_assignments
  SET
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_homework_id;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_homework_answers_by_share_token(p_share_token text, p_homework_id uuid, p_student_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_homework_student_access(p_share_token, p_homework_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for homework' USING ERRCODE = '42501';
  END IF;
  RETURN public.submit_homework_answers(p_homework_id, p_student_email);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.submit_homework_answers_by_share_token(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_homework_answers_by_share_token(text, uuid, text) TO anon, authenticated, service_role;

-- 5. mark_ai_evaluation_done ----------------------------------------------

DO $revoke$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'mark_ai_evaluation_done'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fn);
  END LOOP;
END
$revoke$;

-- 6. dead trigger ---------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_update_homework_ai_evaluation ON public.homework_student_answers;
DROP FUNCTION IF EXISTS public.update_homework_event_with_ai_evaluation();
