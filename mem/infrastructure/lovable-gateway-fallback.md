---
name: aiChat helper — Google Gemini direct + OpenAI fallback (v6.9.66)
description: Shared chatCompletion helper now calls Google Generative Language direct as primary and OpenAI as fallback; Lovable Gateway removed from hot path
type: feature
---

All Edge Functions that need a chat-completion call go through
`supabase/functions/_shared/aiChat.ts` (`chatCompletion`).

Behavior (v6.9.66):
- Primary: Google Generative Language direct
  (`GEMINI_API_KEY`, `https://generativelanguage.googleapis.com/v1beta/models/<id>:generateContent`).
  `primaryModel` accepts both bare ids (`gemini-2.5-flash`) and legacy
  `google/gemini-2.5-flash` (the `google/` prefix is stripped).
- Fallback: OpenAI Chat Completions (`/v1/chat/completions`,
  default `gpt-4o-mini`) on HTTP 402 / 429 / 503 / 5xx or a fetch throw.
- Body is sent in OpenAI Chat Completions shape; the helper maps it to
  Gemini `generateContent` (system → `systemInstruction`,
  `response_format.json_object` → `responseMimeType`,
  `tools[]` → `functionDeclarations`) and converts the Gemini response
  back to OpenAI shape so callsites parse `choices[0].message.content`
  unchanged.
- Always calls `logModelFailure` for any primary failure (StatusPage
  banner picks it up).

Callers using the helper: `classify-knowledge-entry`, `suggest-exercises`,
`verify-open-answers`, `translate-flashcard`, `extract-student-profile`,
`generate-curriculum-phases`, `generate-timeline`,
`process-welcome-test` (2 sites).

`generateWorksheet` does NOT use this helper — sanctity rule, and it
already has its own direct Gemini + direct OpenAI chain.

**Why v6.9.66:** Workspace Lovable AI credits exhausted; v6.9.65's
Lovable-primary + OpenAI-fallback chain added 100–300 ms guaranteed
round-trip and spammed `error_logs` with `lovable-gateway 402` on every
call. Switching to Google direct removes the dead round-trip entirely.
Lovable Gateway is kept only as a monthly audit probe so we re-detect
the moment credits return.