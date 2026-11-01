# Pillar 3 of 5: Two-sided Student-Teacher Workflow (approved plan)

- 3.1 Goals in Student Hub (DONE): `get-student-hub-data` returns live teacher goals; `StudentHubGoalsCard` on `/my/:teacherToken`.
- 3.2 Homework lifecycle tabs and in-hub teacher feedback implemented; verification and access limitations recorded in `pillar3-homework-feedback-spec.md`.
- 3.3 Mistake-to-flashcard loop implemented for self-contained evaluated homework items; scope and verification boundaries: `pillar3-mistake-flashcards-spec.md`.
- 3.4 Cross-stage regression baseline, full local suite, HTTP tests, CI gates and documentation completed. Hosted verification remains explicitly blocked; see the closeout below.

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

## 3.4 implementation closeout (2026-11-01)

- Cross-stage tests cover goal scoping, lifecycle precedence, lazy published feedback and the actual feedback-modal-to-conversion handoff. Conversion tests cover exact source identity, demo/read guards, stale results, retry and existing study links.
- Actual isolated PostgreSQL migrations cover deduplication, concurrency, grants/RLS, source and learner-proof changes, rollback after a valid first card, deleted cards and preservation of seeded homework/answer/learning rows. Minimal fixtures do not include the production triggers.
- The actual exported HTTP handler has malformed/injected request, CORS/method, caller resolution, review gating, trusted RPC payload and safe error translation tests. CI now installs PostgreSQL and runs the complete Vitest suite plus Deno with explicit per-function configuration before its existing production build.
- Two defects found by regression tests were corrected: missing/unusable multiple-choice questions cannot produce options-only cards, and both preview/create reject more than the existing 500-card batch bound instead of allowing a preview that cannot be saved.
- Final local results: 195 suites / 2842 Vitest tests passed, including 27 isolated PostgreSQL cases; 21 Deno tests passed (18 HTTP, 3 service) with the explicit function config. The broken optional canvas package was temporarily quarantined to allow jsdom's normal optional-peer fallback, then restored after validation; this is not an unmodified-environment result, and no source dependency or suite was removed.
- Browser verification: real signed-out teacher and Hub redirects passed. Synthetic current Hub goals -> lifecycle tabs -> feedback -> conversion -> study/reveal -> saved practice response, existing conversion, invalid selection, empty candidates and error/retry passed with zero page errors. Synthetic practice readback is not a hosted database readback.
- Final endpoint deployment succeeded. Live negative requests returned 403 for unauthorized preview, 400 for browser-authored card payload and 405 for GET; OPTIONS returned 200 with required browser headers covered. The automatic preview build reports OK, and all 107 protected engine/llms baseline hashes are unchanged for Stage 3.4.
- Independent final review found no actionable new correctness/security regression. It did not independently rerun the reported tests. Hosted GitHub CI and the full SEO production build were not executed locally. The generic Supabase Deno runner's npm-resolution limitation remains separate from the passing explicit-config CLI/CI command.

## Remaining release-verification boundary

Implementation and local regression closeout are complete, but Pillar 3 is not certified as a fully verified production loop. External unmanaged Supabase supplies no authorized dedicated teacher/student session. Real goal visibility, student submission -> teacher review -> learner feedback -> conversion -> saved practice -> subsequent learner evidence, Hub-password enforcement and existing production trigger effects remain unverified. Keep mistake practice BETA until this dedicated hosted flow is verified; do not use local fixtures as authorization evidence.
