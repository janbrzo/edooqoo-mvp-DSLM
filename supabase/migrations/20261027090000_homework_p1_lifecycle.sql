-- Homework P1.2: the assignment, not the answer rows, decides whether a homework is open.
--
-- Backward compatible with the published client:
--  * save_homework_answer refuses writes once the assignment is completed (a
--    student return, an empty submit or the teacher's "Mark done"); before, only
--    submitted ROWS locked, so a stale tab could still write after Mark done and
--    an empty submit left the homework writable forever.
--  * submit_homework_answers is refused for a homework the teacher closed
--    (message 'homework_closed'); the result used to be stored, graded, fed into
--    DSLM and hidden from the review queue.
--  * mark_homework_completed_internal no longer overwrites a student return with a
--    teacher close or re-dates a close, and no longer fails silently for homework
--    whose student was removed (inner JOIN on students).
--  * reopen_homework lets the owner undo a teacher close.
--  * get_homework_state_by_share_token adds completed_by_teacher to the student
--    status read (the old get_homework_status_by_share_token keeps working).

SET LOCAL lock_timeout = '5s';

-- 1. save_homework_answer: assignment-level lock ---------------------------------

CREATE OR REPLACE FUNCTION public.save_homework_answer(p_homework_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_audio_answers jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_answer_id UUID;
  v_exercises jsonb;
  v_completed timestamptz;
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
  SELECT ha.selected_exercises, ha.completed_at INTO v_exercises, v_completed
  FROM public.homework_assignments ha
  WHERE ha.id = p_homework_id;
  IF NOT FOUND OR p_exercise_index < 0 THEN
    RETURN NULL;
  END IF;
  -- A completed assignment (student return, empty submit, teacher Mark done) is closed.
  IF v_completed IS NOT NULL THEN
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

-- 2. submit_homework_answers: a teacher-closed homework takes no submission -------

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
  v_closed boolean;
BEGIN
  SELECT ha.completed_at IS NULL, COALESCE(ha.completed_by_teacher, false)
    INTO v_first, v_closed
  FROM public.homework_assignments ha WHERE ha.id = p_homework_id;

  -- The teacher closed this homework (Mark done): a late submission would be graded
  -- and feed DSLM, but never reach the review queue. The student page says why.
  IF v_closed THEN
    RAISE EXCEPTION 'homework_closed: the teacher closed this homework' USING ERRCODE = 'P0001';
  END IF;

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

        -- One homework_submitted event per homework (idempotent: a repeated submit adds
        -- none; an older client calling log_homework_submitted_event replaces it).
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

-- 3. mark_homework_completed_internal: idempotent, never turns a student return into a close

CREATE OR REPLACE FUNCTION public.mark_homework_completed_internal(p_homework_id uuid, p_user_id uuid, p_is_teacher boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_homework RECORD;
  v_notification_id UUID;
BEGIN
  -- LEFT JOIN: a homework whose student was removed can still be closed by its teacher.
  SELECT
    ha.id,
    ha.title,
    ha.teacher_id,
    ha.student_id,
    ha.completed_at,
    ha.completed_by_teacher,
    COALESCE(s.name, 'Student') AS student_name
  INTO v_homework
  FROM public.homework_assignments ha
  LEFT JOIN public.students s ON ha.student_id = s.id
  WHERE ha.id = p_homework_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Homework not found'
    );
  END IF;

  -- Verify authorization
  IF p_is_teacher AND p_user_id IS DISTINCT FROM v_homework.teacher_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Already completed (returned by the student, or already closed): keep the first
  -- completion, so Mark done never re-dates it nor turns a student return into a
  -- teacher close (which would drop it from the review queue).
  IF p_is_teacher AND v_homework.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'homework_id', p_homework_id,
      'already_completed', true,
      'completed_at', v_homework.completed_at,
      'completed_by_teacher', COALESCE(v_homework.completed_by_teacher, false)
    );
  END IF;

  -- Update homework completion status
  UPDATE public.homework_assignments
  SET
    completed_at = NOW(),
    completed_by_teacher = p_is_teacher,
    updated_at = NOW()
  WHERE id = p_homework_id;

  -- Create notification for teacher (only if student completed it)
  IF NOT p_is_teacher THEN
    INSERT INTO public.homework_notifications (
      teacher_id,
      homework_id,
      student_id,
      notification_type,
      message
    ) VALUES (
      v_homework.teacher_id,
      p_homework_id,
      v_homework.student_id,
      'completed',
      format('%s has completed homework: %s', v_homework.student_name, v_homework.title)
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'homework_id', p_homework_id,
    'completed_at', NOW(),
    'completed_by_teacher', p_is_teacher,
    'notification_id', v_notification_id
  );
END;
$function$;

-- 4. reopen_homework: the owner undoes a teacher close --------------------------------

CREATE OR REPLACE FUNCTION public.reopen_homework(p_homework_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hw RECORD;
BEGIN
  SELECT ha.teacher_id, ha.completed_at, ha.completed_by_teacher
  INTO v_hw
  FROM public.homework_assignments ha
  WHERE ha.id = p_homework_id;

  IF NOT FOUND OR v_hw.teacher_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to reopen this homework' USING ERRCODE = '42501';
  END IF;

  -- Only a teacher close can be undone here; a student return keeps its answers,
  -- grading and review (a retake is a separate product decision).
  IF v_hw.completed_at IS NULL OR COALESCE(v_hw.completed_by_teacher, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only a homework marked done by the teacher can be reopened');
  END IF;

  UPDATE public.homework_assignments
  SET completed_at = NULL,
      completed_by_teacher = false,
      updated_at = NOW()
  WHERE id = p_homework_id;

  RETURN jsonb_build_object('success', true, 'homework_id', p_homework_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.reopen_homework(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_homework(uuid) TO authenticated, service_role;

-- 5. student status read with completed_by_teacher -----------------------------------

CREATE OR REPLACE FUNCTION public.get_homework_state_by_share_token(p_share_token text)
 RETURNS TABLE(id uuid, reviewed_at timestamp with time zone, completed_at timestamp with time zone, completed_by_teacher boolean, source_worksheet_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.reviewed_at, h.completed_at, COALESCE(h.completed_by_teacher, false), h.source_worksheet_id
  FROM public.homework_assignments h
  WHERE h.share_token = p_share_token
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_homework_state_by_share_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_homework_state_by_share_token(text) TO anon, authenticated, service_role;
