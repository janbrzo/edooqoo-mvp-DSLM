-- Homework P0: the server, not the student's browser, owns grading and side effects.
--
-- Backward compatible: a student tab still running the previous client keeps
-- working (its saves merge, its post-submit grading writes are ignored and the
-- scheduled / immediate server evaluation grades the answers instead), so this
-- migration may be applied before the new client is deployed.
--
--  1. update_homework_answer_by_share_token no longer lets a student write
--     answers, ratings, mastery or eval_trigger. It was callable after submit and
--     let a link + email holder rewrite a submitted homework and inject any skill
--     at mastery 100 into DSLM. Grading is written only by the service role
--     (process-pending-ai-evaluations); only the owner teacher keeps the RPC.
--  2. Student-supplied ratings are validated against the exercise they belong to
--     (skill names must occur in the homework's own exercise JSON, mastery is
--     clamped to -1..100) in save_homework_answer, and the exercise index / type
--     come from the homework snapshot.
--  3. Saves merge by key: item ratings are merged per (question, skill) and dropped
--     when the question has no answer any more, audio answers are merged, time is
--     never lowered. A stale tab or a blur without edits can no longer replace a
--     newer exercise snapshot.
--  4. submit_homework_answers creates the teacher notification and the
--     homework_submitted event itself (when rows were submitted or at the first
--     completion), so they no longer depend on the student's tab surviving the
--     whole AI phase.
--  5. The owner teacher ("View as student") can no longer write the student's rows
--     through the share-token save.

SET LOCAL lock_timeout = '5s';

-- Pure helpers -------------------------------------------------------------

