-- Hotfix: compute_skill_metric v3 (20261015090000) writes trend = 'insufficient_data'
-- for a skill with fewer than 4 data points, but the CHECK constraint on
-- student_skill_metrics.trend still allowed only improving/declining/stable.
-- The metric upsert runs inside the student_events INSERT trigger, so every
-- rated event for a skill with < 4 points was rolled back (Welcome Test keyed
-- items, homework, worksheets, Mark done). Postgres logged
-- "violates check constraint student_skill_metrics_trend_check" from
-- 2026-10-15 19:32 UTC. The frontend already handles 'insufficient_data'.
ALTER TABLE public.student_skill_metrics
  DROP CONSTRAINT IF EXISTS student_skill_metrics_trend_check;

ALTER TABLE public.student_skill_metrics
  ADD CONSTRAINT student_skill_metrics_trend_check
  CHECK (trend = ANY (ARRAY['improving'::text, 'declining'::text, 'stable'::text, 'insufficient_data'::text]));
