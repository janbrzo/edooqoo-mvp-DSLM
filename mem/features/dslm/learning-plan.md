---
name: Learning plan tab
description: Student page fourth tab (?tab=model) = stage-driven Learning plan — status line + Plan / Insights; Prep and Plan share one next-lesson order
type: feature
---

- Visible label "Learning plan" (mobile "Plan"); URL stays `tab=model`, all legacy aliases permanent. Spec: `docs/ux/learning-model-spec.md`.
- Stage from `computeModelReadiness`: `setup` (no active suggestion → 4-step checklist: Goal, Level check, Roadmap, Next lessons), `review` (amber "Needs your OK": level change, pacing proposals, suggested goals), `ready`.
- Plan order = order of work: Needs your OK → Up next (featured #1 + rows + History) → Roadmap stepper → Goals. Only one in-place disclosure level; MacroTimeline, GoalsView and SkillsOverviewPanel open unchanged inside side Sheets.
- Insights = summary sentences + skill bars (weakest first) + ProfileView. Segment switch writes `view=pathway` / `view=insights`; `view=skills|profile|goals` deep links still work via `resolveModelSegment`.
- The #1 suggestion in Prep and Plan comes from `orderUpNext` (`src/lib/dslm/learningPlan.ts`) — never sort suggestions elsewhere; `sequence_number` restarts per phase.
- One primary button per panel; no cockpit stats, no pacing slider on top, no "What is DSLM?" banner, no Welcome Test banner on this tab — do not reintroduce.
- Confidence is shown as Strong / Good / Rough fit (`describeFit`), never as a percentage on cards.
