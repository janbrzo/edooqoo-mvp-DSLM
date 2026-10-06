---
name: Homework reminders cron auth
description: send-homework-reminders is called by pg_cron; why it returned 401 for 11+ days and how it authenticates now
type: feature
---

- `send-homework-reminders` rejects requests unless they carry `x-cron-secret == CRON_SECRET` (`_shared/cronAuth.ts`, fails closed) or `Authorization: Bearer <anon|service role key>`.
- Incident (found 2026-10-05): both pg_cron jobs (`*/15` job 3, `*/30` job 1) sent only `Content-Type`, no auth header, so every call returned 401 and no reminders were sent (logs show 100% 401 from at least 2026-09-24). A dry run showed 0 reminders were pending; 107 not-completed assignments with reminders all had deadlines older than the 7-day window.
- Putting the public anon key (from `src/integrations/supabase/client.ts`) in the job header also returned 401: the function's `SUPABASE_ANON_KEY` does not equal that key. Do not rely on the anon-key path for cron.
- cron.job 3 is owned by `supabase_read_only_user`, so `postgres` cannot alter or unschedule it (`alter_job` fails with "Job 3 does not exist or you don't own it"); it only produces 401 noise. Job 1 (owner `postgres`) was unscheduled. Job 31 `send-homework-reminders-auth-15min` (owner `postgres`) is the live job and must send `x-cron-secret`.
- After rotating `CRON_SECRET`, update this job together with `audit-llm-models-daily` and `audit-llm-models-monthly`.
- Before enabling a reminder job again after an outage, dry-run the candidate query (overdue: `send_overdue_emails` not false and not yet reminded after the deadline; upcoming: `reminder_scheduled_at <= now` and not reminded within `reminder_hours`) so students do not get a burst of stale mails.

**Why:** the auth check was added when functions were hardened, but the cron definitions were never updated and nothing alerted on the 401s.
