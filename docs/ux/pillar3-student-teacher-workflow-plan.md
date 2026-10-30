# Pillar 3 of 5: Two-sided Student-Teacher Workflow (approved plan)

- 3.1 Goals in Student Hub (DONE): `get-student-hub-data` returns live teacher goals; `StudentHubGoalsCard` on `/my/:teacherToken`.
- 3.2 Homework lifecycle tabs and in-hub teacher feedback implemented; verification and access limitations recorded in `pillar3-homework-feedback-spec.md`.
- 3.3 Mistake-to-flashcard loop from evaluated homework items.
- 3.4 Tests, baselines and docs for each stage.

## 3.1 rules
- Shown: goals with `deleted_at` and `archived_at` NULL, non-empty title, same teacher. Welcome Test auto goals only after the teacher accepts them.
- Progress = teacher's `manual_progress_pct` (clamped 0-100), 100 when achieved, hidden when unset. Never inferred from worksheets or metrics.
- Status: achieved, past target date, due within 14 days, in progress. Achieved goals listed last.

## 3.2 rules
- All retains every assignment, including teacher-closed homework. To Do means canonical open; In Review means student-submitted; Reviewed means a published student-return review. Overdue is an independent flag for open homework only.
- Native feedback uses the existing published token/email projection only, selected from the current successful Hub list. It does not expose answer keys, raw evaluations, archived attempts, or a student redo action.
- Stage 3.3 is not implemented; Pillar 3 is not complete until that separately approved stage and its verification finish.
