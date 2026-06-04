---
name: v6.9.36 Welcome Test + Auto-Submit Hardening
description: Fixes for AddStudent autosend 400, WorksheetForm auto-submit race, lazy DSLM Add-Goal modal, gallery renderer JSON variants, and audit-llm GPT-5 probe.
type: feature
---

## What changed (v6.9.36)

### Welcome Test autosend
- New helper `src/lib/welcomeTest/ensureWelcomeTest.ts` owns lifecycle: insert as `draft` → seed questions → RPC `generate_test_share_token` (which flips to `assigned`) → return token + url.
- `AddStudentDialog.tsx` calls the helper instead of inserting `status='pending'` (invalid → 400) and then awaits `send-test-email` so users no longer see "could not be sent automatically".

### Auto-start 1-Minute Prep
- `WorksheetForm/index.tsx` no longer uses `setTimeout` for `autoGenerateWorksheet`. It reads `autoGenerateWorksheetRequest` from `sessionStorage` (written by `StudentPage.tsx` when teacher clicks a Next-Step) and only calls `formRef.requestSubmit()` once `selectedStudentId` matches AND `lessonTopic` is hydrated — wrapped in `requestAnimationFrame`. Watchdog: 30 s.

### Post-signup nav
- `GoogleSignInButton.tsx` routes new users to `/?action=add-student`.
- `Index.tsx` mounts `AddStudentDialog` for both anonymous and authenticated branches.
- `localStorage['post-signup-add-student']` survives Supabase email-confirm redirects.

### Lazy DSLMTab Add Goal
- `DSLMTab.tsx` + `GoalsView.tsx` replaced transient `CustomEvent` with `window.pendingAddGoal` flag (read on mount). Goals modal now opens reliably even when the tab mounts lazily after navigation.

### Gallery renderer
- `GalleryExerciseRenderer.tsx`: helpers `asArray`, `splitTokens`, `maskWordFromAnswer` normalize multiple JSON shapes:
  - `word-order`: accepts `shuffled_sentence` (string) or `words`/`tokens` (array).
  - `matching-halves`: accepts `{prompt, options}` and `{halves}` / `pairs`.
  - `complete-word`: accepts `before`/`after`/`full_word` keys.

### UI
- `HeroHeadline.tsx`: `leading-[1.15]` + `pb-2` prevents descender clipping on "g", "y", etc.

### Audit
- `audit-llm-models/index.ts`: removed unused `lovable-gateway/openai/gpt-5-mini` daily probe (real fallback uses direct OpenAI). Added direct `openai/gpt-5-mini-2025-08-07` model check. Daily smoke (2026-06-04): 4/4 OK.

## Files touched
- `src/lib/welcomeTest/ensureWelcomeTest.ts` (new)
- `src/components/dashboard/AddStudentDialog.tsx`
- `src/components/WorksheetForm/index.tsx`
- `src/pages/StudentPage.tsx`, `src/pages/Index.tsx`
- `src/components/GoogleSignInButton.tsx`
- `src/components/dslm/DSLMTab.tsx`, `src/components/dslm/GoalsView.tsx`
- `src/components/gallery/GalleryExerciseRenderer.tsx`
- `src/pages/gallery/PublicGalleryWorksheetPage.tsx`
- `src/components/landing/HeroHeadline.tsx`
- `supabase/functions/audit-llm-models/index.ts`

## Sanctity
No changes to worksheet generation prompt, calculator formulas, RLS, Stripe, or table schemas.
