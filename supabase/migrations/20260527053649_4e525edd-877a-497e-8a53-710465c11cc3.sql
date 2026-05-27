CREATE TABLE IF NOT EXISTS public.model_health_checks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  status int not null,
  latency_ms int,
  ok boolean not null,
  error text,
  checked_at timestamptz not null default now()
);

GRANT ALL ON public.model_health_checks TO service_role;

ALTER TABLE public.model_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.model_health_checks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mhc_recent ON public.model_health_checks (provider, model, checked_at DESC);