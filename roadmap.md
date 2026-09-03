# Edooqoo Roadmap

Lean task list. Details live in `docs/` and `.lovable/plan/`.

## UX North Star

Reference: `docs/ux/target-teacher-experience.md` (approved 2026-09-02).

- [ ] Dashboard → Today (v6.9.109) — spec: `docs/ux/dashboard-today-spec.md`
  - [x] Phase 0 — docs + roadmap
  - [x] Phase 1 — data hooks (`useNextUpStudents`, `useDashboardAttention`, `useDashboardCounts`) + `formatGoal` lib (not yet wired to UI; unit tests in `src/hooks/__tests__/dashboardToday.test.ts`)
  - [x] Phase 2+3 — dashboard components (`DashboardHeader`, `GuidedStepsBar`, `NextUpSection/Card`, `AttentionSection`, `EverythingElseSection`, `RecentWorksheetRow`, `EmptyDashboard`, `CompactStatsBar variant="list"`) + `Dashboard.tsx` rewrite; `create_homework` detection restored in `useOnboardingProgress`. Note: `/students` tile links to a route that ships in Phase 4; `unifiedBell:open` listener ships in Phase 6.
  - [ ] Phase 4 — `/students` (`AllStudentsPage`)
  - [ ] Phase 5 — `/profile` Usage card + `AddStudentDialog` Hub helper text
  - [ ] Phase 6+7 — `OnboardingChecklist` route gate, `UnifiedBell` open event, demo data
  - [ ] Phase 8 — cleanup + RAG (`docs/llm-context.md`, `public/llms.txt`)
- [ ] Student Workspace — 3 tabs (Prep / Timeline / Library) + snapshot panel, DSLM as deep view
- [ ] Guided mode beyond the dashboard

## Deferred

- [ ] P2.2 Multi-voice TTS (explicitly excluded until further notice)
- [ ] SEO growth: `/blog/communicative-language-teaching-activities.html` content + meta rewrite
