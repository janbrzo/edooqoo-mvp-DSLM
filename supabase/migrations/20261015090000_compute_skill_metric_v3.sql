-- compute_skill_metric v3 (iteration 8, task 8.1).
--
-- Changes against 20261012160000_mark_done_supersedes_student_events.sql:
--  1. Concurrency: a transaction-level advisory lock per (student, teacher,
--     skill) serialises recomputes, so two saves can no longer overwrite each
--     other with a stale read.
--  2. Unit: one data point per (event, skill). The ratings of one event for
--     the skill are averaged first; the weighted mastery mean, total_events and
--     the trend work on these points, so one 10-item exercise counts once.
--  3. Mark done supersession per EXERCISE: a worksheet event is left out for
--     every skill when a mark_done_evaluation of the same student, teacher,
--     source_id and exercise_index has at least one rated item (any skill).
--     refresh_skill_metrics_on_event is redefined below so that saving or
--     undoing a Mark done also recomputes the skills of those worksheet events.
--  4. first_event_at is refreshed on every recompute.
--  5. mastery_history is ascending by created_at (tie-break event id) and keeps
--     the LAST 20 points: {mastery, date, at, event_id}. The date key is
--     unchanged for the sparkline.
--  6. trend is insufficient_data below 4 points, otherwise last 3 vs the up to
--     3 before them (+-10), as before.
-- Unchanged: signature, SECURITY DEFINER, search_path, the 0.03 per day decay,
-- the flashcard branch, deleting the row when no events remain, columns of
-- student_skill_metrics, updated_at = now().
--
-- Existing metric rows keep the old values until they are recomputed: apply
-- 20261015090100_recompute_skill_metrics_v3.sql in a quiet window after this.

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
  SELECT COALESCE(jsonb_agg(jsonb_build_object('event_id', pt.event_id, 'created_at', pt.created_at, 'mastery_val', pt.mastery_val)
                            ORDER BY pt.created_at, pt.event_id), '[]'::jsonb)
    INTO v_points
  FROM (
    SELECT se.id AS event_id, se.created_at, AVG((nsr->>'mastery')::numeric) AS mastery_val
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
    SELECT se.id, se.created_at, se.mastery
    FROM student_events se
    WHERE p_skill_name LIKE 'flashcard:%'
      AND se.student_id = p_student_id
      AND se.teacher_id = p_teacher_id
      AND se.event_source = 'flashcard'
      AND se.mastery IS NOT NULL
      AND se.event_payload->>'card_id' = substring(p_skill_name from 11)
  ) pt;

  SELECT count(*),
         COALESCE(SUM(p.mastery_val * exp(-0.03 * EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0)), 0),
         COALESCE(SUM(exp(-0.03 * EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0)), 0),
         MIN(p.created_at), MAX(p.created_at)
    INTO v_total_events, v_weighted_sum, v_weight_total, v_first_at, v_last_at
  FROM jsonb_to_recordset(v_points) AS p(event_id uuid, created_at timestamptz, mastery_val numeric);

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
    FROM jsonb_to_recordset(v_points) AS p(event_id uuid, created_at timestamptz, mastery_val numeric)
    ORDER BY p.created_at DESC, p.event_id DESC
    LIMIT 20
  ) l;

  -- Trend on the ordered per-event points: last 3 vs the up to 3 before them.
  IF v_total_events >= 4 THEN
    SELECT AVG(r.mastery_val) INTO v_recent_avg FROM (
      SELECT p.mastery_val FROM jsonb_to_recordset(v_points) AS p(event_id uuid, created_at timestamptz, mastery_val numeric)
      ORDER BY p.created_at DESC, p.event_id DESC LIMIT 3
    ) r;
    SELECT AVG(o.mastery_val) INTO v_older_avg FROM (
      SELECT p.mastery_val FROM jsonb_to_recordset(v_points) AS p(event_id uuid, created_at timestamptz, mastery_val numeric)
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

-- refresh_skill_metrics_on_event: as in 20261012120000 plus
--  * skills are recomputed in name order (consistent advisory lock order), and
--  * a Mark done event also recomputes the skills of the worksheet events of
--    its exercise, because it supersedes them for every skill.
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
    SELECT DISTINCT skill_name FROM (
      SELECT elem->>'name' AS skill_name
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
      UNION ALL
      -- Mark done supersedes the whole exercise: refresh every skill its
      -- worksheet events carry (the old and the new exercise on an update).
      SELECT w_elem->>'name'
      FROM public.student_events w,
           jsonb_array_elements(
             CASE WHEN jsonb_typeof(w.event_payload->'nano_skill_ratings') = 'array'
                  THEN w.event_payload->'nano_skill_ratings' ELSE '[]'::jsonb END) AS w_elem,
           (
             SELECT NEW.source_id AS source_id, NEW.event_payload->>'exercise_index' AS exercise_index
             WHERE TG_OP <> 'DELETE' AND NEW.event_type = 'mark_done_evaluation'
             UNION
             SELECT OLD.source_id, OLD.event_payload->>'exercise_index'
             WHERE TG_OP <> 'INSERT' AND OLD.event_type = 'mark_done_evaluation'
           ) ex
      WHERE w.student_id = v_student_id
        AND w.teacher_id = v_teacher_id
        AND w.event_source = 'worksheet'
        AND w.source_id IS NOT DISTINCT FROM ex.source_id
        AND w.event_payload->>'exercise_index' = ex.exercise_index
        AND (w_elem->>'hasValue')::boolean = true
        AND (w_elem->>'mastery')::numeric >= 0
        AND w_elem->>'name' IS NOT NULL
    ) all_skills
    ORDER BY skill_name
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
