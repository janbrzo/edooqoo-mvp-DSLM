-- Welcome Test validation loop (Stage 5): a teacher's verdict on one signal
-- the Welcome Test showed (a trait, a declared-vs-measured divergence, the
-- learning-path band). One row per teacher, student, test and signal; the
-- interpretation_version says which reading of the answers the teacher judged.
-- Additive only: no existing table or function is touched.

CREATE TABLE IF NOT EXISTS public.wt_signal_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  test_id uuid REFERENCES public.student_tests(id) ON DELETE SET NULL,
  signal_key text NOT NULL,
  signal_value text,
  verdict text NOT NULL CHECK (verdict IN ('agree', 'partly', 'disagree')),
  comment text CHECK (char_length(comment) <= 1000),
  interpretation_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- NULLS NOT DISTINCT: a verdict without a test (test deleted) is still one row per signal.
  CONSTRAINT wt_signal_feedback_unique_signal
    UNIQUE NULLS NOT DISTINCT (teacher_id, student_id, test_id, signal_key)
);

CREATE INDEX IF NOT EXISTS wt_signal_feedback_student_idx
  ON public.wt_signal_feedback (student_id, test_id);

CREATE OR REPLACE FUNCTION public.wt_signal_feedback_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wt_signal_feedback_touch_updated_at ON public.wt_signal_feedback;
CREATE TRIGGER wt_signal_feedback_touch_updated_at
  BEFORE UPDATE ON public.wt_signal_feedback
  FOR EACH ROW EXECUTE FUNCTION public.wt_signal_feedback_touch_updated_at();

ALTER TABLE public.wt_signal_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers read own signal feedback" ON public.wt_signal_feedback;
CREATE POLICY "Teachers read own signal feedback"
  ON public.wt_signal_feedback FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = wt_signal_feedback.student_id AND s.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "Teachers insert own signal feedback" ON public.wt_signal_feedback;
CREATE POLICY "Teachers insert own signal feedback"
  ON public.wt_signal_feedback FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = wt_signal_feedback.student_id AND s.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "Teachers update own signal feedback" ON public.wt_signal_feedback;
CREATE POLICY "Teachers update own signal feedback"
  ON public.wt_signal_feedback FOR UPDATE TO authenticated
  USING (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = wt_signal_feedback.student_id AND s.teacher_id = auth.uid())
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = wt_signal_feedback.student_id AND s.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "Teachers delete own signal feedback" ON public.wt_signal_feedback;
CREATE POLICY "Teachers delete own signal feedback"
  ON public.wt_signal_feedback FOR DELETE TO authenticated
  USING (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = wt_signal_feedback.student_id AND s.teacher_id = auth.uid())
  );

REVOKE ALL ON public.wt_signal_feedback FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wt_signal_feedback TO authenticated;
GRANT ALL ON public.wt_signal_feedback TO service_role;
