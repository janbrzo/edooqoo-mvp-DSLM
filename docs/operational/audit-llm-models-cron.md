# audit-llm-models — scheduling guide

Daily health check that pings Lovable Gateway + OpenAI models and writes results to `public.model_health_checks`. Deprecation responses (404/410) and 5xx also flow into `error_logs` via `logModelFailure`, which the StatusPage banner reads.

## Prerequisites

1. Secret `CRON_SECRET` exists in project secrets (Lovable Cloud → Settings → Secrets).
2. Edge function `audit-llm-models` is deployed.
3. Extensions `pg_cron` and `pg_net` are enabled in Supabase.

## One-time setup (run in Supabase SQL editor)

The SQL below contains the project URL + the CRON_SECRET value, so it must NOT be committed to `supabase/migrations/`. Run it once from the Supabase SQL editor.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'audit-llm-models-daily',
  '0 6 * * *',  -- 06:00 UTC daily
  $$
  select net.http_post(
    url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  '<PASTE_CRON_SECRET_VALUE_HERE>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

## Manual smoke-test

```bash
curl -X POST \
  -H "x-cron-secret: <CRON_SECRET>" \
  https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models
```

Expected: JSON `{ ok: true, checked: 4, results: [...] }`. New rows appear in `public.model_health_checks` for each target model.

## Operations

- Inspect runs:
  ```sql
  select * from cron.job_run_details
  where jobname = 'audit-llm-models-daily'
  order by start_time desc limit 10;
  ```
- Unschedule (e.g. before rotating `CRON_SECRET`):
  ```sql
  select cron.unschedule('audit-llm-models-daily');
  ```
  Then re-run the `cron.schedule(...)` block with the new secret value.
- Recent health check rows:
  ```sql
  select provider, model, status, latency_ms, ok, checked_at
  from public.model_health_checks
  order by checked_at desc limit 20;
  ```

## What the function checks

- `google/gemini-2.5-flash` (Lovable Gateway)
- `google/gemini-2.5-flash-lite` (Lovable Gateway)
- `openai/gpt-5-mini` (Lovable Gateway)
- `gpt-4o-mini` (OpenAI direct, via `/v1/models/<id>`)

A non-OK response that returns 404/410/5xx is additionally written to `error_logs` so the StatusPage banner picks it up within the next page load.