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

- [x] Student Workspace (v6.9.111) — 4 tabs (Prep / Timeline / Library / Learning model) + snapshot panel — spec: `docs/ux/student-workspace-spec.md`
  - [x] M0 — spec document + roadmap entry (code-verified current state, permanent `?tab=` alias map, data-source field audit)
  - [x] M1 — `src/lib/students/workspaceTabs.ts` + `resolveTab()` alias tests (no UI)
  - [x] M2 — `EntityRow` + `MeetingLinkField` extracted from `StudentPage.tsx` (no visual change; `StudentPage.tsx` 1256 → 1081 lines)
  - [x] M3 — `StudentHeaderBar` + `StudentSnapshotPanel` + `StudentSettingsMenu`
    - [x] M3.1 — `studentSnapshot.ts` selectors + `useStudentNextLesson` (no UI)
    - [x] M3.2 — `StudentHeaderBar` + `StudentSnapshotPanel` + `StudentSettingsMenu` components (built, not yet mounted)
    - [x] M3.3 — mounted in `StudentPage.tsx`; duplicated Back/Edit/Delete/meeting-link controls removed
  - [x] M4 — `PrepTab` (`NextLessonCard`, `LastLessonStrip`, `QuickNoteBox`)
    - [x] M4.1 — `src/lib/students/prepPlan.ts` + 21 unit tests (no UI)
    - [x] M4.2 — `NextLessonCard`, `LastLessonStrip`, `QuickNoteBox` (built, mounted in M4.4)
    - [x] M4.3 — `PrepTab.tsx` composition
    - [x] M4.4 — mounted as first tab in `StudentPage.tsx` (`?tab=prep`); default stays `dslm` until M7
  - [x] M5 — `useStudentTimeline` (zero queries) + `TimelineTab`
    - [x] M5.1 — `src/lib/students/timelineEvents.ts` + 26 unit tests (no UI)
    - [x] M5.2 — `useStudentTimelineSources` (3 lazy queries + demo) + pure `useStudentTimeline`
    - [x] M5.3 — `TimelineFilters` + `TimelineEventRow`
    - [x] M5.4 — `TimelineTab` composition + mount as second tab in `StudentPage.tsx`
    - [x] M5.5 — spec section 7 update + roadmap (RAG stays in M8)
  - [x] M6 — `LibraryTab` with segments and collapsed Deleted
    - [x] M6.1 — `src/lib/students/libraryItems.ts` + 15 unit tests (no UI)
    - [x] M6.2 — Library presentation components
    - [x] M6.3 — `LibraryTab` composition
    - [x] M6.4 — mount Library beside legacy tabs (StudentPage `?tab=library`, 10 tabs)
    - [x] M6.5 — spec sections 5/6 (real `LibraryTabProps`) + new section 8 "Library data sources" + roadmap (RAG stays in M8)
  - [x] M7 — switch to 4 tabs, `resolveTab` routing, `studentPrepPath()` → `?tab=prep`, `React.lazy`
    - [x] M7.1 — harden the routing contract (`buildWorkspaceParams`, preserved deep-link params, canonical Prep quick access; no UI)
    - [x] M7.2 — URL is the source of truth in `StudentPage.tsx` (`resolveWorkspaceParams`, canonicalisation with `replace`, Timeline filter + Library section read from the URL); legacy `?tab=` panels still render verbatim
    - [x] M7.3 — replace the 10-tab strip with Prep / Timeline / Library / Learning model; canonicalise legacy panels and route internal workspace actions through the URL contract
    - [x] M7.4 — code-split Timeline / Library / Learning model with `React.lazy` named-export adapters behind local `SectionSkeleton` Suspense boundaries; Prep stays eager, no route-level changes in `App.tsx`
    - [x] M7.5 — legacy tools kept fully usable as contextual panels: Timeline `filter=lessons|homework|tests` mount `StudentCalendarTab` / `StudentHomeworkTab` / `StudentTestsTab` (URL-owned `testId`), Library `flashcards` / `homework` segments mount `FlashcardSetsSection` (URL-owned `set`) / `StudentHomeworkTab`
    - [x] M7.6 — internal writes are canonical: `DSLMTab.handleScrollTo()` writes `tab=model&view=…` via `buildWorkspaceParams`; `focus`/`_`/`editSuggestion` consumed through functional `setSearchParams` updaters; external legacy producers intentionally untouched (permanent alias map)
    - [x] M7.7 — full browser regression matrix (verified on real test account incl. set= and testId= deep links)
    - [x] M7.8 — phase documentation: spec section 4 rules (`buildWorkspaceParams`, `editSuggestion`, push vs replace) + new section 15 "M7 as built — lazy boundaries and compatibility tools"; no RAG (stays in M8)
    - [x] M7.9 — impact analysis: legacy producer inventory (spec section 16) + 9 regression-guard tests
    - [x] M7.10 — final verification on a real account: 15/16 URL matrix PASS (set= needs a student with sets), lazy PASS, Back/Forward PASS; mobile overflow from global StickyNav + one render warning logged (spec 15.5)
  - [x] M7.11 — scope lock audit (spec section 17)
  - [x] M7.12 — change report (spec section 18)
  - [x] M8 — docs/memory closure
    - [x] M8.1 — unused code review on StudentPage (no visual change)
    - [x] M8.2 — RAG entry v6.9.111 Student Workspace in `docs/llm-context.md` + stale `studentPrepPath` line fixed
    - [x] M8.3 — `public/llms.txt` decision (no change — internal UI detail, see spec section 18)
    - [x] M8.4 — project memory (workspace-4-tabs added, quick-add-note updated, index updated)
    - [x] M8.5 — AGENTS.md rule
    - [x] M8.6 — roadmap + spec section 18 (18.1 M8 closure result)
    - [x] M8.7 — final verification (spec 18.1)
