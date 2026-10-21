-- D11 / audit B1: one-off pacing apply for students whose stored pacing contradicts the
-- value computed by computeStylePacing and who never had a manual set.
-- RUNBOOK FILE: review the qualifying students first (the FOR loop query below, run as a SELECT),
-- then run once in the SQL Editor. Not run by the deploy pipeline of this iteration.
--
-- Source of the computed value: students.last_pacing_reasoning (key proposed), written by
-- recalculate-pacing (computeStylePacing) at last_pacing_recalc_at. Rows whose snapshot is
-- older than 35 days are skipped: run recalculate-pacing (mode apply) for them instead.
--
-- A student qualifies when
--   last_pacing_set_manually is false or NULL (never set by a teacher),
--   no pacing_proposals row with status accepted, reverted or rejected (no teacher decision),
--   the snapshot value differs from dslm_pacing_mode.
-- Every changed row is recorded in public.dslm_backfill_audit (step F2_pacing_apply_d11).
-- Idempotent: after the apply the stored value equals the snapshot, so a second run
-- selects nothing. last_pacing_set_manually becomes false (computed value), as in apply mode.
-- last_pacing_recalc_at and last_pacing_reasoning are left as they are.

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

DO $f2$
DECLARE
  v_run text := 'f2_pacing_apply_d11_' || to_char(now() AT TIME ZONE 'utc', 'YYYYMMDD"T"HH24MISS');
  r record;
BEGIN
  FOR r IN
    SELECT s.id,
           s.dslm_pacing_mode AS old_mode,
           s.last_pacing_set_manually AS old_flag,
           (s.last_pacing_reasoning->>'proposed')::int AS new_mode,
           s.last_pacing_recalc_at
    FROM public.students s
    WHERE s.deleted_at IS NULL
      AND s.last_pacing_set_manually IS NOT TRUE
      AND s.last_pacing_recalc_at > now() - interval '35 days'
      AND (s.last_pacing_reasoning->>'proposed') ~ '^[0-9]{1,3}$'
      AND (s.last_pacing_reasoning->>'proposed')::int BETWEEN 0 AND 100
      AND (s.last_pacing_reasoning->>'proposed')::int <> s.dslm_pacing_mode
      AND NOT EXISTS (
        SELECT 1 FROM public.pacing_proposals p
        WHERE p.student_id = s.id AND p.status IN ('accepted', 'reverted', 'rejected')
      )
    FOR UPDATE OF s
  LOOP
    UPDATE public.students
       SET dslm_pacing_mode = r.new_mode, last_pacing_set_manually = false
     WHERE id = r.id;

    INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
    VALUES (v_run, 'F2_pacing_apply_d11', 'students', r.id::text,
            jsonb_build_object('dslm_pacing_mode', r.old_mode, 'last_pacing_set_manually', r.old_flag),
            jsonb_build_object('dslm_pacing_mode', r.new_mode, 'last_pacing_set_manually', false,
                               'snapshot_at', r.last_pacing_recalc_at));
  END LOOP;
END
$f2$;
