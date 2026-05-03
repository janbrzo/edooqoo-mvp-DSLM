---
name: Dashboard Compact Stats Bar
description: Single-row stats bar on /dashboard with Student Hub CTA + 6 micro-tiles
type: feature
---
**Component:** `src/components/dashboard/CompactStatsBar.tsx`
**Used in:** `src/pages/Dashboard.tsx` (replaces old grid + Hub Info banner).

**Layout:**
- Desktop: `[Student Hub CTA (basis 40%)] | [6 inline pills with divide-x]` in one row.
- Mobile: Hub CTA on top, pills as 3-col grid below.

**6 stats:**
1. Tokens left ← `useTokenSystem`
2. This month ← `useWorksheetStats.thisMonthCount`
3. All time ← `profile.total_worksheets_created`
4. Students ← `useStudents.length`
5. Active homework ← derived from `useAllWorksheetHomework` (filter !completed_at)
6. Upcoming lessons (7 days) ← `useUpcomingLessonsCount` (new hook, single SELECT on `calendar_slots` status='booked')

**Constraints:**
- Hub Info points to `https://edooqoo.com/my` (Student Hub entry).
- All labels English. Tooltip provides full label.
- New hook returns 0 on error (graceful degradation).
- No worksheet engine touched (Sanctity Rule).
