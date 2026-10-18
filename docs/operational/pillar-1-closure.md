# Pillar 1 closure: taxonomy documentation and service-only access

## Scope and root cause

The three-tier taxonomy and read-only state contract were implemented but not
fully recorded in persistent product memory. Five internal tables have RLS but
no explicit policies. Production `consume_newsletter_rate_limit(text, text,
integer, integer)` is executable by client roles despite the original migration
granting it only to the service role. The two previously cited cleanup functions
and `add_student_event_internal` are already service-only in production.

Affected surface: root/scoped AGENTS rules, DSLM project memory, the existing
DSLM section in `docs/llm-context.md`, operational specifications, roadmap,
explicit policies and grants on five internal tables, the newsletter rate-limit
function's execution privileges, and isolated PostgreSQL regression coverage.
No worksheet generation code, prompts, student ratings, UI or public API
contracts are changed. `public/llms.txt` and root `llms.txt` remain untouched.

## Options and selected approach

| Approach | Tradeoff | Regression risk |
| --- | --- | --- |
| Revoke all client SECURITY DEFINER execution | Reduces alerts but breaks intentional token-authorized student and teacher RPCs | High |
| Explicit service-only table/function allowlist | Changes only verified internal access, leaves intentional public endpoints intact | Low |

Selected: the explicit allowlist, cross-checked against source callers and the
production catalog. Five `service_role`-only policies express existing closed
client access. Client table grants are revoked, service CRUD grants preserved.
Only the verified internal newsletter limiter needs a new execution restriction;
already-closed cleanup function permissions are verified and left unchanged.
No blanket revocation is authorized by this closure.

## Taxonomy and documentation

- Three levels: `skill_category -> micro_skill -> skill_name`.
- Existing real-topic classifications remain stable. Taxonomy backfills move
  fallback topics only and never alter saved mastery.
- Product decisions are stored at `mem://dslm/three-tier-nano-skill-taxonomy`.
- Technical classification rules belong in root `AGENTS.md`; service-only
  access rules belong in scoped `supabase/AGENTS.md`.
- The existing Digital Student Learning Model and One Minute Prep section is
  extended in place, preserving its anchor and PROBLEM/SOLUTION/MECHANICS/RAG
  format. No release notes are inserted into generated AI discovery files.

## Production evidence and limitations

2026-10-18 catalog checks confirm:

- Query role: `supabase_read_only_user`, which cannot execute the state-vector
  RPC. `anon` cannot execute it; `authenticated` and `service_role` can.
- The RPC remains SECURITY INVOKER; student RLS restricts the teacher to their
  own students, and metric reads match `teacher_id` to `auth.uid()`.
- Existing indexes include `idx_ssm_student_teacher(student_id, teacher_id)`
  and `idx_skill_metrics_micro_skill(student_id, teacher_id, micro_skill)`.
- Initial linter: 145 findings (5 missing-policy information findings, 54 anon
  definer warnings, 83 authenticated definer warnings, 3 hosted-setting warnings).
- The previous chat reported single database timings of 4.1 ms for 134 metrics
  and 15.8 ms for 477 metrics. No raw measurement artifact is available here;
  these are reported samples, not a reproduced production RPC benchmark. The
  heavy sample exceeds 15 ms. A denied read-only role is not proof of correct
  owning-teacher access or cross-tenant authorization by itself.

Therefore production RPC execution time across the workload, p95, HTTP latency
and authenticated lesson flows are not certified. Local SQL authorization and
decay tests do not substitute for those checks. No privileged credentials or
temporary production execution grant are requested merely to benchmark.

### Remaining production benchmark procedure

1. Use an existing authorized operational connection or owning-teacher session.
2. Read the actual RPC for an empty, typical and highest-metric active student;
   retain anonymized workload size, role, UTC time and database version only.
3. Measure first call separately, then at least 30 warm calls per workload;
   report median, p95 and maximum database execution time. Verify version 1,
   bounds, teacher/student scoping and unchanged stored mastery.
4. Measure authenticated HTTP round trips separately. Do not describe database
   execution as end-to-end latency or set a global <15 ms PASS from one sample.
5. If any agreed workload misses the target, examine actual query plans before
   proposing an additive index/query optimization. No benchmark-only production
   permission relaxation or generation-engine change is permitted.

## Deferred hosted configuration

OTP expiry, leaked-password protection and PostgreSQL patches require a hosted
settings read and an appropriate operational change path. A version upgrade
also requires a maintenance-window decision. No SQL change to reserved schemas
or speculative authentication setting modification is included.

## Verification

Baseline before migration: 81 test files, 1074 tests passed. Final migration
catalog, linter and regression results are recorded below after execution.
Remaining intentional or unaudited SECURITY DEFINER warnings are not represented
as repaired or automatically classified as safe.

- Applied migration: `20261018082946_f70f80f4-6caa-45ef-a5ac-cbd580b6a0a5.sql`.
- Production readback: all five tables retain RLS, one service-only policy, no
  anon/authenticated read grants and service CRUD. Limiter execution is false
  for anon/authenticated, true for service_role. State-vector and already-private
  helper execution privileges are unchanged.
- Fresh linter: 138 findings, down by seven (five policy information findings
  and two limiter warnings). No migration-related findings were introduced.
- Remaining: 53 anonymous and 82 authenticated definer warnings need individual
  contract review; three hosted-setting warnings require the operational actions
  described above. They are not 138 proven vulnerabilities.
- Regression coverage executes the actual closure SQL in isolated PostgreSQL:
  one test per internal table checks denied client reads/truncation and preserved
  service CRUD; a limiter test checks denied client execution and retained service
  execution. Existing vector authorization/read-only tests run after the migration.
  The limiter's minimal test body isolates ACL behavior, not live email delivery.