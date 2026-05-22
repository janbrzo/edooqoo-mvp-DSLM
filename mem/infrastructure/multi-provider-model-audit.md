---
name: Multi-Provider LLM Model Audit
description: Procedure B inventory + runtime logger + StatusPage banner for OpenAI/Gemini/Anthropic/ElevenLabs/Lovable Gateway model failures
type: feature
---
v6.9.21 added systematic LLM model monitoring across every provider Edooqoo uses.

- **Inventory + live-check:** `scripts/audit-llm-models.ts` (Deno) scans `supabase/functions/**` for model refs, pings each provider, writes `docs/closed-loops/LLM_MODEL_INVENTORY.md` and `STATUS_LIVE.md`. Run monthly (Procedure B).
- **Runtime logger:** `supabase/functions/_shared/modelFailureLogger.ts` — call from every catch block that hits a provider API. Inserts into `error_logs` with `error_code='model_deprecation'` (404/410) or `'model_failure'` (5xx), `component=<provider>`, `context={model,provider,endpoint,status,error}`. Wired into `generate-audio` (chat + TTS steps). Pattern to replicate in: `generateWorksheet`, `verify-open-answers`, `translate-flashcard`, `process-welcome-test`, `suggest-exercises`, `generate-welcome-test-audio`, `classify-knowledge-entry`, `generate-curriculum-phases`, `generate-media-exercises`, `generate-image`, `generate-timeline`.
- **Public banner:** `public.get_active_model_issues()` RPC (SECURITY DEFINER, granted to anon+authenticated) returns provider/model/last_seen/count for last 24h. `StatusPage.tsx` shows red banner when non-empty.
- **DO NOT** add an `error_type` column — schema uses `error_code` + `component`. Logger maps accordingly.