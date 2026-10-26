-- Phase advance proposals (audit 9.6, decision D14): when the evidence shows that the
-- weak skills of the current phase recovered, the app proposes to mark the phase done
-- and start the next planned one. The teacher decides; nothing advances by itself.
-- Modelled on public.pacing_proposals (same RLS, no foreign keys).

CREATE TABLE IF NOT EXISTS public.phase_advance_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  phase_id uuid NOT NULL,
  next_phase_id uuid,
  status text NOT NULL DEFAULT 'pending',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  CONSTRAINT phase_advance_proposals_status_check
    CHECK (status IN ('pending', 'accepted', 'dismissed', 'superseded'))
);

-- One pending proposal per phase, so concurrent clients cannot create duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS phase_advance_proposals_one_pending_idx
  ON public.phase_advance_proposals (phase_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS phase_advance_proposals_student_idx
  ON public.phase_advance_proposals (student_id, status);

ALTER TABLE public.phase_advance_proposals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.phase_advance_proposals TO authenticated;
GRANT ALL ON public.phase_advance_proposals TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'phase_advance_proposals'
      AND policyname = 'Service role full access phase_advance_proposals'
  ) THEN
    CREATE POLICY "Service role full access phase_advance_proposals"
      ON public.phase_advance_proposals FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'phase_advance_proposals'
      AND policyname = 'Teachers manage their own phase advance proposals'
  ) THEN
    CREATE POLICY "Teachers manage their own phase advance proposals"
      ON public.phase_advance_proposals FOR ALL TO authenticated
      USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
  END IF;
END
$$;
