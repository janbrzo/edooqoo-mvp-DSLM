# Iteration 10 rollout: validation loop v1

All steps are additive. Apply in this order; each step is safe to repeat.

1. `supabase/migrations/20261027085900_dslm_validation_loop_v1.sql` (connector or SQL Editor).
   Creates `dslm_interpretation_params` (version 1 seed), `param_version` columns on
   `student_skill_metrics` and `pacing_proposals`, `dslm_decision_log` and `log_dslm_decision`.
   Contains no removal statement.
2. `supabase/migrations/20261027090100_dslm_validation_report.sql` (read-only report function).
3. `supabase/migrations/20261027090200_save_mark_done_replace_signature.sql`, run by the owner in the
   SQL Editor (it contains `DROP FUNCTION`, which the connector would hold for confirmation). It
   replaces `save_mark_done_evaluation(uuid, uuid, integer, text, text, jsonb)` with the same
   function plus an optional trailing `p_prior_verdict jsonb DEFAULT NULL`, so no second overload
   remains. Old 6 argument calls keep working. The DROP and CREATE run in one batch, so there is no
   window without the function.
4. Check with `pg_proc`: exactly one `save_mark_done_evaluation` row (7 arguments), one
   `log_dslm_decision`, and `select count(*) from dslm_interpretation_params` = 19.
5. Deploy the client. A client that sends `p_prior_verdict` before step 3 fails the RPC with an
   unknown parameter error, so the client must go out after step 3 (it falls back to the 6 argument
   call only if it implements that fallback).

Rollback: the client can stop sending `p_prior_verdict`; the extra argument and tables are inert.
Stored `event_payload.prior_verdict` is never read by `compute_skill_metric`.
