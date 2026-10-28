-- DATA SCRIPT (not a migration): recompute skill metrics whose category or micro skill was
-- other and now maps to a real value (Phase 1 / P1.5, migration
-- 20261028111000_extract_skill_category_fallbacks.sql). Run by an operator in the SQL
-- Editor AFTER that migration is applied; it is never applied by `supabase db push`.
--
-- What it does: for every public.student_skill_metrics row with skill_category = other
-- or micro_skill = other whose skill_name now maps to a different category or micro
-- skill, it calls the existing public.compute_skill_metric(student, teacher, skill_name,
-- extract_skill_category(skill_name)). compute_skill_metric rewrites the row from the
-- events (and sets micro_skill with extract_micro_skill), so mastery, trend and history
-- are recomputed by the normal engine; skill_name is never renamed.
-- Rows whose mapping does not change (for example ns.QA.forged.* test names) are not
-- touched. Deleting junk rows is a separate decision.
--
-- Every changed row is recorded in public.dslm_backfill_audit with step
-- E_other_category_remap (full before and after row), so the run can be reviewed.
-- Re-running is safe: a row that is already remapped no longer matches.
--
-- STEP 1 (read only): run the dry run below and check the counts.
-- STEP 2: run the DO block. At most 500 rows per run; run again while "left" is above 0.

-- ---------------------------------------------------------------------------------------
-- DRY RUN: how many rows change, and into what
-- ---------------------------------------------------------------------------------------
SELECT
  m.skill_category AS old_category,
  public.extract_skill_category(m.skill_name) AS new_category,
  m.micro_skill AS old_micro,
  public.extract_micro_skill(m.skill_name) AS new_micro,
  count(*) AS rows_changing,
  min(m.skill_name) AS example_skill_name
FROM public.student_skill_metrics m
WHERE (m.skill_category = 'other' OR m.micro_skill = 'other')
  AND (public.extract_skill_category(m.skill_name) IS DISTINCT FROM m.skill_category
       OR public.extract_micro_skill(m.skill_name) IS DISTINCT FROM m.micro_skill)
GROUP BY 1, 2, 3, 4
ORDER BY rows_changing DESC;

SELECT count(*) AS rows_changing_total
FROM public.student_skill_metrics m
WHERE (m.skill_category = 'other' OR m.micro_skill = 'other')
  AND (public.extract_skill_category(m.skill_name) IS DISTINCT FROM m.skill_category
       OR public.extract_micro_skill(m.skill_name) IS DISTINCT FROM m.micro_skill);

-- ---------------------------------------------------------------------------------------
-- RECOMPUTE (writes): one transaction
-- ---------------------------------------------------------------------------------------
BEGIN;

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

DO $remap$
DECLARE
  v_run text := 'dslm_other_remap_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS_MS');
  v_batch integer := 500;
  v_todo integer;
  v_done integer := 0;
  r record;
  v_after jsonb;
BEGIN
  IF position('pg_advisory_xact_lock' IN pg_get_functiondef('public.compute_skill_metric(uuid,uuid,text,text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'compute_skill_metric v3 is not deployed';
  END IF;
  IF public.extract_micro_skill('ns.B1.used_to.affirmative_form_past_tense') = 'other' THEN
    RAISE EXCEPTION 'Apply 20261028111000_extract_skill_category_fallbacks.sql first';
  END IF;

  SELECT count(*) INTO v_todo
  FROM public.student_skill_metrics m
  WHERE (m.skill_category = 'other' OR m.micro_skill = 'other')
    AND (public.extract_skill_category(m.skill_name) IS DISTINCT FROM m.skill_category
         OR public.extract_micro_skill(m.skill_name) IS DISTINCT FROM m.micro_skill);

  -- Same order everywhere: consistent advisory lock order against live saves.
  FOR r IN
    SELECT m.student_id, m.teacher_id, m.skill_name, to_jsonb(m) AS before_row
    FROM public.student_skill_metrics m
    WHERE (m.skill_category = 'other' OR m.micro_skill = 'other')
      AND (public.extract_skill_category(m.skill_name) IS DISTINCT FROM m.skill_category
           OR public.extract_micro_skill(m.skill_name) IS DISTINCT FROM m.micro_skill)
    ORDER BY m.student_id, m.teacher_id, m.skill_name
    LIMIT v_batch
  LOOP
    PERFORM public.compute_skill_metric(
      r.student_id, r.teacher_id, r.skill_name, public.extract_skill_category(r.skill_name)
    );
    SELECT to_jsonb(m) INTO v_after
    FROM public.student_skill_metrics m
    WHERE m.student_id = r.student_id AND m.teacher_id = r.teacher_id AND m.skill_name = r.skill_name;

    INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
    VALUES (v_run, 'E_other_category_remap', 'student_skill_metrics',
            r.student_id::text || '|' || r.teacher_id::text || '|' || r.skill_name,
            r.before_row, v_after);
    v_done := v_done + 1;
  END LOOP;

  RAISE NOTICE 'run %: recomputed % of % rows, left %', v_run, v_done, v_todo, v_todo - v_done;
END
$remap$;

COMMIT;

-- Verification (read only): both counts should be 0 for names the mapping knows.
SELECT
  count(*) FILTER (WHERE skill_category = 'other' AND micro_skill <> 'other') AS category_other_micro_known,
  count(*) FILTER (WHERE skill_category = 'other') AS category_other,
  count(*) FILTER (WHERE micro_skill = 'other') AS micro_other
FROM public.student_skill_metrics;
