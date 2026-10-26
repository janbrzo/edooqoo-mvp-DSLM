# Public tools and Gallery references

## Purpose and scope

Adult one-to-one English tutors can move from topic guidance to the four existing free tools,
inspect real published worksheets at their original Gallery URLs, and choose a next objective
from observed teaching evidence. No learner record, private DSLM score or worksheet generation
parameter is read or changed by this public navigation.

## Public surfaces

- All four topical hubs expose `/tools` and the Next Lesson Decision Tool, retaining their
  primary specialist tool, reference pages, citation paragraph, decision table and FAQs.
- `/tools` accurately names all four tools and links back to the four topic hubs.
- `/tools`, `/esl-worksheets` and `/esl-exercise-design` show two reviewed Gallery source
  recommendations only while those slugs appear in the publication-filtered metadata list.
- Recommendations link to the original exercises. They do not reproduce exercise bodies,
  media, answer keys, raw AI JSON, teacher notes or learner identity data.
- Loading, empty and request-error states are distinct. Error state offers Retry and the
  permanent Gallery link remains available. A fresh mount checks publication again.

## Publication and privacy

Recommendations use only the existing public metadata list with anonymous public credentials,
without cookies or a teacher access token. Reads are bounded and cancelled on unmount, with
an eight-second timeout. No returned worksheet data is persisted in storage or SEO snapshots.
The prerender process marks its document before React renders and strips the marker from
the saved HTML; the public-read hook skips its request during that process.

Publication consent does not establish permission for separate promotional reproduction.
Direct exercise excerpts remain blocked until author reuse permission is confirmed and a
bounded public content read enforces `is_public=true` before any worksheet body is returned.
The existing detail RPC does not enforce this predicate; this phase does not change the
database or falsely claim to repair that separate issue.

## Next lesson links

A Gallery worksheet passes only an exact supported CEFR level. Mixed labels such as `B1/B2`
do not select either level. Level-only and source-only links prefill the form without displaying
a decision. Existing evidence-bearing shared links keep displaying their calculated result.
Changing a selection invalidates the old result, and navigation to another query updates the
form and result together. Repair, Continue and Advance rules are unchanged.

After calculating a result, tutors can open lesson planning, the Gallery, worked scenarios and
the factual DSLM feature page. Public results are not described as private DSLM assessments.

## Verification contract

Unit tests cover reviewed-source selection, metadata field exclusion, absence of invented
mastery, mixed CEFR labels and query injection rejection. Browser checks use the live public
Gallery list, open original worksheet content, pass to the decision tool and calculate a result
from selected teaching evidence. Empty and error states are exercised separately. SEO checks
must retain self canonicals, existing indexation policy and the Phase 4.1 graph thresholds.

## Deferred

Direct exercise body embedding: awaiting author reuse permission and a publication-filtered,
bounded content read. Phase 4.4 is outside this specification.