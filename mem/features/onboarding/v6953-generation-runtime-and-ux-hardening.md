---
name: v6.9.53 generation runtime + UX hardening
description: Persistent worksheet generation intent + refresh-safe job registry + mini panel; anon forceNew fix and top banner; Welcome Test email re-validation on restore; calendar 24h booked-without-worksheet warning.
type: feature
---

## What changed

1. **Persistent auto-generate intent** — `src/lib/worksheet/autoGenerateBootstrap.ts` now writes a full intent to `localStorage` (`edooqoo.pendingWorksheetIntent`) and mirrors the legacy `sessionStorage` flags. `StudentPage.tsx` uses `writeAutoGenerateIntent` for auto-generate clicks. `WorksheetForm` listener no longer clears the persistent intent. Eliminates the recurring "navigates to / but never starts" bug.

2. **Generation job registry** — `src/lib/worksheet/generationJobRegistry.ts` plus `src/hooks/useActiveWorksheetGenerationJob.tsx` track every active generation in localStorage and poll the `worksheets` table after refresh/navigation to finish side effects (suggestion `is_used`, `consume_token`, success event).

3. **Global mini panel** — `src/components/generation/ActiveGenerationMiniPanel.tsx` mounted in `App.tsx`. Running = non-closable status. Completed = "Open generated worksheet" + X. Failed = error + X.

4. **Anon worksheet fixes** — `Index.tsx` accepts any `forceNew` value; anon generated branch renders `StickyNav` + `AnonPreWorksheetBanner` immediately. `WorksheetHeader` uses `?forceNew=1`. Banner/CTA copy updated to 1-Minute Prep context.

5. **Welcome Test email** — `WelcomeTestPage` re-validates stored `wt_email_*` against the regex; invalid stored values are deleted so the modal cannot be bypassed.

6. **Calendar 24h warning** — `SlotDetailModal` shows an amber banner when a confirmed Booked slot starts in ≤24h without a worksheet, with a `Generate with 1-Minute Prep` shortcut.

## Sanctity

No Worksheet Generation Engine prompt/logic change. No DB migration. RLS untouched.