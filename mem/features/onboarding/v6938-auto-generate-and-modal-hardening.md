---
name: v6.9.38 auto-generate worksheet & Add-Goal modal hardening
description: Lazy-init readiness gate for 1-Minute Prep auto-submit, rAF dedupe for DSLM focus param, LazySection eager-flip honoring, daily/monthly audit banner, blog mojibake purge, pacing article scientific-basis alignment.
type: feature
---

# v6.9.38 fixes

## WorksheetForm auto-submit (P1)
- `src/components/WorksheetForm/index.tsx` reads `autoGenerateWorksheet`, `autoGenerateWorksheetRequest`, and prefilled `lessonTopic` synchronously via lazy useState/useRef initializers (`readAutoGenerateIntent`, `readPrefillTopic`, `initialAutoIntentRef`).
- `selectedStudentId` lazy init prefers `request.studentId` over `preSelectedStudent.id`.
- Readiness gate watches only `[lessonTopic, selectedExercises]`, fires `requestSubmit()` once, clears sessionStorage flags AFTER dispatch.
- Watchdog reduced from 5000ms → 1500ms.

## DSLMTab focus param + LazySection (P2)
- `src/components/dslm/DSLMTab.tsx` focus-param effect rewritten with `focusHandledRef` cache key (`${focusParam}:${_}`) + `requestAnimationFrame` instead of `setTimeout(500)`. Multiple rerenders no longer cancel the pending action via cleanup.
- `src/components/dslm/LazySection.tsx` adds `useEffect([eager, shouldRender])` so a late `eager → true` flip immediately unlocks the children. Defensive; primary fix is in DSLMTab.

## LLM audit clarity (P3)
- `supabase/functions/audit-llm-models/index.ts` prepends an explicit cadence banner (`Daily LLM Audit — hot-path subset` vs `Monthly LLM Audit — full inventory`) to the report HTML before the table. Subject prefix in `send-model-audit-email/index.ts` was already mode-aware. Daily and Monthly are different audits (Monthly = Daily ∪ {gpt-4o-mini-tts, gpt-4.1-2025-04-14, google/gemini-3-flash-preview}); both remain enabled.

## Content hygiene (P4 + P5)
- `public/blog/teaching-english-one-to-one.html` purged of double-encoded UTF-8 sequences (`â€"`, `Â·`, `â†'`, etc.) and BOM stripped.
- `public/blog/learning-pacing-scientific-vs-pragmatic-esl.html` gains expanded "Mode Definitions" with explicit receptive/productive exercise counts and a new "Scientific basis Edooqoo applies" section citing Krashen (Natural Order Hypothesis, Input Hypothesis i+1), TBLT (Willis, Ellis), and Lexical Approach (Lewis). Aligned 1:1 with `supabase/functions/_shared/dslmPromptCore.ts`.

## Sanctity
- Worksheet Generation Engine: NOT TOUCHED.
- DB schema, RLS, migrations: unchanged.
- Edge functions with generation logic: unchanged.