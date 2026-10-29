# Pillar 3 of 5: Two-sided Student-Teacher Workflow (approved plan)

- 3.1 Goals in Student Hub (DONE): `get-student-hub-data` returns live teacher goals; `StudentHubGoalsCard` on `/my/:teacherToken`.
- 3.2 Homework lifecycle tabs (To Do / In Review / Reviewed) and in-hub teacher feedback via `get_homework_review_by_share_token`.
- 3.3 Mistake-to-flashcard loop from evaluated homework items.
- 3.4 Tests, baselines and docs for each stage.

## 3.1 rules
- Shown: goals with `deleted_at` and `archived_at` NULL, non-empty title, same teacher. Welcome Test auto goals only after the teacher accepts them.
- Progress = teacher's `manual_progress_pct` (clamped 0-100), 100 when achieved, hidden when unset. Never inferred from worksheets or metrics.
- Status: achieved, past target date, due within 14 days, in progress. Achieved goals listed last.
