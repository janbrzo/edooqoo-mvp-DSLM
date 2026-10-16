-- W2: saving an exercise merges its answers instead of replacing the whole map.
--
-- save_worksheet_answer / save_homework_answer (9 arguments) did
-- `answers = EXCLUDED.answers`, so a tab that had not seen another tab's keys (or
-- the `_transcription_N` keys written by process-pending-ai-evaluations) erased
-- them on its next save: last write wins on the whole exercise (audit 2026-10,
-- S-B2, L2-02). The new map is now merged over the stored one (`stored || new`):
-- keys that are sent win, keys that are not sent stay. The client never deletes a
-- key (clearing an input stores an empty string), so a cleared answer still
-- overwrites the old value. Everything else in both functions is unchanged.
--
-- Rollback: re-run the two definitions from 20261012090000_dslm_pipeline_baseline.sql.

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.save_worksheet_answer(p_worksheet_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_audio_answers jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO worksheet_student_answers (
    worksheet_id, student_email, exercise_index, exercise_type,
    answers, started_at, last_saved_at, time_spent_ms, mastery, item_evaluations, audio_answers
  )
  VALUES (
    p_worksheet_id, lower(p_student_email), p_exercise_index, p_exercise_type,
    p_answers, NOW(), NOW(), COALESCE(p_time_spent_ms, 0), p_mastery, p_item_evaluations,
    COALESCE(p_audio_answers, '{}'::jsonb)
  )
  ON CONFLICT (worksheet_id, student_email, exercise_index)
  DO UPDATE SET
    answers = CASE
      WHEN jsonb_typeof(worksheet_student_answers.answers) = 'object' AND jsonb_typeof(EXCLUDED.answers) = 'object'
      THEN worksheet_student_answers.answers || EXCLUDED.answers
      ELSE EXCLUDED.answers
    END,
    last_saved_at = NOW(),
    time_spent_ms = COALESCE(EXCLUDED.time_spent_ms, worksheet_student_answers.time_spent_ms),
    mastery = COALESCE(EXCLUDED.mastery, worksheet_student_answers.mastery),
    item_evaluations = COALESCE(EXCLUDED.item_evaluations, worksheet_student_answers.item_evaluations),
    audio_answers = CASE 
      WHEN EXCLUDED.audio_answers IS NOT NULL AND EXCLUDED.audio_answers != '{}'::jsonb 
      THEN EXCLUDED.audio_answers 
      ELSE worksheet_student_answers.audio_answers 
    END,
    eval_trigger = NULL
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_homework_answer(p_homework_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_audio_answers jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_answer_id UUID;
BEGIN
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
  RETURNING id INTO v_answer_id;
  
  RETURN v_answer_id;
END;
$function$;
