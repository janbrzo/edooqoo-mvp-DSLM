-- Homework answer events belong to the student the homework was assigned to.
--
-- log_homework_answer_to_events looked the student up by the e-mail typed on the answer row: after
-- the teacher edited the student's address, or re-added the student, the evidence was dropped or
-- went to another student. The homework's own student_id is now the source, the e-mail match stays
-- as the fallback for a homework without one. Body otherwise identical to production (2026-10-28).
CREATE OR REPLACE FUNCTION public.log_homework_answer_to_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher_id uuid;
  v_student_id uuid;
  v_event_type text;
  v_written_ratings jsonb;
  v_audio_ratings jsonb;
  v_written_mastery numeric;
  v_audio_mastery numeric;
  v_has_text boolean;
  v_has_audio boolean;
BEGIN
  -- Nothing the events are built from changed (e.g. an ai_evaluation-only write):
  -- keep the existing events instead of deleting and re-dating them.
  IF TG_OP = 'UPDATE'
     AND NEW.answers IS NOT DISTINCT FROM OLD.answers
     AND NEW.item_evaluations IS NOT DISTINCT FROM OLD.item_evaluations
     AND NEW.audio_answers IS NOT DISTINCT FROM OLD.audio_answers
     AND NEW.mastery IS NOT DISTINCT FROM OLD.mastery
     AND NEW.eval_trigger IS NOT DISTINCT FROM OLD.eval_trigger
     AND NEW.exercise_type IS NOT DISTINCT FROM OLD.exercise_type THEN
    RETURN NEW;
  END IF;

  v_event_type := CASE 
    WHEN NEW.eval_trigger = '10min_inactivity' THEN '10min_AI_evaluation'
    WHEN NEW.eval_trigger = 'create_homework' THEN 'create_hw_AI_evaluation'
    WHEN NEW.eval_trigger = 'submit_homework' THEN 'submit_hw_AI_evaluation'
    ELSE 'student_learning_activity'
  END;

  -- The evidence belongs to the student the homework was assigned to, never to whoever currently
  -- owns the typed e-mail: an edited address, or a re-added student, used to drop or misdirect it.
  SELECT ha.teacher_id, ha.student_id INTO v_teacher_id, v_student_id
  FROM homework_assignments ha WHERE ha.id = NEW.homework_id;
  IF v_teacher_id IS NULL THEN RETURN NEW; END IF;

  IF v_student_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM students s WHERE s.id = v_student_id AND s.deleted_at IS NULL
  ) THEN
    v_student_id := NULL;
  END IF;
  IF v_student_id IS NULL THEN
    SELECT s.id INTO v_student_id FROM students s
    WHERE lower(s.student_email) = lower(NEW.student_email) AND s.teacher_id = v_teacher_id AND s.deleted_at IS NULL LIMIT 1;
  END IF;
  IF v_student_id IS NULL THEN RETURN NEW; END IF;

  -- GUARD: Skip re-logging if this exercise already has submit-evaluated events
  -- and the current update is NOT a new submit evaluation.
  -- This prevents transcription persistence or other post-submit updates from
  -- overwriting correct AI evaluation results with empty nano_skill_ratings.
  IF NEW.eval_trigger IS DISTINCT FROM 'submit_homework' AND EXISTS (
    SELECT 1 FROM student_events 
    WHERE student_id = v_student_id 
      AND source_id = NEW.homework_id
      AND (event_payload->>'exercise_index')::int = NEW.exercise_index
      AND event_type = 'submit_hw_AI_evaluation'
  ) THEN
    RETURN NEW;
  END IF;

  v_has_text := NEW.answers IS NOT NULL AND NEW.answers != '{}'::jsonb;
  v_has_audio := NEW.audio_answers IS NOT NULL AND NEW.audio_answers != '{}'::jsonb;

  -- Build separate ratings for written vs audio questions
  IF NEW.item_evaluations IS NOT NULL THEN
    IF v_has_audio THEN
      SELECT jsonb_agg(elem - 'feedback') INTO v_written_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE
        AND NOT (NEW.audio_answers ? (elem->>'question_index'));

      SELECT jsonb_agg(elem - 'feedback') INTO v_audio_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE
        AND (NEW.audio_answers ? (elem->>'question_index'));
    ELSE
      SELECT jsonb_agg(elem - 'feedback') INTO v_written_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE;
    END IF;
  END IF;

  v_written_mastery := NEW.mastery;
  v_audio_mastery := NEW.mastery;

  IF v_written_ratings IS NOT NULL AND jsonb_array_length(v_written_ratings) > 0 THEN
    SELECT ROUND(AVG((elem->>'mastery')::numeric)) INTO v_written_mastery
    FROM jsonb_array_elements(v_written_ratings) AS elem
    WHERE (elem->>'mastery')::numeric >= 0 AND (elem->>'hasValue')::boolean = true;
  END IF;

  IF v_audio_ratings IS NOT NULL AND jsonb_array_length(v_audio_ratings) > 0 THEN
    SELECT ROUND(AVG((elem->>'mastery')::numeric)) INTO v_audio_mastery
    FROM jsonb_array_elements(v_audio_ratings) AS elem
    WHERE (elem->>'mastery')::numeric >= 0 AND (elem->>'hasValue')::boolean = true;
  END IF;

  DELETE FROM student_events
  WHERE student_id = v_student_id AND source_id = NEW.homework_id
    AND event_source = 'homework'
    AND (event_payload->>'exercise_index')::int = NEW.exercise_index;

  IF v_has_text THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'homework', NEW.homework_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'written', 'is_submitted', NEW.is_submitted, 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', COALESCE(v_written_ratings, '[]'::jsonb)),
      ARRAY(SELECT elem->>'name' FROM jsonb_array_elements(COALESCE(v_written_ratings, '[]'::jsonb)) AS elem WHERE elem->>'name' IS NOT NULL),
      NEW.exercise_type, NULL, v_written_mastery);
  END IF;

  IF v_has_audio THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'homework', NEW.homework_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'audio', 'audio_answers', NEW.audio_answers, 'is_submitted', NEW.is_submitted, 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', COALESCE(v_audio_ratings, '[]'::jsonb)),
      ARRAY(SELECT elem->>'name' FROM jsonb_array_elements(COALESCE(v_audio_ratings, '[]'::jsonb)) AS elem WHERE elem->>'name' IS NOT NULL),
      NEW.exercise_type, NULL, v_audio_mastery);
  END IF;

  IF NOT v_has_text AND NOT v_has_audio THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'homework', NEW.homework_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'empty', 'is_submitted', NEW.is_submitted, 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', '[]'::jsonb),
      NULL, NEW.exercise_type, NULL, NULL);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_homework_answer_to_events error: %', SQLERRM;
  BEGIN
    INSERT INTO public.dslm_event_errors (source, row_id, message) VALUES ('log_homework_answer_to_events', NEW.id, SQLERRM);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$function$;
