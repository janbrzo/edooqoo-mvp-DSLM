-- One-off DSLM backfill with a before/after audit (decision D7, iteration 6).
--
-- Corrects stored data written by bugs fixed in iterations 1-5. Every changed
-- row is recorded in public.dslm_backfill_audit (run_id, step, table, row id,
-- full before / after), so the run can be reviewed and reverted row by row.
-- Re-running is safe: each step only touches rows that still differ from the
-- corrected value. The whole file is one transaction: any error rolls it back.
--
-- RUN IN A QUIET WINDOW: step C locks the metric rows it rewrites until commit
-- (a few seconds); a student save that needs one of them waits meanwhile.
--
-- Requires 20261012120000 (answer triggers keep teacher events, metrics on
-- UPDATE/DELETE, compute_skill_metric deletes orphans) and 20261012180000
-- (Welcome Test events refresh metrics); both are checked below.
--
-- A. Open WORKSHEET answers (the AI queue's fallback branch) whose AI
--    quality_score was 0 but whose main rating was stored as 70: that rating is
--    set to 0 and the exercise mastery recomputed (mean of scored ratings, as
--    averageScoredMastery). Writing/speaking ratings that carry their own score
--    are left alone. The answer trigger rebuilds the exercise's events; their
--    original created_at is restored so recency weighting is unchanged, and the
--    replaced events are kept in the audit.
-- B. Welcome Test answer events: mastery and the first skill rating are set
--    from the event's own question (same test, question_index =
--    exercise_index): the AI score for open items, 100/0 from is_correct for
--    any keyed item, unscored otherwise. Fixes scores left on the wrong event by
--    the legacy-id collision. AI scores of exactly 25, 50 or 75 may be the old
--    fallback buckets and cannot be told apart from real ones: those events are
--    not changed, only listed in the audit as B_review_fallback_bucket.
-- C. Every skill metric is recomputed from its events; metrics with no
--    supporting events (orphans) are deleted. The full metric row is audited.

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
REVOKE ALL ON public.dslm_backfill_audit FROM PUBLIC, anon, authenticated;

DO $backfill$
DECLARE
  v_run text := 'dslm_backfill_v1_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS_MS');
  r record;
  v_items jsonb;
  v_payload jsonb;
  v_mastery numeric;
  v_bad integer;
  v_open_types text[] := ARRAY[
    'reading', 'discussion', 'describe', 'describe-picture', 'answer-questions',
    'answer-questions-audio', 'answer-questions-picture', 'dialogue', 'paraphrasing',
    'speaking', 'sentence-transformation', 'essay', 'listening-comprehension'
  ];
