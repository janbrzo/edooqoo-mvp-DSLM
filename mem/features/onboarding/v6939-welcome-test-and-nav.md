---
name: v6.9.39 Welcome Test loop + public nav
description: Fixes for duplicate WT banner, retake survival + confirm dialog, wtCompleted semantics, auto-apply fallback, auto level/goal suggestion, public workflow map, PublicWorkflowNav layout.
type: feature
---

## P1 — Duplicate Welcome Test banner
`PathwayView` no longer mounts a second `<WelcomeTestSuggestion compact />`. The DSLMTab-level instance owns `data-spotlight="send-welcome-test"`. Removing the inner one eliminated the double banner on `/student/:id?tab=dslm`.

## P2 — Retake survival + guard
`WelcomeTestSuggestion.checkWelcomeTest` now treats the LATEST attempt as authoritative when its status is pending/assigned/in_progress, only falling back to completed/reviewed when the latest itself is terminal. Both `WelcomeTestSuggestion.handleRetake` and `StudentTestsTab.handleRetake` open an `AlertDialog` when the prior attempt is not completed — warning that re-take usually makes sense ~30 days after completion. All three retake paths (`WelcomeTestSuggestion`, `StudentTestsTab`, `TestDetailsView`) dispatch `window.dispatchEvent(new CustomEvent('student-tests:refresh', { detail: { studentId } }))`. `StudentTestsTab` listens to that event and calls `refetch()` immediately so the new card appears without polling.

## P3 — `wtCompleted` semantics
`MacroTimeline` no longer reads the latest test status from `useWelcomeTestActions.getStatus()`. It runs a dedicated count query: `student_tests.status in ('completed','reviewed') AND deleted_at IS NULL`. Any past completion suppresses the `Welcome Placement Test not completed — Send test` line, even after a fresh pending retake.

## P4 — Auto-apply fallback in `process-welcome-test`
- For each `test_skill_results` row missing `applied_to_element_id`, look up `student_learning_elements` by `(student_id, element_type)`. If found, persist the rating + back-fill `applied_to_element_id`. If not found, still mark `applied_at` so the manual fallback doesn't re-flag the row (the per-skill score lives on `student_learning_profiles`).
- ALWAYS promote `student_tests.status` to `reviewed` once the learning profile upsert succeeded. Eliminates the misleading `Auto-apply did not complete` banner for brand-new students who have no nano-skill elements yet.

## P5 — Auto-fill level + suggested goals
- Migration adds `source text`, `accepted_at timestamptz`, `metadata jsonb default '{}'::jsonb` to `student_progress_goals` plus index `idx_student_progress_goals_source (student_id, source) WHERE deleted_at IS NULL`.
- `process-welcome-test` writes `students.english_level = estimatedLevel` when current level is null/empty; otherwise leaves it untouched (no silent overwrite).
- When the student has 0 active goals (`is_achieved=false AND archived_at IS NULL AND deleted_at IS NULL`), the function inserts 2-3 suggestions with `source='welcome_test_auto'` derived from `weakest_skill`, `strongest_skill`, and the first `interest_topics` entry.
- `GoalsView` renders a `Suggested from Welcome Test` banner for any goal with `source='welcome_test_auto'` and no `accepted_at`. Accept all → bulk `update accepted_at`. Dismiss all → bulk `deleteGoal`.

## P6 — No more fake `B1 → B2`
`StudentNavBadges` removed `LEVEL_PROGRESSION`. The nav now shows only the current CEFR. The codebase currently has no evidence-based target signal (no `target_level` column on `dslm_curriculum_phases`, no `level_change` `pacing_proposals.trigger_type`); when one exists, re-introduce `current → target` driven by that signal.

## P7 — Workflow map on `/one-minute-prep` and `/`
`FeatureWorkflowMap` mounted on `/one-minute-prep` with `activeKey="one-minute-prep"` (key already exists in `PUBLIC_FEATURE_WORKFLOW`) and on the anonymous landing branch of `/` without `activeKey`.

## P8 — PublicWorkflowNav layout
`PublicWorkflowNav` switched from `max-w-7xl` container to full-width with `flex-1` on the left block. Feature pills breakpoint moved from `xl:flex` to `lg:flex` so they appear at ≥ 1024px viewports without crushing the action cluster.

## Sanctity
No Worksheet Generation Engine, generation prompt, or generation pipeline change. Only DB additive change (nullable columns + default + index).