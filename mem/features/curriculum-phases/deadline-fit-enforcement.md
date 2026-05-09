---
name: Curriculum phases — deadline-fit enforcement
description: Two-layer cap so AI-generated phases never exceed student deadline (prompt + server scaler)
type: feature
---
`generate-curriculum-phases` enforces a hard deadline budget.

**Budget**:
- `weeksUntilDeadline = round((main_goal_target_date - today) / 7)`, min 1
- `mode='replace'`: budget = `weeksUntilDeadline`
- `mode='add'`: budget = `weeksUntilDeadline − max(end-week of existing non-done phases)`
- No deadline → falls back to `phaseCount × avgWeeksPerPhase`

**Layer 1 — Prompt**: `HARD CONSTRAINT — DEADLINE FIT` block requires sum of `(end − start + 1)` to equal the budget exactly, contiguous from week 1 (or post-add anchor), min 2 weeks/phase.

**Layer 2 — Server scaler** (`fitPhasesToDeadline`): rescales every AI response proportionally to original AI durations, honors minWeeks=2 (drops to 1 if budget too tight), rebases to contiguous integer ranges via `rebase()`. Always runs — idempotent when AI already fits.

**Telemetry**: `generation_context.target_total_weeks` and `generation_context.deadline_fit_adjusted` (boolean).

**Sanctity**: Worksheet-generation prompt is UNTOUCHED. Only the curriculum-phases prompt and post-processor changed.