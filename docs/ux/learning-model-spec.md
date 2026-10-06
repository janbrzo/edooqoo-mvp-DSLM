# Learning Plan Tab — Specification

Status: APPROVED 2026-10-05 — phases L0–L8 (see section 12 for the as-built state)
Parent: `docs/ux/student-workspace-spec.md` (Level 2, fourth tab), `docs/ux/target-teacher-experience.md`
Route: `/student/:id?tab=model` (URL value unchanged; visible label "Learning plan")
Supersedes: `student-workspace-spec.md` section 19 ("Model Cockpit v1.0")

---

## 1. Verified problem (2026-10-05, `/demo`, Playwright 1440×900 and 390×844)

| Finding | Evidence |
|---|---|
| Content starts below the fold | Above it: Welcome Test banner (6 buttons), "What is DSLM?" paragraph, cockpit, level/activity badges, perspective switch. First content heading at y≈900 px (desktop), y≈1330 px (mobile, ~1.6 screens). |
| Same fact repeated | Level 4× (header, snapshot, cockpit, badge), main goal 4×, "0 lessons" 2× inside the cockpit, "Send test" 3× and "Add goal" 3× on one view. |
| Dependency order inverted | Top: disabled "Generate 1-Minute Prep suggestions" (step 3) saying "add goals first"; middle: roadmap (step 2); bottom: goals (step 1). |
| Contradictions | "Model: Learning — suggestions improve…" with zero suggestions/goals/roadmap; "No learning goals set" while a main goal exists; snapshot focus area vs "No skill data yet"; "Refresh the page to see them"; "Hide from 1 MINUTE". |
| Competing primaries | Send Welcome Test, Generate suggestions, Generate Learning Roadmap (+ nav Generate Worksheet). |
| Vocabulary | ~20 domain terms on one tab (DSLM, Model: Learning, 1-Minute Prep suggestions, Next Lesson Ideas, Next Steps, Learning Roadmap, phases, Pacing Scientific/Balanced/Pragmatic · 50, Learner DNA, Nano/Micro skills, Confidence 82%, [V]/[G], "used −1"). |
| Density | Roadmap & Goals for a student with 4 phases, 6 suggestions, 3 goals × 2 elements: ~120 interactive elements (featured card 8, every suggestion card 9, every goal card 6 + 6 per element). |
| Nested disclosure | Up to 4 levels (More goals → Additional → GoalCard → element). |
| Sticky bug | Perspective switch `sticky top-0 z-10` slides under `StickyNav` (`sticky top-0 z-50`); mobile labels truncated ("Roadma…"). |
| Logic bug | `selectPrepSuggestion` sorted phase steps by `sequence_number`, which restarts at 1 in every phase (`useFutureTimeline.generateNextSteps`). Prep could propose "Phase 2 step 1" while the Learning model showed the in-progress phase's step as #1. |
| Data duplication | Independent hook instances (`useStudentProgress` ×4, `useFutureTimeline` ×2, Welcome Test query ×2) synchronised by window events — origin of "refresh the page". |

Root cause: the tab was organised as an inspector of model internals (three data perspectives) instead of the three questions a teacher brings to it — "what next and why?", "do I agree?", "what does the system still need from me?".

---

## 2. Mental model

One sentence shown in "How it works": *Edooqoo keeps a plan for each student — you set the goal, it proposes the roadmap and the next lessons, you approve.*

Goal → Roadmap → Up next maps 1:1 to existing data: `students.main_goal` + `student_progress_goals` → `dslm_curriculum_phases` → `future_worksheet_suggestions`. No schema change.

---

## 3. Principles

1. The tab has a **stage** that decides the view: `setup` → `review` → `ready` (`computeModelReadiness`).
2. One sentence on top, at most one action.
3. Screen order = order of the teacher's work.
4. Every fact appears once. Level lives in the header/snapshot; the main goal appears only in the Goals section.
5. One level of in-place disclosure. Anything deeper opens a side panel (`Sheet`). Nothing is removed.
6. Words instead of numbers; a number only when it drives a decision.
7. One name per thing (section 8).
8. Prep and the Learning plan always show the same #1 suggestion (`orderUpNext`).