BEGIN
  ---------------------------------------------------------------------------
  -- Preconditions
  ---------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_refresh_skill_metrics_on_delete')
     OR position('event_source = ''worksheet''' IN pg_get_functiondef('public.log_worksheet_answer_to_events()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Apply 20261012120000 first (otherwise answer triggers delete teacher events)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_learning_profiles' AND column_name = 'signal_coverage'
  ) THEN
    RAISE EXCEPTION 'Apply 20261012180000 first (Welcome Test events must refresh metrics)';
  END IF;
  SELECT count(*) INTO v_bad
  FROM public.student_events se,
       jsonb_array_elements(CASE WHEN jsonb_typeof(se.event_payload->'nano_skill_ratings') = 'array'
                                 THEN se.event_payload->'nano_skill_ratings' ELSE '[]'::jsonb END) nsr
  WHERE jsonb_typeof(nsr) <> 'object'
     OR (nsr ? 'mastery' AND (nsr->>'mastery') !~ '^-?[0-9]+(\.[0-9]+)?$')
     OR (nsr ? 'hasValue' AND (nsr->>'hasValue') NOT IN ('true', 'false'));
  IF v_bad > 0 THEN
    RAISE EXCEPTION '% malformed nano_skill_ratings would abort the metric recompute; fix them first', v_bad;
  END IF;

  -- Metrics before any step: steps A and B change metrics through the triggers.
  CREATE TEMP TABLE _dslm_metrics_before ON COMMIT DROP AS
    SELECT * FROM public.student_skill_metrics;
  CREATE TEMP TABLE _dslm_events_before (LIKE public.student_events) ON COMMIT DROP;

  ---------------------------------------------------------------------------
  -- A. Main rating stored as 70 for an AI quality_score of 0 (worksheets, open types)
  ---------------------------------------------------------------------------
  FOR r IN
    SELECT a.id, a.item_evaluations, a.ai_evaluation, a.mastery
    FROM public.worksheet_student_answers a
    WHERE a.exercise_type = ANY (v_open_types)
      AND jsonb_typeof(a.item_evaluations) = 'array'
      AND jsonb_typeof(a.ai_evaluation->'question_evaluations') = 'array'
  LOOP
    SELECT jsonb_agg(
             CASE WHEN jsonb_typeof(ie) = 'object'
                       AND (ie->>'mastery') ~ '^-?[0-9.]+$' AND (ie->>'mastery')::numeric = 70
                       AND NOT (coalesce(ie->>'name', '') ~* '\.(writing|wr)\.' AND (ie->>'writing_score') ~ '^[0-9.]+$')
                       AND NOT (coalesce(ie->>'name', '') ~* '\.(speaking|sp)\.' AND (ie->>'speaking_score') ~ '^[0-9.]+$')
                       AND EXISTS (
                         SELECT 1 FROM jsonb_array_elements(r.ai_evaluation->'question_evaluations') qe
                         WHERE jsonb_typeof(qe) = 'object'
                           AND qe->>'question_index' = ie->>'question_index'
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
      WHERE jsonb_typeof(ie) = 'object'
        AND (ie->>'mastery') ~ '^-?[0-9.]+$' AND (ie->>'mastery')::numeric >= 0
        AND coalesce(ie->>'hasValue', 'true') = 'true';

      -- Events of this answer before the trigger rebuilds them.
      DELETE FROM _dslm_events_before;
      INSERT INTO _dslm_events_before
        SELECT * FROM public.student_events
        WHERE event_source = 'worksheet' AND event_payload->>'answer_id' = r.id::text;

      UPDATE public.worksheet_student_answers SET item_evaluations = v_items, mastery = v_mastery WHERE id = r.id;

      -- Keep the original dates of the rebuilt events (same answer and response type).
      UPDATE public.student_events e
         SET created_at = b.created_at
        FROM (SELECT event_payload->>'response_type' AS rt, min(created_at) AS created_at
                FROM _dslm_events_before GROUP BY 1) b
       WHERE e.event_source = 'worksheet'
         AND e.event_payload->>'answer_id' = r.id::text
         AND e.event_payload->>'response_type' IS NOT DISTINCT FROM b.rt
         AND e.created_at > b.created_at;

      INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
      VALUES (v_run, 'A_zero_score_stored_as_70', 'worksheet_student_answers', r.id::text,
              jsonb_build_object('item_evaluations', r.item_evaluations, 'mastery', r.mastery),
              jsonb_build_object('item_evaluations', v_items, 'mastery', v_mastery));
      INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
      SELECT v_run, 'A_replaced_event', 'student_events', b.id::text, to_jsonb(b), NULL
      FROM _dslm_events_before b;
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
        AND (e.event_payload->>'exercise_index') ~ '^[0-9]{1,6}$'
    )
    SELECT ev.*,
           coalesce(ev.ai_score ~ '^[0-9]+(\.[0-9]+)?$' AND ev.ai_score::numeric IN (25, 50, 75), false) AS fallback_bucket,
           CASE
             WHEN ev.ai_score ~ '^[0-9]+(\.[0-9]+)?$' THEN round(ev.ai_score::numeric)
             -- Any keyed item (multiple choice, fill blank, listening, keyed scenario items).
             WHEN ev.is_correct IS NOT NULL THEN CASE WHEN ev.is_correct THEN 100 ELSE 0 END
             ELSE NULL
           END AS desired
    FROM ev
  LOOP
    v_payload := r.event_payload;
    IF jsonb_typeof(v_payload->'nano_skill_ratings') = 'array'
       AND jsonb_array_length(v_payload->'nano_skill_ratings') > 0
       AND jsonb_typeof(v_payload->'nano_skill_ratings'->0) = 'object' THEN
      v_payload := jsonb_set(v_payload, '{nano_skill_ratings,0,mastery}', to_jsonb(coalesce(r.desired, -1)));
      v_payload := jsonb_set(v_payload, '{nano_skill_ratings,0,hasValue}', to_jsonb(r.desired IS NOT NULL));
    END IF;

    -- Compare the column AND the rating: the old code could update one without the other.
    IF r.mastery IS DISTINCT FROM r.desired OR v_payload IS DISTINCT FROM r.event_payload THEN
      IF r.fallback_bucket THEN
        INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
        VALUES (v_run, 'B_review_fallback_bucket', 'student_events', r.id::text,
                jsonb_build_object('mastery', r.mastery, 'nano_skill_ratings', r.event_payload->'nano_skill_ratings'),
                jsonb_build_object('question_ai_score', r.ai_score, 'not_changed', true));
        CONTINUE;
      END IF;

      UPDATE public.student_events SET mastery = r.desired, event_payload = v_payload WHERE id = r.id;

      INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
      VALUES (v_run, 'B_welcome_test_event_mastery', 'student_events', r.id::text,
              jsonb_build_object('mastery', r.mastery, 'nano_skill_ratings', r.event_payload->'nano_skill_ratings'),
              jsonb_build_object('mastery', r.desired, 'nano_skill_ratings', v_payload->'nano_skill_ratings'));
    END IF;
  END LOOP;

  ---------------------------------------------------------------------------
  -- C. Recompute every metric from its events (orphans are deleted)
  ---------------------------------------------------------------------------
  FOR r IN
    SELECT student_id, teacher_id, skill_name FROM _dslm_metrics_before
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
         CASE WHEN b.skill_name IS NULL THEN NULL ELSE to_jsonb(b) END,
         CASE WHEN m.skill_name IS NULL THEN NULL ELSE to_jsonb(m) END
  FROM _dslm_metrics_before b
  FULL JOIN public.student_skill_metrics m
    ON m.student_id = b.student_id
   AND m.teacher_id IS NOT DISTINCT FROM b.teacher_id
   AND m.skill_name = b.skill_name
  WHERE b.skill_name IS NULL OR m.skill_name IS NULL
     OR b.current_mastery IS DISTINCT FROM m.current_mastery
     OR b.trend IS DISTINCT FROM m.trend
     OR b.total_events IS DISTINCT FROM m.total_events;

  RAISE NOTICE 'DSLM backfill % done: % audit rows', v_run,
    (SELECT count(*) FROM public.dslm_backfill_audit WHERE run_id = v_run);
END
$backfill$;
