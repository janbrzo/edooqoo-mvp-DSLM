---
name: DSLM forgetting curve
description: Read-time effective mastery (decision D9/D10): 14 day grace, 60 day half-life, floor 50 percent, shown in profile and Learning plan and sent to prompts
type: feature
---
# DSLM forgetting curve (iteration 7)

- Owner decision D9: effective = stored * (0.5 + 0.5 * 0.5^((days - 14) / 60)), no decay for 14 days, never below 50% of the stored value.
- Owner decision D10: Learning plan, skills profile, goal progress, MCP summary and DSLM prompts use the effective value; the teacher can see the last practised value and date in the skill row tooltip.
- Single implementation: `supabase/functions/_shared/forgetting.ts`. The stored `current_mastery` is never rewritten.
- Deferred on purpose: AI queue batching (7.1, 76 rows total) and incremental ratings table with canonical skill keys (7.2, needs a skill taxonomy decision); revisit at about 10x current volume.
