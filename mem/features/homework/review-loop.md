---
name: Homework review loop
description: One rule for "waiting for review", every entry point opens /homework/:id/review, demo and auth behaviour of the review page
type: feature
---

## Invariants

- `isHomeworkAwaitingReview` (`src/lib/homework/reviewState.ts`) = `completed_at && !reviewed_at && completed_by_teacher !== true`. Used by the dashboard attention zone (query adds `.not('completed_by_teacher', 'is', true)`), the timeline `homework_returned` event, `useStudentAttentionDots` and the homework list. Never inline the condition again.
- Entry points to `/homework/:id/review`: dashboard `Review`, timeline `Review` / reviewed return, homework list (`StudentHomeworkTab`) `Review` (awaiting) or `View review` (reviewed). Teacher-marked completion (`completed_by_teacher`) has no review link.
- `HomeworkReviewPage`: `useTeacherAuthRedirect` (login keeps `state.from`); a failed or empty load renders "Homework not available" with Try again / Back to dashboard (never a blank page); `Send Review` invalidates `['dashboard-attention']` and `['student-timeline-sources']` with `refetchType: 'all'` because the app's QueryClient has `refetchOnMount: false`.
- Demo: the review page renders an explanation card (Back to student / Sign up free) instead of redirecting to `/login`; `StudentHomeworkTab` lists `demoData.homework` for the student and every write or student-link action shows `showDemoBlockedToast`.
- `StudentHomeworkTab` rows wrap (`flex-col sm:flex-row`, `flex-wrap` action group); verified scrollWidth == viewport at 360/375/1024/1280.

- Review page renders exercises with `isInteractive` + `disabled` (answers only render in interactive mode) and AI feedback via `parseAiEvaluation` per question; the stored `ai_evaluation` is `{question_evaluations: [...]}`, never a single `AiEvaluation`.
- `Badge` forwards refs (Radix `asChild` triggers, e.g. homework deadline popover).
- CreateHomeworkModal remembers `emailSentTo`; the success screen says "Email sent to …" instead of inviting a duplicate send.
- Open DB issues found 2026-10-06 (need a migration, not applied from the repo): `prevent_profile_billing_self_update` checks `auth.role()` and blocks `consume_token` (no token charged since 2026-09-18); anon students cannot call `add_student_event` since 2026-08-07, so Welcome Test answer events and `homework_submitted` events are lost.

**Why:** the 2026-10-05 user-flow audit found the review page reachable only from the dashboard (max 5 unreviewed items), the timeline showing "Waiting for your review" for reviewed homework, the demo's main attention CTA ending on `/login`, and a stale attention row after sending a review.
