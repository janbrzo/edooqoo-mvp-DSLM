# Owner checklist after the worksheet + DSLM audit (W0-W2), 2026-10-16

**Status 2026-10-18: everything below is done** (PR 71 merged, Edge Functions deployed, `APP_BASE_URL` set, iteration 8
and W2 migrations applied, legacy revokes applied, post-release test passed). The only open item is removing cron job 3
(`send-homework-reminders-every-15min`) in the dashboard; its owner role is not changeable from SQL and it only returns
401. The steps are kept as a record.

What is already done in production (applied through the Supabase connector, verified):

- W0: `consume_token`, `mark_homework_completed`, `soft_delete_worksheet`, `get_worksheet_live_answers`,
  `save_teacher_comment`, `get_homework_comments` check the signed-in caller; token-checked variants of the AI queue and
  notification RPCs exist.
- W2 (homework): `save_homework_answer` merges answers and refuses writes to a submitted homework;
  `submit_homework_answers` keeps the first completion date.

What is only in the repository (branch `claude/zen-dijkstra-pxd4d7`, merged with `main` up to 2026-10-16):

- Frontend: retried and serialized answer saves, "Not saved yet, retrying", per-exercise answer reveal with locked inputs,
  per-blank fill-in-blanks, matching definitions fix, share modal for unassigned worksheets, planner topic and
  `last_event_at` fixes.
- Edge Functions: `send-homework-reminders` (anon key no longer accepted), `test-send-reminder` (owner or service role
  only), `send-homework-email` and `send-worksheet-email` (links from `APP_BASE_URL`), `generate-timeline`,
  `generate-curriculum-phases`, `recalculate-pacing`, plus the shared scoring modules used by
  `process-pending-ai-evaluations` and `verify-open-answers`.

## Steps for you, in this order

1. **Merge the branch into `main`** (open a pull request from `claude/zen-dijkstra-pxd4d7`; the merge with `main` is
   already done and 942 tests pass). Lovable then builds the frontend.
2. **Apply the iteration 8 migrations that are still pending**, exactly as `iteration-8-rollout.md` says (step 1 list;
   `20261015090400_homework_ai_queue_and_worksheet_save.sql` is required by the next item). Check what is missing with
   `select max(version) from supabase_migrations.schema_migrations;` (production currently ends at 20261016080031) and
   `select to_regprocedure('public.worksheet_answers_differ(jsonb, jsonb)');` (NULL = iteration 8 step 3 not applied).
3. **Apply `supabase/migrations/20261016110000_w2_merge_answers_on_save.sql`** right after iteration 8 step 3
   (Supabase CLI, psql or the MCP connector; it contains `SELECT ... INTO`, so not the SQL Editor paste). It refuses to run
   earlier.
4. **Deploy the Edge Functions** listed above together with the iteration 8 ones (`process-pending-ai-evaluations`,
   `process-welcome-test`, `transcribe-audio`, `verify-open-answers`).
   - Make sure the `APP_BASE_URL` secret is set (emails fall back to `https://edooqoo.com`).
   - Cron: `select jobname, command ilike '%x-cron-secret%' as has_secret from cron.job;` must be true for every job that
     calls `send-homework-reminders`. Job 3 (`send-homework-reminders-every-15min`) has no secret and returns 401 every
     15 minutes; remove it in the dashboard (Integrations > Cron), the role that owns it cannot be changed from SQL.
5. **One day after the release** apply `20261017090100_w0_revoke_legacy_queue_and_notification_rpcs.sql` (revokes the
   anon-callable `queue_worksheet_ai_evaluation`, `needs_ai_evaluation`, `insert_homework_submission_notification`).
   Then apply the old pending revokes if still open: `20261012200100_revoke_legacy_student_answer_rpcs.sql` and
   `20261014090100_revoke_legacy_submit_homework.sql` (check:
   `select proname, has_function_privilege('anon', oid, 'execute') from pg_proc where pronamespace='public'::regnamespace and proname in ('save_worksheet_answer','get_worksheet_student_answers','save_homework_answer','get_student_homework_answers','submit_homework_answers');`
   all false).

## Quick manual test after the release (5 minutes, test account)

1. Open a student worksheet link in a private window, answer two exercises in two tabs: both answers must survive a
   reload.
2. Switch the network off in the student tab, type, switch it on: the badge says "Not saved yet, retrying..." and then
   "Saved".
3. Do a fill-in-blanks sentence with two blanks: each blank keeps its own answer after a reload.
4. Submit a homework, then open it as the teacher and click into an exercise: the student's answers stay unchanged.
5. Teacher dashboard: mark a homework as completed, open the review page (comments load), delete and restore a worksheet.

## Not done yet (needs a decision or a larger change)

- W3: stable exercise ids; until then a regenerated, reordered or deleted exercise keeps the old answers and the student
  still sees exercises the teacher deleted.
- Generation client fixes (errors never shown, duplicate silent retry, stale suggestion id, server-side token charge needs
  the literal instruction "update the Worksheet Generation Engine").
- Editor fixes (Discard does not revert, regenerate overwrites parallel edits, autosave loses the last 2.5 s).
- Welcome Test question keys and validation loop (see `docs/research` plan in the session notes).
