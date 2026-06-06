---
name: v6.9.40 Welcome Test retake cards, auto-apply repair, readiness, level/goal auto-fill
description: Per-attempt retake cards, fixed auto-apply column, retake-aware banners, level+main_goal auto-fill, 1-Minute Prep readiness panel.
type: feature
---

## P2 — Retake cards
`StudentTestsTab` now renders one card per Welcome Test attempt sorted by attempt_number desc. Labels: `Initial Welcome Test` (attempt 1) and `Welcome Test — Retake N` (attempt N+1). Latest attempt owns `WelcomeTestActionsPanel`; older attempts get read-only View. `nextAttempt` is derived from MAX(attempt_number) across all welcome rows. Retake title becomes `(Retake {nextAttempt-1})`. Modal copy recommends 8–12 week intervals.

## P2C — Retake-aware banners
`WelcomeTestSuggestion` stores `attempt_number` from the latest attempt and uses `retake N` wording for pending/in-progress/completed states.

## P3 — Auto-apply column fix
`process-welcome-test` previously queried `test_skill_results.student_test_id` which does not exist. Changed to `test_id`. After this fix and deployment, freshly completed Welcome Tests reach `reviewed` status without the `Auto-apply did not complete` warning. `TestDetailsView` shows `Results manually applied...` when teacher used the fallback button (`manualApplyCompleted` state).

## P4 — Level + main_goal + suggested goals
`process-welcome-test`:
- Fills `students.english_level` when missing/empty/`unknown`.
- Derives `suggestedMainGoal` (exam/work/travel/academic/social-conversation/general) from motivation, career importance, learning timeline, interests; writes to `students.main_goal` when missing/empty/`custom`.
- Inserts 2–3 `student_progress_goals` rows with `source='welcome_test_auto'`. Deduped per `test_id` via `metadata @> { test_id }` check.

Backfill done for student `4466eaf8-cb04-41f5-a9ec-462dde020bda`: level A1, main_goal travel, three suggestions tied to test `94c76ba5-7cc0-47d7-be04-832f1207dafa`.

## P5 — 1-Minute Prep readiness panel
`NextStepBanner` empty state now mirrors the roadmap readiness card: missing goals, incomplete Welcome Test, missing curriculum plan. Actions wired through `PathwayView` → `NextStepsSection` → `NextStepBanner` and reuse `useWelcomeTestActions`.

## Out of scope (next cycle)
- Guided Generate Learning Roadmap modal (P6): hook signature extended (`useCurriculumPhases.generatePhases` accepts `weeksPerPhase`, `phaseWeekTargets`, `focusedGoalIds`), but modal UI and Edge Function consumption pending. Default path unchanged.
- Pre-existing security linter findings (197).
- Evidence-based `current → target` CEFR badge.

## Sanctity
No worksheet generation engine, prompt, or pipeline change.