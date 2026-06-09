---
name: v6.9.49 force-new bootstrap reset + WT ultra-compact + shared level banner on DSLM tab + final status promotion + phase annotation
description: Index.tsx auto-bootstrap resets worksheet state, WelcomeTestPage drops paddings + 2-col options ≥7 short choices + sticky nav, SuggestedLevelChangeBanner shared between TestDetailsView and DSLMTab, process-welcome-test final defensive status='reviewed' + status/reviewed_at response, generate-timeline existing-steps block annotates [Phase #N "title"].
type: feature
---

## P1 — Auto-generate force-reset
`Index.tsx` mount-effect (v6.9.48 bootstrap) drops `if (bothWorksheetsReady) return;` and calls `worksheetState.resetWorksheetState()` defensively before `handleGenerateWorksheet(payload)`. Uses a component-level `autoBootstrapFiredRef` so the effect can safely re-run when `bothWorksheetsReady` flips. `hasAutoGenerateIntent()` from `autoGenerateBootstrap.ts` skips the interval entirely when no DSLM intent is queued.

## P2 — Welcome Test ultra-compact
Outer padding `py-1`, header `mb-1.5`, section tabs `min-h-[26px] px-2 py-0.5`, single-line section header (h2 + inline subtitle), question card `pt-2 pb-2 space-y-2`, question text `text-[13.5px] leading-snug`, options `px-2 py-1.5 text-[13.5px] leading-tight`, translation italic `text-[11px]`. Sticky bottom nav `sticky bottom-0 z-10 bg-background/95 backdrop-blur min-h-[34px]`. `QuestionInput` auto-switches options to `grid grid-cols-1 sm:grid-cols-2` when ≥7 options, every option ≤42 chars, and no per-option translation. Mobile "Section progress" duplicate removed.

## P3 — Shared level banner + final status promotion
- `src/components/student-tests/SuggestedLevelChangeBanner.tsx` (new): props `studentId`, optional `testId`, `currentLevel`, optional `onApplied`. Fetches `student_learning_profiles.estimated_level` (filtered by `welcome_test_id` when `testId` provided). Dismiss key per scope (`wt-level-change-dismissed:${testId}` or `wt-level-change-dismissed:student:${studentId}`). Apply updates `students.english_level`.
- `TestDetailsView` uses the shared banner instead of inline render; unused `estimatedLevel`/`levelDismissed`/`levelApplying` state removed.
- `DSLMTab` mounts banner above `PathwayView` with student-scoped dismiss.
- `process-welcome-test` adds a FINAL defensive `status='reviewed'` promotion outside the per-section try-block (idempotent via `.neq('status','reviewed')`) and now returns `{ success, estimated_level, ai_summary, learning_path, status, reviewed_at }` so the UI can clear the "Auto-apply did not complete" banner on the next `loadTest()`.

## P4 — Per-phase batch annotation
`generate-timeline` existing-steps query joins `dslm_curriculum_phases:phase_id(sequence_number, title)`. `buildExistingStepsBlock` in `dslmPromptCore.ts` renders `[Phase #N "title"]` for joined steps and falls back to `[in phase XXXX]` (truncated UUID) or `[free queue]`. UI copy in `MacroTimeline.tsx` dropdown helper text and `GenerateStepsDialog.tsx` `helperText` explicitly states that the AI receives existing steps from this AND other phases and complements them.

## Sanctity
No Worksheet Generation Engine prompt/parameter/logic change. No schema migration. No RLS change.