# Pillar 3 of 5: Two-sided Student-Teacher Workflow (approved plan)

- 3.1 Goals in Student Hub (DONE): `get-student-hub-data` returns live teacher goals; `StudentHubGoalsCard` on `/my/:teacherToken`.
- 3.2 Homework lifecycle tabs and in-hub teacher feedback implemented; verification and access limitations recorded in `pillar3-homework-feedback-spec.md`.
- 3.3 Mistake-to-flashcard loop implemented for self-contained evaluated homework items; scope and verification boundaries: `pillar3-mistake-flashcards-spec.md`.
- 3.4 Tests, baselines and docs for each stage.

## 3.1 rules
- Shown: goals with `deleted_at` and `archived_at` NULL, non-empty title, same teacher. Welcome Test auto goals only after the teacher accepts them.
- Progress = teacher's `manual_progress_pct` (clamped 0-100), 100 when achieved, hidden when unset. Never inferred from worksheets or metrics.
- Status: achieved, past target date, due within 14 days, in progress. Achieved goals listed last.

## 3.2 rules
- All retains every assignment, including teacher-closed homework. To Do means canonical open; In Review means student-submitted; Reviewed means a published student-return review. Overdue is an independent flag for open homework only.
- Native feedback uses the existing published token/email projection only, selected from the current successful Hub list. It does not expose answer keys, raw evaluations, archived attempts, or a student redo action.
- Stage 3.3 adds a separate server-authorized conversion action without expanding the published feedback payload. Full hosted teacher/student verification remains outstanding; implementation completion is not production authorization certification.

## 3.3 rules
- Teacher action appears on submitted homework review; student actions appear only after the review is published, in the Hub feedback modal and verified standalone homework.
- Only saved, evaluated question evidence qualifies; uncertain, accepted, conflicting, unscorable and source/media-dependent items are skipped. Open-answer models are labeled as suggestions.
- One shared set per homework attempt; one card per exercise/question. Retry and concurrent teacher/student conversion do not duplicate cards or overwrite edited cards.
- Creation writes only flashcard content and provenance. Grades, homework lifecycle, DSLM scores/events, repetition progress and worksheet generation are unchanged.
