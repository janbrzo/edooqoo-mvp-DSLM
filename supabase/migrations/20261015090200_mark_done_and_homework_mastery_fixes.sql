-- Iteration 8 (I8.D): Mark done undo and homework exercise mastery.
--
-- RUN IN A QUIET WINDOW: the event rebuilds take advisory locks per skill metric;
-- two concurrent student saves with overlapping skills can deadlock (the answer
-- save commits, the event rebuild of the loser is logged in dslm_event_errors and
-- happens again on the next save). Requires 20261015090000 (trigger on created_at).
--
-- 1. delete_mark_done_evaluation also resets worksheet_student_answers.eval_trigger
--    from mark_done to NULL for that student, worksheet and exercise (a label
--    without its event is what an undo used to leave behind). The reset makes the
--    answer trigger rebuild the events of that answer, so their original created_at is
--    restored afterwards (recency weighting must not move).
-- 2. Backfill E_homework_row_mastery: homework_student_answers.mastery is set to the
--    mean of the scored items of item_evaluations (hasValue not false, mastery >= 0,
--    the same rule as averageScoredMastery) where it differs. Rows without scored
--    items are left alone. Every changed row is recorded in public.dslm_backfill_audit,
--    the rebuilt events keep their original created_at, and re-running changes nothing.
--
-- Requires 20261012120000 (answer triggers, delete_mark_done_evaluation) and
-- 20261012200000 (dslm_backfill_audit).

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
  v_ans record;
  v_dates jsonb;
BEGIN
  IF v_teacher_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.teacher_id = v_teacher_id
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.student_events se
  WHERE se.student_id = p_student_id AND se.teacher_id = v_teacher_id
    AND se.source_id IS NOT DISTINCT FROM p_worksheet_id AND se.event_type = 'mark_done_evaluation'
    AND (se.event_payload->>'exercise_index')::int = p_exercise_index;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- The answer no longer carries the mark_done label once its evaluation is undone.
  FOR v_ans IN
    SELECT wsa.id
    FROM public.worksheet_student_answers wsa
    JOIN public.students s ON s.id = p_student_id AND lower(s.student_email) = lower(wsa.student_email)
    WHERE wsa.worksheet_id = p_worksheet_id
      AND wsa.exercise_index = p_exercise_index
      AND wsa.eval_trigger = 'mark_done'
  LOOP
    SELECT coalesce(jsonb_object_agg(rt, ts), '{}'::jsonb) INTO v_dates
    FROM (
      SELECT e.event_payload->>'response_type' AS rt, min(e.created_at) AS ts
      FROM public.student_events e
      WHERE e.event_source = 'worksheet' AND e.event_payload->>'answer_id' = v_ans.id::text
        AND e.event_payload->>'response_type' IS NOT NULL
      GROUP BY 1
    ) d;

    UPDATE public.worksheet_student_answers SET eval_trigger = NULL WHERE id = v_ans.id;

    -- The answer trigger rebuilt the events: give them their original dates back.
    UPDATE public.student_events e
       SET created_at = (v_dates->>(e.event_payload->>'response_type'))::timestamptz
     WHERE e.event_source = 'worksheet'
       AND e.event_payload->>'answer_id' = v_ans.id::text
       AND v_dates ? (e.event_payload->>'response_type')
       AND e.created_at > (v_dates->>(e.event_payload->>'response_type'))::timestamptz;
  END LOOP;

  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_mark_done_evaluation(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_mark_done_evaluation(uuid, uuid, integer) TO authenticated;

-- E. Homework exercise mastery = mean of the scored items ------------------
DO $backfill$
DECLARE
  v_run text := 'i8d_homework_row_mastery_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS_MS');
  r record;
  v_dates jsonb;
BEGIN
  FOR r IN
    SELECT a.id, a.mastery AS old_mastery, a.eval_trigger, a.item_evaluations,
           m.desired
    FROM public.homework_student_answers a
    CROSS JOIN LATERAL (
      SELECT round(avg((ie->>'mastery')::numeric))::int AS desired
      FROM jsonb_array_elements(a.item_evaluations) ie
      WHERE jsonb_typeof(ie) = 'object'
        AND (ie->>'mastery') ~ '^-?[0-9]+(\.[0-9]+)?$' AND (ie->>'mastery')::numeric >= 0
        AND coalesce(ie->>'hasValue', 'true') = 'true'
    ) m
    WHERE jsonb_typeof(a.item_evaluations) = 'array'
      AND m.desired IS NOT NULL
      AND a.mastery IS DISTINCT FROM m.desired
  LOOP
    SELECT coalesce(jsonb_object_agg(rt, ts), '{}'::jsonb) INTO v_dates
    FROM (
      SELECT e.event_payload->>'response_type' AS rt, min(e.created_at) AS ts
      FROM public.student_events e
      WHERE e.event_source = 'homework' AND e.event_payload->>'answer_id' = r.id::text
        AND e.event_payload->>'response_type' IS NOT NULL
      GROUP BY 1
    ) d;

    UPDATE public.homework_student_answers SET mastery = r.desired WHERE id = r.id;

    -- The answer trigger may rebuild the events of this answer: keep their original dates.
    UPDATE public.student_events e
       SET created_at = (v_dates->>(e.event_payload->>'response_type'))::timestamptz
     WHERE e.event_source = 'homework'
       AND e.event_payload->>'answer_id' = r.id::text
       AND v_dates ? (e.event_payload->>'response_type')
       AND e.created_at > (v_dates->>(e.event_payload->>'response_type'))::timestamptz;

    INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
    VALUES (v_run, 'E_homework_row_mastery', 'homework_student_answers', r.id::text,
            jsonb_build_object('mastery', r.old_mastery, 'eval_trigger', r.eval_trigger),
            jsonb_build_object('mastery', r.desired));
  END LOOP;

  RAISE NOTICE 'I8.D homework row mastery backfill % done: % rows', v_run,
    (SELECT count(*) FROM public.dslm_backfill_audit WHERE run_id = v_run);
END
$backfill$;
