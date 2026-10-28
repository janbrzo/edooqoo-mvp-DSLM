# Homework: Specification (audit iteration 12, October 2026)

Status: AS-BUILT 2026-10-28. Parent: `docs/ux/target-teacher-experience.md`. Routes: `/homework/:token` (student), `/homework/:id/review` (teacher), Student tab of `/student/:id`.

Promise to protect: the tutor prepares and assigns homework in under a minute, the student needs no account, and everything the tutor sees about the student's work is evidence the tutor can trust.

## 1. Flow

1. **Create** (worksheet or Student tab). The modal opens at once. The exercises the student did not do in class or did badly (class mastery below 70) are preselected; the deadline defaults to 2 h before the student's next booked lesson (at least 4 h of work time, lessons within 14 days), else +6 days. "Notify student by email" is off by default; a reminder needs a deadline. The Student tab has a worksheet picker.
2. **Student** opens the link, confirms the assigned e-mail (the exercises and their answer keys are read only after that), answers (autosave of changed keys, keepalive write on tab close), submits with an explicit click (nothing answered cannot be submitted; a recording that failed to upload stops the submit).
3. **Server** grades right after submit and notifies the teacher; a scheduled run finishes what did not finish.
4. **Review** (`/homework/:id/review`, opened by every bell): the teacher decides items the key could not judge, rates open answers 0-100 (the automatic score is a proposal), writes comments, sends the review. The student sees the comments and the teacher's decisions when they open the link again. "Let student redo" archives the returned attempt and opens the homework again under the same link.
5. **Mark done** (teacher) is terminal until reopened: the student can no longer save or submit.

## 2. Decisions

- Evidence weight in the DSLM: submitted homework 1.0, draft 0.8 (a student may do work and not send it). Versioned in `dslm_event_weight`.
- The browser never grades: ratings of closed exercises are rebuilt on the server from the answers and the homework snapshot; AI may only raise typed closed items the key marks wrong or uncertain.
- An item the key cannot decide ("review") counts nowhere until the teacher decides; an AI explanation never contradicts a teacher decision on a closed item.
- No blurred preview before the e-mail gate: a bare link carries only the title and names.
- A redo keeps the first attempt's DSLM events until the second attempt is submitted and evaluated; the archive keeps the first attempt in full.
- The review is delivered on the page, not by e-mail (the teacher keeps control of e-mails).

## 3. Not done on purpose

- Viewing archived attempts in the UI (the data is kept in `homework_attempts`).
- Deadline editing in a calendar-aware way beyond the default.
- Server-side length cap for forged payloads (the client cuts answers at 20 000 characters).
- Identity keyed by student_id everywhere (answers are still keyed by e-mail; the DSLM trigger already follows `homework_assignments.student_id`).
- Duplicate pg_cron job 3 (`send-homework-reminders-every-15min`) answering 401: removing it needs the database owner role (Dashboard, Integrations, Cron).
- Parallel answer models of homework, shared worksheet and live session (architecture).

## 4. Verification

Every change was tested on production with throwaway data (`QA-HW-*` students and homework, kept on purpose): server authority, lifecycle and Mark done, evidence weights, deletion cleanup, closed ratings from the key, draft re-rating, the e-mail gate, review for the student, teacher verdicts and ratings, submit guards, terminal 42501, keepalive save, redo and the student_id trigger.
