# Iteration 7 rollout (DSLM write-path ownership, endpoint hardening)

Order matters: steps 1-2 are safe before the release; step 3 is the release; step 4 waits a day.

## 1. Cron jobs: send x-cron-secret instead of the anon key (before the release)

`pacing-periodic-check-daily` (job 4) and `loop-pacing-aggregator` (job 6) call their functions with the anon key, which the new functions reject. The extra header is ignored by the current functions, so this step is safe before the release. The secret is copied server side from `process-ai-evaluations-5min`, never typed.

```sql
DO $$
DECLARE
  v_secret text;
BEGIN
  SELECT substring(command FROM $re$'x-cron-secret'\s*,\s*'([^']+)'$re$) INTO v_secret
  FROM cron.job WHERE jobname = 'process-ai-evaluations-5min';
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'CRON_SECRET not found in process-ai-evaluations-5min';
  END IF;

  PERFORM cron.alter_job(
    job_id := (SELECT jobid FROM cron.job WHERE jobname = 'pacing-periodic-check-daily'),
    command := format($cmd$select net.http_post(
    url := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/pacing-periodic-check',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', %L),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );$cmd$, v_secret));

  PERFORM cron.alter_job(
    job_id := (SELECT jobid FROM cron.job WHERE jobname = 'loop-pacing-aggregator'),
    command := format($cmd$select net.http_post(
    url := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/loop-pacing-aggregator',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', %L),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );$cmd$, v_secret));
END
$$;

-- Job 3 has no secret and returns 401 every 15 minutes; job 31
-- (send-homework-reminders-auth-15min) is the working twin.
SELECT cron.unschedule('send-homework-reminders-every-15min');
```

Check: `select jobname, command ilike '%x-cron-secret%' from cron.job;` must be true for both jobs.

## 2. Migration 20261014090000 (before or with the release)

`supabase/migrations/20261014090000_event_and_homework_answer_access.sql`. Backward compatible with the current client: teachers still call `add_student_event` for their own students, the student wrappers keep their signatures, and `submit_homework_answers_by_share_token` is new.

## 3. Release

Deploy the frontend and the Edge Functions `transcribe-audio`, `suggest-exercises`, `pacing-periodic-check`, `loop-pacing-aggregator`, `verify-open-answers`, `process-welcome-test` together. Anonymous homework speaking answers need the new frontend (it sends the access proof to `transcribe-audio`).

## 4. One day after the release

Apply `20261012200100_revoke_legacy_student_answer_rpcs.sql` and then `20261014090100_revoke_legacy_submit_homework.sql`.

Check (all must be false):

```sql
select p.oid::regprocedure, has_function_privilege('anon', p.oid, 'EXECUTE') anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') auth
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('save_homework_answer', 'save_worksheet_answer', 'get_student_homework_answers',
                    'get_worksheet_student_answers', 'submit_homework_answers', 'mark_ai_evaluation_done',
                    'add_student_event_internal');
```

## 5. Later

Rotate CRON_SECRET (it is stored in clear text in `cron.job.command`): set the new Edge Function secret, then re-run step 1 with the new value for every job that sends it.
