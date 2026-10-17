-- W2 (part 1): saving a worksheet exercise merges its answers instead of replacing the map.
--
-- Built on the iteration 8 definition of save_worksheet_answer (9 arguments) from
-- 20261015090400_homework_ai_queue_and_worksheet_save.sql: everything that function does
-- (changed-answer detection, ai_alternative ratings kept on a re-save, ai_evaluation cleared
-- on a changed answer, eval_trigger handling) is unchanged; the only difference is that the
-- map sent by the client is merged over the stored one before it is compared and stored.
-- Before: `answers = EXCLUDED.answers`, so a tab that had not seen another tab's keys (or the
-- `_transcription_N` keys of the evaluation queue) erased them on its next save: last write
-- wins on the whole exercise (audit 2026-10, S-B2, L2-02). The client never deletes a key
-- (clearing an input stores an empty string), so a cleared answer still overwrites the old value.
--
-- APPLY ORDER: after 20261015090400 (this file replaces its function and refuses to run before it).
-- Rollback: re-run the 9-argument definition from 20261015090400.

SET LOCAL lock_timeout = '5s';

DO $guard$
BEGIN
  IF to_regprocedure('public.worksheet_answers_differ(jsonb, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261015090400 before this migration (it defines worksheet_answers_differ)';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.save_worksheet_answer(p_worksheet_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_audio_answers jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_old public.worksheet_student_answers%ROWTYPE;
  v_found boolean;
  v_changed boolean;
  v_items jsonb;
  v_kept boolean;
  v_merged jsonb;
BEGIN
  SELECT * INTO v_old
  FROM public.worksheet_student_answers
  WHERE worksheet_id = p_worksheet_id
    AND student_email = lower(p_student_email)
    AND exercise_index = p_exercise_index
  FOR UPDATE;
  v_found := FOUND;
  -- W2: the new map is merged over the stored one (`stored || new`), so a stale tab cannot
  -- erase another tab's keys or the `_transcription_N` keys written by the evaluation queue.
  v_merged := CASE
    WHEN v_found AND jsonb_typeof(v_old.answers) = 'object' AND jsonb_typeof(p_answers) = 'object'
    THEN v_old.answers || p_answers
    ELSE p_answers
  END;
  v_changed := NOT v_found OR public.worksheet_answers_differ(v_old.answers, v_merged);
  v_items := public.keep_ai_alternative_ratings(v_old.item_evaluations, p_item_evaluations);
  v_kept := NOT v_changed AND v_items IS DISTINCT FROM p_item_evaluations;

  INSERT INTO public.worksheet_student_answers (
    worksheet_id, student_email, exercise_index, exercise_type,
    answers, started_at, last_saved_at, time_spent_ms, mastery, item_evaluations, audio_answers
  )
  VALUES (
    p_worksheet_id, lower(p_student_email), p_exercise_index, p_exercise_type,
    v_merged, NOW(), NOW(), COALESCE(p_time_spent_ms, 0), p_mastery, p_item_evaluations,
    COALESCE(p_audio_answers, '{}'::jsonb)
  )
  ON CONFLICT (worksheet_id, student_email, exercise_index)
  DO UPDATE SET
    answers = EXCLUDED.answers,
    last_saved_at = NOW(),
    time_spent_ms = COALESCE(EXCLUDED.time_spent_ms, worksheet_student_answers.time_spent_ms),
    ai_evaluation = CASE WHEN v_changed THEN NULL ELSE worksheet_student_answers.ai_evaluation END,
    mastery = CASE
      WHEN v_changed THEN EXCLUDED.mastery
      WHEN v_kept THEN worksheet_student_answers.mastery
      ELSE COALESCE(EXCLUDED.mastery, worksheet_student_answers.mastery)
    END,
    item_evaluations = CASE
      WHEN v_changed THEN EXCLUDED.item_evaluations
      ELSE COALESCE(v_items, worksheet_student_answers.item_evaluations)
    END,
    audio_answers = CASE
      WHEN EXCLUDED.audio_answers IS NOT NULL AND EXCLUDED.audio_answers != '{}'::jsonb
      THEN EXCLUDED.audio_answers
      ELSE worksheet_student_answers.audio_answers
    END,
    eval_trigger = CASE WHEN v_changed THEN NULL ELSE worksheet_student_answers.eval_trigger END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
