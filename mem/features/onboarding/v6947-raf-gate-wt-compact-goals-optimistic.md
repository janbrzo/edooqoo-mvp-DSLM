---
name: v6.9.47 RAF auto-submit gate, Welcome Test compact, Goals optimistic accept
description: RAF readiness poll for 1-Minute Prep auto-submit; WelcomeTestPage compact layout + radio auto-advance + Enter advance; GoalsView optimistic accept/dismiss Sets.
type: feature
---

## What changed

1. **WorksheetForm auto-submit gate** (`src/components/WorksheetForm/index.tsx`):
   replaced setTimeout/useEffect gate with `requestAnimationFrame` poll loop
   (≤180 frames). Fires `submitForm()` exactly once when both `lessonTopic.trim()`
   and `formRef.current` are ready, recovers topic from `sessionStorage.prefillWorksheet`
   if React state hasn't flushed. Clears `autoGenerateWorksheet*` sessionStorage
   only AFTER dispatch. Eliminates race where formRef was null on first effect run.

2. **WelcomeTestPage compact** (`src/pages/WelcomeTestPage.tsx`):
   - container `max-w-2xl` → `max-w-lg`, outer padding `px-3 sm:px-4 py-3` →
     `px-2 sm:px-3 py-2` so translated questions don't push nav off-screen.
   - Threaded `onNext` callback into `QuestionInput` / `QuestionInputInner`.
   - Auto-advance (180 ms after `onAnswer`) for single-choice radios:
     `listening_comprehension`, `self_assessment`, `scenario_reaction`,
     `multiple_choice`, single-select `preference_choice`.
   - Enter advances on `fill_blank` Input; Enter (without Shift) advances on
     `open_ended` / `open_reflection` Textarea.

3. **GoalsView optimistic accept/dismiss** (`src/components/dslm/GoalsView.tsx`):
   added local `optimisticAccepted` and `optimisticDismissed` `Set<string>` state.
   `suggestedGoals` filter excludes both sets so the welcome-test suggestion banner
   chip disappears instantly. Per-id and bulk handlers roll back on Supabase error.

## Sanctity

No Worksheet Generation Engine prompt/logic change. No RLS/DB/auth change.