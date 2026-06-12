---
name: Welcome Test v6.9.56 Martha audit
description: Pedagogical rewrites + renumeration wt_q01..58 + IDK as pedagogical signal + integrity layer + i18n update for 8 changed questions across 10 languages
type: feature
---

# Welcome Test v6.9.56 — Martha Audit (in progress)

Multi-wave implementation. Status as of Wave 1.

## Decisions locked

- Q23 (hotel writing) STAYS — travel context is popular among learners. Only Q24 (speaking) becomes an independent pronunciation prompt to remove duplication.
- IDK promoted from "ignored" to pedagogical signal. New columns on `student_learning_profiles`: `idk_count_total`, `idk_count_skill`, `self_awareness_score`.
- Full renumeration `wt_q1..wt_q45 + wt_q3b..wt_q41s` → `wt_q01..wt_q58` (display order). Legacy IDs kept via `LEGACY_TO_CANONICAL` in `src/utils/welcomeTestNumbering.ts` to preserve historical answer snapshots.
- Skill questions (grammar/vocab/reading/listening) remain English-only across all locales (existing rule in `welcomeTestTranslations.ts`).
- Worksheet engine feedback (mobile UX, color, grammar position, A2-B1 fit, always-2-reading) DEFERRED — requires explicit "update Worksheet Generation Engine" instruction (Sanctity rule).

## Critical implementation gate

`supabase/functions/process-welcome-test/index.ts` reconstructs traits via **literal option-text matching** in `TRAIT_QUESTIONS` (~lines 405-600). Any wording change to options on q01/q03/q06/q07/q21/q22 (new IDs) MUST be mirrored verbatim in this map, or trait reconstruction silently breaks and `student_learning_profiles` rows are left with NULL traits.

## Wave plan

- **Wave 1 (done)**: Modal scroll fix (max-w 1080, list cap 46vh, padding tweaks). DB migration adding 3 IDK columns. Memory + RAG scaffolding.
- **Wave 2 (pending)**: Renumeration wt_q01..58 across `welcomeTestQuestions.ts` + `welcomeTestTranslations.ts` (10 langs, key-only) + `process-welcome-test/index.ts` (TRAIT_QUESTIONS questionIds × 17 + hardcoded id arrays) + `welcomeTestNumbering.ts` LEGACY map. Content rewrites for q01/q02/q03/q06/q07/q21/q22 (A1-A2 simplification), q24 (pronunciation prompt), q27 (reading dialog, answer hidden past line 1), q29 (listening, new transcript + TTS audio), q35 (grammar clean distractors). TRAIT_QUESTIONS option-text sync for the 6 trait-mapped questions.
- **Wave 3 (pending)**: IDK signal aggregation in edge function + AI summary prompt update. Universal IDK button visibility + first-use Popover hint + intro banner copy. `useWelcomeTestIntegrity` hook (tab_blur logging to `student_events`, paste block on open-ended). Retranslation of 8 question contents across 10 locales via Lovable AI Gateway. Audio TTS generation for q29.

## Anti-regression guardrails

- Legacy answer IDs stored in `student_events.event_payload.answer_id` and `student_test_questions.question_id` MUST still resolve. `toCanonicalId()` becomes the only allowed reader.
- TTS file for q29 uses a new R2 key — old `welcome-test-listening-1771235244954.mp3` stays for historical snapshots.
- Trait map update is atomic with content edit per question (same commit).