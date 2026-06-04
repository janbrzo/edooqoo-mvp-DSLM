---
name: Onboarding v6.9.35 — clickthrough, post-signup nav, reminder, gallery
description: SpotlightOverlay wrapper pointer-events-none, AddStudent autosend query fix + dashboard nav handoff, WorksheetForm rAF auto-submit, post-signup localStorage flag, reminder email body, PublicTopNav on /gallery, renderer fallbacks, GPT-5 token bump
type: feature
---

## Spotlight clickthrough
- `SpotlightOverlay` root `<div>` is `pointer-events-none`. Only the hint tooltip retains `pointer-events-auto`. The highlighted element is now directly clickable while spotlight is active.

## AddStudent autosend query
- Inline autosend in `AddStudentDialog` no longer filters by `deleted_at` (column not exposed via PostgREST in this context — caused 400 on `/rest/v1/student_tests?select=id`). Idempotency relies on `order created_at desc limit 1`.

## Dashboard add-student nav handoff
- `Dashboard.tsx` no longer passes `onStudentAdded` to `<AddStudentDialog>`. Default flow runs: navigates to `/student/:id?tab=dslm&view=...` with focus `add-goal-modal` (autosend ON) or `send-welcome-test` (autosend OFF).

## WorksheetForm auto-submit (v6.9.35)
- `autoGenerateWorksheet` submit now waits 2× `requestAnimationFrame` after `lessonTopic` hydrates, then calls `formRef.current.requestSubmit()`. Replaces the 500 ms setTimeout that was cancelled by rapid dep changes. Safety watchdog extended to 30 s.

## Post-signup AddStudent modal
- `Signup.tsx` and `GoogleSignInButton` (signup mode) write `localStorage['post-signup-add-student'] = '1'` before redirect/OAuth.
- `Index.tsx` opens `<AddStudentDialog>` when flag OR `?action=add-student` AND `isRegisteredUser` is true. Clears flag + strips param after opening.

## Welcome Test reminder email
- `send-test-email` accepts `reminder: true`. When true + welcome test, sends a distinct body ("⏰ Friendly reminder — Welcome Test") and subject `Reminder: please complete your Welcome Test from <teacher>`.

## Public gallery nav
- New `src/components/public/PublicTopNav.tsx` — auth-free sticky header (Logo, Gallery, Exercises, Sign in, Get started). Mounted on `/gallery` and `/gallery/:slug`.

## Gallery renderer fallbacks
- `matching` / `matching-halves`: if rows shaped `{prompt, options}`, render as A/B/C multiple-choice list instead of 2-col table.
- `word-order`: accepts `shuffled_sentence`, `scrambled_sentence` in addition to existing keys.
- `complete-word` / `negative-prefixes` / `word-formation`: left col adds `before`, `context`, `clue`, `sentence`; right col adds `full_word`, `complete`, `after`, `result`.

## Audit LLM
- GPT-5 family probe in `audit-llm-models` uses `max_completion_tokens: 128` (16 still tripped the reasoning-token limit).

## Sanctity
No DB migrations, no RLS changes, no Worksheet Generation Engine changes.