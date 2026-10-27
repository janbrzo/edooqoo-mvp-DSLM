# Profile v2 backfill plan (decision D15, step G_profile_v2)

Status: DESIGN ONLY. Nothing in this file has been executed and no migration exists. It needs the owner's approval of the before/after table produced by the dry run, and of the open decisions at the end.

## What is missing and how profiles are written

`process-welcome-test` is the only writer of `student_learning_profiles`. A full run upserts the typed columns plus the v2 columns (`traits`, `learning_path`, `divergences`, `answer_behaviour`, `signal_coverage`) and stamps `raw_answers.__interpretation_version__`, `raw_answers.trait_evidence`, `raw_answers.learning_path`. A teacher "force" re-run does the same for an old profile, but it also re-grades rows, calls the AI, rewrites `ai_summary`, level and events, and keeps an older stored learning path (a stored v1 path is kept as is). That is why a re-run is not the backfill: this plan updates only the v2 columns from the stored answers.

Three groups exist in production (counts from the dry run, 2026-10-27, 45 profiles):

| Group | Meaning | Count |
|---|---|---|
| missing_v2_columns | `traits` and `learning_path` columns NULL (23 of them still have an unversioned v1 path in `raw_answers.learning_path`, which the pacing loader reads) | 26 |
| pre_stage4 | v2 columns present, written by LPS v2 and unstamped interpretation (v1) | 10 |
| current | LPS v3, `__interpretation_version__` 2, `trait_evidence` | 9 |

D15 covers the first group. The second group is an optional extension (see open decisions). The current group is never touched.

## Dry run (read only)

`scripts/dslm/backfill-profile-v2-dryrun.mjs` (pure logic in `scripts/dslm/profileV2Recompute.ts`, tests in `src/lib/welcomeTest/__tests__/profileV2Backfill.test.ts`). It recomputes the five columns from the stored answers with `reconstructTraits`, `computeLearningPathScore`, `computeDivergences`, `answerBehaviour` and `buildTraitEvidence`, reads pacing through `computeIntensity` and `computeStylePacing`, and prints a before/after table with ids shortened to 8 characters. It takes a service role key from `SUPABASE_SERVICE_ROLE_KEY` (GET requests only) or a JSON export (`--input`). `--what-if-aliases` shows the table with proposed legacy option texts applied in memory.

Rules it follows, identical to the force re-run of the same attempt:

- answers come from `student_test_questions` for a test of a known bank size, from the stored `wt_*` keys of `raw_answers` for a legacy size (49, 54, 174 rows);
- the interpretation version is the one stored with the profile (unstamped = 1), so stored psychological readings are not reinterpreted; the Learning Path is computed as v3;
- a trait that the answers do not resolve may be taken from the typed column that already holds it (never replaces a resolved value);
- the level, scores, `self_awareness_score`, `ai_summary`, events and the typed trait columns are not recomputed.

## Safety gates (a profile is applied only if all hold)

1. No stored answer of a trait or Learning Path question matches no option text (`NO_OPTION_MATCH`, the legacy alias problem E1). On 2026-10-27 this blocks 17 of 36 profiles until aliases for `wt_q1`, `wt_q3` and `wt_q7` are added to `LEGACY_OPTION_TEXT` (REQUEST in the iteration 11 report). Never apply with an unmatched answer: the component would silently become `null`.
2. The stored answers exist (source `rows` or `raw_answers`, never `none`).
3. The row still looks as it did in the dry run (guard in the function below), so a concurrent teacher re-run is never overwritten.

## Proposed audited update (not executed)

One service-only function, versioned in its own migration (`CREATE OR REPLACE`, no `DROP`), reading a reviewed JSON payload that the dry run script would emit with a future `--emit-payload` flag (`[{ profile_id, expected, after }]`, ids full length, payload kept out of the repository):

