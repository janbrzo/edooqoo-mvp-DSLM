# Explainable DSLM

## Scope

Stage 2.1 provides deterministic supporting evidence. Stage 2.2 surfaces it in the teacher's Prep next-lesson card, the Learning plan featured lesson and the applied worksheet preset. Stage 2.3 adds the competency radar to the Insights Skills section: a two-layer chart (stored mastery vs estimated retention) with four zones (critical gap, retention alert, mastered, in progress) and a manual "Add to next lesson" prefill for skills needing attention. Stage 2.4 locks the contracts with `pillar2Baseline.test.ts`.

## Evidence contract

- Use the exact active suggestion ID and current learner/teacher scope, never a matching topic or the first carousel item.
- Skill evidence comes only from that suggestion's focus_skill_names and raw metrics. The shared forgetting curve derives estimated retention at read time. Missing raw scores are not zero.
- Current signals support the suggestion; they do not prove an AI model's internal reasoning. Generated rationale is labeled "Suggested rationale" separately from source facts.
- Phase membership can support a planned-step label. Existing records do not establish explicit goal, note or diagnostic source links, so Stage 2.2 does not invent those badges from generation counts or prose.
- No lesson selection, worksheet prompt, model call, generation request or persistent mastery changes.

## Presentation

"Why This Lesson?" shows a concise supporting reason, one evidence badge and "Show evidence breakdown". One disclosure level exposes source observations, stored mastery, estimated retention and practice age. No percentage match or confidence score is introduced.

The carousel keeps its existing ordering, apply/edit actions and navigation. Each chip may show a compact evidence badge. A full panel appears only after an exact matching preset is applied, including manual Prefill from Prep/Plan. Generic form requests do not get a passport.

No linked evidence: state this explicitly, without inventing a pedagogical reason. Metric load: local skeleton, not a disabled generation button. Metric failure: unavailable state and Retry; no stale numerical evidence displayed. Demo: no metric calls or extra evidence panel.

## Lifecycle and privacy

- Changing learner clears the local applied source. Editing the topic, goal, grammar focus or additional information hides the applied explanation unless it still matches the source.
- Removing, teaching or changing the source suggestion invalidates its explanation. Worksheet generation success clears only the display state, preserving the existing marking-used flow.
- Stored suggestion IDs are pointers, not evidence snapshots. Revalidate against current rows and scope before displaying.
- Panels stay within the teacher's access boundary. Private notes, diagnostic answers and evidence snapshots are not exported, persisted or added to public pages.

## Verification limits

Unit tests cover exact selection, learner/teacher scope, edits and lifecycle invalidation, unknown mastery and shared decay facts. Browser fixture checks validate controls and layout but do not certify a signed-in production flow. Authenticated end-to-end testing is unavailable with the project's external unmanaged Supabase connection.