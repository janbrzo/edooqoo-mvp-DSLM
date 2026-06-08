---
name: v6.9.48 auto-generate bootstrap + WT compact 2xl + level-change banner + force reprocess + phase target vs batch
description: Index-owned auto-generate dispatch via sessionStorage + handshake event, Welcome Test compact layout, suggested-level-change banner, process-welcome-test force re-run, dynamic Welcome Test heading, and per-phase target/per-batch split for recommended phase.
type: feature
---

## P1 — Auto-generate handshake bootstrap
`src/lib/worksheet/autoGenerateBootstrap.ts` exports `readAutoGenerateIntent`, `buildAutoGeneratePayload`, `clearAutoGenerateFlags`. `Index.tsx` mount effect uses these to wait for `tokensLoading=false`, dispatch `worksheet:autoGenerateStarted`, clear flags, and call `handleGenerateWorksheet(payload)`. `handleGenerateWorksheet` also dispatches the event when payload carries `__autoGenerateRequestId` (covers the form-driven RAF path). `WorksheetForm` removed all sessionStorage cleanups from the RAF/watchdog and listens for the event, so an aborted retry no longer drops the intent.

## P2 — Welcome Test compact
`WelcomeTestPage` container `max-w-2xl`, `py-1.5`; header `mb-2`; question card `pt-3 pb-3 space-y-3`; all option rows `px-2.5 py-2`. Net ≈ −20% vertical with extra horizontal room for translation lines.

## P3 — Welcome Test analysis & headings
- `process-welcome-test` accepts `{ test_id, force: true }`. When force is set without student/teacher, both are resolved from `student_tests`; when answers are missing, they are reconstructed from `student_test_questions.student_answer` keyed by `wt_q<question_index+1>`. `raw_answers.level_change_suggestion = { current, estimated, created_at }` is persisted whenever the estimated level differs from the saved `students.english_level`. Existing dedupe guards stay (force does not re-emit goal suggestions).
- `TestDetailsView` heading: `Welcome Test - {studentName}{retake suffix}` from live `students.name` (rename now visible). Suggested-level-change banner uses `student_learning_profiles.estimated_level` (fetched by `welcome_test_id`) and offers Apply / Keep buttons; dismissal stored as `sessionStorage.wt-level-change-dismissed:<testId>`. `handleApplyResults` first invokes the edge function with `force: true`, falling back to the client-side rating application path.

## P4 — Per-phase target vs per-batch
`MacroTimeline` exports `recommendedStepsPerBatch` (1–6 clamp; input default + button label) and `targetStepsForPhase` (full 1-per-week target, no clamp). `recommendedStepsForPhase` kept as alias for backwards compatibility. `PathwayView.phaseOptions.need` now uses `targetStepsForPhase(p)` so `recommendedTargetPhaseId` only suggests the next phase once the current one is truly full; `perBatch` is also included in `PhaseOption`. Per-phase "How many next steps to add?" dropdown and `GenerateStepsDialog` helper text distinguish `weeks ≤ 6` ("one per week of N-week phase, have/target added") from `weeks > 6` ("X per batch (have/target added — max 6 per generation, repeat to fill)").

## Sanctity
No Worksheet Generation Engine, prompt, RLS, or schema change. Only behavioural code, edge-function logic, and UI copy.