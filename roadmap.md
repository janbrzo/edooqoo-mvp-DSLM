# Edooqoo Roadmap

Lean task list. Details live in `docs/` and `.lovable/plan/`.

## UX North Star

Reference: `docs/ux/target-teacher-experience.md` (approved 2026-09-02).

- [x] Dashboard → Today (v6.9.109) — spec: `docs/ux/dashboard-today-spec.md`
  - [x] Phase 0 — docs + roadmap
  - [x] Phase 1 — data hooks (`useNextUpStudents`, `useDashboardAttention`, `useDashboardCounts`) + `formatGoal` lib
  - [x] Phase 2+3 — dashboard components + `Dashboard.tsx` rewrite
  - [x] Phase 4 — `/students` (`AllStudentsPage` + `useStudentsOverview`)
  - [x] Phase 5 — `/profile` Usage card + `AddStudentDialog` Hub helper text
  - [x] Phase 6+7 — `OnboardingChecklistGate`, `unifiedBell:open`, demo data signals
  - [x] Phase 8 — cleanup (`NextPrepStrip` removed) + RAG (`docs/llm-context.md`, `public/llms.txt`)

- [x] Quick student access (v6.9.110) — header search, recent pills, inline All students, nav switcher on /dashboard
  - [x] Step 1 — `src/lib/students/quickAccess.ts` + unit tests
  - [x] Step 2 — `StudentQuickSearch` + `RecentStudentsBar` in `Dashboard.tsx`
  - [x] Step 3 — expandable All students tile; split Worksheets tile opens recent items from its chevron
  - [x] Step 4 — `StickyNav` on /dashboard + filter in `NavStudentSwitcher`
  - [x] Step 5 — memory (`mem/features/dashboard/quick-student-access.md`) + RAG (`docs/llm-context.md` v6.9.110)

- [ ] Student Workspace (v6.9.111) — 4 tabs (Prep / Timeline / Library / Learning model) + snapshot panel — spec: `docs/ux/student-workspace-spec.md`
  - [x] M0 — spec document + roadmap entry (code-verified current state, permanent `?tab=` alias map, data-source field audit)
  - [x] M1 — `src/lib/students/workspaceTabs.ts` + `resolveTab()` alias tests (no UI)
  - [x] M2 — `EntityRow` + `MeetingLinkField` extracted from `StudentPage.tsx` (no visual change; `StudentPage.tsx` 1256 → 1081 lines)
  - [ ] M3 — `StudentHeaderBar` + `StudentSnapshotPanel` + `StudentSettingsMenu`
    - [x] M3.1 — `studentSnapshot.ts` selectors + `useStudentNextLesson` (no UI)
    - [x] M3.2 — `StudentHeaderBar` + `StudentSnapshotPanel` + `StudentSettingsMenu` components (built, not yet mounted)
    - [x] M3.3 — mounted in `StudentPage.tsx`; duplicated Back/Edit/Delete/meeting-link controls removed
  - [x] M4 — `PrepTab` (`NextLessonCard`, `LastLessonStrip`, `QuickNoteBox`)
    - [x] M4.1 — `src/lib/students/prepPlan.ts` + 21 unit tests (no UI)
    - [x] M4.2 — `NextLessonCard`, `LastLessonStrip`, `QuickNoteBox` (built, mounted in M4.4)
    - [x] M4.3 — `PrepTab.tsx` composition
    - [x] M4.4 — mounted as first tab in `StudentPage.tsx` (`?tab=prep`); default stays `dslm` until M7
  - [ ] M5 — `useStudentTimeline` (zero queries) + `TimelineTab`
    - [x] M5.1 — `src/lib/students/timelineEvents.ts` + 26 unit tests (no UI)
    - [x] M5.2 — `useStudentTimelineSources` (3 lazy queries + demo) + pure `useStudentTimeline`
    - [x] M5.3 — `TimelineFilters` + `TimelineEventRow`
    - [x] M5.4 — `TimelineTab` composition + mount as second tab in `StudentPage.tsx`
    - [x] M5.5 — spec section 7 update + roadmap (RAG stays in M8)
  - [ ] M6 — `LibraryTab` with segments and collapsed Deleted
  - [ ] M7 — switch to 4 tabs, `resolveTab` routing, `studentPrepPath()` → `?tab=prep`, `React.lazy`
  - [ ] M8 — dead-code removal + RAG (`docs/llm-context.md`, `public/llms.txt`, memory)
- [ ] Guided mode beyond the dashboard

## Deferred

- [ ] P2.2 Multi-voice TTS (explicitly excluded until further notice)
- [ ] SEO growth: `/blog/communicative-language-teaching-activities.html` content + meta rewrite
