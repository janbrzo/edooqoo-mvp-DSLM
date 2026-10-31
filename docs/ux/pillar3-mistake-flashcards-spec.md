# Pillar 3.3: Source-bound Homework Mistake Flashcards

## Scope and root cause

Homework evaluations and flashcards had no source-bound conversion contract. Generic card insertion could neither prove the mistake came from the assigned learner's current homework nor atomically prevent repeated teacher/student imports.

The implemented slice adds teacher/student actions and transactional provenance. It does not change worksheet generation, grading, homework lifecycle, goals, notifications, DSLM calculations or the repetition algorithm.

## Eligible evidence and educational content

- Homework must be a current student return: completed_at is set and completed_by_teacher is not true. Students additionally require published reviewed_at; the owner can prepare cards before publication.
- Answer rows must be submitted and evaluated, with saved per-question ratings. All authoritative ratings must have hasValue=true and finite mastery from 0 inclusive to 50 exclusive.
- Saved teacher ratings override automatic ratings. Teacher acceptance, missing ratings and accepted AI alternatives exclude the item. Conflicting ratings are skipped rather than converted into a false mistake.
- Automatic closed items additionally require the canonical key verdict wrong. The extractor delegates context/verdict to the existing closedItemContext/matchAnswer path; review is never promoted to wrong.
- Closed cards contain their readable question/options and the saved key answer. A missing or unusable answer produces no card. Ambiguous automatic multi-blank aggregates are skipped.
- Open cards require a real written answer, real source item and existing suggested/model answer. They are labeled Suggested answer, never represented as an AI-generated correction of the learner's own text.
- Audio, image, speaking and passage/transcript-dependent tasks are skipped because a standalone text card would lose necessary context. No source media or raw private answers are added to the Hub feedback payload.
- One question becomes at most one card even when it has multiple skill ratings. Text is plain, trimmed, nonempty and bounded; no invented examples or AI generation calls are used.

## Teacher and student interactions

- Teacher review exposes the action on submitted homework. Changing saved question decisions refreshes the preview scope.
- Verified standalone student homework exposes the action after publication. Hub feedback exposes it after the lazy published review read succeeds, using the current successful Hub assignment and server-returned assigned email.
- Preview loads only a count in the browser. Create sends homework identity and learner proof, never card content or claimed teacher identity.
- Loading, no qualifying mistakes, retryable error, saving and successful/existing-set states are explicit. A pending save blocks double clicks.
- Success links to the existing FlashcardsLearning study/browse route in a native new tab. Student practice receives email and a same-origin returnTo path back to the original homework/feedback.
- Demo mode blocks reads and creates. Request key plus monotonically increasing generation ignores late responses on closing, learner/assignment switches, refresh and A-to-B-to-A changes.

## Authorization and transactional deduplication

- The endpoint validates POST JSON and bounded UUID/token/email parameters. Teacher identity comes only from validated caller resolution; anonymous Supabase accounts are not teacher owners.
- Learner access requires the exact current homework share token plus the current assigned email, normalized case/whitespace. Deleted, cross-teacher and mismatched students are denied. A remembered Hub email alone is not authority.
- The service repeats ownership, assignment and review checks. The privileged loader and saver are executable only by service_role, not anon/authenticated.
- The saver locks the homework, student, answer rows and existing set. It rechecks current ownership/token/email, publication and submission and compares the source snapshot before writing. Equivalent timestamp strings are compared as timestamp instants; all other source fields remain exact JSONB comparisons.
- Source mappings use one unique homework/student/teacher/attempt set and one unique exercise/question card. Concurrent teacher/student saves serialize on the homework lock. Repeated calls return existing counts and the same shared set.
- Retries never overwrite edited card text. Deleted/expired sets, deleted cards and disabled learner contributions are rejected rather than silently recreated. A new homework attempt has distinct provenance; previous practice history remains intact.
- RLS permits authenticated teachers to read only their own provenance. Students access flashcards through existing share-token routes; no generic student provenance mutation permission is added.
- Card creation writes sets, cards and mappings only. It does not create mastery/events/progress or grade an answer. Only later real practice uses the existing repetition/evidence pipeline.
- This endpoint implements the existing standalone homework-token/email access contract, not a new independent Hub-password contract. Portal password checks remain with the Hub.

## Regression coverage

- homeworkMistakeExtractor.test.ts: confirmed versus uncertain/accepted/conflicting evidence, teacher authority, deduplication, grammar matcher, absent keys, multi-blank ambiguity, suggested open answers and missing source/media context.
- homeworkMistakeService.test.ts: owner versus learner proof, deleted/cross-owner source, publication and reopen gates, no empty set and no source mutation.
- pillar3MistakeRuntime.test.tsx: exact request identity, missing proof, demo guards, double click, stale preview/save, A-to-B-to-A, retry and study handoff.
- homeworkMistakeSql.test.ts: actual tool-managed migrations executed against an isolated temporary PostgreSQL schema, email/timestamp parity, sequential/concurrent deduplication, grants/RLS, rejected scopes, source changes, rollback and contribution/deletion gates.
- Existing lifecycle, review, answer validation and DSLM baseline suites remain authoritative. The isolated database supplies minimal tables, not all existing hosted triggers: it does not certify production side effects.

## Verification boundaries

Hosted migrations and endpoint deployment succeeded. Live catalog confirms the new RPCs are service-only. Unauthorized deployed preview requests return 403.

The sandbox reports external_unmanaged and cannot mint a real teacher/student session. Local browser fixtures and isolated PostgreSQL are not authenticated hosted certification. Full real homework submission -> teacher review -> mistake conversion -> saved practice readback and later learner evidence require an authorized dedicated test session. The whole Pillar 3 remains unverified in that hosted sense.

The existing full-suite environment also has five jsdom files blocked by a missing optional canvas.node binary. These are not treated as passing, deleted or hidden by changing production dependencies. Supabase reports 158 pre-existing linter findings, none introduced by these migrations; remediation is outside this slice.