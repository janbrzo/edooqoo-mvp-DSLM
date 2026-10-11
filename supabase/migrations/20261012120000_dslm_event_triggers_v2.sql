-- DSLM event and metric triggers v2 (iteration 2 of the evaluation pipeline fixes).
--
-- 1. Answer -> event triggers (homework and worksheet)
--    - delete only the events they own (event_source homework/worksheet), so a
--      teacher's mark_done_evaluation (event_source 'teacher') is never wiped by
--      a later student save, Create Homework or an AI write;
--    - skip the delete + re-insert when nothing the events are built from
--      changed (an ai_evaluation-only write, a repeated autosave);
--    - match the student email case-insensitively;
--    - record failures in dslm_event_errors instead of only a WARNING.
-- 2. Skill metrics follow every change of student_events, not only INSERT:
--    UPDATE (Welcome Test AI scores, Mark done re-evaluation) and DELETE
--    recompute the affected skills; a skill left without events loses its
--    metric row instead of keeping a stale value.
-- 3. Mark done re-evaluation and undo go through teacher-checked RPCs
--    (student_events has no UPDATE/DELETE policy for teachers, so the old
--    direct writes silently changed nothing).
--
-- Bodies are the production definitions from 20261012090000 with only the
-- changes above.

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.dslm_event_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  row_id uuid,
  message text
);
ALTER TABLE public.dslm_event_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dslm_event_errors FROM anon, authenticated;

-- log_worksheet_answer_to_events
CREATE OR REPLACE FUNCTION public.log_worksheet_answer_to_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher_id uuid;
  v_student_id uuid;
  v_event_type text;
  v_all_ratings jsonb;
  v_written_ratings jsonb;
  v_audio_ratings jsonb;
  v_written_mastery numeric;
  v_audio_mastery numeric;
  v_source_id uuid;
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

  SELECT COALESCE(w.teacher_id, w.user_id) INTO v_teacher_id
  FROM worksheets w WHERE w.id = NEW.worksheet_id;
  IF v_teacher_id IS NULL THEN RETURN NEW; END IF;

  SELECT s.id INTO v_student_id FROM students s
  WHERE lower(s.student_email) = lower(NEW.student_email) AND s.teacher_id = v_teacher_id AND s.deleted_at IS NULL LIMIT 1;
  IF v_student_id IS NULL THEN RETURN NEW; END IF;

  v_source_id := NEW.worksheet_id;
  v_has_text := NEW.answers IS NOT NULL AND NEW.answers != '{}'::jsonb;
  v_has_audio := NEW.audio_answers IS NOT NULL AND NEW.audio_answers != '{}'::jsonb;

  -- Build separate ratings for written vs audio questions
  IF NEW.item_evaluations IS NOT NULL THEN
    IF v_has_audio THEN
      -- Written: ratings for questions NOT in audio_answers
      SELECT jsonb_agg(elem - 'feedback') INTO v_written_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE
        AND NOT (NEW.audio_answers ? (elem->>'question_index'));

      -- Audio: ratings for questions IN audio_answers
      SELECT jsonb_agg(elem - 'feedback') INTO v_audio_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE
        AND (NEW.audio_answers ? (elem->>'question_index'));
    ELSE
      -- No audio, all ratings go to written
      SELECT jsonb_agg(elem - 'feedback') INTO v_written_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE;
    END IF;
  END IF;

  -- Calculate mastery per response type
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
  WHERE student_id = v_student_id AND source_id = v_source_id
    AND event_source = 'worksheet'
    AND (event_payload->>'exercise_index')::int = NEW.exercise_index;

  IF v_has_text THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'worksheet', v_source_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'written', 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', COALESCE(v_written_ratings, '[]'::jsonb)),
      ARRAY(SELECT elem->>'name' FROM jsonb_array_elements(COALESCE(v_written_ratings, '[]'::jsonb)) AS elem WHERE elem->>'name' IS NOT NULL),
      NEW.exercise_type, NULL, v_written_mastery);
  END IF;

  IF v_has_audio THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'worksheet', v_source_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'audio', 'audio_answers', NEW.audio_answers, 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', COALESCE(v_audio_ratings, '[]'::jsonb)),
      ARRAY(SELECT elem->>'name' FROM jsonb_array_elements(COALESCE(v_audio_ratings, '[]'::jsonb)) AS elem WHERE elem->>'name' IS NOT NULL),
      NEW.exercise_type, NULL, v_audio_mastery);
  END IF;

  IF NOT v_has_text AND NOT v_has_audio THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'worksheet', v_source_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'empty', 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', '[]'::jsonb),
      NULL, NEW.exercise_type, NULL, NULL);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_worksheet_answer_to_events error: %', SQLERRM;
  BEGIN
    INSERT INTO public.dslm_event_errors (source, row_id, message) VALUES ('log_worksheet_answer_to_events', NEW.id, SQLERRM);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$function$
