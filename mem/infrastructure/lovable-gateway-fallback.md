---
name: Lovable Gateway → OpenAI fallback (v6.9.65)
description: Shared chatCompletion helper auto-falls-back to OpenAI gpt-4o-mini on Lovable 402/429/5xx
type: feature
---

All Edge Functions that previously called Lovable AI Gateway directly now
go through `supabase/functions/_shared/aiChat.ts` (`chatCompletion`).

Behavior:
- Tries Lovable Gateway with `primaryModel` (default Gemini Flash).
- On HTTP 402 / 429 / 5xx (or fetch throw) → retries the same body
  against `https://api.openai.com/v1/chat/completions` with
  `fallbackModel` (default `gpt-4o-mini`).
- Forwards `tools`, `tool_choice`, `response_format`, `temperature`,
  `max_tokens`, etc. verbatim; OpenAI ignores unsupported fields like
  `reasoning`.
- Always calls `logModelFailure` for the original Lovable failure so the
  StatusPage banner picks it up.

Refactored callers: `classify-knowledge-entry`, `suggest-exercises`,
`verify-open-answers`, `translate-flashcard`, `extract-student-profile`,
`generate-curriculum-phases`, `generate-timeline`,
`process-welcome-test` (2 sites).

`generateWorksheet` does NOT use this helper — it already has its own
direct Gemini + direct OpenAI fallback chain (Worksheet Generation
Engine sanctity rule).

**Why:** Daily LLM Audit started reporting `lovable-gateway 402
payment_required` once the workspace credit pool emptied. Without the
helper, every AI-backed feature broke until credits were topped up.