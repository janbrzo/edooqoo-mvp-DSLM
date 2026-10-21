# Iteration 9 rollout (interpretation layer)

1. Migration `supabase/migrations/20261021090000_students_pacing_flag_default_null.sql` (one `ALTER COLUMN ... SET DEFAULT NULL`, no DROP; the MCP connector can apply it). Check: `select column_default from information_schema.columns where table_name = 'students' and column_name = 'last_pacing_set_manually';` is NULL.
2. Deploy the Edge Functions `generate-timeline`, `generate-curriculum-phases`, `recalculate-pacing`, `pacing-periodic-check` and the frontend together.
3. Smoke test on the test teacher account: generate a timeline and phases for one student (the phases prompt now uses the shared framework and 3 pacing labels), check `generation_context.weak_skills_snapshot`, and that a student with an overdue goal date gets the reminder toast.
4. Optional, by hand: run `docs/operational/f2-pacing-apply-d11.sql` in the SQL Editor after reviewing the SELECT part (about 49 students stored at 50 qualify; the 3 students with other stored values are reviewed manually). The file is not a migration on purpose.