;

-- log_homework_answer_to_events
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

  SELECT ha.teacher_id INTO v_teacher_id FROM homework_assignments ha WHERE ha.id = NEW.homework_id;
  IF v_teacher_id IS NULL THEN RETURN NEW; END IF;

  SELECT s.id INTO v_student_id FROM students s
  WHERE lower(s.student_email) = lower(NEW.student_email) AND s.teacher_id = v_teacher_id AND s.deleted_at IS NULL LIMIT 1;
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
$function$
;

-- compute_skill_metric
CREATE OR REPLACE FUNCTION public.compute_skill_metric(p_student_id uuid, p_teacher_id uuid, p_skill_name text, p_skill_category text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_weighted_sum NUMERIC := 0;
  v_weight_total NUMERIC := 0;
  v_total_events INTEGER := 0;
  v_first_at TIMESTAMPTZ;
  v_last_at TIMESTAMPTZ;
  v_current_mastery NUMERIC;
  v_trend TEXT := 'stable';
  v_history JSONB := '[]'::jsonb;
  v_recent_avg NUMERIC;
  v_older_avg NUMERIC;
  v_micro_skill TEXT;
  r RECORD;
BEGIN
  -- Extract micro_skill
  v_micro_skill := public.extract_micro_skill(p_skill_name);

  -- Gather all mastery values for this skill from nano_skill_ratings
  FOR r IN
    SELECT 
      (nsr->>'mastery')::numeric AS mastery_val,
      se.created_at,
      EXTRACT(EPOCH FROM (now() - se.created_at)) / 86400.0 AS days_ago
    FROM student_events se,
         jsonb_array_elements(se.event_payload->'nano_skill_ratings') AS nsr
    WHERE se.student_id = p_student_id
      AND se.teacher_id = p_teacher_id
      AND nsr->>'name' = p_skill_name
      AND (nsr->>'hasValue')::boolean = true
      AND (nsr->>'mastery')::numeric >= 0
    ORDER BY se.created_at ASC
  LOOP
    DECLARE
      v_weight NUMERIC;
    BEGIN
      v_weight := exp(-0.03 * r.days_ago);
      v_weighted_sum := v_weighted_sum + (r.mastery_val * v_weight);
      v_weight_total := v_weight_total + v_weight;
      v_total_events := v_total_events + 1;
      
      IF v_first_at IS NULL THEN
        v_first_at := r.created_at;
      END IF;
      v_last_at := r.created_at;
      
      v_history := v_history || jsonb_build_object(
        'mastery', r.mastery_val,
        'date', to_char(r.created_at, 'YYYY-MM-DD')
      );
    END;
  END LOOP;
  
  -- Also handle flashcard events
  IF p_skill_name LIKE 'flashcard:%' THEN
    FOR r IN
      SELECT 
        se.mastery AS mastery_val,
        se.created_at,
        EXTRACT(EPOCH FROM (now() - se.created_at)) / 86400.0 AS days_ago
      FROM student_events se
      WHERE se.student_id = p_student_id
        AND se.teacher_id = p_teacher_id
        AND se.event_source = 'flashcard'
        AND se.mastery IS NOT NULL
        AND se.event_payload->>'card_id' = substring(p_skill_name from 11)
      ORDER BY se.created_at ASC
    LOOP
      DECLARE
        v_weight NUMERIC;
      BEGIN
        v_weight := exp(-0.03 * r.days_ago);
        v_weighted_sum := v_weighted_sum + (r.mastery_val * v_weight);
        v_weight_total := v_weight_total + v_weight;
        v_total_events := v_total_events + 1;
        
        IF v_first_at IS NULL THEN
          v_first_at := r.created_at;
        END IF;
        v_last_at := r.created_at;
        
        v_history := v_history || jsonb_build_object(
          'mastery', r.mastery_val,
          'date', to_char(r.created_at, 'YYYY-MM-DD')
        );
      END;
    END LOOP;
  END IF;

  IF v_total_events = 0 THEN
    -- No supporting events left (deleted or re-scored): remove the stale metric.
    DELETE FROM public.student_skill_metrics
    WHERE student_id = p_student_id AND teacher_id = p_teacher_id AND skill_name = p_skill_name;
    RETURN;
  END IF;

  v_current_mastery := ROUND(v_weighted_sum / NULLIF(v_weight_total, 0), 1);
  
  -- Trim history to last 20
  IF jsonb_array_length(v_history) > 20 THEN
    v_history := (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_history) AS elem
        ORDER BY elem->>'date' DESC
        LIMIT 20
      ) sub
    );
  END IF;

  -- Trend: compare last 3 vs previous 3
  IF v_total_events >= 4 THEN
    SELECT AVG((elem->>'mastery')::numeric) INTO v_recent_avg
    FROM (
      SELECT elem FROM jsonb_array_elements(v_history) AS elem
      ORDER BY elem->>'date' DESC LIMIT 3
    ) sub;
    
    SELECT AVG((elem->>'mastery')::numeric) INTO v_older_avg
    FROM (
      SELECT elem FROM jsonb_array_elements(v_history) AS elem
      ORDER BY elem->>'date' DESC OFFSET 3 LIMIT 3
    ) sub;
    
    IF v_older_avg IS NOT NULL THEN
      IF v_recent_avg > v_older_avg + 10 THEN
        v_trend := 'improving';
      ELSIF v_recent_avg < v_older_avg - 10 THEN
        v_trend := 'declining';
      ELSE
        v_trend := 'stable';
      END IF;
    END IF;
  END IF;

  -- Upsert with micro_skill
  INSERT INTO public.student_skill_metrics (
    student_id, teacher_id, skill_name, skill_category, micro_skill,
    current_mastery, trend, total_events, 
    first_event_at, last_event_at, mastery_history, updated_at
  ) VALUES (
    p_student_id, p_teacher_id, p_skill_name, p_skill_category, v_micro_skill,
    v_current_mastery, v_trend, v_total_events,
    v_first_at, v_last_at, v_history, now()
  )
  ON CONFLICT (student_id, teacher_id, skill_name) DO UPDATE SET
    current_mastery = EXCLUDED.current_mastery,
    trend = EXCLUDED.trend,
    total_events = EXCLUDED.total_events,
    last_event_at = EXCLUDED.last_event_at,
    mastery_history = EXCLUDED.mastery_history,
    skill_category = EXCLUDED.skill_category,
    micro_skill = EXCLUDED.micro_skill,
    updated_at = now();
