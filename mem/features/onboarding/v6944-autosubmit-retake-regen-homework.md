---
name: v6.9.44 — Auto-submit, WT retake gating, regen preserves in_progress, Homework modal redesign
description: Drop exercises predicate in auto-submit gate/watchdog; canRetake prop on WelcomeTestActionsPanel; KEPT_STATUSES (done+in_progress) in generate-curriculum-phases; redesigned Create Homework modal with grid + sticky action bar.
type: feature
---

## P1 — 1-Minute Prep auto-submit (final)
`WorksheetForm` gate and 1500 ms watchdog no longer require `selectedExercises.length > 0`. `submitForm()` already auto-completes ćwiczenia (6 for 45min, 8 for 60min) honoring `selectedMediaTypes`. Suggestions with empty `suggested_exercises` now generate automatically.

## P2 — Welcome Test retake gating + compact banners
`WelcomeTestActionsPanel` accepts `canRetake?: boolean`; fallback = `state === 'completed'`. Parents in `WelcomeTestSuggestion` (Overview / 1 MINUTE) and `StudentTestsTab` pass `canRetake={panelState === 'completed'}` — "Create retake" / "Re-take Test" hidden on `no_test`, `pending`, `in_progress`. Both banners + Tests cards refactored to `lg:flex-row` single-row layout with inline meta (`· Sent Xh ago`, `· Attempt #N`, dates inline) and tighter padding.

## P3 — Regenerate roadmap preserves in_progress
`supabase/functions/generate-curriculum-phases/index.ts`:
- `KEPT_STATUSES = ['done', 'in_progress']`, `keptPhases`, `keptWeeksConsumed`.
- Replace mode soft-deletes only NON-KEPT phases.
- `remainingMaxSeq` for replace based on kept (was: done only).
- `remainingBudget` for replace = `max(phaseCount, weeksUntilDeadline − keptWeeksConsumed)`.
- Prompt: first week = `keptWeeksConsumed + 1` whenever kept set is non-empty; COMPLEMENTARITY RULES explicitly list both done + in_progress as KEPT.

## P4 — Create Homework modal redesign
- Dialog `max-w-3xl max-h-[88vh] p-5`.
- Row 1: Student + Deadline side-by-side (`md:grid-cols-2`).
- Row 2: Exercises full-width section with `Select all` / `Clear` and 2-column checkbox grid (`max-h-44 overflow-y-auto`).
- Row 3: Reminder inline (switch + select on the same line).
- Row 4: Single `Collapsible` for "Generate additional exercises" (collapsed by default; types in 2-col grid, textarea 2 rows, Generate + Clear).
- Sticky bottom action bar.
- One label per section (no more `Student / Select Student` duplication). Functionality preserved: existing-homework alert, AI generator (max 6 types), additional instructions, generated list, deadline date+time, reminder offsets with disabled rules, share + email + send-to-teacher success view.

## Sanctity
No Worksheet Generation Engine, generation prompt, RLS, DB schema, Stripe, pacing, or auth changes.

RAG keywords: autoSubmit exercises optional, watchdog drop predicate, submitForm media-aware auto-fill, canRetake prop, retake gating completed, single-row welcome banner, lg:flex-row tests card, KEPT_STATUSES preserve in_progress, keptWeeksConsumed, firstWeekStart prompt, CreateHomeworkModal max-w-3xl, sticky action bar homework, select all clear exercises, collapsible generator section.