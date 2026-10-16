# W2 rollout (answer saves merge, homework lock after submit, per-exercise reveal)

Both migrations are backward compatible with the current client; apply them with or before the release. Each file is
under 8 KB and has no `SELECT ... INTO`, so it fits one SQL Editor paste (see `iteration-7-rollout.md`).

1. `supabase/migrations/20261016090000_w2_merge_answers_on_save.sql`
   `save_worksheet_answer` and `save_homework_answer` (9 arguments) merge the new answers over the stored ones
   (`stored || new`) instead of replacing the whole map. A stale tab can no longer erase another tab's keys or the
   `_transcription_N` keys written by the evaluation queue. The client never deletes a key (clearing stores `''`).
2. `supabase/migrations/20261016090010_w2_homework_lock_after_submit.sql`
   `save_homework_answer` updates only rows with `is_submitted = FALSE` (a save on a submitted row changes nothing and
   returns NULL), so the teacher's homework view or an old tab cannot overwrite submitted answers. The post-submit AI
   phase writes through `update_homework_answer_by_share_token` and is not affected. `submit_homework_answers` keeps
   the first `completed_at`.

Checks after applying:

```sql
-- merge: both bodies contain the merge expression
select proname from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('save_worksheet_answer', 'save_homework_answer')
  and pronargs = 9 and pg_get_functiondef(oid) like '%.answers || EXCLUDED.answers%';   -- 2 rows

-- lock
select pg_get_functiondef(oid) like '%is_submitted = FALSE%RETURNING%'
from pg_proc where pronamespace = 'public'::regnamespace and proname = 'save_homework_answer' and pronargs = 9;  -- true
```

Client behaviour shipped with the release (no migration needed):

- Saves of one exercise never overlap; a failed save is kept and retried (3 s, 8 s, 20 s, then every 45 s), the progress
  bar shows "Not saved yet, retrying...", and homework Submit refuses to continue while answers are unsaved.
- The page-hide keepalive write sends only exercises with unsaved changes, once.
- Answer keys are revealed per exercise: a finished exercise, an open exercise with its AI evaluation, or (after the
  10-minute inactivity evaluation succeeded) the exercises the student answered. Revealed exercises are locked for
  students. A failed evaluation call no longer unlocks the keys.

Rollback: re-run the `save_*` definitions from `20261012090000_dslm_pipeline_baseline.sql` and the
`submit_homework_answers` definition from `20261014090000`.
