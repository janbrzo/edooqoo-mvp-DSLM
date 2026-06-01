---
name: Onboarding Spotlight v2
description: SpotlightOverlay, force-show reset, AddStudent v2, autosend Welcome Test, NavSwitcher +Add CTA
type: feature
---

## Spotlight
- Global mount: `<SpotlightOverlay/>` in `src/App.tsx`. Tag any actionable element with `data-spotlight="<id>"`.
- Trigger via URL `?focus=<id>` or `window.dispatchEvent(new CustomEvent('app:spotlight', { detail: { id } }))`.
- Registered IDs: `send-welcome-test`, `add-goal-modal`, `learning-roadmap`, `next-lesson-ideas`, `pick-idea`.
- Self-clears on click or 8s timeout. Use this pattern — no bespoke highlight logic.

## Onboarding force-show
- `useOnboardingProgress.resetOnboarding()` sets `localStorage.onboarding_force_show='true'`.
- `shouldShow()` returns true while flag set, regardless of `dismissed/completed`.
- `dismissOnboarding()` + `handleTemporaryDismiss()` clear the flag → user-initiated hide always wins.

## AddStudentDialog v2
- Compact 2-col layout (name + email).
- Default `deferProfile=true` → `english_level` and `main_goal` inserted as `null` (columns nullable since `20260601082424_*.sql`).
- When unchecked → DeadlinePicker writes `main_goal_target_date`. Default goal preset = `custom`.
- `autoSendWelcomeTest` (default ON) → navigates to `/student/{id}?tab=overview&focus=send-welcome-test&autosend=1`.
- `WelcomeTestSuggestion` consumes `autosend=1` once via `autosendFiredRef` and strips the param.
- `useStudents.addStudent` extended: `(name, level|null, goal|null, email?, sendOverdue?, native?, mainGoalTargetDate?)`.

## NavStudentSwitcher
- Renders unconditionally for authenticated teachers (even with 0 students).
- Popover footer = `+ Add new student` opens controlled AddStudentDialog (sibling, not nested, so popover close doesn't unmount).

## Bulk-publish (one-shot)
- 904 worksheets flipped to `is_public_gallery=true` via SQL CTE (min 6 tasks, no PII, title>=3). Edge function `bulk-publish-worksheets` retained as manual rerun, NOT scheduled.

**Sanctity:** Do not add bespoke highlight overlays; reuse Spotlight. Do not re-require `english_level`/`main_goal` on insert; defer is the default UX.