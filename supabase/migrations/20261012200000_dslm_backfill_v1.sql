-- One-off DSLM backfill with a before/after audit (decision D7, iteration 6).
--
-- Corrects stored data written by bugs fixed in iterations 1-5. Every changed
-- row is recorded in public.dslm_backfill_audit (run_id, table, row id, before,
-- after), so the run can be reviewed and reverted row by row. Re-running is
-- safe: each step only touches rows that still differ from the corrected value
-- (a re-run adds a new run_id with only the rows it actually changed).
--
-- Requires 20261012120000 (metric triggers on UPDATE/DELETE) and
-- 20261012180000 (Welcome Test events refresh metrics), so the event updates
-- below recompute the affected skill metrics through the normal triggers.
--
-- A. Open answers whose AI quality_score was 0 but whose item rating was
--    stored as 70 (`quality_score || 0.7`): rating set to 0, exercise mastery
--    recomputed as the mean of the scored ratings. The answer triggers then
--    rebuild that exercise's events.
-- B. Welcome Test answer events: mastery and the skill rating are set from the
--    event's own question (same test, question_index = exercise_index): the AI
--    score for open items, 100/0 from is_correct for keyed items (any type), nothing for
--    unscored items. Fixes scores written onto the wrong event by the
--    legacy-id collision (iteration 2) and fallback values.
-- C. Every skill metric is recomputed from its events; metrics with no
--    supporting events (orphans) are deleted by compute_skill_metric.

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.dslm_backfill_audit (
  id bigserial PRIMARY KEY,
  run_id text NOT NULL,
  step text NOT NULL,
  table_name text NOT NULL,
  row_id text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dslm_backfill_audit ENABLE ROW LEVEL SECURITY;
-- No policies: readable only by the service role / SQL editor.

DO $backfill$
DECLARE
  v_run text := 'dslm_backfill_v1_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS');
  r record;
  v_items jsonb;
  v_mastery numeric;
