# Iteration 8 rollout (signal correctness)

Apply after iteration 7 step 4. Run migrations through the Supabase MCP connector or CLI; from the SQL Editor use the base64 `DO` wrapper described in `iteration-7-rollout.md` (PL/pgSQL bodies, 8 KB limit). Statements with DELETE or DROP must run in the editor.

Status 2026-10-17: all six migrations are applied in production (090000, 090300, 090400, 090500, then 090100 and 090200). Result: 2388 of 2388 metrics in v3 format, 2227 `D_metric_recompute_v3` and 25 `E_homework_row_mastery` audit rows. Applied from the SQL Editor as base64 chunks staged in a temporary table (dropped afterwards).

## 1. Migrations (order)

1. `20261015090000_compute_skill_metric_v3.sql`: metric engine v3 and the refresh trigger function. Existing metrics keep their values until recomputed; every new event recomputes its skills with v3.
2. `20261015090300_welcome_test_event_reconciliation.sql`: one event per Welcome Test answer, retake supersession, reconciliation RPC. Must precede the `process-welcome-test` deploy (the new calls only warn until it exists).
3. `20261015090400_homework_ai_queue_and_worksheet_save.sql`: worksheet save without stale values, homework server AI functions and columns.
4. `20261015090500_test_results_null_for_unattempted.sql`: NULL score for unattempted Welcome Test skills, no tag double count.
5. Quiet window: `20261015090100_recompute_skill_metrics_v3.sql` (re-run until the NOTICE reports 0 left; about 5 runs of 500 for ~2200 metrics), then `20261015090200_mark_done_and_homework_mastery_fixes.sql` (homework row mastery backfill, ~23 rows).

Review afterwards: `select step, count(*) from dslm_backfill_audit where step like 'D_%' or step like 'E_%' or step like 'F_%' group by 1;`

## 2. Release

Frontend and Edge Functions `process-pending-ai-evaluations`, `process-welcome-test`, `transcribe-audio`, `verify-open-answers` together.

## 3. After the release

- The scheduled `process-pending-ai-evaluations` run evaluates up to 6 submitted homework answers per run whose AI never finished (last 14 days). Check its response `homework` field and new `submit_hw_AI_evaluation` events.
- Old Welcome Tests with missing events are reconciled on the next "Apply to Progress" re-run (or by a service-role script calling `reconcile_welcome_test_events` per test; review the audit table before and after).
- 72 existing `test_skill_results` rows with 0% for unattempted skills are corrected on the next `calculate_test_results` run of their test; no backfill.
