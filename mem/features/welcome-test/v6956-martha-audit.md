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
- **Wave 2A (done)**: Canonical analytics IDs zero-padded `wt_q01..wt_q58` in `welcomeTestNumbering.ts` (legacy non-padded `wt_qN` still resolves via back-compat entries). A1-A2 content simplification for q1/q3/q6/q7 (option text). Skill description hints added to q21/q22 (does not affect correct_answer). q16s rewritten as fully independent speaking prompt (no longer "now describe the same thing"). q18 replaced with software-account dialog where the answer is hidden past line 1 (option phrasing forces inference). q18l replaced with restaurant booking transcript + new question/options; **audio file pending regeneration in Wave 3** (UI still falls back to transcript). q35 distractors cleaned (consistent body-part idiom shape). `TRAIT_QUESTIONS` option strings in `process-welcome-test/index.ts` resynced for q1/q3/q7 — verbatim mirror, trait reconstruction preserved. PL translations updated for q1/q3/q6/q7.
- **Wave 2B (pending)**: Storage-level rename of `id` field on every question definition + translation keys + edge-function hardcoded IDs to padded `wt_q01..wt_q58`. Deferred — UI already renders sequential display numbers from array index, and rename carries high regression risk on historical `student_test_questions.question_id` / `student_events.event_payload.answer_id` rows.
- **Wave 3 (pending)**: IDK signal aggregation in edge function + AI summary prompt update. Universal IDK button visibility + first-use Popover hint + intro banner copy. `useWelcomeTestIntegrity` hook (tab_blur logging to `student_events`, paste block on open-ended). Retranslation of 8 question contents across 10 locales via Lovable AI Gateway. Audio TTS generation for q29.

## Anti-regression guardrails

- Legacy answer IDs stored in `student_events.event_payload.answer_id` and `student_test_questions.question_id` MUST still resolve. `toCanonicalId()` becomes the only allowed reader.
- TTS file for q29 uses a new R2 key — old `welcome-test-listening-1771235244954.mp3` stays for historical snapshots.
- Trait map update is atomic with content edit per question (same commit).