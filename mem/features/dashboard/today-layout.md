---
name: Dashboard Today layout (v6.9.109)
description: /dashboard is a single-column Today view (Next up / Needs your attention / Everything else); student list on /students, counters on /profile
type: feature
---

## Dashboard Today — invariants

- `/dashboard` is single-column and ritual-based, not object-based. Three zones only:
  1. **Next up** — max 3 students, nearest booked lesson first, DSLM focus signal or goal, one primary action `Prepare next lesson` → `/student/:id?tab=dslm`.
  2. **Needs your attention** — homework awaiting review, completed Welcome Tests, new bookings. Hidden when empty.
  3. **Everything else** — tiles (All students, Worksheets, Calendar) + collapsible Recent worksheets; row actions live in one `…` menu.
- `DashboardHeader` (greeting + counts + Add student), `GuidedStepsBar` (3 onboarding steps), `EmptyDashboard` (zero students).
- Aggregate statistics belong on `/profile` (Usage card, `CompactStatsBar variant="list"`), NOT on the dashboard.
- Full student list lives on `/students` (`AllStudentsPage` + `useStudentsOverview`, single grouped query — never N+1).
- Data hooks: `useNextUpStudents`, `useDashboardAttention`, `useDashboardCounts`, `useActiveHomeworkCount`. All return early in demo mode.
- Floating onboarding checklist is hidden on `/dashboard` only (`OnboardingChecklistGate`); `UnifiedBell` opens via `unifiedBell:open` event.
- Removed for good: `StudentCard.tsx`, `NextPrepStrip.tsx` — do not reintroduce card grids or stat bars on the dashboard.

**Why:** teachers reported the old dashboard had competing hierarchies and no clear "what now".