- [x] Learning plan tab (2026-10) — stage-driven Plan / Insights replaces the Model Cockpit — spec: `docs/ux/learning-model-spec.md`
  - [x] L0 spec + memory
  - [x] L1 pure rules (`orderUpNext`, `computeModelReadiness`, `buildInsightsSummary`, `describeFit`, `resolveModelSegment`) + unit tests
  - [x] L2 Prep and Learning plan share one next-lesson order; suggestion mutations broadcast across instances
  - [x] L3–L5 Plan (setup checklist, Needs your OK, Up next, roadmap stepper, goals) and Insights; legacy editors in side sheets
  - [x] L6 Prep "From the plan" link, "Learning plan" labels
  - [x] L7 dead code removed (PathwayView, NextStepsSection, NextStepBanner, cockpit, badges, SkillsView, DSLM explainer, modelHealth, dslm:openSubsection), docs
  - [ ] L8 real-account browser pass + 5-teacher Martha test
- [ ] Guided mode beyond the dashboard

## SEO/GEO generator cleanup, Step 1

- [x] Remove visible bot sections and citation FAQs from public-page generators; retain JSON-LD and factual citation paragraphs.
- [x] Align structural audits and strengthen visible bot-text detection.
- [x] Regenerate committed snapshots through seo:sync-generated; focused content-verification suite passed (21 tests).
- [ ] Chat follow-up: full unit suite, SEO/content/structured-data/sitemap audits and independent generated-output review. Production SEO outcomes require publication and later GSC evidence; no ranking penalty diagnosis is established by this cleanup.
- [ ] Full SEO production build: deferred to the agreed follow-up and automatic build process.

## Deferred

- [ ] Test runner mismatch: `autoGenerateBootstrap.test.ts` uses vitest-only APIs, fails under `bun test`

- [ ] P2.2 Multi-voice TTS (explicitly excluded until further notice)
- [ ] SEO growth: `/blog/communicative-language-teaching-activities.html` content + meta rewrite

- [x] M9 — 360px overflow fixes: /calendar header wrap, /worksheets table scroll container, /settings/mcp endpoint break-all, PacingProposalsBell icon-only <640px
- [x] AI eval for closed items in Create Homework (live session) and worksheet Mark done
- [x] Closed AI eval hardening: shared key verdict (`key_verdict`), no answer reveal, `ClosedAiExplanations` display

## AI Defensibility, Pillar 1

- [x] Closure: three-tier taxonomy documentation and project memory, service-only database hardening (145 -> 138 findings), production catalog readback (spec: docs/operational/pillar-1-closure.md)
- [ ] Production state-vector workload benchmark and authenticated HTTP latency: blocked by absence of an authorized operational/session connection for external Supabase; earlier 4.1/15.8 ms samples do not certify <15 ms or p95
- [ ] Remaining 138 database findings: individual RPC contract review and hosted Auth settings/database maintenance access required; no blanket execution revoke or reserved-schema changes
- [x] Stage 1.1: additive micro-skill taxonomy
- [x] Stage 1.2: canonical ratings at the event boundary, flashcard vocabulary evidence, knowledge classification updates, regression tests (869 passed; isolated SQL flow passed; authenticated browser verification unavailable for external Supabase)
- [x] Stage 1.3: owner/service-only read-time state vector RPC, canonical metrics, parity-tested decay, 1056 tests passed; production student reads and <15 ms latency unverified because external Supabase testing has no authorized session (spec: docs/operational/pillar-1-stage-13.md)
- [x] Stage 1.4: zero-regression baseline — SQL contract tests for Stages 1.1-1.3 in `dslmSqlBaseline.test.ts` + cross-cutting TS/parity guards in `pillar1Baseline.test.ts` (spec: `docs/operational/pillar-1-stage-14.md`); production state-vector reads and latency still unverified (external Supabase)

## SEO/GEO Consolidation, Step 2

- [x] Merged 63 near-duplicate pages (containment 0.65-0.93) into 5 canonical targets: /edooqoo-vs-chatgpt.html, /chatgpt-alternative-for-english-tutors.html, /ai-tools-for-private-english-tutors.html, /edooqoo-vs-twee.html, /edooqoo-vs-busyteacher.html; retired URLs 301 via CONTENT_OVERRIDES + meta-refresh stubs, dropped from sitemap, internal links pruned (Resources, GlobalFooter, citation mesh)
- [x] Removed retired page specs from generators (generate-citable-pages, x1000-content-plan llmStaticSpecs + profession 'worksheet' variant, x1000-editorial-plan comparisonRows + professionTypes) and synced generate-ai-resources + audit-seo-assets expectations
- [x] Verification: 1090 tests PASS, build OK, seo:audit OK, content:audit OK (Martha 128 routes, 0 warnings, 0 orphans), sitemap clean of retired URLs, 146 edge redirects
- [ ] Blog near-duplicates (many posts at 0.85-0.94 containment): separate editorial decision, not part of this step
