-- Welcome Test profile v2 (iteration 5 of the evaluation pipeline fixes).
--
-- 1. Typed storage for what the Welcome Test measures beyond the CEFR level.
--    Before, the scenario traits (latent goal, homework commitment, plateau,
--    deadline response...) existed only as raw answer strings, the Learning
--    Path Score was buried in raw_answers, and nothing recorded how much of the
--    test was actually answered. All columns are nullable: old profiles keep
--    working and readers fall back to raw_answers.
--      traits            reconstructed trait map (process-welcome-test)
--      learning_path     Learning Path Score v2 (intensity, coverage, capacity cap)
--      divergences       declared-vs-measured pairs computed in code
--      answer_behaviour  skill-item coverage, skips, "I don't know", timing
--      signal_coverage   share of the LPS weight that was measured (0..1)
-- 2. student_learning_profile_versions: the previous profile is kept before a
--    retake overwrites it, so attempts can be compared on real data.
-- 3. Welcome Test AI score updates now feed skill metrics (review item S3 of
--    the iteration 2 review): the UPDATE trigger no longer skips
--    event_source 'welcome_test', so an open answer scored by the model counts
--    with its real score instead of the placeholder it was inserted with.

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.student_learning_profiles
  ADD COLUMN IF NOT EXISTS traits jsonb,
  ADD COLUMN IF NOT EXISTS learning_path jsonb,
  ADD COLUMN IF NOT EXISTS divergences jsonb,
  ADD COLUMN IF NOT EXISTS answer_behaviour jsonb,
  ADD COLUMN IF NOT EXISTS signal_coverage numeric;

CREATE TABLE IF NOT EXISTS public.student_learning_profile_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  welcome_test_id uuid,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_profile_versions_student
  ON public.student_learning_profile_versions (student_id, teacher_id, created_at DESC);

ALTER TABLE public.student_learning_profile_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view their students' profile versions" ON public.student_learning_profile_versions;
CREATE POLICY "Teachers can view their students' profile versions"
  ON public.student_learning_profile_versions
  FOR SELECT
  USING (auth.uid() = teacher_id);
-- Rows are written only by process-welcome-test with the service role.

DROP TRIGGER IF EXISTS trg_refresh_skill_metrics_on_update ON public.student_events;
CREATE TRIGGER trg_refresh_skill_metrics_on_update
  AFTER UPDATE OF event_payload, mastery ON public.student_events
  FOR EACH ROW
  WHEN (OLD.event_payload IS DISTINCT FROM NEW.event_payload OR OLD.mastery IS DISTINCT FROM NEW.mastery)
  EXECUTE FUNCTION refresh_skill_metrics_on_event();
