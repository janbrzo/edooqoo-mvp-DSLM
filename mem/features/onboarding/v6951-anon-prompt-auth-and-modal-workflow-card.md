---
name: v6.9.51 Anonymous prompt 401 fix + GeneratingModal workflow card
description: Direct-fetch fallback for format-worksheet-prompt with publishable key; compact 3-phase WorkflowSummaryCard inside GeneratingModal left column.
type: feature
---

## What changed

1. **`src/utils/promptFormatter.ts`** — `formatPromptForAI` no longer relies on
   `supabase.functions.invoke`. It calls `format-worksheet-prompt` with a raw
   `fetch`, sending `Authorization: Bearer <session token or VITE_SUPABASE_PUBLISHABLE_KEY>`
   plus the matching `apikey` header. This eliminates the 401 anonymous users
   were hitting when the public landing page submitted the worksheet form
   before any Supabase session was established. Authenticated callers keep
   using their real access token, so no regression. Retry-once-after-250ms
   behaviour is preserved.

2. The former left workflow card is retired. Keep the left side focused on
   generation status and Expected time; use only the concise right-side,
   audience-specific rotating slides described in `mem://ux/generation-modal-conversion`.

## Sanctity

No Worksheet Generation Engine prompt/logic change.