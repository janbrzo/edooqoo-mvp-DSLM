# W2 rollout (answer saves merge, homework lock after submit, per-exercise reveal)

**Status 2026-10-18: all W2 migrations are APPLIED in production and verified.** `20261016110010` (homework: merge, lock
after submit, first completion date) and `20261016110000` (worksheet answers merge, built on the iteration 8
`save_worksheet_answer`) are live together with the client release (PR 71). Post-release test on the test account:
answers from two tabs both kept, offline save retried and saved, a two-blank sentence stored as `0_0`/`0_1`, a submitted
homework locked and readable by the teacher. `20261016110000` contains `SELECT ... INTO` (inherited from the iteration 8
body), so apply it with the Supabase CLI / psql / MCP, not the SQL Editor paste.

1. `supabase/migrations/20261016110000_w2_merge_answers_on_save.sql`
   `save_worksheet_answer` (9 arguments) merges the new answers over the stored ones (`stored || new`) before the
   iteration 8 "changed answer" comparison, instead of replacing the whole map. A stale tab can no longer erase another
   tab's keys or the `_transcription_N` keys written by the evaluation queue. The client never deletes a key (clearing
   stores `''`).
2. `supabase/migrations/20261016110010_w2_homework_lock_after_submit.sql`
   `save_homework_answer` also merges, and updates only rows with `is_submitted = FALSE` (a save on a submitted row, or
   for a new exercise after a submit, changes nothing and returns NULL), so the teacher's homework view or an old tab
   cannot overwrite submitted answers. The post-submit AI phase writes through `update_homework_answer_by_share_token`
   and is not affected. `submit_homework_answers` keeps the first `completed_at`.

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
- Answer keys are revealed per exercise: a finished exercise, or an exercise the evaluation queue evaluated (open
  feedback or closed explanation; the queue runs after 10 minutes without a save, and a student save never writes
  `ai_evaluation`), or, when the 10-minute inactivity evaluation succeeded, the exercises the student answered.
  Revealed exercises are locked for students and stay revealed after a reload. A failed evaluation call no longer
  unlocks the keys.

Rollback: re-run the `save_*` definitions from `20261012090000_dslm_pipeline_baseline.sql` and the
`submit_homework_answers` definition from `20261014090000`.
