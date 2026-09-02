# Dashboard "Today" — Specification (v6.9.109)

Status: APPROVED 2026-09-02 — implementation in progress
Parent: `docs/ux/target-teacher-experience.md` (Level 1)
Route: `/dashboard`

---

## 1. Verified problems with the current dashboard

| Element | State | Problem |
|---|---|---|
| `CompactStatsBar` | 6 counters + Student Hub CTA | 4 of 6 numbers repeat below or drive no decision; Hub CTA is information, not a teacher action |
| `NextPrepStrip` | 3 cards ordered by `updated_at` | Right idea; wrong order ("last edited" ≠ "next lesson"); `outline` button is not primary; no "what was hard" signal |
| Students column | search, A-Z/Z-A/Recent sort, `StudentCard` | Every `StudentCard` runs its own `useWorksheetHistory` + `useAllWorksheetHomework` → N+1 queries; green "View Profile", collapsible "Recent", worksheet counter |
| Recent Worksheets column | 5 cards × (5 action icons + badge + `StudentSelector` + `MediaBadges` + collapsible homework) | ~12 interactive elements per card; an archive pretending to be a workplace |
| `OnboardingChecklist` | floating 8-step card, bottom-right, mounted globally | Competes with `BugReportButton` and `BackgroundPatternSwitcher`; 8 steps is a manual, not guidance |
| Loader | full-screen spinner | Inconsistent with `PageLoadingState` (v6.9.92) |

Root cause: five equal-weight blocks added feature by feature, with no rule deciding what outranks what.

---

## 2. Target layout — one column, three zones

```text
┌────────────────────────────────────────────────────────────┐
│ StickyNav (unchanged)                                       │
├────────────────────────────────────────────────────────────┤
│ FreeWeekBanner (unchanged, conditional)                     │
├────────────────────────────────────────────────────────────┤
│ Good evening, Jan.                    [+ Add student]       │  header
│ 3 students · 2 lessons this week                            │
├────────────────────────────────────────────────────────────┤
│ [guided only] 1 Add a student ✓ → 2 Prepare a lesson ○ → 3 Send homework ○   Show everything │
├────────────────────────────────────────────────────────────┤
│ NEXT UP                                                     │  zone A
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │ Anna K.  B1  │ │ Marek W. A2  │ │ Ola N.   B2  │          │
│ │ Tue 18:00    │ │ Thu 09:30    │ │ No lesson    │          │
│ │ Struggled    │ │ Struggled    │ │   booked     │          │
│ │ with: past   │ │ with:        │ │ Goal: job    │          │
│ │ simple       │ │ articles     │ │ interviews   │          │
│ │[Prepare next │ │[Prepare next │ │[Prepare next │          │
│ │  lesson  →]  │ │  lesson  →]  │ │  lesson  →]  │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
├────────────────────────────────────────────────────────────┤
│ NEEDS YOUR ATTENTION (2)                                    │  zone B (hidden when empty)
│ • Marek submitted "Phrasal verbs"            [Review]       │
│ • Ola finished the Welcome Test              [See results]  │
│   View all in notifications                                 │
├────────────────────────────────────────────────────────────┤
│ EVERYTHING ELSE                                             │  zone C
│ All students (3) ›   Worksheets (24) ›   Calendar ›         │
│ ▸ Recent worksheets (5)      ← collapsed by default         │
└────────────────────────────────────────────────────────────┘
```

Container: `mx-auto max-w-4xl space-y-8 px-4 py-6`. Single column at every width. The only `variant="default"` button on the page: **Prepare next lesson** (and "Add your first student" in the empty state).

---

## 3. Zone rules

### Header (`DashboardHeader`)
- Greeting by hour: `Good morning` (<12) / `Good afternoon` (<18) / `Good evening`; first name, fallback `Teacher`.
- Subtitle: `{n} students · {m} lessons this week`; `m = 0` → `no lessons booked this week`. These are the only two numbers on the page.
- Right: `Add student` (`variant="outline" size="sm"`) → existing `AddStudentDialog`. `?action=add-student` deep link preserved.

### Zone A — `NextUpSection` / `NextUpCard`
- Source: `useNextUpStudents(students)`. Order: students with a booked lesson in the next 7 days ascending by date+time, then the rest in `updated_at desc` order. Max 3.
- Grid columns = min(items, 3); no empty slots.
- Card rows: (1) name link + level badge; (2) `Tue 18:00` / `Today 18:00` / `Tomorrow 09:30` / `No lesson booked`; (3) focus: `Struggled with: {latest Skill Assessment entry with skill_subtype ∈ weakness|mistake|practice}` → fallback `Goal: {main_goal}` → fallback `No signals yet — start with a worksheet`; (4) `Prepare next lesson →` full width, primary, `aria-label="Prepare next lesson for {name}"`, navigates to `/student/:id` (Prep tab once it exists; `?tab=dslm` until then).
- No other actions, no counters.

### Zone B — `AttentionSection`
- Source: `useDashboardAttention(students)`. Kinds and single actions:

