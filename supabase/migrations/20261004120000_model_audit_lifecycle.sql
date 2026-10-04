-- v6.9.90 — LLM model audit: lifecycle columns + per-run reports.
-- Additive only: existing rows and readers of model_health_checks are unaffected.

ALTER TABLE public.model_health_checks
  ADD COLUMN IF NOT EXISTS check_kind text,
  ADD COLUMN IF NOT EXISTS shutdown_date date,
  ADD COLUMN IF NOT EXISTS days_to_shutdown integer;

COMMENT ON COLUMN public.model_health_checks.check_kind IS 'Probe type from modelRegistry.ts: metadata | gemini-generate | openai-chat | openai-chat-reasoning | openai-tts.';
COMMENT ON COLUMN public.model_health_checks.shutdown_date IS 'Provider-announced shutdown date for this model at check time (from modelRegistry.ts).';
COMMENT ON COLUMN public.model_health_checks.days_to_shutdown IS 'Days from checked_at to shutdown_date; negative once passed.';

CREATE TABLE IF NOT EXISTS public.model_audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL CHECK (mode IN ('daily', 'monthly')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  probes jsonb NOT NULL DEFAULT '[]'::jsonb,
  lifecycle jsonb NOT NULL DEFAULT '[]'::jsonb,
  deprecation_scan jsonb,
  advisor jsonb,
  unregistered jsonb NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE public.model_audit_reports IS 'One row per audit-llm-models run: health summary, shutdown countdown, deprecation-page scan and model advisor output (monthly).';

GRANT ALL ON public.model_audit_reports TO service_role;

ALTER TABLE public.model_audit_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only" ON public.model_audit_reports;
CREATE POLICY "service role only" ON public.model_audit_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_model_audit_reports_recent ON public.model_audit_reports (mode, created_at DESC);
