---
name: DSLM evaluation pipeline audit and fix plan
description: 2026-10-11 real-account audit of AI evaluation + DSLM data flow, owner decisions D1-D7, and the iteration plan (iterations 1-5 shipped in v6.9.115-v6.9.119).
type: feature
---
- Audit (16 agents, cross-checked, read-only SQL + live tests on the test teacher account): closed items reach AI on every path but AI only explains; DSLM mastery stays key-based. Four closed scorers exist (shared itemMastery, Mark done modal 80/30/50, Welcome Test string equality, legacy). The event/metric SQL lived only in production.
- Owner decisions (2026-10-12, all accepted as recommended):
  - D1 typed closed items: AI may only RAISE a key `wrong`/`review` verdict (is_acceptable, score >= 0.85 -> mastery 85-95, `source: ai_alternative`, teacher can revert); never lowers; selection items (MC, T/F, matching, categorize, odd-one-out) always by key.
  - D2 Mark done is a teacher override that supersedes the student's event for that exercise, on the 0-100 scale prefilled from the key.
  - D3 Learning Path Score is INTENSITY (phase count/length, homework load), a separate dimension from the scientific-pragmatic style slider; one shared pacing function.
  - D4 urgent deadline wins over style, but intensity is capped by declared capacity and the teacher sees an "unrealistic goal" warning.
  - D5 Welcome Test CEFR scoring unchanged; skip count, coverage and avoidance vs honest IDK are stored for the profile; button wording fixed.
  - D6 Welcome Test fill_blank uses matchAnswer for NEW tests only (old results untouched).
  - D7 one-off backfill with a before/after audit table.
- Welcome Test is also a psychological instrument (owner): any fix to WT answer recording or mastery must not change the inputs of the profile analysis (answers, traits, Learning Path Score); every WT change needs a profile regression test.
- Iteration 1 (v6.9.115): SQL baseline, evaluation endpoint access, token RPCs, prompt-injection cap, scoreToMastery, homework submit stale answers, WT email + raw_answers merge. Deliberately NOT done: COALESCE in save_homework_answer (would keep a stale closed mastery after the student clears an answer).
- Iteration 2 (v6.9.116): triggers keep teacher events and skip unchanged rows, metrics on UPDATE/DELETE, Mark done RPCs, verify-open-answers id mapping + retry + partial results, process-pending never overwrites with nothing, Welcome Test event lookup fixed and no 25 fallback. Verified on a local Postgres 16 with the production bodies and on production REST (the new Welcome Test filter returns exactly one event where the old one returned two).
- Remaining iterations: (2, done) answer triggers delete only own event types and skip unchanged rows, metric trigger on UPDATE/DELETE, verify-open-answers id mapping + allSettled + no fabricated 0.7, WT legacy-id collision, Mark done RPCs (no teacher UPDATE/DELETE RLS on student_events); (3) queue claim/retry/cron, server-side enqueue for shared worksheets; (4) one verdict policy (D1, D2); (5) WT profile + pacing (recalculate-pacing queries non-existent columns); (6) backfill; then revoke legacy answer RPCs from anon.
- Known: `test_answer_skipped` events never appear because anonymous WT pages cannot call add_student_event (see skip-idk-semantics); fix with the share-token RPC in the WT iteration.
- Iteration 3 (v6.9.117): queue claim/retry/stale recovery, scheduled stale-answer queueing, evaluation of stored answers, parallel processing, 202 for students. Homework AI failures are NOT queued (no homework queue table); handled when homework scoring moves to the shared module (iteration 4).
- Iteration 4 (v6.9.118): D1 (aiAlternativeMastery) in homework submit and the queue; Mark done prefill from the shared scorer (100/0, neutral 50 only when the key cannot decide) and D2 supersession in compute_skill_metric (per exercise AND skill, so every recompute stays exact); one open/closed type list (word-formation is not generated, left unclassified); real learner level; flashcard first reviews logged (app quality scale is 0 = Again / 2 = I know this, not SM-2 0-5) with review-outcome mastery; NextSteps banner on orderUpNext; homework AI one retry. A homework answer whose AI call still fails is NOT re-evaluated server-side yet (no homework queue): candidate for iteration 7.
- Iteration 5 (v6.9.119): Welcome Test profile v2 (typed traits, LPS v2 with null-not-50, coverage and capacity cap per D4, deterministic divergences explained by the AI, answer behaviour, profile versions), S3 enabled (WT AI scores update metrics), Apply-results re-run fixed (real question ids, no null overwrite, owner-only), one pacing function with intensity separate from style (D3), D5 copy, D6 matchAnswer for new WT fill_blank answers. Not done: backfill of v2 columns for old profiles (iteration 6, with the audit table); v1 profiles show their old learning path with a note.
- Owner decisions after iteration 5 (2026-10-12): Welcome Test grammar fill_blank is strict (a wrong form such as "gos" is wrong; vocabulary keeps matchAnswer); prompt-time pacing counts the stored value as set whenever last_pacing_set_manually is true/false (accepting a proposal writes false), the auto rule only when nobody set it.
- pg_cron job (run once in the SQL editor after migration 20261012140000; replace the secret with the current CRON_SECRET, and update it together with the reminder and audit jobs when the secret is rotated):
  ```sql
  select cron.schedule('process-ai-evaluations-5min', '*/5 * * * *', $$
    select net.http_post(
      url := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/process-pending-ai-evaluations',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$);
  ```
  First run queues at most 20 stale rows per tick (saved within the last 7 days), so the backlog is drained gradually and AI cost stays bounded.
