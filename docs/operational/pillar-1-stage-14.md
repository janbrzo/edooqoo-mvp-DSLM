# Pillar 1, Stage 1.4: Unit Test Package and Zero-Regression Baseline

Status: implemented 2026-10-17. Scope: tests and documentation only; no production
code, no migration, no Worksheet Generation Engine change.

## Goal

Freeze the invariants delivered by Stages 1.1-1.3 so any future change that breaks
them fails in `vitest` before it reaches production.

## What was added

### 1. `src/lib/__tests__/dslmSqlBaseline.test.ts` (extended)

Three new describe blocks asserting the SQL contracts of each stage against the
migration files:

- **Pillar 1.1** (`20261015201345`): the migration is the latest
  `extract_micro_skill` definition and stays additive (v1 rules kept in order).
- **Pillar 1.2** (`20261016074048`): `trg_normalize_student_event_ratings` fires
  BEFORE INSERT OR UPDATE OF event_payload, mastery, skill_ids on
  `student_events` and rewrites `nano_skill_ratings` through
  `normalize_dslm_ratings`; the normalizer, the trigger function,
  `knowledge_entry_dslm_ratings` and `log_knowledge_entry_event` are all revoked
  from PUBLIC/anon/authenticated and granted to service_role only; the knowledge
  classification trigger re-logs the DSLM event on category/content/tags changes.
- **Pillar 1.3** (`20261017134759` plus the same-day rounding-parity follow-ups
  `20261017134848` and `20261017135037`): assertions run against the latest
  definition of `dslm_effective_mastery` and `get_student_dslm_state_vector`,
  which must keep the contract; the vector
  pins one read timestamp via `statement_timestamp()`, excludes `flashcard:%`
  metrics, returns the version 1 contract (`strongest_skills`, `critical_gaps`,
  `decaying_skills`, `recommended_focus`), is revoked from PUBLIC/anon and
  granted to authenticated + service_role, and contains no INSERT/UPDATE/DELETE
  on `student_skill_metrics` (read-only guarantee).

### 2. `src/lib/__tests__/pillar1Baseline.test.ts` (new)

Cross-cutting TypeScript and TS<->SQL parity invariants:

- **Unevaluated sentinel**: `aiEvaluationMapper.ts` maps a missing or non-finite
  `quality_score` to -1 and never to a fabricated fallback (`|| 0.7` is banned);
  unmapped questions keep `quality_score: -1`.
- **Forgetting constants**: `FORGETTING_GRACE_DAYS = 14`,
  `FORGETTING_HALF_LIFE_DAYS = 60`, `FORGETTING_FLOOR = 0.5` in
  `supabase/functions/_shared/forgetting.ts`, and the same constants appear in
  the SQL decay helper; `withEffectiveMastery` preserves `raw_mastery` and never
  writes back; grace period, null and unparseable dates leave the stored value
  untouched.
- **Read-only state vector**: no file in `src/` calls
  `get_student_dslm_state_vector` yet (guard to be replaced by a usage allowlist
  when a UI consumer lands); no migration overwrites
  `student_skill_metrics.current_mastery` with a decayed value (decision D9:
  decay applies at read time only).
- **Event boundary coverage**: no migration after `20261016074048` drops
  `trg_normalize_student_event_ratings`.

## Verification

- `bun run test` (vitest): full suite green, including the new baseline files.
- No production file, prompt, or migration was modified.

## Out of scope (noted, not fixed)

- Production student reads of the state vector and the <15 ms latency target
  remain unverified (external Supabase, no authorized test session) — carried
  over from Stage 1.3.
- Pre-existing database security warnings (145) unrelated to this pillar.
