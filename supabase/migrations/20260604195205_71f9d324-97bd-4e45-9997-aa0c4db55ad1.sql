alter table public.model_health_checks add column if not exists purpose text;
comment on column public.model_health_checks.purpose is 'Human-readable description of what this model powers in the app.';
create index if not exists idx_model_health_checks_purpose on public.model_health_checks (purpose);