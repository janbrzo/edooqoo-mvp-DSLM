---
name: v6.9.58 live progress + multi-job mini panel
description: Modal seeds progress/timer from job.startedAt so refresh resumes live values; motivational CTA block replaces refresh hint and adds Open dashboard ↗ button + student-profile deep link; generationJobRegistry refactored to a multi-job map so ActiveGenerationMiniPanel stacks one card per concurrent generation with per-jobId modal gating.
type: feature
---

## What changed

1. **Live progress on refresh** — `GeneratingModal` accepts a `startedAt`
   prop and seeds both `elapsedTime` and `progress` from
   `Date.now() - startedAt`. After F5 the modal resumes from realistic
   values instead of resetting to 0.

2. **Motivational CTA block** — The "Refreshing this page won't stop
   generation" one-liner is replaced by a single unified block that
   invites the teacher to keep prepping for the same student or another
   one while generation runs. New small `Open dashboard ↗` button opens
   `/dashboard` in a new tab (`target="_blank" rel="noopener"`). The
   `For {studentName}` header now renders the name as a link to
   `/student/{id}` in a new tab when `studentId` is known. Resumed-after-
   refresh state keeps the amber styling and prepends "Generation
   resumed.".

3. **Multi-job mini panel** — `generationJobRegistry` migrated from a
   single-job localStorage key to a map keyed by `jobId`
   (`edooqoo.activeWorksheetGenerations`). Legacy key migrated on first
   read. New `getActiveGenerationJobs` /
   `subscribeToGenerationJobs` API; old single-job helpers kept as
   back-compat wrappers that return the latest running job.
   `ActiveGenerationMiniPanel` renders one card per active job stacked
   bottom-right (`bottom = 16 + idx * (96 + 8)`). Modal mount/unmount
   events now include `{ jobId }` and the panel hides ONLY the job that
   currently has its modal on screen, so other concurrent generations
   stay visible.

## Sanctity

No Worksheet Generation Engine change. No DB migration. No RLS change.
Prompts, models, and pipeline untouched.

## Verification

- Start generation, watch progress reach ~30s, refresh — modal returns
  with ~33s elapsed and matching % (not 0).
- Modal shows new CTA: click student name → `/student/:id` in new tab;
  click `Open dashboard ↗` → `/dashboard` in new tab.
- Open a second tab on `/dashboard` during generation — mini panel
  visible. Refresh that tab — still visible.
- Start two parallel generations from two tabs → both mini panels stack
  on a third tab.
- After completion, mini panel exposes `X` close.
