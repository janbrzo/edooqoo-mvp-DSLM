-- Welcome Test events: skip/answer swap, lost-event reconciliation, retake.
--
-- 1. log_welcome_test_event_by_share_token deletes the earlier event of BOTH
--    types (test_answer_submitted and test_answer_skipped) for the answer, so a
--    skip after an answer, or an answer after a skip, leaves exactly one event.
--    (Before, a stale skipped event stayed next to the submitted one.)
-- 2. reconcile_welcome_test_events(test, events): service role only. Inserts
--    the events of answered questions that have none (events lost in fast
--    sessions). The event payloads are built in TypeScript by
--    supabase/functions/_shared/welcomeTestEventPayload.ts, the same builder
--    the browser uses, because they need the question bank (nano skill, trait
--    mapping, reasons) that does not exist in the database. Idempotent: an
--    answer that already has a submitted event is left alone; a stale skipped
--    event of an answered question is replaced. Inserted events keep the time
--    the question was answered (created_at). Every change is audited.
-- 3. supersede_previous_welcome_test_events(test): service role only. Owner
--    decision D13: a completed retake replaces the earlier attempts. Deletes
--    the welcome_test events of the same student and teacher whose source test
--    is an older welcome attempt; the existing DELETE trigger recomputes the
--    skill metrics. Rows are written to dslm_backfill_audit first. Does nothing
--    when the new test has no events yet (the old evidence is kept).
--
-- Re-running is safe. No backfill of old tests here: the payloads cannot be
-- rebuilt in SQL, so past tests are reconciled by process-welcome-test (force
-- re-run) or by a service-role script calling reconcile_welcome_test_events.

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

