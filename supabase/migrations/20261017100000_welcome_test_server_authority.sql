-- Welcome Test server authority and retake history (audit 2026-10-16, owner decisions 1-3).
--
-- 1. Retake history (decision 1): a completed retake no longer DELETES the older
--    attempts' welcome_test events. They get superseded_at / superseded_by and
--    stay for history and attempt-to-attempt trends; compute_skill_metric
--    ignores superseded events. Older attempts of students with several
--    completed attempts are marked now (they were double counted on production).
-- 2. calculate_test_results: callable by the service role, the owning teacher,
--    or (transitional, previous student client) while the test is in progress.
--    Skill and test scores divide by scored items only (is_correct not null),
--    so a skipped question is not a wrong answer and the score is not diluted by
--    the unscored profile questions.
-- 3. save_test_answer_by_share_token: only while the link is valid and the test
--    is assigned or in progress, only for an existing question; returns false
--    otherwise. is_correct from the client is provisional: process-welcome-test
--    re-grades keyed answers from the stored key before scoring.
-- 4. get_test_questions_by_share_token no longer returns correct_answer.
-- 5. verify_welcome_test_email ignores deleted and expired tests.

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.student_events
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid;

CREATE INDEX IF NOT EXISTS idx_student_events_welcome_active
  ON public.student_events (student_id, source_id)
  WHERE event_source = 'welcome_test' AND superseded_at IS NULL;

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
    SELECT se.id, se.created_at, se.mastery
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

CREATE OR REPLACE TRIGGER trg_refresh_skill_metrics_on_update
  AFTER UPDATE OF event_payload, mastery, created_at, superseded_at ON public.student_events
  FOR EACH ROW
  WHEN (OLD.event_payload IS DISTINCT FROM NEW.event_payload
        OR OLD.mastery IS DISTINCT FROM NEW.mastery
        OR OLD.created_at IS DISTINCT FROM NEW.created_at
        OR OLD.superseded_at IS DISTINCT FROM NEW.superseded_at)
  EXECUTE FUNCTION public.refresh_skill_metrics_on_event();

