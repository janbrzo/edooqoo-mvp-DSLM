---
name: Welcome Test Duplicate Prevention v6.9.27
description: Idempotent createTest + partial unique index prevents duplicate welcome attempts and broken "Waiting for student" UI
type: feature
---

## v6.9.27 — Welcome Test integrity

### Root cause
Race condition in `WelcomeTestSuggestion.tsx`: `checkWelcomeTest()` async populated `testId/shareUrl` AFTER user clicked Send/Copy/Refresh. `ensureWelcomeTest()` saw `testId == null` → INSERT new `student_tests` row with new questions+token. `tests.find(t.test_type==='welcome')` returned the latest (empty) row, hiding the actual completed attempt.

### Rules
- `useStudentTests.createTest`: for `test_type='welcome'` and no `previous_attempt_id`, SELECT latest non-deleted row first; if exists, return it (idempotent).
- `WelcomeTestSuggestion.tsx`: expose `checking` flag; disable Copy/Send/Refresh/Preview until `checkWelcomeTest()` resolves.
- Active welcome selection: prefer `completed > reviewed > in_progress > assigned > pending`, never just newest.
- `process-welcome-test/index.ts`: after profile upsert, explicitly UPDATE `status='completed', completed_at=now()`.
- DB invariant: partial unique index `uq_one_active_welcome_attempt ON student_tests (student_id, teacher_id, test_type, attempt_number) WHERE deleted_at IS NULL`.
- `Compare attempts` UI renders only when ≥2 welcome tests are in (`completed`, `reviewed`).

**Why:** prevents profile UI showing "Waiting for student" + disabled `View Results` after student finished (Johny Bravo bug).