---

## 4. Layout

```text
Learning plan tab
├─ ModelStatusLine        stage sentence · one action · "How it works"
├─ Segments               [ Plan ] [ Insights ]       (not sticky)
└─ Plan                    or   Insights
   ├─ setup:  SetupChecklist (4 steps)
   └─ review/ready:
      ├─ ReviewStrip       "Needs your OK" (level change, pacing proposals, suggested goals) — only when non-empty
      ├─ Up next           featured card + rows + "+ Add suggestions" + History
      ├─ Roadmap           phase stepper → RoadmapSheet (MacroTimeline 1:1, roadmap toggle, pacing)
      └─ Goals             main goal + supporting goals → GoalsSheet (GoalsView 1:1)
```

### 4.1 Stage `setup` (no active suggestion)

| Step | Done when | Actions |
|---|---|---|
| 1 Goal | main goal set, or ≥1 active goal | `+ Add a specific goal`, `Manage goals` |
| 2 Level check | any Welcome Test attempt completed/reviewed | not sent: Send Welcome Test · Copy link; sent: "Waiting for {name} · sent {age}" + Resend email · Copy link; done: "Placement test completed" |
| 3 Roadmap | ≥1 phase | Generate roadmap (guided dialog; "without goals?" confirm when no specific goal, as in MacroTimeline) |
| 4 Next lessons | ≥1 active suggestion | Get suggestions (`GenerateStepsDialog`, first mode) — always enabled (decision D3) |

- Only the first actionable, not-done step renders its button as `variant="default"`; a sent-but-pending Welcome Test does not hold the highlight.
- No "Skip" buttons; every step can be done at any time.
- When the first suggestion exists the checklist disappears; unfinished steps 2–3 come back as one "Sharper plan" hint in the status line.

### 4.2 Stage `review`

`ReviewStrip` (amber, same language as the dashboard "Needs your attention") lists: `SuggestedLevelChangeBanner`, every `PacingProposalCard`, `SuggestedGoalsCard`. Count = suggested goals + pacing proposals + (level suggestion ? 1 : 0).

### 4.3 Stage `ready`

