---
name: Onboarding Spotlight v3 + AddStudent v4 + 48h reminder
description: v6.9.34 — non-blocking dim, direct triggerSpotlight on checklist clicks, force-refresh after action, 2-mode AddStudent with default-on welcome test, autosend in defer mode regardless of caller, 48h pending-test reminder
type: feature
---

## Spotlight v3 — non-blocking dim
- `SpotlightOverlay` dim panels are `pointer-events-none`. Closing via ESC, the explicit × button in the hint tooltip, or by clicking the highlighted element directly.
- URL effect re-fires on `searchParams.get('_')` change (cache-buster), not just on `focus`.
- `triggerSpotlight` always stamps `at: Date.now()` so identical IDs fire fresh events.

## Checklist click reliability
- `OnboardingChecklist.navAndSpotlight(suffix, focusId)` runs `navigate` + scheduled `triggerSpotlight(focusId)` (700 ms) + scheduled `refreshProgress()` (1.8 s). Used by every "Start" deep link.
- Listens for `window 'onboarding:refresh'` event — any component can request a checklist refresh.

## Reset onboarding
- `/profile` "Reset Onboarding" navigates to `/dashboard` after calling `resetOnboarding()` so the freshly empty checklist is visible immediately.

## AddStudentDialog v4
- 2 modes only: `know`, `defer`. `manual` removed (still possible from student page after creation).
- `sendTestWhenKnown` defaults to `true` for `know` mode.
- Welcome Test auto-send is now triggered INSIDE the dialog (lightweight inline ensure + `send-test-email` invoke), so it fires even when `onStudentAdded` callback overrides navigation (inline-add in WorksheetForm).
- Navigation after add (default flow only — skipped when `onStudentAdded` is provided):
  - autosend ON  → `/student/:id?tab=dslm&view=goals&focus=add-goal-modal`
  - autosend OFF → `/student/:id?tab=dslm&view=pathway&focus=send-welcome-test`

## Signup
- `Signup.tsx` ALWAYS lands on `/?action=add-student` after signup (immediate or via email confirmation). `Index.tsx` reads it and opens AddStudentDialog.

## WorksheetForm auto-generate (Generate worksheet ↗)
- Auto-submit `autoGenerateWorksheet` sessionStorage flag persists until either it fires OR a 10 s safety timer expires. A `useEffect` keyed on `[lessonTopic, selectedStudentId]` triggers `requestSubmit()` once topic is hydrated. Eliminates the silent "form filled, nothing happens" race.

## 48h Welcome Test reminder
- `WelcomeTestSuggestion` tracks `created_at` (`sentAt`). When status is `pending` and `hours >= 48`, renders a "Send reminder" button that re-invokes `send-test-email` with `reminder: true`.

## Audit LLM
- `audit-llm-models` GPT-5 family probe uses `max_completion_tokens: 16` (1 was always tripping the reasoning-token limit).
- `google/gemini-2.0-flash` replaced with `google/gemini-3-flash-preview` (gateway removed the 2.0 alias).

## Gallery
- Single CEFR chip row (A1, A2, B1, B2, C1, C2, All). Legacy `<select>` removed.
- `public_level` filter uses `ilike '%LEVEL%'` to also match composite values (e.g. "A1/A2").
- `GalleryExerciseRenderer`:
  - `matching` accepts parallel `left/right`, `first/second`, `halves_left/halves_right`, `starts/endings`.
  - `word-order` splits delimited strings (`|`, `/`, `,`, spaces), accepts `tokens|scrambled|shuffled|words|sentence|prompt`.
  - `negative-prefixes`/`complete-word`/`word-formation` accept extra keys: `root`, `original`, `stem`, `negative`, `opposite`, `transformed`, `full`.

## Sanctity
No Worksheet Generation Engine, RLS, Stripe, or DB schema changes. `send-test-email` Edge Function is invoked with an extra `reminder` flag (ignored unless the function consumes it).
