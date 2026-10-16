-- Recompute every skill metric with compute_skill_metric v3 (iteration 8, task 8.1).
--
-- REQUIRES 20261015090000_compute_skill_metric_v3.sql (checked below).
-- RUN IN A QUIET WINDOW: every recompute takes the per-skill advisory lock until
-- the end of this transaction and rewrites the metric row, so a student save that
-- needs one of them waits meanwhile.
--
-- Batches: one run handles at most 500 metrics (max_locks_per_transaction is 64 in production, so keep the lock count low) (the advisory locks of a
-- transaction are all held until commit). A metric counts as migrated once its
-- mastery_history carries event_id (written only by v3, also by live triggers).
-- If the run reports metrics left, run the file again; a run with nothing left
-- changes nothing. Re-running is safe and idempotent.
--
-- Every row whose current_mastery, trend, total_events or first_event_at changed
-- (or that was created or deleted) is recorded in public.dslm_backfill_audit with
-- step D_metric_recompute_v3 (full before and after row). Event dates are untouched.

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
REVOKE ALL ON public.dslm_backfill_audit FROM PUBLIC, anon, authenticated;

DO $recompute$
DECLARE
  v_run text := 'dslm_metric_v3_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS_MS');
  v_batch integer := 500;
  v_todo integer;
  v_done integer;
  r record;
BEGIN
  IF position('pg_advisory_xact_lock' IN pg_get_functiondef('public.compute_skill_metric(uuid,uuid,text,text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Apply 20261015090000_compute_skill_metric_v3.sql first';
  END IF;

  CREATE TEMP TABLE _v3_keys ON COMMIT DROP AS
  WITH keys AS (
    SELECT student_id, teacher_id, skill_name
    FROM public.student_skill_metrics
    WHERE NOT (jsonb_typeof(mastery_history) = 'array' AND jsonb_array_length(mastery_history) > 0
               AND mastery_history->0 ? 'event_id')
    UNION
    SELECT se.student_id, se.teacher_id, nsr->>'name'
    FROM public.student_events se,
         jsonb_array_elements(CASE WHEN jsonb_typeof(se.event_payload->'nano_skill_ratings') = 'array'
                                   THEN se.event_payload->'nano_skill_ratings' ELSE '[]'::jsonb END) nsr
    WHERE nsr->>'name' IS NOT NULL
      AND (nsr->>'hasValue') = 'true'
      AND (nsr->>'mastery') ~ '^-?[0-9.]+$' AND (nsr->>'mastery')::numeric >= 0
      AND NOT EXISTS (SELECT 1 FROM public.student_skill_metrics m
                      WHERE m.student_id = se.student_id AND m.teacher_id = se.teacher_id AND m.skill_name = nsr->>'name')
    UNION
    SELECT se.student_id, se.teacher_id, 'flashcard:' || (se.event_payload->>'card_id')
    FROM public.student_events se
    WHERE se.event_source = 'flashcard' AND se.mastery IS NOT NULL
      AND (se.event_payload->>'card_id') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.student_skill_metrics m
                      WHERE m.student_id = se.student_id AND m.teacher_id = se.teacher_id
                        AND m.skill_name = 'flashcard:' || (se.event_payload->>'card_id'))
  )
  SELECT * FROM keys ORDER BY student_id, teacher_id, skill_name;
  SELECT count(*) INTO v_todo FROM _v3_keys;

  CREATE TEMP TABLE _v3_batch ON COMMIT DROP AS
  SELECT k.student_id, k.teacher_id, k.skill_name, to_jsonb(m) AS before_row
  FROM (SELECT * FROM _v3_keys LIMIT v_batch) k
  LEFT JOIN public.student_skill_metrics m
    ON m.student_id = k.student_id AND m.teacher_id = k.teacher_id AND m.skill_name = k.skill_name;

  -- Same order everywhere: consistent advisory lock order against live saves.
  FOR r IN SELECT * FROM _v3_batch ORDER BY student_id, teacher_id, skill_name LOOP
    PERFORM public.compute_skill_metric(
      r.student_id, r.teacher_id, r.skill_name,
      CASE WHEN r.skill_name LIKE 'flashcard:%' THEN 'vocabulary' ELSE public.extract_skill_category(r.skill_name) END
    );
  END LOOP;

  INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
  SELECT v_run, 'D_metric_recompute_v3', 'student_skill_metrics',
         b.student_id::text || '|' || b.teacher_id::text || '|' || b.skill_name,
         b.before_row,
         to_jsonb(m)
  FROM _v3_batch b
  LEFT JOIN public.student_skill_metrics m
    ON m.student_id = b.student_id AND m.teacher_id = b.teacher_id AND m.skill_name = b.skill_name
  WHERE b.before_row IS NULL OR m.skill_name IS NULL
     OR (b.before_row->>'current_mastery') IS DISTINCT FROM m.current_mastery::text
     OR (b.before_row->>'trend') IS DISTINCT FROM m.trend
     OR (b.before_row->>'total_events') IS DISTINCT FROM m.total_events::text
     OR (b.before_row->>'first_event_at')::timestamptz IS DISTINCT FROM m.first_event_at;

  SELECT count(*) INTO v_done FROM _v3_batch;
  RAISE NOTICE 'Metric v3 recompute %: % of % metrics processed, % left, % audit rows',
    v_run, v_done, v_todo, GREATEST(v_todo - v_done, 0),
    (SELECT count(*) FROM public.dslm_backfill_audit WHERE run_id = v_run);
END
$recompute$;
