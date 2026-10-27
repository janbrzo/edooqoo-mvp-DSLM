-- Homework P1.3: source weights in compute_skill_metric (DSLM_EVENT_WEIGHT_VERSION 1).
--
-- Owner decision (2026-10-26): evidence of a SUBMITTED homework counts 1.0, a draft
-- (homework answers saved but not submitted) counts 0.8, so work that was done but
-- never sent is not lost. The weight multiplies the recency decay of an event in the
-- weighted mean (current_mastery); history and trend still use the raw per-event points.
-- Every other source weighs 1.0. The rule lives in public.dslm_event_weight
-- (20261027100000), this migration only applies it.
--
-- The function body is unchanged otherwise (v3, 20261017100000), including the removal of
-- a metric that has no supporting events left.

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
  v_trend TEXT := 'insufficient_data';
  v_history JSONB := '[]'::jsonb;
  v_recent_avg NUMERIC;
  v_older_avg NUMERIC;
  v_micro_skill TEXT;
  v_points JSONB;
BEGIN
  -- One recompute per (student, teacher, skill) at a time, until commit.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_student_id::text || '|' || p_teacher_id::text || '|' || p_skill_name, 0)
  );

  v_micro_skill := public.extract_micro_skill(p_skill_name);

  -- One point per event: the mean of the rated items of that event for this skill
  -- (plus flashcard events, already one per event), ascending in time.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('event_id', pt.event_id, 'created_at', pt.created_at, 'mastery_val', pt.mastery_val, 'weight', pt.weight)
                            ORDER BY pt.created_at, pt.event_id), '[]'::jsonb)
    INTO v_points
  FROM (
    SELECT se.id AS event_id, se.created_at, AVG((nsr->>'mastery')::numeric) AS mastery_val,
           public.dslm_event_weight(se.event_source, se.event_payload) AS weight
    FROM student_events se,
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(se.event_payload->'nano_skill_ratings') = 'array'
                THEN se.event_payload->'nano_skill_ratings' ELSE '[]'::jsonb END
         ) AS nsr
    WHERE se.student_id = p_student_id
      AND se.teacher_id = p_teacher_id
      AND nsr->>'name' = p_skill_name
      -- A completed Welcome Test retake supersedes older attempts (kept for history).
      AND se.superseded_at IS NULL
      AND (nsr->>'hasValue')::boolean = true
      AND (nsr->>'mastery')::numeric >= 0
      -- Decision D2: the Mark done of the same worksheet exercise, with
      -- at least one rated item (any skill), supersedes the student answer event.
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
            AND (mr->>'hasValue')::boolean = true
            AND (mr->>'mastery')::numeric >= 0
        )
      )
    GROUP BY se.id, se.created_at
    UNION ALL
    SELECT se.id, se.created_at, se.mastery, 1.0::numeric AS weight
    FROM student_events se
    WHERE p_skill_name LIKE 'flashcard:%'
      AND se.student_id = p_student_id
      AND se.teacher_id = p_teacher_id
      AND se.event_source = 'flashcard'
      AND se.superseded_at IS NULL
      AND se.mastery IS NOT NULL
      AND se.event_payload->>'card_id' = substring(p_skill_name from 11)
  ) pt;

  SELECT count(*),
         COALESCE(SUM(p.mastery_val * COALESCE(p.weight, 1) * exp(-0.03 * EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0)), 0),
         COALESCE(SUM(COALESCE(p.weight, 1) * exp(-0.03 * EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0)), 0),
         MIN(p.created_at), MAX(p.created_at)
    INTO v_total_events, v_weighted_sum, v_weight_total, v_first_at, v_last_at
  FROM jsonb_to_recordset(v_points) AS p(event_id uuid, created_at timestamptz, mastery_val numeric, weight numeric);

  IF v_total_events = 0 THEN
    -- No supporting events left (deleted or re-scored): remove the stale metric.
    DELETE FROM public.student_skill_metrics
    WHERE student_id = p_student_id AND teacher_id = p_teacher_id AND skill_name = p_skill_name;
    RETURN;
  END IF;

  v_current_mastery := ROUND(v_weighted_sum / NULLIF(v_weight_total, 0), 1);

  -- History: ascending by time, last 20 points.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'mastery', ROUND(l.mastery_val, 1),
           'date', to_char(l.created_at, 'YYYY-MM-DD'),
           'at', to_char(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
           'event_id', l.event_id
         ) ORDER BY l.created_at, l.event_id), '[]'::jsonb)
    INTO v_history
  FROM (
    SELECT p.event_id, p.created_at, p.mastery_val
    FROM jsonb_to_recordset(v_points) AS p(event_id uuid, created_at timestamptz, mastery_val numeric, weight numeric)
    ORDER BY p.created_at DESC, p.event_id DESC
    LIMIT 20
  ) l;

  -- Trend on the ordered per-event points: last 3 vs the up to 3 before them.
  IF v_total_events >= 4 THEN
    SELECT AVG(r.mastery_val) INTO v_recent_avg FROM (
      SELECT p.mastery_val FROM jsonb_to_recordset(v_points) AS p(event_id uuid, created_at timestamptz, mastery_val numeric, weight numeric)
      ORDER BY p.created_at DESC, p.event_id DESC LIMIT 3
    ) r;
    SELECT AVG(o.mastery_val) INTO v_older_avg FROM (
      SELECT p.mastery_val FROM jsonb_to_recordset(v_points) AS p(event_id uuid, created_at timestamptz, mastery_val numeric, weight numeric)
      ORDER BY p.created_at DESC, p.event_id DESC OFFSET 3 LIMIT 3
    ) o;

    IF v_recent_avg > v_older_avg + 10 THEN
      v_trend := 'improving';
    ELSIF v_recent_avg < v_older_avg - 10 THEN
      v_trend := 'declining';
    ELSE
      v_trend := 'stable';
    END IF;
  END IF;

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
    first_event_at = EXCLUDED.first_event_at,
    last_event_at = EXCLUDED.last_event_at,
    mastery_history = EXCLUDED.mastery_history,
    skill_category = EXCLUDED.skill_category,
    micro_skill = EXCLUDED.micro_skill,
    updated_at = now();
END;
$function$
;
