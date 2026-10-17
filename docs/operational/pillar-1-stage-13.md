# Pillar 1, Stage 1.3: Student State Vector

## Affected surface and root cause

Canonical metrics exist, but modules have no bounded, authorized read contract for a student's strongest areas, gaps and review needs. The affected surface is two new public SQL functions, their migrations, SQL integration tests and architecture documentation. Existing producers, metric recomputation, profile fields, worksheet generation, Prep, dashboard and lesson ordering are unchanged.

## Options and selection

| Approach | Tradeoff | Regression risk |
| --- | --- | --- |
| Stored vector refreshed by triggers | Adds writes and can become stale as mastery decays without activity | Higher |
| Authorized read-time RPC over canonical metrics | Small aggregation cost; uses existing indexed student/teacher reads | Low, additive |

Selected: the approved read-time RPC. It uses SECURITY INVOKER plus explicit caller and student ownership checks, preserving RLS. No new table, elevated definer access or advisory locks are needed for a read-only query.

## Version 1 contract

- Input: `p_student_id uuid`, `p_teacher_id uuid`; null inputs fail with 22023. Forbidden, nonexistent, mismatched and soft-deleted students fail with the same 42501 response.
- Access: authenticated owning teacher or service role, with a real active student/teacher pair. Both SQL functions revoke PUBLIC/anon execution and grant only authenticated/service_role.
- Output: `version: 1`, `student_id`, `teacher_id`, `as_of`, `skill_count`, `strongest_skills`, `critical_gaps`, `decaying_skills`, `recommended_focus`.
- Empty successful read: zero skills, empty arrays and null focus. Authorization/read errors are errors, never fabricated empty state.
- Sources: canonical `student_skill_metrics` only. No event scan, personal notes, psychological traits, emails, answers or tokens. SQL aggregation has no PostgREST 1000-row response limit.
- Valid evidence: raw mastery 0-100 and positive event count. Null, negative sentinel, nonfinite and out-of-range scores do not become failing skills. Real zero remains zero. `flashcard:*` card metrics are excluded because word evidence is already represented separately.
- Effective mastery: elapsed 24-hour periods, 14-day grace, 60-day half-life, 50% relative floor, rounding/clamping identical to `forgetting.ts`. The SQL helper is a tested database equivalent, not a new policy. Missing dates preserve raw values. A single `statement_timestamp()` anchors the whole read. Stored scores are never overwritten.
- Group identity: `(skill_category, micro_skill)`; legacy missing/empty/other/flashcard micro keys fall back to category without renaming stored identifiers. Group score is the unweighted average of valid nano scores, rounded once to one decimal. `skill_observation_count` is a sum of per-skill counts, not unique lesson/event count.
- `strongest_skills`: up to five micro groups with effective average strictly >80, descending effective score, then category and micro key.
- `critical_gaps`: up to five groups with effective average strictly <50, at least one declining skill supported by >=4 observations, or raw average >80 fallen to effective <=80. Ascending effective score, category and micro key. Declining means a measured per-skill trend, not a newly inferred group trend.
- `decaying_skills`: up to five previously strong groups (raw average >80) whose latest evidence is strictly older than 30 elapsed days, ascending effective score and stable lexical ties. This is a bounded priority list, not a complete stale-skill export.
- `recommended_focus`: lowest-effective existing nano in selected gap groups before selected review groups; tie by skill name; reason `critical_gap` or `spaced_review`. No random focus if neither set exists. This is evidence-based focus, not a replacement for the teacher's queued lesson, active goals or `orderUpNext`.
- Existing `(student_id, teacher_id)` and micro-key indexes are reused. An index on stored mastery would not eliminate sorting by time-dependent effective mastery.

## Verification and limits

`src/lib/__tests__/dslmStateVector.test.ts` runs the actual newest SQL functions in a temporary PostgreSQL cluster with authenticated/anon/service roles and RLS. Coverage includes real zero versus missing scores, top-five bounds, strict 80/50/30-day boundaries, unweighted micro averages, category-key isolation, fractional/grace/floor decay parity, null focus, >1000 rows, denied cross-tenant/anonymous/deleted access, service pair validation and no score writes. PostgreSQL integration cases require local PostgreSQL binaries (auto-discovered in this sandbox, configurable with DSLM_TEST_PG_BIN elsewhere); runners without them skip these cases rather than claiming SQL execution.

Production migrations succeeded. A read-only production catalog probe confirms SECURITY INVOKER, fixed search_path and authenticated/service_role-only execution. The connected query tool is supabase_read_only_user and cannot execute the RPC; production student-data reads, authenticated browser flows and the <15 ms production latency target remain unverified. No service credentials were requested merely for testing. Local integration results do not establish production latency or a successful real lesson.

Final verification: 80 test files and 1056 tests passed, including 11 actual PostgreSQL cases plus the static state-vector contract case. SEO asset audit passed and preview build logs reported build OK. Independent review identified fresh fractional-score rounding drift; the follow-up migration fixed it and new parity cases pass. No production student data was changed for testing.

No UI change is part of this stage. Prep/dashboard integration and whole-pillar validation remain separate work. Existing 145 database security findings predate this migration and are outside scope. public/llms.txt stays unchanged because this internal read contract is not a new public product capability.