---
name: Model Health Monitoring v6.9.27
description: audit-llm-models edge function + model_health_checks table + expanded logModelFailure wiring across AI edge functions
type: feature
---

## v6.9.27 — Multi-provider audit (extends v6.9.21)

- Table `public.model_health_checks` (service-role only): `provider, model, status, latency_ms, ok, error, checked_at`. Index on `(provider, model, checked_at DESC)`.
- Edge function `audit-llm-models` pings Lovable Gateway (`google/gemini-2.5-flash`, `gemini-2.5-flash-lite`, `openai/gpt-5-mini`) and OpenAI (`gpt-4o-mini` via `/v1/models/<id>`). Each ping → row in `model_health_checks`; 404/410/5xx also calls `logModelFailure` so StatusPage banner picks it up.
- Auth: `verify_jwt=false` in `supabase/config.toml`; in-code check `x-cron-secret == CRON_SECRET`. CRON_SECRET must exist in project secrets before scheduling.
- Recommended schedule: pg_cron daily 06:00 UTC (operator-owned SQL — contains anon key/URL, not in migrations).
- `logModelFailure` wired into: `generate-audio`, `verify-open-answers`, `suggest-exercises`, `classify-knowledge-entry`, `generate-curriculum-phases`, `translate-flashcard` (Lovable + OpenAI fallback). Pattern: log BEFORE throw / error response.

**Why:** v6.9.21 logger existed but only 1 function used it; deprecations elsewhere went silent.

## v6.9.81 — Deprecated three-state classification

- Historical note: v6.9.81 temporarily marked old Lovable Gateway failures as `EXPECTED` instead of `FAIL`.
- This was superseded by v6.9.82 because the correct monitoring target is the direct provider path, not an intentionally unused gateway.
- Manual re-run: `POST /functions/v1/audit-llm-models`, header `x-cron-secret: <CRON_SECRET>`, body `{"mode":"monthly"}`.

## v6.9.82 — Lovable Gateway removed from active health checks

- `audit-llm-models` active targets now cover only direct providers used by Edooqoo: Google Generative Language, OpenAI, and Google Vertex.
- Monthly audit replaces the two old Lovable Gateway probes with direct inference smoke tests: Gemini `gemini-2.5-flash` and OpenAI `gpt-4o-mini`.
- Hot-path functions using `_shared/aiChat.ts` must gate on `GEMINI_API_KEY || OPENAI_API_KEY`, not `LOVABLE_API_KEY`.
- `scripts/audit-llm-models.ts` no longer live-pings Lovable Gateway.
- `model_health_checks.expected` remains for backward compatibility with old rows, but current audits should report `Expected: 0`.

**Why:** Edooqoo intentionally does not use Lovable AI credits for model runtime; monitoring must test the direct providers that can actually break teacher workflows.
## v6.9.90 — Model Registry, daily health vs monthly optimisation

- `supabase/functions/_shared/modelRegistry.ts` is the single source of truth for every model id (role, use case, consumers, `protectedEngine`, probe kind, curated `shutdownDate`/`replacement`/`acknowledgedDates` + source URL). `audit-llm-models` no longer keeps its own target list.
- **Daily = "does it work"**: one probe per model (minimal inference for Gemini/OpenAI chat and TTS, metadata for whisper-1 and Vertex images). 401/403/429 now reach `error_logs` (`model_failure`) alongside 404/410/5xx. Shutdowns ≤30 days → `error_logs` `model_shutdown_scheduled` (admin only; StatusPage banner ignores this code).
- **Monthly = "is it still optimal"**: shutdown countdown (warn ≤120 d, crit ≤30 d), scan of the OpenAI / Gemini API / Vertex deprecation pages for dates the registry does not know, and a Gemini advisor (newest stable Flash + Google Search, live model lists, pricing-page excerpts) returning keep/switch/evaluate per role. Switch rule: better & cheaper, better at same price, or ≤30% pricier with clearly better results. Ids missing from the provider list are downgraded to evaluate. Runs in `EdgeRuntime.waitUntil` (202) unless `sync:true`.
- Auth is fail-closed: missing `CRON_SECRET` → 503.
- New table `model_audit_reports` (service role only) stores each run; `model_health_checks` gained `check_kind`, `shutdown_date`, `days_to_shutdown`.
- `scripts/audit-llm-models.ts` removed (stale: Anthropic/ElevenLabs, no Vertex, never produced reports).
- Vitest guard `src/lib/__tests__/modelAudit.test.ts` fails when a quoted model id in `supabase/functions/**` is missing from the registry.
- Scan layout matters: OpenAI rows put the date before the id, Gemini/Vertex rows after it (`DEPRECATION_ROW_LAYOUT`); reading both sides produced false positives from adjacent rows.

**Why:** the old audit only pinged availability, so it reported all-OK while 6 of 10 models had announced shutdowns (gpt-5-mini-2025-08-07 on 2026-12-11 inside the protected engine). Providers answer 200 until removal day.

- Email policy (v6.9.91): monthly always mails; daily mails only when at least one probe failed (`shouldSendAuditEmail`). Silent clean days are intentional.
