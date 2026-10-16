-- W2: a submitted homework is locked on the server.
--
-- 1. save_homework_answer kept overwriting a row after the student submitted it: the
--    teacher's homework view saves on blur with its own (possibly stale) snapshot, and
--    an old tab could do the same (audit 2026-10, H-B1, H-B3). The update now applies
--    only while the row is not submitted; a save on a submitted row changes nothing and
--    returns NULL, and so does a save for an exercise that had no row yet once any row
--    of that student's homework is submitted (production has one homework where an
--    exercise row was inserted after the submit and made the page look unsubmitted).
--    The post-submit AI phase writes through update_homework_answer_by_share_token,
--    which is not affected.
-- 2. submit_homework_answers re-dated completed_at on every call (a repeated student
--    submit moved the date); the first completion date is kept. mark_homework_completed
--    (teacher) still sets completed_at itself and is not changed here.
--
-- Rollback: re-run the definitions from 20261016090000 / 20261014090000.

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.save_homework_answer(p_homework_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_audio_answers jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_answer_id UUID;
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

  INSERT INTO public.homework_student_answers (
    homework_id, student_email, exercise_index, exercise_type,
    answers, time_spent_ms, mastery, item_evaluations, audio_answers,
    is_submitted, started_at, last_saved_at
  )
  VALUES (
    p_homework_id, LOWER(TRIM(p_student_email)), p_exercise_index, p_exercise_type,
    p_answers, p_time_spent_ms, p_mastery, p_item_evaluations,
    COALESCE(p_audio_answers, '{}'::jsonb),
    FALSE, NOW(), NOW()
  )
  ON CONFLICT (homework_id, student_email, exercise_index)
  DO UPDATE SET
    answers = CASE
      WHEN jsonb_typeof(homework_student_answers.answers) = 'object' AND jsonb_typeof(EXCLUDED.answers) = 'object'
      THEN homework_student_answers.answers || EXCLUDED.answers
      ELSE EXCLUDED.answers
    END,
    exercise_type = EXCLUDED.exercise_type,
    time_spent_ms = EXCLUDED.time_spent_ms,
    mastery = EXCLUDED.mastery,
    item_evaluations = EXCLUDED.item_evaluations,
    audio_answers = CASE 
      WHEN EXCLUDED.audio_answers IS NOT NULL AND EXCLUDED.audio_answers != '{}'::jsonb 
      THEN EXCLUDED.audio_answers 
      ELSE homework_student_answers.audio_answers 
    END,
    eval_trigger = NULL,
    last_saved_at = NOW()
  WHERE homework_student_answers.is_submitted = FALSE
  RETURNING id INTO v_answer_id;
  
  RETURN v_answer_id;
END;
$function$;

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

  -- Also mark the homework assignment as completed (the first completion date is kept)
  UPDATE public.homework_assignments
  SET
    completed_at = COALESCE(completed_at, NOW()),
    updated_at = NOW()
  WHERE id = p_homework_id;

  RETURN FOUND;
END;
$function$;
