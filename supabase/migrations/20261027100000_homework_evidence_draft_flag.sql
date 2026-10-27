-- Homework P1.3a: draft evidence is marked as such and finalised at submit.
--
-- DSLM_EVENT_WEIGHT_VERSION 1 (owner decision 2026-10-26): a homework event counts 1.0 once
-- the exercise was submitted and 0.8 while it is only a draft, so work that was done but
-- never sent is not lost. compute_skill_metric applies the weight (20261027100100).
--
--  * dslm_event_weight: the single rule, parity-checked by src/lib/__tests__/homeworkEvidenceWeight.test.ts.
--  * submit_homework_answers also flips event_payload.is_submitted of the submitted
--    exercises to true: the answer trigger ignores a submit-only change, so the flag used to
--    stay false forever for exercises the AI never re-evaluated (matching, choice, true/false).
--  * Backfill: events whose exercise is submitted but whose flag is still false (7 on production).

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.dslm_event_weight(p_event_source text, p_payload jsonb)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_event_source = 'homework' AND p_payload->>'is_submitted' = 'false' THEN 0.8
    ELSE 1.0
  END::numeric;
$function$;

REVOKE ALL ON FUNCTION public.dslm_event_weight(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dslm_event_weight(text, jsonb) TO service_role;

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

      -- The ratings of the exercises just submitted stop being drafts (weight 1.0 instead
      -- of 0.8, see dslm_event_weight); the answer trigger skips a submit-only change.
      UPDATE public.student_events se
      SET event_payload = jsonb_set(se.event_payload, '{is_submitted}', 'true'::jsonb)
      WHERE se.event_source = 'homework'
        AND se.source_id = p_homework_id
        AND se.event_payload->>'is_submitted' = 'false'
        AND (se.event_payload->>'exercise_index')::integer IN (
          SELECT a.exercise_index
          FROM public.homework_student_answers a
          WHERE a.homework_id = p_homework_id
            AND lower(a.student_email) = lower(trim(p_student_email))
            AND a.is_submitted
        );

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

UPDATE public.student_events se
SET event_payload = jsonb_set(se.event_payload, '{is_submitted}', 'true'::jsonb)
WHERE se.event_source = 'homework'
  AND se.event_payload->>'is_submitted' = 'false'
  AND EXISTS (
    SELECT 1 FROM public.homework_student_answers a
    WHERE a.homework_id = se.source_id
      AND a.exercise_index = (se.event_payload->>'exercise_index')::integer
      AND a.is_submitted
  );