BEGIN
  -- Metrics before any step: steps A and B change metrics through the triggers.
  DROP TABLE IF EXISTS _metrics_before;
  CREATE TEMP TABLE _metrics_before AS
    SELECT student_id, teacher_id, skill_name, current_mastery, trend, total_events
    FROM public.student_skill_metrics;

  ---------------------------------------------------------------------------
  -- A. 70 stored for an AI quality_score of 0
  ---------------------------------------------------------------------------
  FOR r IN
    SELECT 'worksheet_student_answers'::text AS tbl, a.id, a.item_evaluations, a.ai_evaluation, a.mastery
    FROM public.worksheet_student_answers a
    WHERE jsonb_typeof(a.item_evaluations) = 'array'
      AND jsonb_typeof(a.ai_evaluation->'question_evaluations') = 'array'
    UNION ALL
    SELECT 'homework_student_answers', a.id, a.item_evaluations, a.ai_evaluation, a.mastery
    FROM public.homework_student_answers a
    WHERE jsonb_typeof(a.item_evaluations) = 'array'
      AND jsonb_typeof(a.ai_evaluation->'question_evaluations') = 'array'
  LOOP
    SELECT jsonb_agg(
             CASE WHEN (ie->>'mastery') ~ '^-?[0-9.]+$' AND (ie->>'mastery')::numeric = 70
                       AND EXISTS (
                         SELECT 1 FROM jsonb_array_elements(r.ai_evaluation->'question_evaluations') qe
                         WHERE qe->>'question_index' = ie->>'question_index'
                           AND (qe->>'quality_score') ~ '^[0-9.]+$'
                           AND (qe->>'quality_score')::numeric = 0)
                  THEN jsonb_set(ie, '{mastery}', '0'::jsonb)
                  ELSE ie END
             ORDER BY ord)
      INTO v_items
    FROM jsonb_array_elements(r.item_evaluations) WITH ORDINALITY AS t(ie, ord);

    IF v_items IS DISTINCT FROM r.item_evaluations THEN
      SELECT round(avg((ie->>'mastery')::numeric))
        INTO v_mastery
      FROM jsonb_array_elements(v_items) ie
      WHERE (ie->>'mastery') ~ '^-?[0-9.]+$' AND (ie->>'mastery')::numeric >= 0
        AND coalesce((ie->>'hasValue')::boolean, true);

      IF r.tbl = 'worksheet_student_answers' THEN
        UPDATE public.worksheet_student_answers SET item_evaluations = v_items, mastery = v_mastery WHERE id = r.id;
      ELSE
        UPDATE public.homework_student_answers SET item_evaluations = v_items, mastery = v_mastery WHERE id = r.id;
      END IF;

      INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
      VALUES (v_run, 'A_zero_score_stored_as_70', r.tbl, r.id::text,
              jsonb_build_object('item_evaluations', r.item_evaluations, 'mastery', r.mastery),
              jsonb_build_object('item_evaluations', v_items, 'mastery', v_mastery));
    END IF;
  END LOOP;

  ---------------------------------------------------------------------------
  -- B. Welcome Test events: mastery from the event's own question
  ---------------------------------------------------------------------------
  FOR r IN
    WITH ev AS (
      SELECT e.id, e.mastery, e.event_payload,
             q.question_type, q.is_correct, q.question_data->>'ai_score' AS ai_score
      FROM public.student_events e
      JOIN public.student_test_questions q
        ON q.test_id = e.source_id
       AND q.question_index = (e.event_payload->>'exercise_index')::int
      WHERE e.event_source = 'welcome_test'
        AND e.event_type = 'test_answer_submitted'
        AND (e.event_payload->>'exercise_index') ~ '^[0-9]+$'
    )
    SELECT ev.*,
           CASE
             WHEN ev.ai_score ~ '^[0-9]+(\.[0-9]+)?$' THEN round(ev.ai_score::numeric)
             -- Any keyed item (multiple choice, fill blank, listening, keyed scenario items).
             WHEN ev.is_correct IS NOT NULL THEN CASE WHEN ev.is_correct THEN 100 ELSE 0 END
             ELSE NULL
           END AS desired
    FROM ev
  LOOP
    IF r.mastery IS DISTINCT FROM r.desired THEN
      v_items := r.event_payload;
      IF jsonb_typeof(v_items->'nano_skill_ratings') = 'array' AND jsonb_array_length(v_items->'nano_skill_ratings') > 0 THEN
        v_items := jsonb_set(v_items, '{nano_skill_ratings,0,mastery}', to_jsonb(coalesce(r.desired, -1)));
        v_items := jsonb_set(v_items, '{nano_skill_ratings,0,hasValue}', to_jsonb(r.desired IS NOT NULL));
      END IF;

      UPDATE public.student_events SET mastery = r.desired, event_payload = v_items WHERE id = r.id;

      INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
      VALUES (v_run, 'B_welcome_test_event_mastery', 'student_events', r.id::text,
              jsonb_build_object('mastery', r.mastery, 'nano_skill_ratings', r.event_payload->'nano_skill_ratings'),
              jsonb_build_object('mastery', r.desired, 'nano_skill_ratings', v_items->'nano_skill_ratings'));
    END IF;
  END LOOP;

  ---------------------------------------------------------------------------
  -- C. Recompute every metric from its events (orphans are deleted)
  ---------------------------------------------------------------------------
  FOR r IN
    SELECT student_id, teacher_id, skill_name FROM _metrics_before
    UNION
    SELECT DISTINCT se.student_id, se.teacher_id, nsr->>'name'
    FROM public.student_events se,
         jsonb_array_elements(CASE WHEN jsonb_typeof(se.event_payload->'nano_skill_ratings') = 'array'
                                   THEN se.event_payload->'nano_skill_ratings' ELSE '[]'::jsonb END) nsr
    WHERE nsr->>'name' IS NOT NULL
      AND (nsr->>'hasValue') = 'true'
      AND (nsr->>'mastery') ~ '^-?[0-9.]+$' AND (nsr->>'mastery')::numeric >= 0
  LOOP
    PERFORM public.compute_skill_metric(
      r.student_id, r.teacher_id, r.skill_name,
      CASE WHEN r.skill_name LIKE 'flashcard:%' THEN 'vocabulary' ELSE public.extract_skill_category(r.skill_name) END
    );
  END LOOP;

  INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
  SELECT v_run, 'C_metric_recompute', 'student_skill_metrics',
         coalesce(b.student_id, m.student_id)::text || '|' || coalesce(b.teacher_id, m.teacher_id)::text || '|' || coalesce(b.skill_name, m.skill_name),
         CASE WHEN b.skill_name IS NULL THEN NULL
              ELSE jsonb_build_object('current_mastery', b.current_mastery, 'trend', b.trend, 'total_events', b.total_events) END,
         CASE WHEN m.skill_name IS NULL THEN NULL
              ELSE jsonb_build_object('current_mastery', m.current_mastery, 'trend', m.trend, 'total_events', m.total_events) END
  FROM _metrics_before b
  FULL JOIN public.student_skill_metrics m
    ON m.student_id = b.student_id AND m.teacher_id = b.teacher_id AND m.skill_name = b.skill_name
  WHERE b.skill_name IS NULL OR m.skill_name IS NULL
     OR b.current_mastery IS DISTINCT FROM m.current_mastery
     OR b.trend IS DISTINCT FROM m.trend
     OR b.total_events IS DISTINCT FROM m.total_events;

  DROP TABLE _metrics_before;

  RAISE NOTICE 'DSLM backfill % done: % audit rows', v_run,
    (SELECT count(*) FROM public.dslm_backfill_audit WHERE run_id = v_run);
END
$backfill$;
