-- Mark done supersedes the student's answer event (decision D2).
--
-- A teacher who marks a worksheet exercise done rates its nano-skills on the
-- 0-100 scale (prefilled from the same answer-key verdict the student event
-- holds). Before this change both events counted, so a teacher correction of
-- a wrong key verdict was averaged with the verdict it corrected.
--
-- compute_skill_metric now skips a student 'worksheet' event's rating of a skill
-- when a mark_done_evaluation of the same student, worksheet and exercise_index
-- rates that skill. The supersession is per skill, so every recompute stays
-- exact with the existing triggers: saving or updating a Mark done recomputes
-- the skills it rates (NEW), undoing it recomputes the skills it rated (OLD).
-- Body otherwise identical to 20261012120000_dslm_event_triggers_v2.sql.

SET LOCAL lock_timeout = '5s';

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
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(se.event_payload->'nano_skill_ratings') = 'array'
                THEN se.event_payload->'nano_skill_ratings' ELSE '[]'::jsonb END
         ) AS nsr
    WHERE se.student_id = p_student_id
      AND se.teacher_id = p_teacher_id
      AND nsr->>'name' = p_skill_name
      AND (nsr->>'hasValue')::boolean = true
      AND (nsr->>'mastery')::numeric >= 0
      -- Decision D2: a teacher's Mark done rating of this skill for the same
      -- worksheet exercise supersedes the student's own answer event.
      AND NOT (
        se.event_source = 'worksheet' AND EXISTS (
          SELECT 1
          FROM student_events md,
               jsonb_array_elements(
                 CASE WHEN jsonb_typeof(md.event_payload->'nano_skill_ratings') = 'array'
                      THEN md.event_payload->'nano_skill_ratings' ELSE '[]'::jsonb END
               ) AS mr
          WHERE md.student_id = se.student_id
            AND md.teacher_id = se.teacher_id
            AND md.event_type = 'mark_done_evaluation'
            AND md.source_id IS NOT DISTINCT FROM se.source_id
            AND md.event_payload->>'exercise_index' = se.event_payload->>'exercise_index'
            AND mr->>'name' = p_skill_name
            AND (mr->>'hasValue')::boolean = true
            AND (mr->>'mastery')::numeric >= 0
        )
      )
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

-- Lookup used by the supersession check above.
CREATE INDEX IF NOT EXISTS idx_student_events_mark_done_lookup
  ON public.student_events (student_id, teacher_id, source_id)
  WHERE event_type = 'mark_done_evaluation';