```sql
-- Sketch only. Comments avoid apostrophes (SQL Editor splitter).
CREATE OR REPLACE FUNCTION public.backfill_profile_v2(p_run_id text, p_items jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_item jsonb;
  v_row public.student_learning_profiles%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_applied integer := 0;
  v_skipped integer := 0;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'service only';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_row FROM public.student_learning_profiles
      WHERE id = (v_item->>'profile_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    -- Idempotent: only rows that still hold the state the dry run saw.
    IF v_row.traits IS DISTINCT FROM (v_item->'expected'->'traits')
       OR v_row.learning_path IS DISTINCT FROM (v_item->'expected'->'learning_path')
       OR v_row.welcome_test_id IS DISTINCT FROM (v_item->>'welcome_test_id')::uuid THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    v_after := v_item->'after';
    IF v_row.traits IS NOT DISTINCT FROM v_after->'traits'
       AND v_row.learning_path IS NOT DISTINCT FROM v_after->'learning_path'
       AND v_row.divergences IS NOT DISTINCT FROM v_after->'divergences'
       AND v_row.answer_behaviour IS NOT DISTINCT FROM v_after->'answer_behaviour' THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    v_before := jsonb_build_object(
      'traits', v_row.traits, 'learning_path', v_row.learning_path,
      'divergences', v_row.divergences, 'answer_behaviour', v_row.answer_behaviour,
      'signal_coverage', v_row.signal_coverage, 'updated_at', v_row.updated_at,
      'raw_answers_keys', jsonb_build_object(
        'trait_evidence', v_row.raw_answers->'trait_evidence',
        'learning_path', v_row.raw_answers->'learning_path',
        '__interpretation_version__', v_row.raw_answers->'__interpretation_version__'));
    IF NOT p_dry_run THEN
      INSERT INTO public.dslm_backfill_audit (run_id, step, table_name, row_id, before, after)
      VALUES (p_run_id, 'G_profile_v2', 'student_learning_profiles', v_row.id::text, v_before, v_after);
      UPDATE public.student_learning_profiles SET
        traits = v_after->'traits',
        learning_path = v_after->'learning_path',
        divergences = v_after->'divergences',
        answer_behaviour = v_after->'answer_behaviour',
        signal_coverage = (v_after->>'signal_coverage')::numeric,
        raw_answers = coalesce(raw_answers, '{}'::jsonb)
          || jsonb_build_object('trait_evidence', v_after->'trait_evidence',
                                'learning_path', v_after->'learning_path')
      WHERE id = v_row.id;
    END IF;
    v_applied := v_applied + 1;
  END LOOP;
  RETURN jsonb_build_object('run_id', p_run_id, 'dry_run', p_dry_run, 'applied', v_applied, 'skipped', v_skipped);
END
$fn$;
REVOKE ALL ON FUNCTION public.backfill_profile_v2(text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
```

Properties:

- Columns written: `traits`, `learning_path`, `divergences`, `answer_behaviour`, `signal_coverage`, and in `raw_answers` only the keys `trait_evidence` and `learning_path` (the mirror older readers use). `__interpretation_version__` is added only when the profile version is above 1. Nothing else changes: answers (`wt_*`), typed trait columns, level, scores, `self_awareness_score`, `ai_summary`, `welcome_test_id`, events, `students`.
- Audit: one `dslm_backfill_audit` row per changed profile, `step = 'G_profile_v2'`, `table_name = 'student_learning_profiles'`, `row_id` the profile id, `before` and `after` as above. Reverting a row is an update from `before`.
- Idempotent: a second run skips every row (state no longer equals `expected`, or already equals `after`). `p_dry_run = true` (default) writes nothing and reports the counts.
- Table approval: the owner approves the per profile table in `scratchpad/impl11/P-table.md` (or a fresh run of the script) before `p_dry_run => false`. The payload is generated after the aliases exist, from the same data, in one session.
- Order: (1) alias REQUEST merged and deployed, (2) fresh dry run, owner approval, (3) migration with the function applied and `pg_proc` checked, (4) call with `p_dry_run => true`, compare counts with the table, (5) call with `p_dry_run => false` in a quiet window, (6) verify: second call reports `applied = 0`, `SELECT count(*) FROM dslm_backfill_audit WHERE step = 'G_profile_v2'` equals `applied`, `compute` of intensity for a sample matches the table.
- `updated_at`: the table has a `BEFORE UPDATE` trigger that sets `updated_at = now()`, so the backfill moves `updated_at` (the old value is in the audit). Avoiding it needs `SET LOCAL session_replication_role = replica` (superuser) or a trigger change; the plan accepts the bump unless the owner objects.

## Prompt effect the owner is approving

Pacing reads `learning_path` (falling back to `raw_answers.learning_path`) at prompt time. For the first group the intensity line and the capacity warning change as listed per student in the table; the style number changes only through `capacity` (profile only effect shown in the table). Generated timelines and phases are not recomputed by the backfill; they pick the new intensity at their next generation or pacing proposal.

## Open decisions for the owner

1. Group 2 (10 pre Stage 4 profiles): upgrade LPS v2 to v3 (two of them drop from `accelerated` 75 to `guided` 50 because v3 has no urgent override) or leave them as v2? Default in this plan: include `learning_path` and `signal_coverage` only after separate approval; interpretation stays v1.
2. Interpretation v2 for old profiles: this plan keeps each profile at its own version (v1) so stored readings do not change. Moving them to v2 changes `ambiguity_tolerance` for 11 profiles (table column "interp v2 would change").
3. Aliases for `wt_q1`, `wt_q3`, `wt_q7`: the proposed mappings in the report are semantic choices; each was checked against the typed column the profile already holds (no contradiction found), but the owner confirms them.
4. `updated_at` bump (above).