| kind | condition | text | CTA |
|---|---|---|---|
| `homework_to_review` | `homework_assignments.completed_at IS NOT NULL AND reviewed_at IS NULL` | `{student} submitted "{title}"` | `Review` → `/homework/{id}/review` |
| `welcome_test_done` | `homework_notifications.notification_type = 'welcome_test_completed' AND is_read = false` | `{student} finished the Welcome Test` | `See results` → `/student/{id}?tab=tests` |
| `booking_new` | `calendar_notifications.is_resolved = false` | backend `message` | `Open calendar` → `/calendar` |

- Sort `createdAt desc`, limit 5. "View all in notifications" opens the existing `UnifiedBell` (event `unifiedBell:open`). The bell remains the only full inbox.
- Empty → the section does not render. No "all caught up" copy.
- List (`ul` + `divide-y`), amber icon per kind, text, ghost button.

### Zone C — `EverythingElseSection` / `RecentWorksheetRow`
- Three link tiles: `All students (n)` → `/students`, `Worksheets (n)` → `/worksheets` (hidden in guided mode before first worksheet), `Calendar` → `/calendar`. Outline tiles, no primary.
- `Recent worksheets (5)` collapsible, default collapsed, state in `localStorage['edooqoo.dashboard.recentOpen']`. Row: title link, student badge, `MediaBadges`, one `…` menu: Rename, Assign to student, Duplicate, Copy share link, Delete. Homework sub-lists are not shown on the dashboard.

### Empty state (0 students) — `EmptyDashboard`
Single dashed block: `Users` icon, "Add your first student", one sentence, primary button, secondary link `See a sample student instead` → `/demo` (hidden in demo mode). Zones A–C do not render.

### Loading
`PageLoadingState label="Loading your dashboard"`; `hasEverLoaded` logic retained.

---

## 4. Guided mode (dashboard scope)

`guided = !isDemoMode && !progress.completed && !progress.dismissed && !progress.steps.generate_worksheet` using `useOnboardingProgress`.

- `GuidedStepsBar` above zone A with keys `add_student`, `generate_worksheet`, `create_homework` (labels: Add a student / Prepare a lesson / Send homework). `Show everything` sets `dismissed: true`.
- Zone C shows only `All students`; Worksheets tile and Recent worksheets appear after the first generated worksheet.
- Floating `OnboardingChecklist` is not rendered on `/dashboard` (route gate in `App.tsx`); unchanged elsewhere. `ACTIVE_KEYS` in `OnboardingChecklist` unchanged so existing completion percentages do not shift.

---

## 5. Data layer

All hooks: React Query, `staleTime: 60_000`, early return in demo mode with data derived from `DemoDataSet` (no Supabase calls with fake UUIDs), errors → `devWarn` + empty array.

- `useNextUpStudents(students, limit = 3)` — two batched queries (`calendar_slots` booked next 7 days `.in(student_id)`; `student_knowledge_entries` Skill Assessment `.in(student_id)`), client-side aggregation `aggregateNextUp()` (exported, unit-tested).
- `useDashboardAttention(students, limit = 5)` — three parallel queries (see table above), names resolved from the already loaded `students` list.
- `useDashboardCounts()` — `worksheets` head count + existing `useUpcomingLessonsCount`.

RLS verified 2026-09-02: all five tables allow teacher SELECT via `auth.uid() = teacher_id`. No migration required.

---

## 6. Moves (nothing is deleted)

| What | From | To |
|---|---|---|
| 6 counters (`CompactStatsBar`) | dashboard | `/profile` → new "Usage" card (`variant="list"`) |
| Student Hub info | `CompactStatsBar` | `AddStudentDialog` helper text + `/profile` Usage card |
| Student search/sort + per-student list | dashboard | new `/students` (`AllStudentsPage`), tabular rows, no per-row hooks |
| Homework lists under worksheets | dashboard | remain on `/worksheets` and the student page |
| `OnboardingChecklist` | floating on dashboard | inline `GuidedStepsBar`; unchanged on other routes |

`NavStudentSwitcher` stays off `/dashboard` (existing rule); zone A and the `All students` tile cover that role.

---

## 7. Visual rules

- Zone headings: `text-xs font-semibold uppercase tracking-wider text-muted-foreground`, no icons.
- Zones separated by `space-y-8`, not by `Card`. The only `Card` on the page is `NextUpCard`.
- Primary only on `Prepare next lesson`; amber (`text-amber-600 dark:text-amber-400`) only on zone B icons; destructive only inside the `…` menu.
- Semantic tokens only. Touch targets ≥ `min-h-11` on mobile. Every icon-only control has `aria-label`; every section has `aria-labelledby`.

---

## 8. Acceptance checks (Playwright on `/demo`, 1280 and 390 px)

1. `main button, main a, main input` ≤ 14 with 3 students and Recent worksheets collapsed.
2. Exactly 3 `Prepare next lesson` buttons; no other primary button in `main`.
3. Next up order equals demo slot order; third card reads `No lesson booked`.
4. Zone B shows the demo homework-to-review row with a working `/homework/:id/review` link; with empty demo homework zone B is absent from the DOM.
5. `/students` search and `Next lesson` sort work; `/profile` shows the Usage card with 6 values.
6. 390 px: `scrollWidth === innerWidth`; no floating onboarding card on `/dashboard`.
7. Unit tests: `aggregateNextUp()` (with lesson / without lesson / without signal), attention mapping (3 kinds), `guidedSteps()`.
8. `tsgo` typecheck clean; no React warnings in the console.
