---
name: Onboarding Checklist v3 + Add Student RadioGroup + Gallery hardening
description: v6.9.33 — 8-step checklist with locked states + calendar; DSLM-anchored Welcome Test spotlight; re-clickable focus deep links; 5-min reset window; 3-mode Add Student modal; single global student switcher; gallery renderer alias + toText hardening
type: feature
---

## Onboarding Checklist v3
- `OnboardingStep` union (in `src/hooks/useOnboardingProgress.tsx`) has 8 ordered IDs: `add_student`, `send_welcome_test`, `add_goals`, `generate_roadmap`, `generate_next_ideas`, `pick_idea`, `generate_worksheet`, `setup_calendar`.
- `setup_calendar` is detected via `count > 0` on `calendar_slots` filtered by `teacher_id`.
- Steps requiring a student are visually locked (`Lock` icon + disabled `Start` + "Add a student first" tooltip) when `students.length === 0`.
- Floating card sized `max-w-[280px]` with `text-xs`/`text-[11px]` typography and `h-7` buttons (-30% vs v2).
- Every checklist deep-link appends `&_=Date.now()` so React Router fires a fresh navigation even on repeat clicks.

## DSLM focus deep-links
- `DSLMTab.tsx` has a `useEffect` keyed by `searchParams.get('focus')` AND `searchParams.get('_')`. It handles `add-goal-modal` (dispatch `dslm:addGoal`) and `pick-idea` (scroll to pathway + dispatch `pathway:pickIdea`), then strips both `focus` and `_` from the URL via `setSearchParams({...}, { replace: true })`.
- `NextStepsSection.tsx` listens for `pathway:pickIdea`: opens `GenerateStepsDialog` when `items.length === 0`, otherwise scrolls to `[data-spotlight="pick-idea"]`.

## Spotlight markers
- `data-spotlight="send-welcome-test"` lives on the `WelcomeTestSuggestion` Card — mounted in BOTH Overview and DSLM Pathway (compact variant).
- `data-spotlight="learning-roadmap"` lives on the Roadmap `<Collapsible>` (not the zero-size sentinel).
- `data-spotlight="pick-idea"` wraps the first `NextStepBanner`.
- `data-spotlight="next-lesson-ideas"` stays on the NextSteps container.

## Reset Onboarding
- `/profile` button → `resetOnboarding()` writes `localStorage.onboarding_reset_at = Date.now()` and clears session/temp flags.
- For 5 minutes after reset, `checkSteps` zeroes every step EXCEPT `add_student` (objective fact). After the window expires the flag is removed and live detection resumes.

## Add Student modal v3
- `RadioGroup` with `know|defer|manual`.
  - `know`: level + main goal required; optional checkbox "Also send the Welcome Test (refines learning profile)".
  - `defer` (default): auto-send Welcome Test, infer profile.
  - `manual`: skip Welcome Test; teacher fills everything later.
- Main Goal label has an info tooltip explaining Main vs Supporting vs Additional Goals.
- `onStudentAdded?: (newStudent?: { id; name }) => void` — when supplied, the dialog skips its default navigation. `WorksheetForm` uses this to auto-select the new student inline.
- Default-flow navigation:
  - auto-send → `/student/:id?tab=dslm&view=goals&focus=add-goal-modal&_=ts`
  - no auto-send → `/student/:id?tab=dslm&view=pathway&focus=send-welcome-test&autosend=0&_=ts`

## Sticky-nav student switcher
- SINGLE `NavStudentSwitcher` rendered on every authenticated page except `/dashboard` and `/profile` (INCLUDING `/student/:id`).
- Anchored in the LEFT cluster (right after `<Logo />`) on mobile + desktop.
- Trigger label shows the current student name on `/student/:id`.
- `+ Add` button placed in the popover header next to "Switch to student" (per UX request from screenshot).
- Removed: `StudentSwitcherPopover` usage in `StudentPage.tsx`.

## 1 MINUTE tab border fix
- Wrapping `TabsTrigger` in `TooltipTrigger asChild` was stripping Radix `data-state` from the trigger. Fix: Tooltip and TabsTrigger are no longer composed via `asChild`; the trigger uses `title=...` for the explanation, restoring the active-state border.

## Generator inline Add Student
- `WorksheetForm` student `<Select>` has `<SelectItem value="__add_student__">+ Add Student</SelectItem>` directly under "No student (generic)".
- Selecting it opens `<AddStudentDialog onStudentAdded={(s) => { refetchStudents(); setSelectedStudentId(s.id); }} />` so the new student is auto-selected without page navigation.

## Signup → first action
- After immediate signup login `Signup.tsx` navigates to `/?action=add-student`. `Index.tsx` reads this param, opens `AddStudentDialog`, and removes it via `setSearchParams`.

## Public gallery hardening
- `GalleryExerciseRenderer.normalize()` maps aliases: `synonyms-antonyms` → `synonyms`, `matching-halves` → `matching`, `word_order` → `word-order`, `complete_word` → `complete-word`, `negative_prefixes` → `negative-prefixes`, `fill-in-blanks` → `fill-in-the-blanks`.
- `toText()` covers many more keys (`term`, `prompt`, `base`, `gapped`, `masked`, `first`, `a`, `synonym`, `antonym`, …) and SILENTLY returns `""` for un-mappable objects, including nano-skill metadata (`{name, mastery, reason}`). Never falls back to `JSON.stringify`.
- `QuestionText()` delegates to `toText()`.
- `word-order` accepts `tokens` and `scrambled` in addition to `words`/`shuffled`/string fallback.
- Matching pairs accept `word`, `match`, `pair`, `synonym`, `antonym` keys.
- `PublicGalleryIndex.tsx` has a CEFR chip filter row (`A1/A2`, `B1/B2`, `C1/C2`) syncing the existing `?level=` query param. The `<select>` and topic input remain unchanged.

## SANCTITY
No Worksheet Generation Engine prompt, parameter, or logic change. No Supabase schema, RLS, Edge Function, Stripe, auth, or service-role change. The bulk-publish edge function and `public_level` data are untouched.