# W0 rollout (caller checks on SECURITY DEFINER functions, token-checked queue RPCs)

**Status 2026-10-16: step 1 (the four migrations) is APPLIED in production and verified** (foreign user gets 42501 on
consume_token, mark_homework_completed and soft_delete_worksheet, gets no rows from get_worksheet_live_answers; the owner
keeps full access). **Status 2026-10-18: all steps are done.** The release (PR 71) is live, `APP_BASE_URL` is set, and
`20261017090100` (revoke of the legacy queue and notification RPCs) is applied; the legacy answer RPCs were already
revoked. Only cron job 3 is left to remove by hand (see step 2).

Order matters: step 1 is backward compatible with the current client; step 3 waits a day after the release.
Run each step as its own query in the Supabase SQL Editor (see the editor limits in `iteration-7-rollout.md`: the
editor cuts bodies that contain `SELECT ... INTO` and long pastes, so apply with the Supabase CLI / psql, or as base64
text executed by one `DO` block).

## 1. Migrations 20261016100000, 100010, 100015, 100020 (before or with the release)

Four idempotent files, each under 8 KB so they fit one SQL Editor paste (no `SELECT ... INTO`); apply them in file-name order:
`20261016100000_w0_a_consume_token_live_answers_soft_delete.sql`, `20261016100010_w0_b_mark_homework_completed.sql`,
`20261016100015_w0_b_teacher_comments.sql`, `20261016100020_w0_c_share_token_queue_and_notification.sql`.
The revoke in step 3 has a later timestamp (`20261017090100`) so `supabase db push` does not apply it together with step 1.

- `consume_token` keeps its body as `consume_token_internal` (service role only); the public name is a wrapper that
  lets a signed-in caller charge only their own id. Teacher UI, `useActiveWorksheetGenerationJob` and `useTokenSystem`
  already pass the signed-in user id, so they keep working.
- `soft_delete_worksheet`, `get_worksheet_live_answers`, `save_teacher_comment`, `get_homework_comments` check the
  signed-in owner. `get_homework_comments` is no longer executable by anon (only the teacher review page uses it).
- `mark_homework_completed` becomes a wrapper: signed-in callers are treated as the owning teacher (`p_user_id` is
  ignored), students are rejected (they use `submit_homework_answers_by_share_token`); anon loses EXECUTE.
- New `needs_ai_evaluation_by_share_token`, `queue_worksheet_ai_evaluation_by_share_token`,
  `insert_homework_submission_notification_by_share_token` (token + assigned email, owner teacher passes; the notification is deduplicated against unread ones).
  The client calls them and falls back to the legacy names only while the migration is missing.

Checks (all must hold):

```sql
-- no client role may execute the internal bodies
select proname, has_function_privilege('authenticated', oid, 'execute') as auth_exec,
       has_function_privilege('anon', oid, 'execute') as anon_exec
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('consume_token_internal', 'mark_homework_completed_internal');   -- false, false

-- anon can no longer run these
select proname, has_function_privilege('anon', oid, 'execute')
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('consume_token', 'mark_homework_completed', 'get_homework_comments', 'save_teacher_comment');  -- all false
```

Functional check as the test teacher: generate one worksheet (one token charged), open a shared worksheet in live mode
(answers load), mark one homework as completed from the dashboard, open the review page (comments load).

## 2. Release

Deploy the frontend and the Edge Functions `send-homework-reminders`, `test-send-reminder`, `send-homework-email`,
`send-worksheet-email`. `send-homework-reminders` no longer accepts the anon key: confirm that every cron job calling it
sends `x-cron-secret` (`select jobname, command ilike '%x-cron-secret%' from cron.job;`). Job 3
(`send-homework-reminders-every-15min`) has no secret, already gets 401 and can be removed from the dashboard.
Make sure the `APP_BASE_URL` secret is set (the emails fall back to `https://edooqoo.com`).

## 3. One day after the release

`supabase/migrations/20261017090100_w0_revoke_legacy_queue_and_notification_rpcs.sql` revokes the anon-callable
`queue_worksheet_ai_evaluation`, `needs_ai_evaluation` and `insert_homework_submission_notification` from client roles
(service role keeps EXECUTE; the token variants call them as their owner). Also apply the pending
`20261012200100` and `20261014090100` if they are still unapplied (`submit_homework_answers` is already revoked in
production as of 2026-10-15; check the four legacy answer RPCs).

Rollback: `GRANT EXECUTE ON FUNCTION <name> TO anon, authenticated;` for step 3; for step 1 see the header of the
migration.
