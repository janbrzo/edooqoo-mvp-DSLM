# Pillar 3.2: Student Homework Lifecycle and Native Teacher Feedback

## Scope and root cause

The Hub previously grouped every completion together and omitted `completed_by_teacher` from its response. A reviewed assignment only opened the standalone homework page, so a learner could not read the teacher's published comments in the portal.

Stage 3.2 adds explicit student lifecycle tabs and a read-only feedback modal. Stage 3.4 supplies regression coverage and architectural documentation for this slice. No worksheet generation, grading, mastery, submission, redo, notification, or flashcard pipeline changes are included.

## Lifecycle contract

`src/lib/studentHub/homeworkLifecycle.ts` delegates state to the existing `homeworkState` in `reviewState.ts`, rather than maintaining a new state machine.

| Tab / label | Canonical state | Meaning |
| --- | --- | --- |
| All | Any | Includes teacher-closed assignments |
| To Do | open | No assignment completion timestamp |
| In Review | submitted | Returned by the learner; teacher has not published review |
| Reviewed | reviewed | Learner return with published review |
| Closed by teacher | closed | Visible in All only; never represented as awaiting review |

Overdue is true only for open work with a valid deadline strictly before caller-supplied time. Deadline equality is not overdue. Invalid/missing dates do not crash the row. Exercise counts do not decide lifecycle. The endpoint's active-homework count and the dashboard's newest-three order are unchanged. Older payloads without the additive teacher-closure field preserve the previous canonical fallback.

## Portal interactions

- The homework list uses accessible All / To Do / In Review / Reviewed tabs.
- Each row has an explicit native new-tab homework link; reviewed rows also have View Feedback.
- The dashboard uses the same row and status rules. Its feedback action navigates to `/my/:teacherToken/homework?feedback=:id`.
- A feedback id from the URL is a selection hint, not authorization: it must match a reviewed row in the current successful Hub response.
- Closing feedback removes the selection hint, without affecting homework answers or completion.
- The modal displays numbered exercises, published comments as plain text, and teacher question decisions. These decisions are not presented as a full score or AI feedback.
- Loading, retryable error, server-null/unavailable, successful review without comments, and populated feedback are separate states.
- Open Homework preserves the existing standalone exercise view and its existing answer-key gates. No keys are fetched for the modal.
- The learner cannot request a redo here. Only the teacher's existing authorized redo operation reopens an assignment.

## Access and stale-data boundaries

- Hub data still passes the existing teacher-token, live assigned-email and optional password-session checks.
- `useStudentHubData` keys visible data by teacher token and email, clears it during refetch, ignores superseded responses, and clears rejected password proof. It never sends demo identifiers to the live endpoint.
- Feedback is lazy: no request while the modal is closed, homework is open/submitted/teacher-closed, identity is missing, or demo mode is active.
- The request uses the listed homework share token and **server-returned** assigned email, not an arbitrary id or remembered email alone.
- `useStudentHomeworkFeedback` scopes each result to teacher token, email, homework id, share token and review timestamp. A changed scope hides old results synchronously; effect cleanup rejects late responses.
- The only feedback read is the existing `get_homework_review_by_share_token` adapter. Its server gate returns null before publication or for an unmatched token/email.
- This existing standalone RPC does not validate the Hub password proof independently. No new permissions, tables, migrations or broader service-role projection were added.
- Existing RPC hardening opportunities (deleted-student check, reassignment-specific verdict scope and comment-index validation) are outside this slice; no stronger hosted guarantee is claimed.

## Implementation inventory

- Pure projection and membership: `src/lib/studentHub/homeworkLifecycle.ts`.
- Shared row: `src/components/student-hub/StudentHubHomeworkRow.tsx`.
- Modal and lazy read: `HomeworkFeedbackModal.tsx`, `useStudentHomeworkFeedback.ts`.
- Integration: `StudentHubHomework.tsx`, `StudentHubDashboard.tsx`, `useStudentHubData.tsx`.
- Additive field: `get-student-hub-data` returns `completed_by_teacher` from the existing assignment.

## Regression coverage

- `homeworkLifecycle.test.ts`: canonical precedence, all tab memberships, teacher closure, older response compatibility, redo reset, deadline equality/offsets/invalid dates, and no count-derived state.
- `pillar3RuntimeBaseline.test.tsx`: real hook execution against mocked network boundaries, exact review RPC arguments, no request before eligible selection, demo guard, null/empty/error/retry, closing/switching/redo stale-result prevention, plain-text comments, native link handoff, Hub identity switching/out-of-order responses, and password rejection.
- `pillar3Baseline.test.ts`: selected direct I/O/protected-engine guards and additive bulk-response boundary. Source guards do not replace runtime tests or hosted authorization checks.
- Existing homework review, redo, autosave and answer-access suites remain authoritative for those unchanged contracts.

## Verification limitations

### Verification result (2026-10-30)

- 53 new cases: 21 lifecycle, 26 runtime and 6 selected boundary guards. Focused Student Hub/homework/no-em-dash run: 131 tests across 20 files passed.
- All available remaining suites: 2703 tests across 186 files passed. The unfiltered full run exits with five environment errors: existing jsdom suites cannot import the optional native `canvas.node` binary. Those five files were explicitly excluded from the successful second run, not claimed as passing or removed from the project.
- Automatic preview build reports OK. `get-student-hub-data` deployment succeeded with the additive teacher-closure field; real authorized response readback remains unverified.
- Real signed-out homework navigation returned to `/my?teacher=test-teacher`, showing the Hub sign-in screen.
- Synthetic browser verification passed All/To Do/In Review/Reviewed membership, overdue/teacher-closed states, lazy read, comments as text, review failure/retry, exact token/email request, dashboard-to-feedback navigation, invalid-id denial, list selection/reload/close, unrelated query preservation, empty data and Hub failure/retry. There were zero browser page errors.
- Desktop and 390px list/modal were checked visually; neither introduced horizontal overflow. Browser fixtures were local synthetic data, not a real learner session.
- Worksheet Generation Engine and both `llms.txt` files are byte-identical to their initial hash baseline. No database migrations, grading/redo writes, or new student permissions were introduced.

This project uses external unmanaged Supabase. No authorized real teacher/student session is injected, so synthetic Hub browser fixtures and mocked runtime reads do not certify authenticated production behavior. Hosted student submit -> teacher review -> student readback, password enforcement and transactional redo require an authorized dedicated test session. Stage 3.3 is now implemented separately in `pillar3-mistake-flashcards-spec.md`: its conversion action does not expand the feedback RPC or make the whole Pillar 3 hosted flow verified.