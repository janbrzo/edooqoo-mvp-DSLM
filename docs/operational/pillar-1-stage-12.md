# Pillar 1, Stage 1.2: Unified Event Evidence

## Affected surface and root cause

The existing worksheet/homework answer triggers and Mark done RPC already feed student_events and the v3 metric engine. Flashcards had a word skill_id but only produced card-level metrics. Knowledge events were insert-only and lacked nano_skill_ratings, so later classification never became metric evidence.

## Options and selected solution

| Approach | Tradeoff | Regression risk |
| --- | --- | --- |
| Rewrite every producer and duplicate validation in each hook/function | Many changes, greater drift, changes established save semantics | High |
| Normalize at the event boundary; add missing flashcard/knowledge evidence | One internal adapter, existing authorization and scorers retained | Lower |

Selected: the boundary adapter. It is additive for valid current ratings and does not alter the protected generation engine, metric formula, locks or teacher override logic.

## Data contracts

- Ratings remain an array of objects with name, mastery and hasValue. Additional provenance fields survive normalization.
- Numeric mastery 0-100 is valid, including real zero; missing, nonnumeric, out-of-range, or explicitly unevaluated values become -1/false. Empty names are discarded. No automatic 0-1 rescaling is attempted.
- Flashcard reviews retain the established outcome (100 recalled, 0 not recalled) and direction weighting (0.70/1.0/1.1 capped at 100). The earlier plan's Again=20 and unconditional success=100 would change accepted scoring; they are not applied. Word-level evidence is added alongside the existing card metric, not counted twice in one metric.
- Knowledge notes retain one original event. Classification updates that event, not its timestamp or event count. Only an explicit Skill Assessment with a skill and numeric score becomes evidence. AI confidence must meet the existing 0.6 gate. Plain Notes, personal context and subtype alone never invent mastery.
- Free-text skills are mapped to ns.{element_type}.{slug}; existing ns.* identifiers remain intact. This is deterministic normalization, not semantic equivalence with every generated item skill.
- Marking a note outdated or soft-deleting it clears ratings and recomputes old skill metrics through the existing UPDATE trigger. Archiving for lesson prep does not erase learning evidence.
- No historical backfill is run. Existing scores remain untouched until a genuine future update to their source.

## Authorization and compatibility

No tables, RLS policies or caller authorizations are widened. New helper execution is revoked from public/anon/authenticated and granted only to service_role. Existing SECURITY DEFINER triggers use fixed public search_path. Worksheet/homework save behavior and Mark done supersession remain unchanged.

## Additional missing-score guards

Canonical AI payload and legacy display mappers return -1 instead of a fabricated zero when quality/mastery is missing. Real zero is preserved. This does not change normal upstream model results.

## Verification and limits

Regression coverage: dslmEventBoundary.test.ts plus the existing dslmSqlBaseline and scoreToMastery suites; full suite: 869 tests passed across 64 files. Isolated PostgreSQL tests exercise classification update, no duplicate event, preserved date, outdated/delete metric removal, flashcard word evidence and invalid ratings with the actual v3 consumers. Production deployment succeeded; a read-only helper probe was denied because helper execution is intentionally restricted. No production data was modified for testing.

Authenticated browser end-to-end verification is unavailable for this externally managed Supabase project. This limitation is not equivalent to passing a real lesson. Stage 1.3 and 1.4 require separate requests.

## Out of scope

Existing 142 security lint findings, legacy display threshold differences, dormant track-student-event consumers, generated skill-name fragmentation, provider prompt changes and automatic state-vector consumers are not changed here. public/llms.txt remains unchanged because internal pipeline changes are not public release notes.