END;
$function$
;

-- refresh_skill_metrics_on_event: INSERT, UPDATE and DELETE.
-- For INSERT the set of recomputed skills is exactly the previous one.
CREATE OR REPLACE FUNCTION public.refresh_skill_metrics_on_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nsr RECORD;
  v_student_id uuid;
  v_teacher_id uuid;
BEGIN
  v_student_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.student_id ELSE NEW.student_id END;
  v_teacher_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.teacher_id ELSE NEW.teacher_id END;

  FOR nsr IN
    SELECT DISTINCT elem->>'name' AS skill_name
    FROM (
      SELECT elem FROM jsonb_array_elements(
        CASE WHEN TG_OP <> 'DELETE' AND jsonb_typeof(NEW.event_payload->'nano_skill_ratings') = 'array'
             THEN NEW.event_payload->'nano_skill_ratings' ELSE '[]'::jsonb END) AS elem
      UNION ALL
      SELECT elem FROM jsonb_array_elements(
        CASE WHEN TG_OP <> 'INSERT' AND jsonb_typeof(OLD.event_payload->'nano_skill_ratings') = 'array'
             THEN OLD.event_payload->'nano_skill_ratings' ELSE '[]'::jsonb END) AS elem
    ) ratings
    WHERE (elem->>'hasValue')::boolean = true
      AND (elem->>'mastery')::numeric >= 0
      AND elem->>'name' IS NOT NULL
  LOOP
    PERFORM public.compute_skill_metric(
      v_student_id, v_teacher_id, nsr.skill_name, public.extract_skill_category(nsr.skill_name)
    );
  END LOOP;

  -- Flashcard events
  IF TG_OP <> 'DELETE' AND NEW.event_source = 'flashcard' AND NEW.mastery IS NOT NULL THEN
    PERFORM public.compute_skill_metric(
      NEW.student_id, NEW.teacher_id, 'flashcard:' || (NEW.event_payload->>'card_id'), 'vocabulary'
    );
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.event_source = 'flashcard' AND OLD.mastery IS NOT NULL
     AND (TG_OP = 'DELETE' OR (OLD.event_payload->>'card_id') IS DISTINCT FROM (NEW.event_payload->>'card_id')) THEN
    PERFORM public.compute_skill_metric(
      OLD.student_id, OLD.teacher_id, 'flashcard:' || (OLD.event_payload->>'card_id'), 'vocabulary'
    );
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_refresh_skill_metrics_on_update ON public.student_events;
CREATE TRIGGER trg_refresh_skill_metrics_on_update
  AFTER UPDATE OF event_payload, mastery ON public.student_events
  FOR EACH ROW
  WHEN (OLD.event_payload IS DISTINCT FROM NEW.event_payload OR OLD.mastery IS DISTINCT FROM NEW.mastery)
  EXECUTE FUNCTION refresh_skill_metrics_on_event();

