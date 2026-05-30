---
name: Welcome Test Auto-Apply, Completion Email & Brain-Reset Minigame
description: v6.9.29 — process-welcome-test auto-upserts student_learning_elements; Resend completion email with idempotency; BrainResetGame on paused stage; monthly model-audit report
type: feature
---

## Auto-Apply
- `process-welcome-test` upserts nano-skill assessments into `student_learning_elements` (`evidence_source='welcome_test'`) and sets `student_tests.status='reviewed'` immediately after the AI summary completes.
- `TestDetailsView.tsx` shows green chip "Results automatically applied" when `status='reviewed'`; legacy `completed` rows still expose the manual Apply button as fallback.

## Completion Email
- `send-welcome-test-completion-email` Edge Function: direct POST to `https://api.resend.com/emails` (not the connector gateway), sender `hello@edooqoo.com`, `reply_to` = teacher e-mail.
- Idempotency: `student_tests.completion_email_sent_at` (added in migration `20260529154949_*.sql`). Function exits early if already set.
- Parent function uses `EdgeRuntime.waitUntil(emailPromise)` so the Resend POST is not killed.

## Monthly Model-Audit Report
- `audit-llm-models` accepts `{ "mode": "monthly" }` → renders HTML table from last 30 days of `model_health_checks` and delegates to `send-model-audit-email` (recipient `edooqoo@gmail.com`).
- GPT-5 family probed with `max_completion_tokens` (not `max_tokens`) — eliminates false-positive deprecations.
- pg_cron: `audit-llm-models-monthly` runs `0 7 1 * *` UTC, header `x-cron-secret`.

## Brain-Reset Minigame
- `src/components/welcome-test/BrainResetGame.tsx` — 6-pair emoji Memory Pairs, language-free, client-only.
- Mounted only inside `WelcomeTestPage` `stage === "paused"` branch — never persists state, never affects test results.

## Constraints
- DO NOT add English vocabulary/text to BrainResetGame — must remain language-free to preserve placement test integrity.
- DO NOT remove `completion_email_sent_at` idempotency check; duplicate sends would be considered spam.
- DO NOT revert to Lovable connector-gateway Resend route — connector is not installed in this project.
- DO NOT wrap GPT-5 probe back into `max_tokens` — that path returns deprecation false-positives.

## Related files
- `supabase/functions/process-welcome-test/index.ts`
- `supabase/functions/send-welcome-test-completion-email/index.ts`
- `supabase/functions/send-model-audit-email/index.ts`
- `supabase/functions/audit-llm-models/index.ts`
- `supabase/functions/_shared/emailTemplates/welcomeTestCompletion.ts`
- `src/components/welcome-test/BrainResetGame.tsx`
- `src/pages/WelcomeTestPage.tsx`
- `src/components/student-tests/TestDetailsView.tsx`
- `src/hooks/useAuthFlow.tsx`