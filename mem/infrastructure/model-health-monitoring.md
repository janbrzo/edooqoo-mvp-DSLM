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