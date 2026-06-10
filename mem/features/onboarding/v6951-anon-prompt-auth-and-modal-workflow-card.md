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

2. **`src/components/generation/WorkflowSummaryCard.tsx`** — new presentational
   component. Renders the three Edooqoo phases (Phase 1: One-time student setup,
   Lesson-time signal capture, Phase 2: Weekly 1-Minute Prep) as equal-height
   columns with compact item rows. Tailwind tones: violet/blue/emerald.

3. **`src/components/GeneratingModal.tsx`** — the left column wrapper switched
   from `space-y-4` to `flex flex-col h-full space-y-4` and renders
   `<WorkflowSummaryCard className="mt-auto" />` after the "Expected time"
   paragraph. The card fills the previously empty bottom area (red rectangle
   in the user screenshot) and keeps both columns visually balanced.

## Sanctity

No Worksheet Generation Engine prompt/logic change.