CREATE OR REPLACE FUNCTION public.supersede_previous_welcome_test_events(p_test_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t record;
  v_marked integer := 0;
  v_newer uuid;
BEGIN
  SELECT id, student_id, teacher_id, coalesce(attempt_number, 1) AS attempt, created_at INTO t
  FROM public.student_tests
  WHERE id = p_test_id AND test_type = 'welcome';
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Welcome test not found';
  END IF;

  -- Never leave the student without welcome evidence.
  IF NOT EXISTS (
    SELECT 1 FROM public.student_events
    WHERE student_id = t.student_id AND source_id = t.id AND event_source = 'welcome_test'
  ) THEN
    RETURN 0;
  END IF;

  -- A re-run of an older attempt never wins over a newer attempt with events:
  -- its own events stay (or become) superseded by the newest one.
  SELECT n.id INTO v_newer
  FROM public.student_tests n
  WHERE n.test_type = 'welcome'
    AND n.student_id = t.student_id
    AND n.teacher_id = t.teacher_id
    AND n.id <> t.id
    AND n.deleted_at IS NULL
    AND (coalesce(n.attempt_number, 1) > t.attempt
         OR (coalesce(n.attempt_number, 1) = t.attempt AND n.created_at > t.created_at))
    AND EXISTS (SELECT 1 FROM public.student_events ne
                WHERE ne.source_id = n.id AND ne.event_source = 'welcome_test')
  ORDER BY coalesce(n.attempt_number, 1) DESC, n.created_at DESC
  LIMIT 1;
  IF v_newer IS NOT NULL THEN
    UPDATE public.student_events
    SET superseded_at = now(), superseded_by = v_newer
    WHERE student_id = t.student_id AND source_id = t.id
      AND event_source = 'welcome_test' AND superseded_at IS NULL;
    RETURN 0;
  END IF;

  UPDATE public.student_events e
  SET superseded_at = now(), superseded_by = t.id
  FROM public.student_tests o
  WHERE o.id = e.source_id
    AND e.student_id = t.student_id
    AND e.teacher_id = t.teacher_id
    AND e.event_source = 'welcome_test'
    AND e.superseded_at IS NULL
    AND o.test_type = 'welcome'
    AND o.student_id = t.student_id
    AND o.teacher_id = t.teacher_id
    AND o.id <> t.id
    AND (coalesce(o.attempt_number, 1) < t.attempt
         OR (coalesce(o.attempt_number, 1) = t.attempt AND o.created_at < t.created_at));
  GET DIAGNOSTICS v_marked = ROW_COUNT;

  UPDATE public.student_events
  SET superseded_at = NULL, superseded_by = NULL
  WHERE student_id = t.student_id AND source_id = t.id
    AND event_source = 'welcome_test' AND superseded_at IS NOT NULL;

  RETURN v_marked;
END;
$function$;
REVOKE ALL ON FUNCTION public.supersede_previous_welcome_test_events(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supersede_previous_welcome_test_events(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_test_results(p_test_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total INTEGER;
  v_correct INTEGER;
  v_score NUMERIC(5,2);
  v_time INTEGER;
  v_student_id UUID;
  v_current_status TEXT;
  v_teacher_id UUID;
  v_scored INTEGER;
  v_role TEXT := auth.role();
BEGIN
  SELECT st.teacher_id, st.status INTO v_teacher_id, v_current_status
  FROM public.student_tests st WHERE st.id = p_test_id AND st.deleted_at IS NULL;
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Test not found' USING ERRCODE = 'P0002';
  END IF;
  -- Service role and direct SQL (no JWT) always; the owning teacher always;
  -- anyone else only while the test is in progress (the student client of the
  -- previous release calls this once at completion; it can no longer reopen,
  -- re-score or complete an assigned, completed or reviewed test).
  IF v_role IS NOT NULL AND v_role <> 'service_role'
     AND auth.uid() IS DISTINCT FROM v_teacher_id
     AND v_current_status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT st.student_id, st.status,
         COUNT(*)::INTEGER,
         COALESCE(SUM(CASE WHEN stq.is_correct THEN 1 ELSE 0 END), 0)::INTEGER,
         COALESCE(SUM(GREATEST(stq.time_spent_seconds, 0)), 0)::INTEGER,
         COUNT(stq.is_correct)::INTEGER
  INTO v_student_id, v_current_status, v_total, v_correct, v_time, v_scored
  FROM public.student_tests st
  LEFT JOIN public.student_test_questions stq ON stq.test_id = st.id
  WHERE st.id = p_test_id
  GROUP BY st.student_id, st.status;

  -- Score over scored items only (is_correct not null: keyed answers, I don't know
  -- included); skipped and open items without a verdict are not wrong answers.
  v_score := CASE WHEN v_scored > 0 THEN (v_correct::NUMERIC / v_scored * 100) ELSE NULL END;

  UPDATE public.student_tests
  SET total_questions = v_total,
      correct_answers = v_correct,
      score_percentage = v_score,
      time_spent_seconds = v_time,
      -- v6.9.50: never downgrade a reviewed test back to completed
      status = CASE WHEN v_current_status = 'reviewed' THEN status ELSE 'completed' END,
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
  WHERE id = p_test_id;

  -- v6.9.50: UPSERT skill rows preserving applied_at + applied_to_element_id
  INSERT INTO public.test_skill_results
    (test_id, student_id, element_type, skill_tags,
     total_questions, correct_answers, score_percentage, suggested_rating)
  SELECT
    p_test_id,
    v_student_id,
    s.element_type,
    (SELECT ARRAY_AGG(DISTINCT tag)
       FROM public.student_test_questions tq, unnest(tq.skill_tags) AS tag
      WHERE tq.test_id = p_test_id AND tq.element_type = s.element_type AND tag IS NOT NULL),
    s.total,
    s.correct,
    CASE WHEN s.attempted > 0 AND s.scored > 0 THEN (s.correct::NUMERIC / s.scored * 100) END,
    CASE
      WHEN s.attempted = 0 OR s.scored = 0 THEN NULL
      WHEN (s.correct::NUMERIC / s.scored * 100) >= 80 THEN 5
      WHEN (s.correct::NUMERIC / s.scored * 100) >= 60 THEN 4
      WHEN (s.correct::NUMERIC / s.scored * 100) >= 40 THEN 3
      WHEN (s.correct::NUMERIC / s.scored * 100) >= 20 THEN 2
      ELSE 1
    END
  FROM (
    SELECT stq.element_type,
           COUNT(*)::INTEGER AS total,
           COALESCE(SUM(CASE WHEN stq.is_correct THEN 1 ELSE 0 END), 0)::INTEGER AS correct,
           COUNT(stq.is_correct)::INTEGER AS scored,
           COUNT(*) FILTER (WHERE stq.student_answer IS NOT NULL
                              AND stq.student_answer <> 'null'::jsonb
                              AND stq.student_answer <> '""'::jsonb)::INTEGER AS attempted
    FROM public.student_test_questions stq
    WHERE stq.test_id = p_test_id AND stq.element_type IS NOT NULL
    GROUP BY stq.element_type
  ) s
  ON CONFLICT (test_id, element_type) DO UPDATE
    SET skill_tags = EXCLUDED.skill_tags,
        total_questions = EXCLUDED.total_questions,
        correct_answers = EXCLUDED.correct_answers,
        score_percentage = EXCLUDED.score_percentage,
        suggested_rating = EXCLUDED.suggested_rating;
    -- applied_at + applied_to_element_id intentionally not touched

  RETURN jsonb_build_object(
    'total_questions', v_total,
    'correct_answers', v_correct,
    'score_percentage', v_score,
    'time_spent_seconds', v_time
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_test_answer_by_share_token(p_share_token text, p_question_index integer, p_answer jsonb, p_is_correct boolean DEFAULT NULL::boolean, p_time_spent_seconds integer DEFAULT NULL::integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_test_id uuid;
  v_updated integer;
BEGIN
  SELECT t.id INTO v_test_id
  FROM public.student_tests t
  WHERE p_share_token IS NOT NULL
    AND length(p_share_token) >= 8
    AND t.share_token = p_share_token
    AND t.deleted_at IS NULL
    AND t.status IN ('assigned', 'in_progress')
    AND (t.share_expires_at IS NULL OR t.share_expires_at > now())
  LIMIT 1;

  IF v_test_id IS NULL THEN
    RETURN false;
  END IF;

  -- is_correct is provisional (shown to nobody); process-welcome-test re-grades
  -- keyed answers from correct_answer before any score is computed.
  UPDATE public.student_test_questions
  SET student_answer = p_answer,
      is_correct = p_is_correct,
      answered_at = now(),
      time_spent_seconds = COALESCE(LEAST(GREATEST(p_time_spent_seconds, 0), 3600), time_spent_seconds)
  WHERE test_id = v_test_id
    AND question_index = p_question_index;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_test_questions_by_share_token(p_share_token text)
 RETURNS SETOF public.student_test_questions
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- The answer key stays on the server.
  SELECT (jsonb_populate_record(q, jsonb_build_object('correct_answer', NULL))).*
  FROM public.student_test_questions q
  JOIN public.student_tests t ON t.id = q.test_id
  WHERE p_share_token IS NOT NULL
    AND length(p_share_token) >= 8
    AND t.share_token = p_share_token
    AND t.deleted_at IS NULL
  ORDER BY q.question_index ASC;
$function$;

CREATE OR REPLACE FUNCTION public.verify_welcome_test_email(p_share_token text, p_email text)
 RETURNS TABLE(has_email boolean, matches boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_email text;
BEGIN
  SELECT s.student_email
    INTO v_student_email
  FROM public.student_tests t
  JOIN public.students s ON s.id = t.student_id
  WHERE p_share_token IS NOT NULL
    AND length(p_share_token) >= 8
    AND t.share_token = p_share_token
    AND t.deleted_at IS NULL
    AND (t.share_expires_at IS NULL OR t.share_expires_at > now())
  LIMIT 1;

  IF v_student_email IS NULL OR length(btrim(v_student_email)) = 0 THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    lower(btrim(v_student_email)) = lower(btrim(p_email));
END;
$function$;

-- Older attempts of students with several welcome attempts that have events:
-- the newest attempt with events supersedes the rest.
DO $backfill$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (t.student_id, t.teacher_id) t.id
    FROM public.student_tests t
    WHERE t.test_type = 'welcome' AND t.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM public.student_events e
                  WHERE e.source_id = t.id AND e.event_source = 'welcome_test')
      AND (SELECT count(DISTINCT e2.source_id) FROM public.student_events e2
           WHERE e2.student_id = t.student_id AND e2.teacher_id = t.teacher_id
             AND e2.event_source = 'welcome_test') > 1
    ORDER BY t.student_id, t.teacher_id, coalesce(t.attempt_number, 1) DESC, t.created_at DESC
  LOOP
    PERFORM public.supersede_previous_welcome_test_events(r.id);
  END LOOP;
END
$backfill$;
