# Public placement full report, Step 5 verification

Verification date: 2026-11-28 UTC. Scope: final regression and security verification of steps 1-4, not remediation of unrelated project-wide security findings.

## Executed evidence

| Check | Result and boundary |
| --- | --- |
| Full application suite | 214 files, 3023 tests passed, including both six-case isolated PostgreSQL planning suites. |
| Real HTTP adapter and planner suites | 61 Deno tests passed with the function's explicit config. Network, authorization and gateway streams are synthetic boundaries. |
| New adversarial cases | Five cases cover student role/learner spoofing, both planner action bypass attempts, teacher response lease/contact redaction and expired diagnostic reads. |
| Production RPC grants | All five claim/reserve/finish functions are SECURITY DEFINER with search_path=public; anon/authenticated EXECUTE denied, service_role EXECUTE allowed. Read-only catalog verification. |
| Live public generation | Temporary reviewed B1 learner fixture generated exactly three first-lesson proposals and four contiguous learning phases through the deployed endpoint and real AI provider. |
| Persisted readback and cache | Public get returned both ready results. Repeated generation actions returned identical saved results, and browser reload displayed them. HTTP tests separately assert one gateway call per cached job. |
| Live student-token authorization | get with a spoofed teacher role still returned the student projection; both generation actions and claim returned 403. No diagnostic, plans, raw answers or contacts were returned. |
| Manual worksheet handoff | First saved proposal opened the actual worksheet form with the exact topic and eight selected exercises. No unclaimed student, auto-generation flags or generateWorksheet network request. Form consumes the prefill keys, so validation reads the actual topic input rather than requiring keys to remain. |
| Browser presentation | Teacher report, plans, manual form and student report checked on desktop; teacher proposals checked at 390x844 with no horizontal overflow. Zero page errors. |
| Protected assets | No diff in generateWorksheet, format-worksheet-prompt or generated llms.txt files against the step-4 baseline. |
| Preview | Latest automatic observability result: build OK. |

The first full run required compatible min/max worker limits. The next run passed 2994 collected tests but six jsdom environments could not load the pre-existing optional canvas.node binary. For the final unfiltered run, only the broken installed optional canvas package was temporarily moved out of dependency resolution, letting jsdom use its fallback, and restored immediately afterwards. No package declaration, test exclusion or application source was altered. The 3023-test result is an environment-qualified pass, not a pristine-environment pass.

The temporary learner/report used reserved QA UUIDs and example.test addresses. No invitations or emails were sent. QA records and their dependent generated plans were removed after verification.

## Security posture, not a clean-project declaration

Quick database scan and deep code scan both completed. The deep scan returned 52 findings: 32 error-level and 20 warning-level. Database checks additionally report known-leaked password protection disabled. The dependency result is older (2026-11-17), so this is not a current dependency audit. No finding was marked fixed or ignored in this step because this step adds verification coverage, not a corresponding remediation.

Four findings remain on the existing public invitation/forwarding contract:

- `lov_finding_0fd8ec2fcc83020a_368257e7`: caller-selected student recipient on public invite.
- `lov_finding_be5d16763999ee1f`: teacher email lookup binds a pending learner to an account without authenticating the inviting caller.
- `lov_finding_9cb22795933a013c` and `lov_finding_d1e4440c0a0e834d`: student-token forwarding accepts a caller-selected teacher recipient. These overlap; the implemented three-forward cap does not establish recipient ownership.

Per-teacher-email limits and a three-forward cap are present, but do not constitute verified sender identity or a global abuse limit. Changing these contracts is a separate product/security decision and was not silently introduced during closeout. Remaining project-wide findings concern Student Hub/calendar, payments, anonymous generation, learner score writes, logs and prompt inputs. The protected Worksheet Generation Engine was not changed.

Known-leaked password protection must be enabled by the owner in the external Supabase dashboard. Lovable cannot change that setting for this user-managed project. Findings remain active until genuine remediation and verification.

## Open hosted verification boundaries

- `lovable auth-session --json --self` refused session minting because this Supabase project is user-managed. Authenticated teacher claim, owned learner/test/proposal/phase readback and signup/login completion are not certified end-to-end. Synthetic HTTP auth and isolated SQL owner transitions do not prove production authenticated behavior.
- The live QA starts with an intentionally reviewed diagnostic fixture; it verifies real planner generation and persistence, not a fresh student submission and AI grading in this step. Prior steps' submission evidence remains separate.
- Inbox arrival and email-client rendering are not inspectable here; no new email-provider acceptance claim is made.
- No app publication, new migration, endpoint deployment or security-contract change was performed in step 5.