DROP TRIGGER IF EXISTS trg_refresh_skill_metrics_on_delete ON public.student_events;
CREATE TRIGGER trg_refresh_skill_metrics_on_delete
  AFTER DELETE ON public.student_events
  FOR EACH ROW
  EXECUTE FUNCTION refresh_skill_metrics_on_event();

-- Mark done: teacher-checked upsert and undo of mark_done_evaluation events.
CREATE OR REPLACE FUNCTION public.save_mark_done_evaluation(
  p_student_id uuid,
  p_worksheet_id uuid,
  p_exercise_index integer,
  p_element_type text,
  p_exercise_title text,
  p_ratings jsonb
)
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
    AND se.source_id = p_worksheet_id AND se.event_type = 'mark_done_evaluation'
    AND (se.event_payload->>'exercise_index')::int = p_exercise_index
  ORDER BY se.created_at DESC
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    UPDATE public.student_events
       SET event_payload = v_payload, skill_ids = v_skill_ids, mastery = v_mastery, element_type = p_element_type
     WHERE id = v_event_id;
    RETURN v_event_id;
  END IF;

  RETURN public.add_student_event(
    p_student_id, v_teacher_id, 'mark_done_evaluation', 'teacher', p_worksheet_id,
    v_payload, v_skill_ids, p_element_type, NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_mark_done_evaluation(
  p_student_id uuid,
  p_worksheet_id uuid,
  p_exercise_index integer
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher_id uuid := auth.uid();
  v_deleted integer;
BEGIN
  IF v_teacher_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.teacher_id = v_teacher_id
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.student_events se
  WHERE se.student_id = p_student_id AND se.teacher_id = v_teacher_id
    AND se.source_id = p_worksheet_id AND se.event_type = 'mark_done_evaluation'
    AND (se.event_payload->>'exercise_index')::int = p_exercise_index;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_mark_done_evaluation(uuid, uuid, integer, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_mark_done_evaluation(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_mark_done_evaluation(uuid, uuid, integer, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_mark_done_evaluation(uuid, uuid, integer) TO authenticated;
