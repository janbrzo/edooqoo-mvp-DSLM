# audit-llm-models — operator guide

Two cadences, two questions:

| Mode | Schedule (pg_cron) | Question | What runs |
|---|---|---|---|
| daily | `audit-llm-models-daily`, `0 6 * * *` (06:00 UTC), body `{}` | Does every production model still work? | One probe per model, urgent shutdown alerts (≤30 days) |
| monthly | `audit-llm-models-monthly`, 1st of the month (currently fires 07:00 UTC), body `{"mode":"monthly"}` | Is every model still the best fit for its use case? | Daily probes + full shutdown countdown + provider deprecation-page scan + model advisor |

Source of truth for the model list: `supabase/functions/_shared/modelRegistry.ts`. Pure logic: `supabase/functions/_shared/modelAudit.ts` (tests: `src/lib/__tests__/modelAudit.test.ts`).

## Prerequisites

1. Project secrets: `CRON_SECRET` (required; without it the function returns 503), `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GEMINI_VERTEX_API_KEY`, `RESEND_API_KEY`.
2. Optional secret `MODEL_ADVISOR_MODEL` forces the advisor model; by default the newest stable `gemini-X.Y-flash` in the live Gemini model list is used, with `gemini-2.5-flash` as fallback.
3. Migration `20261004120000_model_audit_lifecycle.sql` applied (lifecycle columns + `model_audit_reports`). Until then health rows are still written without the new columns and the report row insert is skipped with a log line.
4. Extensions `pg_cron` and `pg_net`.

## Daily probes

| Probe | Models | Cost |
|---|---|---|
| `gemini-generate` (3 output tokens, thinking off) | gemini-2.5-flash, gemini-2.5-flash-lite | negligible |
| `openai-chat` (3 tokens) | gpt-4o-mini, gpt-4.1-2025-04-14 | negligible |
| `openai-chat-reasoning` (`max_completion_tokens: 1024`, `reasoning_effort: low`; reasoning tokens count against the limit, 16 failed with HTTP 400, and gpt-5.6-terra rejects `minimal`) | gpt-5.6-terra | negligible |
| `openai-tts` (input "OK") | gpt-4o-mini-tts, tts-1 | negligible |
| `metadata` (GET model resource) | whisper-1, Vertex gemini-2.5-flash-image, gemini-3.1-flash-image | free |

If the secrets `GEMINI_IMAGE_MODEL` or `GEMINI_DESCRIPTION_MODEL` point to a model that is not in the registry, it is probed too and listed as "Not in registry".

Outcome routing:
- 404/410 → `error_logs` `model_deprecation`; 401/403, 429, 5xx → `model_failure`. Both feed the public StatusPage banner (`get_active_model_issues`, last 24 h).
- Other 4xx (malformed probe), missing key, network errors → email + `model_health_checks` only.
- Shutdown within 30 days → `error_logs` `model_shutdown_scheduled` (admin only, not on the banner). Monthly also logs the 31–120 day window as `warning`.

## Monthly optimisation

1. **Shutdown countdown** from the registry: `warn` ≤120 days, `crit` ≤30 days.
2. **Deprecation-page scan** of the OpenAI, Gemini API and Vertex model-versions pages. A future date next to one of our model ids that is neither the registry `shutdownDate` nor in `acknowledgedDates` is flagged, as is a registry date that disappeared from the page. Verify on the page, then update the registry.
3. **Advisor**: receives the registry roles and use cases, the live model lists of each provider (`/v1/models`, Gemini `models.list`, Vertex `publishers/google/models`) and excerpts of the official pricing pages, and may use Google Search for quality evidence. Per role it returns `keep`, `switch` or `evaluate`:
   - `switch` only when the candidate is better and cheaper, better at the same price, or at most 30% more expensive with clearly better results for that use case, or when the current model has a shutdown date;
   - a suggested id that the provider does not list for our key is downgraded to `evaluate`;
   - roles inside the Worksheet Generation Engine are marked as needing the literal instruction "update the Worksheet Generation Engine". The audit never changes a model by itself.

The monthly run returns 202 immediately and finishes in the background. Pass `"sync": true` to wait for the full JSON.

## Results

- Email to edooqoo@gmail.com: **monthly always; daily only when at least one probe failed** (a clean daily run sends nothing, the response has `emailSent: false`). The subject counts failures, shutdowns ≤30 days, switch suggestions and deprecation notices. A shutdown ≤30 days alone does not trigger a daily email; it is logged in `error_logs` and shown in the monthly report.
- `public.model_audit_reports`: one row per run (`summary`, `probes`, `lifecycle`, `deprecation_scan`, `advisor`, `unregistered`).
- `public.model_health_checks`: one row per probe.

```sql
select created_at, mode, summary from public.model_audit_reports order by created_at desc limit 10;

select created_at, jsonb_pretty(advisor) from public.model_audit_reports
where mode = 'monthly' order by created_at desc limit 1;

select provider, model, check_kind, status, ok, days_to_shutdown, error, checked_at
from public.model_health_checks order by checked_at desc limit 30;
```

## Scheduling (operator-only SQL, never commit — contains the secret)

```sql
select cron.schedule('audit-llm-models-daily', '0 6 * * *', $$
  select net.http_post(
    url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body    := '{}'::jsonb);
$$);

select cron.schedule('audit-llm-models-monthly', '15 6 1 * *', $$
  select net.http_post(
    url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body    := jsonb_build_object('mode','monthly'));
$$);
```

Inspect runs: `select * from cron.job_run_details order by start_time desc limit 10;`
Unschedule before rotating the secret: `select cron.unschedule('audit-llm-models-daily');` (same for monthly).

## Manual invocation

The SQL Editor only runs SQL (pasting `curl` gives `42601`). Either:

```sql
select net.http_post(
  url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
  body    := jsonb_build_object('mode','monthly')
) as request_id;
-- results arrive by email and in model_audit_reports
```

or from a terminal:

```bash
curl -X POST "https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models" \
  -H "x-cron-secret: <CRON_SECRET>" -H "Content-Type: application/json" \
  -d '{"mode":"monthly","sync":true}'
```

## Maintaining the registry

- Adding or changing a model id in `supabase/functions/**` requires a registry entry; the Vitest guard fails otherwise.
- When a deprecation notice is confirmed: set `shutdownDate`, `replacement`, `verifiedAt`. For "earliest retirement / or later" notices add the date to `acknowledgedDates`.
- Never paste the raw `CRON_SECRET` into shared tabs or screenshots; rotate it and reschedule both jobs if it leaks.
