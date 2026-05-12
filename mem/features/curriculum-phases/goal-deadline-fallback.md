---
name: Goal target_date fallback for curriculum deadline
description: generate-curriculum-phases falls back from students.deadline to earliest student_progress_goals.target_date
type: feature
---

`supabase/functions/generate-curriculum-phases/index.ts` computes `effectiveDeadline = student.deadline ?? min(activeGoals.map(g => g.target_date))`. This unblocks deadline-fit enforcement (v6.9.13) when teachers store deadlines on goals rather than the student record (the common case).

Telemetry: `generation_context.deadline_source` is `'student' | 'goal' | null`. Worksheet engine UNTOUCHED. Server-side `fitPhasesToDeadline` (v6.9.13) still rescales any AI overflow.

Prompt now includes a worked example to reinforce scaling: `"90 days = ~13 weeks → 3 phases of 3 weeks + 1 phase of 4 weeks"`.
