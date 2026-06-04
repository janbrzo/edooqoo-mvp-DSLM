---
name: v6.9.37 Auto-Submit Hard-fix + Add-Goal Modal + Audit Clarity
description: WorksheetForm pins student from request; GoalsView eager-mount; Login Try-Demo removed; blog 404 redirect; daily LLM audit email + purpose column.
type: feature
---

## What changed (v6.9.37)

### WorksheetForm auto-submit (P1)
- `src/components/WorksheetForm/index.tsx`: on mount, when `autoGenerateWorksheet` flag is set, the form now calls `setSelectedStudentId(req.studentId)` immediately from `autoGenerateWorksheetRequest` — bypassing the `preSelectedStudent` prop race that previously blocked the readiness gate.
- Readiness gate emits `devLog` for every blocking condition (`lessonTopic empty`, `no exercises`, `no formRef`, `student not hydrated`).
- Watchdog cut from 30 s → 5 s, with force-submit fallback when topic + exercises + formRef are present but the student never hydrated.

### DSLM Add-Goal modal after autosend (P2)
- `src/components/dslm/DSLMTab.tsx`: `GoalsView` is now wrapped with `<LazySection eager={pendingAddGoal || searchParams.get('focus')==='add-goal-modal'}>`. Mount is immediate when arriving via the autosend deep link.
- `handleConsumePendingAddGoal = useCallback(() => setPendingAddGoal(false), [])` — stable reference, no spurious effect re-fires.

### Login modal (P3)
- `src/pages/Login.tsx`: removed the `🎯 Try Demo — explore without signing up` button block. `/demo` route is still directly reachable.

### Blog 404 (P4)
- `public/blog/learning-pacing-scientific-vs-pragmatic-esl.html`: meta-refresh redirect to `/blog/teaching-english-one-to-one.html` with canonical to the target and `robots=noindex,follow`. Original article content was not recoverable from repo or sitemap; decision logged with the user.

### LLM audit clarity (P5)
- Migration `20260604195117_add_purpose_to_model_health_checks.sql` adds `public.model_health_checks.purpose text` + index. Service-role only, no GRANT changes.
- `supabase/functions/audit-llm-models/index.ts`: every `Target` carries a `purpose` string describing what the model powers. `purpose` is written to every `model_health_checks` row. Email dispatch block now runs in BOTH `daily` and `monthly` modes; body has a new "Used for" column.
- `supabase/functions/send-model-audit-email/index.ts`: destructures `mode` from the request body; subject prefixed with `Daily LLM Audit` or `Monthly LLM Audit`.
- Cron recommendation (operator-owned SQL outside repo): keep daily 06:00 UTC + monthly on 1st 06:30 UTC. Both now send mail; subject reflects cadence.

## Sanctity
No changes to worksheet generation prompt/logic, RLS, Stripe, or table schemas beyond the added `purpose` column.