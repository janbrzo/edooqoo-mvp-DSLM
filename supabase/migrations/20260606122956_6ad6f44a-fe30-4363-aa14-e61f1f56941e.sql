-- v6.9.39 P5: Welcome Test auto-suggested goals support
ALTER TABLE public.student_progress_goals
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_student_progress_goals_source
  ON public.student_progress_goals (student_id, source)
  WHERE deleted_at IS NULL;