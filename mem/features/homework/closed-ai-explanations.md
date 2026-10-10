---
name: Closed exercise AI explanations
description: All closed exercises get AI rule explanations; score stays by answer key
type: feature
---
- Closed exercises (ABCD, T/F, matching, blanks, etc.) receive AI feedback explaining the rule, max ~30 words, adult tone.
- Right/wrong and mastery come from the answer key, never from AI.
- Valid typed alternatives (synonyms) are acknowledged as acceptable.
- The key verdict (correct, wrong or review) is computed once by `calculateItemMastery` and returned as `key_verdict`; the AI input and DSLM use the same verdict.
- The AI never lowers a key-correct score and never reveals answers on shared worksheets.
- Explanations are shown through the `ClosedAiExplanations` component (homework, shared worksheet, live session teacher view, Homework Review).
- Students see an "AI explanations" box under closed exercises after submission.
- Create Homework after live session and worksheet "Mark done" are covered by the same path.
