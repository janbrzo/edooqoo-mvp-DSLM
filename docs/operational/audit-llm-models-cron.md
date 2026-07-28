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

Daily (hot-path, runs at 06:00 UTC) — v6.9.66:
- `gemini-2.5-flash` (Google Generative Language direct) — aiChat primary
- `gemini-2.5-flash-lite` (Google Generative Language direct) — lightweight chat
- `gpt-4o-mini` (OpenAI direct) — aiChat OpenAI fallback + generate-audio chat step
- `gpt-5-mini-2025-08-07` (OpenAI direct) — generateWorksheet JSON fallback + welcome-test
- `gpt-4.1-2025-04-14` (OpenAI direct) — generate-media-exercises
- `whisper-1` (OpenAI direct) — transcribe-audio (live session STT)
- `gpt-4o-mini-tts` (OpenAI direct) — TTS primary
- `tts-1` (OpenAI direct) — TTS for welcome-test-audio + generate-audio fallback
- `gemini-2.5-flash-image` (Google Vertex AI, v1beta1 publisher metadata) — worksheet images

Monthly (full breadth, runs on the 1st at 06:15 UTC):
- Daily set, plus
- `gemini-3.1-flash-image` (Vertex AI) — Nano Banana 2 fallback
- `check: "smoke"` real inference calls for the Gemini and OpenAI text models

Lovable Gateway probes were removed in v6.9.82 — the platform no longer uses that provider.

A non-OK response that returns 404/410/5xx is additionally written to `error_logs` so the StatusPage banner picks it up within the next page load.

## Monthly schedule (operator-only)

```sql
select cron.schedule(
  'audit-llm-models-monthly',
  '15 6 1 * *',
  $$select net.http_post(
      url := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret', current_setting('app.cron_secret', true)
      ),
      body := jsonb_build_object('mode','monthly')
    )$$
);
```

## Manual invocation

The Supabase SQL Editor executes SQL only. Pasting a `curl` command there fails with
`42601: syntax error at or near "curl"`. Use one of the three options below.

### Option A — from the SQL Editor via pg_net

```sql
select net.http_post(
  url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', '<CRON_SECRET>'
  ),
  body    := jsonb_build_object('mode', 'monthly')
) as request_id;
```

Read the response a few seconds later:

```sql
select id, status_code, content
from net._http_response
order by created desc
limit 5;
```

### Option B — from a local terminal

```bash
curl -X POST \
  "https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"monthly"}'
```

### Option C — inspect results without invoking

```sql
select provider, model, status, ok, expected, latency_ms, error, checked_at
from public.model_health_checks
order by checked_at desc
limit 30;
```

### Secret hygiene

Never paste the raw `CRON_SECRET` into a shared SQL Editor tab or screenshot. If it leaks,
rotate the secret and update both pg_cron jobs (`audit-llm-models-daily`, `audit-llm-models-monthly`).
