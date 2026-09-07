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

- [ ] Student Workspace — 3 tabs (Prep / Timeline / Library) + snapshot panel, DSLM as deep view
- [ ] Guided mode beyond the dashboard

## Deferred

- [ ] P2.2 Multi-voice TTS (explicitly excluded until further notice)
- [ ] SEO growth: `/blog/communicative-language-teaching-activities.html` content + meta rewrite