-- True when an answer value holds something (a cleared input stays as '').
CREATE OR REPLACE FUNCTION public.homework_answer_value_present(p_value jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE COALESCE(jsonb_typeof(p_value), 'null')
    WHEN 'string' THEN btrim(p_value #>> '{}') <> ''
    WHEN 'array' THEN jsonb_array_length(p_value) > 0
    WHEN 'object' THEN p_value <> '{}'::jsonb
    WHEN 'null' THEN false
    ELSE true
  END;
$function$;

-- True when question p_q has a written answer (key `3` or `3_1` for multi-blank
-- sentences, the same shapes as src/lib/answers/answerKeys.ts) or a recording.
CREATE OR REPLACE FUNCTION public.homework_question_has_answer(p_answers jsonb, p_audio jsonb, p_q integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT (jsonb_typeof(p_audio) = 'object' AND p_audio ? p_q::text)
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(CASE WHEN jsonb_typeof(p_answers) = 'object' THEN p_answers ELSE '{}'::jsonb END) kv
        WHERE kv.key ~ ('^' || p_q::text || '(_[0-9]+)?$')
          AND public.homework_answer_value_present(kv.value)
      );
$function$;

-- Student ratings reduced to what the exercise itself can produce: an object
-- with a numeric question_index, a skill name that occurs in the exercise JSON
-- and a mastery clamped to -1..100 (-1 = not evaluated). At most 300 entries.
CREATE OR REPLACE FUNCTION public.sanitize_homework_item_evaluations(p_exercise jsonb, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed text[];
  v_clean jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN NULL;
  END IF;
  IF p_exercise IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT array_agg(DISTINCT v #>> '{}') INTO v_allowed
  FROM jsonb_path_query(p_exercise, '$.**') v
  WHERE jsonb_typeof(v) = 'string';

  SELECT COALESCE(jsonb_agg(
           q.e || jsonb_build_object('mastery', LEAST(100, GREATEST(-1, round((q.e->>'mastery')::numeric))))
         ), '[]'::jsonb)
    INTO v_clean
  FROM (
    SELECT t.e
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, n)
    WHERE t.n <= 300
  ) q
  WHERE jsonb_typeof(q.e) = 'object'
    AND jsonb_typeof(q.e->'name') = 'string'
    AND (q.e->>'name') = ANY (COALESCE(v_allowed, ARRAY[]::text[]))
    AND jsonb_typeof(q.e->'question_index') = 'number'
    AND (q.e->>'question_index') ~ '^[0-9]{1,4}$'
    AND jsonb_typeof(q.e->'mastery') = 'number';

  RETURN v_clean;
END;
$function$;

CREATE OR REPLACE FUNCTION public.merge_homework_answers(p_stored jsonb, p_new jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN jsonb_typeof(p_new) <> 'object' THEN COALESCE(p_stored, p_new)
    WHEN jsonb_typeof(p_stored) = 'object' THEN p_stored || p_new
    ELSE p_new
  END;
$function$;

CREATE OR REPLACE FUNCTION public.merge_homework_audio_answers(p_stored jsonb, p_new jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN jsonb_typeof(p_stored) = 'object' AND jsonb_typeof(p_new) = 'object' THEN p_stored || p_new
    WHEN jsonb_typeof(p_new) = 'object' THEN p_new
    ELSE p_stored
  END;
$function$;

-- Stored ratings with the sent ones merged per (question_index, name), minus
-- ratings of questions that have no answer in the merged answers (a cleared
-- input). Sorted, so an unchanged save compares equal in the event trigger.
CREATE OR REPLACE FUNCTION public.merge_homework_item_evaluations(p_stored jsonb, p_new jsonb, p_answers jsonb, p_audio jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT e FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_stored) = 'array' THEN p_stored ELSE '[]'::jsonb END) e
  ), n AS (
    SELECT e FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_new) = 'array' THEN p_new ELSE '[]'::jsonb END) e
  ), merged AS (
    SELECT s.e FROM s
    WHERE NOT EXISTS (
      SELECT 1 FROM n
      WHERE n.e->>'question_index' = s.e->>'question_index' AND n.e->>'name' = s.e->>'name'
    )
    UNION ALL
    SELECT n.e FROM n
  ), kept AS (
    SELECT m.e FROM merged m
    WHERE CASE
      WHEN jsonb_typeof(m.e) = 'object' AND (m.e->>'question_index') ~ '^[0-9]{1,4}$'
        THEN public.homework_question_has_answer(p_answers, p_audio, (m.e->>'question_index')::integer)
      ELSE false
    END
  )
  SELECT CASE WHEN count(*) = 0 THEN NULL
              ELSE jsonb_agg(k.e ORDER BY (k.e->>'question_index')::integer, k.e->>'name') END
  FROM kept k;
$function$;

REVOKE ALL ON FUNCTION public.homework_answer_value_present(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.homework_question_has_answer(jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sanitize_homework_item_evaluations(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_homework_answers(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_homework_audio_answers(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_homework_item_evaluations(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.homework_answer_value_present(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.homework_question_has_answer(jsonb, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sanitize_homework_item_evaluations(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_homework_answers(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_homework_audio_answers(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_homework_item_evaluations(jsonb, jsonb, jsonb, jsonb) TO service_role;

-- 1. save_homework_answer (merge by key, validated ratings) ----------------

CREATE OR REPLACE FUNCTION public.save_homework_answer(p_homework_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_audio_answers jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_answer_id UUID;
  v_exercises jsonb;
  v_exercise jsonb;
  v_type text := p_exercise_type;
  v_items jsonb := p_item_evaluations;
  v_audio jsonb := COALESCE(p_audio_answers, '{}'::jsonb);
BEGIN
  -- Once the student submitted, no new exercise row may appear either.
  IF EXISTS (
    SELECT 1 FROM public.homework_student_answers hs
    WHERE hs.homework_id = p_homework_id
      AND hs.student_email = LOWER(TRIM(p_student_email))
      AND hs.is_submitted = TRUE
  ) THEN
    RETURN NULL;
  END IF;

  -- The exercise index and type come from the homework snapshot; ratings are
  -- reduced to skills of that exercise (the client used to be trusted blindly).
  SELECT ha.selected_exercises INTO v_exercises
  FROM public.homework_assignments ha
  WHERE ha.id = p_homework_id;
  IF NOT FOUND OR p_exercise_index < 0 THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(v_exercises) = 'array' THEN
    v_exercise := v_exercises -> p_exercise_index;
    IF v_exercise IS NULL OR jsonb_typeof(v_exercise) <> 'object' THEN
      RETURN NULL;
    END IF;
    v_type := COALESCE(NULLIF(v_exercise->>'type', ''), p_exercise_type);
    v_items := public.sanitize_homework_item_evaluations(v_exercise, p_item_evaluations);
  END IF;

  INSERT INTO public.homework_student_answers (
    homework_id, student_email, exercise_index, exercise_type,
    answers, time_spent_ms, mastery, item_evaluations, audio_answers,
    is_submitted, started_at, last_saved_at
  )
  VALUES (
    p_homework_id, LOWER(TRIM(p_student_email)), p_exercise_index, v_type,
    p_answers,
    CASE WHEN p_time_spent_ms IS NULL THEN NULL ELSE LEAST(GREATEST(p_time_spent_ms, 0), 21600000) END,
    CASE WHEN p_mastery IS NULL THEN NULL ELSE LEAST(GREATEST(p_mastery, 0), 100) END,
    public.merge_homework_item_evaluations(NULL, v_items, p_answers, v_audio),
    v_audio,
    FALSE, NOW(), NOW()
  )
  ON CONFLICT (homework_id, student_email, exercise_index)
  DO UPDATE SET
    answers = public.merge_homework_answers(homework_student_answers.answers, EXCLUDED.answers),
    exercise_type = EXCLUDED.exercise_type,
    time_spent_ms = GREATEST(homework_student_answers.time_spent_ms, EXCLUDED.time_spent_ms),
    mastery = EXCLUDED.mastery,
    item_evaluations = public.merge_homework_item_evaluations(
      homework_student_answers.item_evaluations,
      v_items,
      public.merge_homework_answers(homework_student_answers.answers, EXCLUDED.answers),
      public.merge_homework_audio_answers(homework_student_answers.audio_answers, EXCLUDED.audio_answers)
    ),
    audio_answers = public.merge_homework_audio_answers(homework_student_answers.audio_answers, EXCLUDED.audio_answers),
    eval_trigger = NULL,
    last_saved_at = NOW()
  WHERE homework_student_answers.is_submitted = FALSE
  RETURNING id INTO v_answer_id;

  RETURN v_answer_id;
END;
$function$;

-- 2. share-token save: the owner teacher never writes a student's rows -------

CREATE OR REPLACE FUNCTION public.save_homework_answer_by_share_token(p_share_token text, p_homework_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_audio_answers jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_homework_student_access(p_share_token, p_homework_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for homework' USING ERRCODE = '42501';
  END IF;
  -- "View as student" lets the owner read the page; it must not write answers
  -- (a bare blur used to overwrite the student's newer answers from a stale snapshot).
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.homework_assignments ha
    WHERE ha.id = p_homework_id AND ha.teacher_id = auth.uid()
  ) THEN
    RETURN NULL;
  END IF;
  RETURN public.save_homework_answer(
    p_homework_id, p_student_email, p_exercise_index, p_exercise_type, p_answers,
    p_time_spent_ms, p_mastery, p_item_evaluations, p_audio_answers
  );
END;
$function$;

-- 3. update_homework_answer_by_share_token: grading is server-owned ---------

CREATE OR REPLACE FUNCTION public.update_homework_answer_by_share_token(p_share_token text, p_homework_id uuid, p_student_email text, p_exercise_index integer, p_answers jsonb DEFAULT NULL::jsonb, p_ai_evaluation jsonb DEFAULT NULL::jsonb, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_mastery integer DEFAULT NULL::integer, p_eval_trigger text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exercise jsonb;
BEGIN
  IF NOT public.has_homework_student_access(p_share_token, p_homework_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for homework' USING ERRCODE = '42501';
  END IF;

  -- A student (anonymous or signed in as someone else) may not write grading:
  -- answers, ai_evaluation, item_evaluations, mastery and eval_trigger are
  -- written only by the service role after submit (process-pending-ai-evaluations).
  -- Calls of an older client are accepted and ignored, so an open tab keeps working.
  IF NOT (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.homework_assignments ha
    WHERE ha.id = p_homework_id AND ha.teacher_id = auth.uid()
  )) THEN
    RETURN EXISTS (
      SELECT 1 FROM public.homework_student_answers a
      WHERE a.homework_id = p_homework_id
        AND lower(a.student_email) = lower(trim(p_student_email))
        AND a.exercise_index = p_exercise_index
    );
  END IF;

  SELECT ha.selected_exercises -> p_exercise_index INTO v_exercise
  FROM public.homework_assignments ha
  WHERE ha.id = p_homework_id AND jsonb_typeof(ha.selected_exercises) = 'array' AND p_exercise_index >= 0;

  UPDATE public.homework_student_answers
     SET answers          = COALESCE(p_answers, answers),
         ai_evaluation    = COALESCE(p_ai_evaluation, ai_evaluation),
         item_evaluations = COALESCE(public.sanitize_homework_item_evaluations(v_exercise, p_item_evaluations), item_evaluations),
         mastery          = COALESCE(CASE WHEN p_mastery IS NULL THEN NULL ELSE LEAST(GREATEST(p_mastery, 0), 100) END, mastery),
         eval_trigger     = COALESCE(p_eval_trigger, eval_trigger)
   WHERE homework_id = p_homework_id
     AND lower(student_email) = lower(trim(p_student_email))
     AND exercise_index = p_exercise_index;

  RETURN FOUND;
END;
$function$;

-- 4. submit_homework_answers: notification and event are created here -------

CREATE OR REPLACE FUNCTION public.submit_homework_answers(p_homework_id uuid, p_student_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows integer;
  v_found boolean;
  v_hw record;
  v_answered integer;
  v_first boolean;
BEGIN
  SELECT ha.completed_at IS NULL INTO v_first FROM public.homework_assignments ha WHERE ha.id = p_homework_id;

  -- Mark all answers as submitted
  UPDATE public.homework_student_answers
  SET
    is_submitted = true,
    submitted_at = NOW()
  WHERE homework_id = p_homework_id
    AND lower(student_email) = lower(trim(p_student_email))
    AND is_submitted = false;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Also mark the homework assignment as completed (the first completion date is kept)
  UPDATE public.homework_assignments
  SET
    completed_at = COALESCE(completed_at, NOW()),
    updated_at = NOW()
  WHERE id = p_homework_id;
  v_found := FOUND;

  -- Teacher notification and DSLM homework_submitted event no longer depend on
  -- the student's tab staying open through the AI phase. Idempotent, and a
  -- failure here never blocks the submit itself.
  IF v_found AND (v_rows > 0 OR COALESCE(v_first, false)) THEN
    BEGIN
      SELECT ha.id, ha.student_id, ha.teacher_id, ha.selected_exercises INTO v_hw
      FROM public.homework_assignments ha WHERE ha.id = p_homework_id;

      IF NOT EXISTS (
        SELECT 1 FROM public.homework_notifications hn
        WHERE hn.homework_id = p_homework_id AND hn.notification_type = 'completed' AND hn.is_read = FALSE
      ) THEN
        PERFORM public.insert_homework_submission_notification(p_homework_id, NULL);
      END IF;

      IF v_hw.student_id IS NOT NULL AND v_hw.teacher_id IS NOT NULL THEN
        SELECT count(*) INTO v_answered
        FROM public.homework_student_answers a
        WHERE a.homework_id = p_homework_id
          AND lower(a.student_email) = lower(trim(p_student_email))
          AND (EXISTS (
                 SELECT 1
                 FROM jsonb_each(CASE WHEN jsonb_typeof(a.answers) = 'object' THEN a.answers ELSE '{}'::jsonb END) kv
                 WHERE kv.key ~ '^[0-9]+(_[0-9]+)?$' AND public.homework_answer_value_present(kv.value))
               OR (jsonb_typeof(a.audio_answers) = 'object' AND a.audio_answers <> '{}'::jsonb));

        -- One homework_submitted event per homework (idempotent: a repeated
        -- submit or an older client calling log_homework_submitted_event adds none).
        IF NOT EXISTS (
          SELECT 1 FROM public.student_events se
          WHERE se.source_id = p_homework_id AND se.event_type = 'homework_submitted'
        ) THEN
          PERFORM public.add_student_event_internal(
            p_student_id => v_hw.student_id,
            p_teacher_id => v_hw.teacher_id,
            p_event_type => 'homework_submitted',
            p_event_source => 'homework',
            p_source_id => p_homework_id,
            p_event_payload => jsonb_build_object(
              'homework_id', p_homework_id,
              'total_exercises', CASE WHEN jsonb_typeof(v_hw.selected_exercises) = 'array' THEN jsonb_array_length(v_hw.selected_exercises) ELSE NULL END,
              'answered_exercises', v_answered
            )
          );
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'submit_homework_answers side effects failed: %', SQLERRM;
    END;
  END IF;

  RETURN v_found;
END;
$function$;