- **Featured card (#1)** — the same suggestion Prep shows, marked "Also in Prep". One-line "Why" always visible; "More" opens `SuggestionWhyPanel` (rationale, grammar focus, exercises with V/G tag, focus skills, "Built from …" counts, fit label + reasons, expected impact). Actions: `Generate worksheet` (only primary), `Edit`, `⋯` = Fill the form without generating · Regenerate with a comment · Already taught · Remove.
- **Rows (#2…N)** — number, topic, phase label, `⋯` with all six actions; clicking the row expands the why panel (one level).
- **+ Add suggestions** (`GenerateStepsDialog`, soft queue gate ≥5 unchanged) and **History (n)** (used suggestions, Restore on the newest, Remove).
- **Roadmap** — horizontal stepper (✓ done, ● now, ○ planned) + one sentence about the current phase; "Roadmap paused" badge when `dslm_use_roadmap = false`. Clicking a phase or "Edit roadmap" opens `RoadmapSheet` with the unchanged `MacroTimeline` (expanded on that phase), the roadmap toggle and `PacingModeSlider`.
- **Goals** — main goal (deadline + progress), up to 3 active supporting goals, `+ Add goal`, "All goals & notes (n)" → `GoalsSheet` with the unchanged `GoalsView`.

### 4.4 Insights

1. `InsightsSummary` — sentences built by `buildInsightsSummary` from existing data (level, placement estimate, strongest/weakest category, last activity, homework ratio). Empty state: one sentence + Send Welcome Test.
2. Skills — category bars, weakest first, trend arrow. "Explore all skills" → `Sheet` with the unchanged `SkillsOverviewPanel` (heat map + micro/nano + filters).
3. "How {name} learns" — `ProfileView` (AI summary, psychological profile, learning patterns, single notes stream, advanced diagnostic log). Learning patterns collapse to one line when every value is empty.

### 4.5 Mobile (390 px)

Header → collapsed snapshot → workspace tabs → status line → 2 segments (no truncation) → content. Featured `Generate worksheet` is full width. Roadmap stepper becomes a vertical list. Sheets are full width.

---

## 5. Visual rules

- No gradient card, no `bg-white`, `text-white`, `text-blue-*`, `bg-[#…]` in new code; semantic tokens only.
- Section headings: `text-xs font-semibold uppercase tracking-wider text-muted-foreground` (dashboard zones); sections separated by spacing, not card-in-card.
- Colour only for meaning: primary = the one action; amber = needs your OK; emerald ✓ = done step in the checklist.
- Exactly one `variant="default"` button visible in the panel.

---

## 6. Interaction budget

| State | Budget | Before |
|---|---|---|
| setup, whole panel | ≤ 14 interactive elements | 28 |
| ready, first screen 1440×900 | ≤ 16 | n/a (content below the fold) |
| ready, whole Plan, reference student (4 phases, 6 suggestions, 3 goals × 2 elements) | ≤ 35 | ~120 |

---

## 7. URL, event and spotlight compatibility (must keep working)

| Input | Result |
|---|---|
| `tab=dslm`, `tab=1minute`, `tab=model`, `tab=progress`, `view=pathway` | Plan |
| `view=goals` | Plan, scrolled to Goals (checklist step 1 in setup) |
| `view=skills`, `tab=skills` | Insights, Skills section |
| `view=profile`, `tab=knowledge`, `tab=events` | Insights, profile section |
| `view=insights` | Insights (written by the segment switch) |
| `focus=add-goal-modal`, event `dslm:addGoal` | `AddGoalDialog` (single owner: `DSLMTab` listener → `pendingAddGoal`) |
| event `dslm:addGoal` with `detail.goalType: 'main'` | `MainGoalDialog` (the main goal editor, never the supporting-goal modal) |
| `focus=pick-idea`, event `pathway:pickIdea` | scroll to Up next; empty queue opens `GenerateStepsDialog` |
| `editSuggestion=<id>` | `SuggestionEditDialog`; param consumed with a functional `setSearchParams` |
| spotlights `send-welcome-test`, `learning-roadmap`, `next-lesson-ideas`, `pick-idea` | exactly one DOM target per id in each stage |
| `PacingProposalsBell`, `NextStepsPresetBanner`, `AddStudentDialog`, `process-welcome-test` email | unchanged (alias map) |

`resolveModelSegment(view)` in `workspaceTabs.ts` maps `view` to `{ segment, anchor }`; `resolveModelPerspective` stays for backward compatibility.

---

## 8. Glossary (teacher-facing)

| System | Before | Now |
|---|---|---|
| DSLM | DSLM, Learning model, Model: Learning | **Learning plan** (DSLM only inside "How it works") |
| `future_worksheet_suggestions` | 1-Minute Prep suggestions, Next steps, Next Lesson Ideas, #1 | **Up next** / suggestion |
| `dslm_curriculum_phases` | Learning Roadmap, curriculum plan, macro timeline | **Roadmap** / phase |
| `student_learning_profiles` | Learner DNA, Psychological Profile | **How {name} learns** |
| confidence heuristic | Confidence 82% | **Strong / Good / Rough fit** (`describeFit`) |
| pacing | Pacing Balanced · 50 | unchanged names, moved into the roadmap panel |

---

## 9. Technical contract

- Pure modules (unit-tested, no React/Supabase): `src/lib/dslm/learningPlan.ts` (`orderUpNext`, `findCurrentPhase`), `src/lib/dslm/modelReadiness.ts` (`computeModelReadiness`, `resolveWelcomeTestState`), `src/lib/dslm/insightsSummary.ts`, `describeFit` in `confidenceScore.ts`, `resolveModelSegment` in `workspaceTabs.ts`.
- `selectPrepSuggestion(phaseSteps, nextSteps, fallback, phases?)` orders through `orderUpNext`; Prep and Plan therefore pick the same #1.
- `useFutureTimeline` broadcasts `dslm:suggestionsUpdated` after its own mutations so every mounted instance (Prep and Plan) refreshes.
- `useLearningPlanData` (in `DSLMTab`) is the single owner of plan data on the tab; legacy components inside sheets keep their own hooks and stay synchronised through existing events.
- `DSLMTab` prop contract unchanged. No database, RLS, Edge Function or Worksheet Generation Engine change; generation still goes through `onUseWorksheetSuggestion` → `writeAutoGenerateIntent` / sessionStorage prefill.
- New mutation entry points go through `useDemoGuard`; new read hooks return early in demo mode.

---

## 10. Phase plan

| Phase | Scope |
|---|---|
| L0 | This spec + memory |
| L1 | Pure modules + unit tests |
| L2 | Prep/Plan share one order; suggestion mutations broadcast |
| L3–L4 | Plan components and `DSLMTab` wiring |
| L5 | Insights |
| L6 | Cross-tab coherence (Prep link, labels, onboarding copy, banners removed from the tab) |
| L7 | Cleanup + docs |
| L8 | Verification |

---

## 11. Acceptance criteria

1. Budgets in section 6.
2. Prep #1 === Plan #1 (unit test with multi-phase fixtures).
3. Level not shown inside the panel; main goal exactly once.
4. No "Refresh the page", "1 MINUTE" or bare "DSLM" text outside "How it works".
5. Two segments without truncation at 360 px; `scrollWidth === innerWidth`.
6. Every row of section 7 passes.
7. Usability check (Martha test, 5 teachers): "what next and why", "change the topic", "prepare her for a presentation on 12 March", "where is she weakest", "skip a suggestion" — ≥4/5 complete each in < 60 s unaided.

---

## 12. As built (2026-10-05)

### 12.1 Files

| Path | Role |
|---|---|
| `src/lib/dslm/learningPlan.ts` | `orderUpNext`, `findCurrentPhase`, `sortPhases`, `formatPhaseCaption` |
| `src/lib/dslm/modelReadiness.ts` | `computeModelReadiness`, `resolveWelcomeTestState` |
| `src/lib/dslm/insightsSummary.ts` | `buildInsightsSummary`, `rankCategories` |
| `src/lib/dslm/goals.ts` | `isActiveGoal`, `isSuggestedGoal` |
| `src/lib/dslm/confidenceScore.ts` | `describeFit` (added) |
| `src/lib/students/workspaceTabs.ts` | `resolveModelSegment`, `MODEL_SEGMENT_VIEWS` (added) |
| `src/hooks/dslm/useLearningPlanData.ts` | single owner of plan data on the tab |
| `src/hooks/dslm/useWelcomeTestState.ts` | none / sent / completed (React Query, demo early return) |
| `src/components/dslm/DSLMTab.tsx` | status line, segments, deep links, `dslm:addGoal` owner |
| `src/components/dslm/plan/*` | `ModelStatusLine`, `PlanSegmentSwitch`, `HowItWorksPopover`, `SetupChecklist`, `ReviewStrip`, `SuggestedGoalsCard`, `UpNextSection`, `SuggestionWhyPanel`, `SuggestionActionsMenu`, `LessonIdeasNotes`, `RoadmapStrip`, `RoadmapSheet`, `GoalsSummary`, `GoalsSheet`, `AddGoalDialog`, `MainGoalDialog`, `LearningPlanView`, `InsightsView`, `PlanSection` |

Additive changes: `MacroTimeline.initialExpandedPhaseId`, `GoalsView.listenForAddGoalEvents`, `SuggestedLevelChangeBanner.onDismissed`, `useStudentAttentionDots().level`, `DSLMTab.studentEmail`, `PrepSuggestion.phaseCaption`, `selectPrepSuggestion(…, phases)`, `useFutureTimeline` broadcasts `dslm:suggestionsUpdated` (with an `origin` so an instance ignores its own event).

Removed (no importers left): `PathwayView`, `NextStepsSection`, `NextStepBanner`, `ModelCockpitHeader`, `StudentNavBadges`, `StudentPathwayBadges`, `SkillsView`, `LazySection`, `DslmExplainerBanner`, `modelHealth` (+ test), the dead `dslm:openSubsection` listener and `CollapsibleSection.alsoOpenFor`.

### 12.2 Deliberate deviations from the plan

- Onboarding (resolved the same day): the two weekly-prep steps used to complete only from `student_knowledge_entries` of category "Next Lesson Ideas" while the checklist pointed at lesson suggestions. `resolveIdeaSteps` (`src/lib/onboarding/ideaSteps.ts`) now completes them from `future_worksheet_suggestions` (any / `is_used = true`) **or** the old note signal, so no teacher loses a ticked step; labels are "Get lesson suggestions" / "Use a lesson suggestion" (step keys unchanged).
- The teacher's own "Next Lesson Ideas" notes stay next to the queue ("Your lesson ideas (n)" under Up next and under the setup checklist) instead of moving only into Insights › Notes — they are planning input, not evidence.
- The DSLMTab `focus` handler marks a deep link as handled inside the animation frame, not before it: under React StrictMode the old order cancelled the frame and swallowed `focus=add-goal-modal` in development.

- 2026-10-06 merge with `main`: Lovable commits had added short mobile labels (Roadmap / Skills / DNA) to the three old perspective buttons and a "+ Set main goal" badge to the old cockpit. The two segments are already short at every width, so the labels have no new home. The main goal entry point is kept: when no main goal is set, the status line hint is "set a main goal" (first in priority, `computeModelReadiness`) and Goals shows "Set main goal"; both open `MainGoalDialog`, and so does `dslm:addGoal` with `goalType: 'main'` (GoalsView honours it too when it listens).

### 12.3 Verification

- `npx tsc --noEmit -p tsconfig.app.json` clean; `npx vitest run` 340/340 (new: learningPlan 11, modelReadiness 12, insightsSummary 7, workspaceTabs segment cases, prepPlan regression cases; modelHealth tests removed with the module).
- Playwright on `/demo` (setup stage, 1440×900 and 390×844): content starts at 413 px (was ≈900) and 535 px (was ≈1330); 8 interactive elements in the panel (was 28); one primary button; spotlight ids unique.
- Playwright on `/demo` with a scratch fixture harness for a populated plan (4 phases, 6 suggestions, 2 used, 3 goals, one Welcome Test goal suggestion): 35 interactive elements in the Plan (≈120 before), 13 on the first 1440×900 screen; `scrollWidth === innerWidth` at 360, 390 and 1440 px; 29/29 checks PASS — 8 legacy aliases, `view=goals` scroll, `focus=add-goal-modal` (exactly one dialog), `focus=pick-idea`, `editSuggestion` from Insights, focus/param consumption, spotlight uniqueness, Up next order, single primary, level not repeated, segment push + Back, roadmap stepper → sheet with the phase expanded, goals sheet, six-action menu, How it works, Explore skills, Generate worksheet hand-off, no page errors.
- Real account (test teacher, 26 students, read-only Node check of the shipped pure rules against live rows): Prep #1 === Plan #1 for every student; one student showed the pre-fix divergence (old Prep proposed a later-phase lesson). Stages: 22 setup, 2 review, 1 ready (+1 setup with phases). Found and fixed: legacy `main_goal` codes (e.g. `grammar-structure`) shown raw as Prep topics.
- Real account after the merge (2026-10-06): with the test teacher's session, Node ran the hooks' own queries and the shipped rules on all 26 students (Prep #1 === Plan #1 for the 3 students with a queue, onboarding idea steps resolve, the 14 pending pacing proposals are readable) and one write round trip on a test student (set main goal, `recalculate-pacing` proposal 50 to 70, the accept path, then every value restored). A static snapshot of three real students was rendered in Chromium through the fixture harness (no browser traffic to Supabase; the pacing and Welcome Test hooks were un-gated in the scratch copy only): 18/18 checks, including the pacing proposal card, the level change, Up next #1 equal to `orderUpNext` on the real rows, the setup checklist, the "set a main goal" hint and `dslm:addGoal` with `goalType: 'main'`, no horizontal scroll at 390 px and no page errors. Found and fixed: "sent jun 26, 2026" / "Used jun 26, 2026" (`formatRelativeAgeInline`).
- Still not verified: a live browser session against Supabase (this environment's TLS-intercepting proxy blocks the browser and the workarounds were refused by the session's safety policy), the Prep tab with real suggestions in a browser (demo mode skips them by design), and the 5-teacher Martha test (section 11.7).
