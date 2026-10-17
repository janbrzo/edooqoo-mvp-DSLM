---
name: Welcome Test server authority, evidence gate and profile validation
description: 2026-10-17 audit decisions. Server grades, retakes supersede (not delete), no level without evidence, interpretation versioning, teacher signal feedback, first WT pacing auto-applied.
type: feature
---
Owner decisions (2026-10-17, audit of the Welcome Test end to end):
1. Retake history: a completed retake marks older attempts' `student_events` with `superseded_at` / `superseded_by`; metrics ignore them, history and attempt-to-attempt trends keep them. Never delete WT evidence.
2. No level without evidence: level algorithm v3 needs >= 8 scored keyed items, >= 5 real answers (not "I don't know") and >= 2 scored skills. Otherwise `estimated_level` is null, `raw_answers.level_evidence.status = 'insufficient'`, the student level is not auto-filled and the teacher sees "Not enough answers to estimate a level".
3. Skill ratings are no longer copied to `student_learning_elements` (unused since 2025-12); the "Results applied" card is gone. Skill evidence reaches DSLM through answer events.
4. New question bank / adaptive test comes after the repair stages (not started).
5. The first Welcome Test pacing proposal is applied automatically when the teacher never set pacing (`welcome_test_initial_auto`, undo available); later retakes keep the approval flow.

How it works now:
- The browser verdict is provisional. `process-welcome-test` rebuilds answers from `student_test_questions`, re-grades keyed rows (`_shared/welcomeTestKeyedAnswer.ts`, same code the browser uses) and runs `calculate_test_results` (scores over scored items only). `get_test_questions_by_share_token` hides `correct_answer`; `save_test_answer_by_share_token` refuses closed, expired or unknown questions and returns false.
- The student gets "completed" right after the server accepts (202); analysis runs in the background. Status `completed` = analysing, `reviewed` = done (set only after the AI step).
- Open and speaking items keep a 0-100 `question_data.ai_score`, never a pass/fail `is_correct`; writing/speaking `test_skill_results` come from AI averages.
- Traits: interpretation v2 (q7 "very frustrated with myself" -> medium anxiety, q4 "ask to repeat" -> medium ambiguity tolerance), stamped `__interpretation_version__`, with `trait_evidence` per trait. LPS v3 separates need from capacity; declared urgency never lifts the path above low capacity (`capacity_warning: unrealistic_goal`).
- Validation loop: `wt_signal_feedback` stores the teacher's Agree / Partly / Disagree per trait, divergence and learning-path band (ask after 2-4 lessons). Change an interpretation only with n >= 30 per signal, as a new version replayed on stored `raw_answers`.

HOW TO APPLY: never trust a client `is_correct` or client `answers` for scoring; never re-introduce writes to `student_learning_elements`; bump `INTERPRETATION_VERSION` / `LEVEL_ALGORITHM_VERSION` / LPS version for any mapping or threshold change.
