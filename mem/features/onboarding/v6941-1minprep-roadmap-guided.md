---
name: v6.9.41 1-Minute Prep auto-submit, guided roadmap, retake emails, per-goal actions
description: Deterministic prefill auto-submit, dslm:addGoal event, retake email notifications, per-goal accept/dismiss, GenerateRoadmapDialog steering generate-curriculum-phases.
type: feature
---

## P1 — 1-Minute Prep auto-submit
`WorksheetForm` reads every prefill field synchronously via `readPrefillStr` / `readPrefillJSON` / `readPrefillFocusMap` / `readPrefillExercises` / `readPrefillMediaTypes`. `autoPrefillHydratedRef` plus a watchdog that re-reads sessionStorage before the final submission close the race that previously left the form filled but idle.

## P2 — Add-Goal modal robustness
`DSLMTab` emits a `dslm:addGoal` window event for URL `focus=add-goal-modal`. `GoalsView` listens to that event so late `LazySection` mounts still open the modal.

## P3 — Welcome Test retake emails
`WelcomeTestSuggestion`, `StudentTestsTab`, and `TestDetailsView` retake handlers call `sendWelcomeTestEmail` after `ensureWelcomeTest` and dispatch `student-tests:refresh`. Confirmation rendered in a responsive grid with `break-words` so long `Retake N sent` labels never break the card.

## P4 — Per-goal suggested actions
`GoalsView` adds `Accept` (UPDATE `student_progress_goals.accepted_at`) and `Dismiss` (soft delete) buttons to each AI-suggested goal alongside the bulk Accept all / Dismiss all controls.

## P5 — Readiness panel parity
`NextStepBanner` readiness panel matches the Learning Roadmap empty state: bordered amber card, icon row, grid of CTAs (`Add goal`, `Send test`, `Go to roadmap`).

## P6 — Guided roadmap generation
New `src/components/dslm/GenerateRoadmapDialog.tsx`. Auto-fit defaults preserve old behavior. Toggle off any of:
- Number of phases (1–8)
- Weeks per phase (1–12, optional per-phase customization when explicit count is set)
- Focused goals (checkbox list of non-achieved goals)
- Additional guidance free text

`useCurriculumPhases.generatePhases` forwards `count`, `weeksPerPhase`, `phaseWeekTargets`, `focusedGoalIds`, `teacherComment`.

`supabase/functions/generate-curriculum-phases`:
- `phaseCount` derives from `phaseWeekTargets.length` when present, else `count`, else heuristic.
- `remainingBudget` priority: `phaseWeekTargets` sum → `weeksPerPhase * phaseCount` → deadline-based.
- `phaseWeekTargets` triggers deterministic `rebase(phases, durations)`; otherwise existing `fitPhasesToDeadline` safety net runs.
- `focusedGoalIds` split `goalsBlock` into `PRIORITY GOALS` vs context.
- `generation_context.teacher_overrides` records `{ explicit_count, explicit_weeks_per_phase, phase_week_targets, focused_goal_ids, has_teacher_comment }`.

Sanctity: no Worksheet Generation Engine, RLS, Stripe, or DB schema changes.
