# Placement repairs, Step 5 verification

## Scope and outcome

The public placement flow was verified on 2026-11-13. The Worksheet Generation Engine, existing student-test grading, AI resources and database schemas were not changed in this step.

### Regression fixes discovered during verification

- Listening audio is paused and its listeners/timer are discarded on unmount and source changes. The shared player is used by both public and assigned tests.
- An invitation lookup failure does not expose the standalone email form. The saved local result remains available for a reload/retry.
- Student tokens return only the student-safe projection, regardless of query parameters, and cannot claim a learner. Public report reads expire even after claim; the already-created learner profile remains in the teacher account.
- A failed required test, profile, goal or final claim write no longer reports success. Request-created dependent records are removed before releasing the claim reservation. This is compensating cleanup, not a single SQL transaction or a guarantee against worker termination.
- A failed pending claim is remembered for another attempt instead of being lost after login.
- Teacher-email failure removes the newly-created report and leaves the invitation uncompleted for retry. Response bodies are consumed, operational errors do not log addresses/provider responses, and links require the configured `APP_BASE_URL`.

## Executed checks

| Check | Evidence | Outcome |
| --- | --- | --- |
| Focused Vitest | 23 files, 319 tests | Passed in the unchanged test environment |
| Edge adapter and claim seeds | 19 HTTP tests and 3 seed tests | 22 passed, synthetic network/auth boundaries |
| Unfiltered application suite | 208 files, 2918 tests | Passed with the environment qualification below |
| SEO assets audit | `seo:audit` | Passed |
| Automatic preview build | Latest observability entry after edits | Build OK |
| Protected assets | 107 original hashes | Unchanged |
| Quick Send | Actual homepage dialog, supplied teacher/student addresses, separate invitations/confirmations | Provider accepted both emails, share-link clipboard readback matched |
| Invited completion | Actual public question flow through all eight sections | Result persisted with seven-day expiry; teacher/student emails accepted automatically; no email re-entry form |
| Listening | Three conversation audio sources exercised consecutively | Sources differed, no page errors |
| Text input | Real open-answer input during the test | Typing did not trigger section completion |
| Student report | Real persisted report plus `view=teacher&claim=1` | Still student view, teacher analysis redacted, claim returned 403 |
| Forwarding | Actual student-report form and send action | Teacher-report email accepted by provider |
| Mobile | 390 by 844 pixels | No horizontal overflow |
| Teacher report presentation | Synthetic report fixture using real page | Account preview, signup/login actions, desktop/mobile checked separately from hosted auth |

### Full-suite environment qualification

The initial unmodified-environment run passed 2890 tests in 203 files, but five existing jsdom suites could not load the optional `canvas.node` binary. For the full rerun, only the broken installed optional canvas package was temporarily moved aside so jsdom used its intended fallback. The package was restored immediately after the run. No dependency declaration, test exclusion or application source was changed to hide the failure. The 2918-test result is an environment-qualified pass, not an unmodified-environment pass.

## Boundaries and unverified items

- External unmanaged Supabase does not provide an authorized teacher session for browser tests. Signup/login completion, authenticated claim, persisted Prep/Insights display and teacher-only goal/pacing behavior were not certified end-to-end. The HTTP tests use synthetic authorization and do not establish production trigger behavior.
- Email-provider acceptance was verified with real requests; inbox arrival and email-client rendering cannot be checked here. Test messages are marked `Placement QA Nov13`.
- Public summaries are deterministic previews. Written answers and recordings stay local, so the imported test cannot offer AI analysis of those answers.
- Compensating claim cleanup cannot guarantee recovery from a process crash or cleanup failure. Concurrent invited submissions and a failure after provider acceptance but before marking the invitation complete are not proven exactly-once delivery.
- Earlier already-claimed learners and previously shared legacy tokens were not backfilled or revoked in this verification step.
- No app publication was performed.