CREATE OR REPLACE FUNCTION public.log_welcome_test_event_by_share_token(p_share_token text, p_event_type text, p_answer_id text, p_legacy_answer_id text, p_event_payload jsonb, p_element_type text DEFAULT NULL::text, p_skill_ids text[] DEFAULT NULL::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t record;
BEGIN
  IF p_event_type NOT IN ('test_answer_submitted', 'test_answer_skipped') THEN
    RAISE EXCEPTION 'Unsupported event type';
  END IF;

  SELECT id, student_id, teacher_id INTO t
  FROM public.student_tests
  WHERE share_token = p_share_token
    AND deleted_at IS NULL
    AND status IN ('assigned', 'in_progress', 'completed')
  LIMIT 1;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Test not found';
  END IF;

  -- Both event types: a question has one event, the latest action wins.
  DELETE FROM public.student_events
  WHERE student_id = t.student_id
    AND source_id = t.id
    AND event_source = 'welcome_test'
    AND event_type IN ('test_answer_submitted', 'test_answer_skipped')
    AND (
      event_payload->>'answer_id' = p_answer_id
      OR (event_payload->>'answer_id' = p_legacy_answer_id
          AND NOT (event_payload ? 'legacy_answer_id'))
    );

  RETURN public.add_student_event_internal(
    p_student_id => t.student_id,
    p_teacher_id => t.teacher_id,
    p_event_type => p_event_type,
    p_event_source => 'welcome_test',
    p_source_id => t.id,
    p_event_payload => p_event_payload,
    p_skill_ids => p_skill_ids,
    p_element_type => p_element_type
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_welcome_test_events(p_test_id uuid, p_events jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t record;
  e jsonb;
  v_run text := 'welcome_reconcile_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS_MS');
  v_answer_id text;
  v_legacy_id text;
  v_payload jsonb;
  v_mastery numeric;
  v_created timestamptz;
  v_skills text[];
  v_new_id uuid;
  v_inserted integer := 0;
  v_present integer := 0;
  v_replaced integer := 0;
  r record;
BEGIN
  SELECT id, student_id, teacher_id INTO t
  FROM public.student_tests
  WHERE id = p_test_id AND test_type = 'welcome';
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Welcome test not found';
  END IF;
  IF p_events IS NULL OR jsonb_typeof(p_events) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_events must be an array' USING ERRCODE = '22023';
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(p_events)
  LOOP
    v_answer_id := e->>'answer_id';
    v_legacy_id := e->>'legacy_answer_id';
    v_payload := e->'event_payload';
    IF v_answer_id IS NULL OR v_payload IS NULL OR jsonb_typeof(v_payload) IS DISTINCT FROM 'object'
       OR v_payload->>'answer_id' IS DISTINCT FROM v_answer_id THEN
      RAISE EXCEPTION 'Invalid event for %', coalesce(v_answer_id, '(none)') USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.student_events x
      WHERE x.student_id = t.student_id AND x.source_id = t.id AND x.event_source = 'welcome_test'
        AND x.event_type = 'test_answer_submitted'
        AND (x.event_payload->>'answer_id' = v_answer_id
             OR (x.event_payload->>'answer_id' = v_legacy_id AND NOT (x.event_payload ? 'legacy_answer_id')))
    ) THEN
      v_present := v_present + 1;
      CONTINUE;
    END IF;

    -- An answered question must not keep a skipped event next to its answer.
    FOR r IN
      SELECT x.* FROM public.student_events x
      WHERE x.student_id = t.student_id AND x.source_id = t.id AND x.event_source = 'welcome_test'
        AND x.event_type = 'test_answer_skipped'
        AND (x.event_payload->>'answer_id' = v_answer_id
             OR (x.event_payload->>'answer_id' = v_legacy_id AND NOT (x.event_payload ? 'legacy_answer_id')))
    LOOP
      INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
      VALUES (v_run, 'F_welcome_event_backfill_replaced_skip', 'student_events', r.id::text, to_jsonb(r), NULL);
      DELETE FROM public.student_events WHERE id = r.id;
      v_replaced := v_replaced + 1;
    END LOOP;

    -- Same mastery rule as add_student_event_internal.
    v_mastery := NULL;
    IF jsonb_typeof(v_payload->'nano_skill_ratings') = 'array'
       AND jsonb_array_length(v_payload->'nano_skill_ratings') > 0 THEN
      SELECT ROUND(AVG((elem->>'mastery')::numeric)) INTO v_mastery
      FROM jsonb_array_elements(v_payload->'nano_skill_ratings') AS elem
      WHERE elem->>'mastery' IS NOT NULL
        AND (elem->>'mastery')::numeric >= 0
        AND (elem ? 'hasValue' AND (elem->>'hasValue')::boolean = true);
    END IF;
    IF v_mastery IS NULL AND (v_payload->>'is_correct') IS NOT NULL THEN
      v_mastery := CASE WHEN (v_payload->>'is_correct')::boolean THEN 100 ELSE 0 END;
    END IF;

    SELECT coalesce(array_agg(s), ARRAY[]::text[]) INTO v_skills
    FROM jsonb_array_elements_text(coalesce(e->'skill_ids', '[]'::jsonb)) AS s;
    v_created := coalesce(nullif(e->>'answered_at', '')::timestamptz, now());

    INSERT INTO public.student_events (
      student_id, teacher_id, event_type, event_source, source_id,
      event_payload, skill_ids, element_type, mastery, created_at
    ) VALUES (
      t.student_id, t.teacher_id, 'test_answer_submitted', 'welcome_test', t.id,
      v_payload, v_skills, nullif(e->>'element_type', ''), v_mastery, v_created
    ) RETURNING id INTO v_new_id;

    INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
    SELECT v_run, 'F_welcome_event_backfill', 'student_events', x.id::text, NULL, to_jsonb(x)
    FROM public.student_events x WHERE x.id = v_new_id;
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'already_present', v_present, 'replaced_skipped', v_replaced);
END;
$function$;

CREATE OR REPLACE FUNCTION public.supersede_previous_welcome_test_events(p_test_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t record;
  v_run text := 'welcome_retake_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS_MS');
  v_deleted integer := 0;
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

  CREATE TEMP TABLE _welcome_superseded ON COMMIT DROP AS
  SELECT e.*
  FROM public.student_events e
  JOIN public.student_tests o ON o.id = e.source_id
  WHERE e.student_id = t.student_id
    AND e.teacher_id = t.teacher_id
    AND e.event_source = 'welcome_test'
    AND o.test_type = 'welcome'
    AND o.student_id = t.student_id
    AND o.teacher_id = t.teacher_id
    AND o.id <> t.id
    AND (coalesce(o.attempt_number, 1) < t.attempt
         OR (coalesce(o.attempt_number, 1) = t.attempt AND o.created_at < t.created_at));

  INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
  SELECT v_run, 'F_welcome_retake_superseded', 'student_events', s.id::text, to_jsonb(s), NULL
  FROM _welcome_superseded s;

  DELETE FROM public.student_events e USING _welcome_superseded s WHERE e.id = s.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  DROP TABLE _welcome_superseded;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_welcome_test_events(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_welcome_test_events(uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.supersede_previous_welcome_test_events(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supersede_previous_welcome_test_events(uuid) TO service_role;
