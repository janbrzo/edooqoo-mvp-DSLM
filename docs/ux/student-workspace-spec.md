# Student Workspace — Specification (v6.9.111)

Status: APPROVED 2026-09-11 — implementation pending
Parent: `docs/ux/target-teacher-experience.md` (Level 2)
Route: `/student/:id`
Sibling: `docs/ux/dashboard-today-spec.md` (Level 1)

This document is the single source of truth for phases M1–M8. Where it refines the north star it must never contradict it; the one deliberate divergence is named in section 10.

---

## 1. Verified current state

All rows below were verified by reading the code on 2026-09-11.

| Element | State | Problem |
|---|---|---|
| `src/pages/StudentPage.tsx` | 1256 lines; 11 `TabsContent` panels; local `MeetingLinkField` component (~170 lines); 4 modals (`StudentEditDialog`, `ShareWorksheetModal`, `RenameDialog`, `StudentKnowledgeQuickAddModal`); two independent paginations (`currentPage`, `deletedCurrentPage`) | One file owns routing, data, layout and every panel; no unit boundary to test or lazy-load |
| Tab strip | `TabsList` with `grid-cols-7`; labels hidden below `lg` (`hidden lg:inline`), leaving 7 unlabeled icons | Icon-only navigation at the exact width most laptops use |
| Hidden panels | `progress`, `skills`, `knowledge`, `events` render `TabsContent` but have no `TabsTrigger`; reachable only via a manual `?tab=` value or `handleTabChange` redirect map | Dead surface that still mounts code paths |
| Overview tab | `WelcomeTestSuggestion` + `OneMinutePrepCard` + Hub banner + 3-column grid: Student Details (8 fields, Edit button, visible destructive trash icon, type-to-confirm dialog, `MeetingLinkField`), Recent Worksheets (list + Generate + View All + per-row actions), Notes card | ~35 interactive elements on the first screen; settings and work are mixed |
| Default tab | `useState(searchParams.get('tab') \|\| 'dslm')` — DSLM opens by default | The most complex view in the product is the first thing a new teacher sees |
| Naming | "1 MINUTE" (tab label), "DSLM" (feature), "1-Minute Prep" (`OneMinutePrepCard`) | Three names for one capability on one screen |
| Data loading | All 11 panels mount together; `StudentHomeworkTab`, `StudentTestsTab`, `StudentCalendarTab`, `DSLMTab`, `FlashcardSetsSection` each fetch their own data | Every student page visit pays for panels the teacher never opens |

Root cause: the page is organised around system objects (worksheets, homework, flashcards, calendar, tests, DSLM) instead of the teacher's recurring ritual — prepare the next lesson, close the previous one — so the teacher must assemble the process from seven equal-weight drawers.

---

## 2. Target layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ StickyNav (unchanged)                                                 │
├──────────────────────────────────────────────────────────────────────┤
│ ‹ Back   Anna Kowalska · B1 · next lesson Tue 18:00            [ … ]  │  StudentHeaderBar
├───────────────────────────────────────────────┬──────────────────────┤
│ [ Prep ] [ Timeline ] [ Library ] [ Model ]   │  STUDENT SNAPSHOT    │
├───────────────────────────────────────────────┤  Level     B1        │
│                                               │  Goal      job intvw │
│  active tab content                           │  Deadline  12 Nov    │
│                                               │  Focus areas         │
│                                               │   · past simple      │
│                                               │   · phrasal verbs    │
│                                               │   · fluency          │
│                                               │  Hub  enabled        │
│                                               │  [Open learning      │
│                                               │   model →]           │
└───────────────────────────────────────────────┴──────────────────────┘
```

Container: `mx-auto max-w-6xl px-4 py-6`.
Grid: `lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8`.
Snapshot: `lg:sticky lg:top-20 lg:self-start`; below `lg` it collapses to a single summary row directly under the header, expandable on click.
The only `variant="default"` button on the page is **Generate worksheet** in Prep.

---

## 3. Tab model

| URL value | Label | Icon | One job | Loading |
|---|---|---|---|---|
| `prep` | Prep | `Sparkles` | Create the next lesson | eager (default) |
| `timeline` | Timeline | `Activity` | See what happened and react | `React.lazy` |
| `library` | Library | `FileText` | Find and reuse existing material | `React.lazy` |
| `model` | Learning model | `Brain` | Inspect and steer the DSLM | `React.lazy` |

Labels are always visible, at every breakpoint. Four labelled tabs fit on a 360 px viewport, so the icon-only mode is removed from the project. `TabsList` becomes `grid w-full grid-cols-4`.

---

## 4. URL contract

Legacy links live in sent emails, browser bookmarks and Edge Function templates. They must keep working indefinitely; the alias map is permanent, not transitional.

| Legacy `?tab=` | New `tab` | Extra params written |
|---|---|---|
| `overview` | `prep` | — |
| `dslm` | `model` | keep `view`, `focus` |
| `1minute` | `model` | — (defensive: "1 MINUTE" is only a label today, `TabsTrigger value="dslm"`; no producer emits `?tab=1minute`) |
| `progress` | `model` | `view=pathway` |
| `skills` | `model` | `view=skills` |
| `knowledge` | `model` | `view=profile` |
| `events` | `model` | `view=profile` |
| `worksheets` | `library` | `section=worksheets` |
| `flashcards` | `library` | `section=flashcards`, keep `set` |
| `homework` | `timeline` | `filter=homework` |
| `tests` | `timeline` | `filter=tests`, keep `testId` |
| `calendar` | `timeline` | `filter=lessons` |
| missing / unknown | `prep` | — |

The `view`/`focus` mappings mirror the existing `redirectMap` in `StudentPage.tsx` so that `OnboardingChecklist` spotlights keep landing on the same DSLM sub-view.

Rules:

1. Canonical tab values: `prep | timeline | library | model`. Canonical `section`: `worksheets | flashcards | homework`. Canonical `filter`: `all | lessons | worksheets | homework | notes | tests`.
2. Pass-through params, never dropped during rewriting: `set`, `intake`, `view`, `focus`, `testId`, `_`.
3. Rewriting happens once, on mount and on `searchParams` change, via `setSearchParams(next, { replace: true })` — history must not grow and Back must not loop.
4. `studentPrepPath()` in `src/lib/students/quickAccess.ts` returns `/student/${id}?tab=prep` from M7 onward.

Known producers of `?tab=` links (verified with `rg -n "tab=" src/ supabase/functions/`):

- `?tab=tests` — `supabase/functions/process-welcome-test/index.ts` (email CTA), `useDashboardAttention.ts`, `UnifiedBell.tsx`, `HomeworkNotificationBadge.tsx`, `WelcomeTestSuggestion.tsx` (also `&testId=`), `WelcomeTestPage.tsx`
- `?tab=dslm` — `quickAccess.ts`, `NextUpCard.tsx`, `SlotDetailModal.tsx`, `PacingProposalsBell.tsx`, `NextStepsPresetBanner.tsx` (`&view=pathway`), `AddStudentDialog.tsx` (`&view=…&focus=…&_=…`), `OnboardingChecklist.tsx` (`&view=…&focus=…`)
- `?tab=flashcards` — `ViewFlashcardSetsModal.tsx`
- `?tab=overview`, `?tab=worksheets`, `?tab=homework`, `?tab=calendar`, `?tab=1minute` — no current producer; reachable from bookmarks, older emails and manual URLs only
- `?tab=progress|skills|knowledge|events` — no producer; today they are absorbed by `redirectMap` in `StudentPage.tsx` (`skills→dslm/skills`, `knowledge→dslm/profile`, `progress→dslm/pathway`, `events→dslm/profile`), which the section 4 table reproduces one-to-one
- `OnboardingChecklist.tsx` emits relative query strings (`?tab=dslm&view=…&focus=…`) rather than absolute paths; `resolveTab()` must therefore run on `searchParams`, not on a parsed full URL

The rg sweep on 2026-09-11 returned no `?tab=` value outside the table above. The Edge Function email link is **not** edited; the alias map absorbs it.

---

## 5. Component inventory

| Path | Phase | Source | Responsibility |
|---|---|---|---|
| `src/lib/students/workspaceTabs.ts` | M1 | new | Canonical tab values, alias map, `resolveTab()` |
| `src/components/student/EntityRow.tsx` | M2 | new | The one row anatomy used by Prep, Timeline and Library |
| `src/components/student/MeetingLinkField.tsx` | M2 | extracted | Meeting link editor, unchanged behaviour |
| `src/components/student/StudentHeaderBar.tsx` | M3 | new | Back, name, level, goal, next lesson, `…` menu |
| `src/components/student/StudentSnapshotPanel.tsx` | M3 | new | Level, goal, deadline, focus areas, Hub status, Open learning model |
| `src/components/student/StudentSettingsMenu.tsx` | M3 | new | Edit details, meeting link, Hub & email, delete (type-to-confirm) |
| `src/components/student/prep/PrepTab.tsx` | M4 | new | Prep composition |
| `src/components/student/prep/NextLessonCard.tsx` | M4 | new | Proposed topic, rationale, Generate worksheet |
| `src/components/student/prep/LastLessonStrip.tsx` | M4 | new | Last worksheet, Open / Reuse |
| `src/components/student/prep/QuickNoteBox.tsx` | M4 | new | One-field note capture + last three notes |
| `src/hooks/useStudentTimeline.ts` | M5 | new | Pure composition of existing data into one event stream |
| `src/components/student/timeline/TimelineTab.tsx` | M5 | new | Stream, date grouping, load more |
| `src/components/student/timeline/TimelineEventRow.tsx` | M5 | new | `EntityRow` bound to `TimelineEvent` |
| `src/components/student/timeline/TimelineFilters.tsx` | M5 | new | Filter pills bound to `?filter=` |
| `src/lib/students/libraryItems.ts` | M6 | new | Pure Library rules: item mapping, search, sort, date format |
| `src/components/student/library/LibraryTab.tsx` | M6 | new | Segmented archive + collapsed Deleted |
| `src/components/student/library/LibrarySegments.tsx` | M6 | new | Always-visible section switcher with counts |
| `src/components/student/library/LibraryToolbar.tsx` | M6 | new | Search, sort, `Generate worksheet` |
| `src/components/student/library/WorksheetLibraryRow.tsx` | M6 | new | Dense `EntityRow` for one worksheet + `…` menu |
| `src/components/student/library/DeletedWorksheetsSection.tsx` | M6 | new | Collapsed restore-only list |

Used unchanged: `DSLMTab`, `DslmExplainerBanner`, `FlashcardSetsSection`, `StudentHomeworkTab`, `StudentTestsTab`, `StudentCalendarTab`, `WelcomeTestSuggestion`, `IntakeExtractionBanner`, `StudentEditDialog`, `ShareWorksheetModal`, `RenameDialog`, `StudentKnowledgeQuickAddModal`, `MediaBadges`, `SectionSkeleton`, `DeleteWorksheetButton`, `DuplicateWorksheetButton`, `AttentionDot`.

---

## 6. Prop contracts

```ts
// src/lib/students/workspaceTabs.ts
export type WorkspaceTab = 'prep' | 'timeline' | 'library' | 'model';
export type LibrarySection = 'worksheets' | 'flashcards' | 'homework';
export type TimelineFilter =
  | 'all' | 'lessons' | 'worksheets' | 'homework' | 'notes' | 'tests';

export interface ResolvedTab {
  tab: WorkspaceTab;
  section?: LibrarySection;
  filter?: TimelineFilter;
  view?: string;
  changed: boolean; // true when the input was a legacy alias
}

export function resolveTab(raw: string | null): ResolvedTab;
```

```ts
// src/hooks/useStudentTimeline.ts
export type TimelineEventType =
  | 'lesson' | 'worksheet' | 'homework_sent' | 'homework_returned'
  | 'note' | 'test_result' | 'mastery_change';

export interface TimelineEvent {
  id: string;              // `${type}:${sourceId}` — dedupe key
  type: TimelineEventType;
  at: string;              // ISO 8601; sort key, descending
  title: string;
  subtitle?: string;
  needsAction: boolean;
  href?: string;
  actionLabel?: string;    // rendered only when needsAction
}

export interface StudentTimelineResult {
  events: TimelineEvent[];
  counts: Record<TimelineFilter, number>;
  isLoading: boolean;
}
```

```ts
// src/components/student/EntityRow.tsx — implemented in M2
export type EntityRowTone = 'default' | 'destructive';
export type EntityRowMode = 'link' | 'button' | 'static';

export interface EntityRowProps {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;        // right-aligned, usually a formatted date
  href?: string;                 // renders <a> + ::after overlay, middle-click works
  onClick?: () => void;
  needsAction?: boolean;         // AttentionDot + amber action button
  actionLabel?: string;
  onAction?: () => void;
  menu?: React.ReactNode;        // DropdownMenu content behind the `…` trigger
  badges?: React.ReactNode;      // MediaBadges and similar
  actions?: React.ReactNode;     // existing buttons (Delete/Duplicate/Transfer)
  dense?: boolean;               // Library archive density
  tone?: EntityRowTone;          // 'destructive' for the Deleted section
  className?: string;
  'data-testid'?: string;
}

// Pure decision helper, unit-tested without a DOM renderer.
export function resolveRowClasses(
  props: Pick<EntityRowProps, 'href' | 'onClick' | 'dense' | 'tone' | 'className'>,
): ResolvedRowClasses;
```

Interaction contract: `href` wins over `onClick` (`mode: 'link'`); `onClick` alone yields
`role="button"` with Enter/Space; neither yields a static row with no hover affordance.

```ts
export interface StudentHeaderBarProps {
  studentId: string;
  name: string;
  englishLevel: string | null;
  mainGoal: string | null;
  nextLessonLabel: string | null; // e.g. "Tue 18:00", null when none booked
  menu: React.ReactNode;
}

export interface StudentSnapshotPanelProps {
  studentId: string;
  teacherId: string;
  englishLevel: string | null;
  mainGoal: string | null;
  mainGoalTargetDate: string | null;
  focusAreas: string[];           // max 3, from Skill Assessment entries
  hubEmail: string | null;
  onOpenModel: () => void;
  menu: React.ReactNode;
}

export interface StudentSettingsMenuProps {
  student: Tables<'students'>;
  teacherId: string;
  gcalEnabled: boolean;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

export interface PrepTabProps {
  student: Tables<'students'>;
  teacherId: string;
  worksheets: WorksheetHistoryItem[];
  totalWorksheetCount: number;
  onGenerate: (payload: GeneratePayload) => void; // same contract as today
  onAddNote: () => void;
}

export interface TimelineTabProps {
  studentId: string;
  teacherId: string;
  filter: TimelineFilter;
  onFilterChange: (next: TimelineFilter) => void;
}

// src/lib/students/libraryItems.ts — implemented in M6
export type LibrarySort = 'newest' | 'oldest' | 'title';
export const LIBRARY_PAGE_SIZE = 10;

export interface LibraryWorksheetItem {
  id: string;
  title: string;            // '' → 'Untitled worksheet'
  createdAt: string;
  grammar: string | null;   // from form_data.grammar
  hasImage: boolean;
  hasAudio: boolean;
  isShared: boolean;
  shareToken: string | null;
  studentId: string | null;
}

export function buildWorksheetItems(rows: readonly LibraryWorksheetSource[]): LibraryWorksheetItem[];
export function filterBySearch(items: readonly LibraryWorksheetItem[], query: string): readonly LibraryWorksheetItem[];
export function sortItems(items: readonly LibraryWorksheetItem[], sort: LibrarySort): LibraryWorksheetItem[];
export function formatLibraryDate(iso: string): string; // 'MMM dd, yyyy HH:mm'

// src/components/student/library/LibraryTab.tsx — as built in M6.3
export interface LibraryTabProps {
  section: LibrarySection;
  counts: LibrarySectionCounts;            // Partial<Record<LibrarySection, number>>
  onSectionChange: (section: LibrarySection) => void;

  items: readonly LibraryWorksheetItem[];  // already filtered and sorted by the page
  isLoading?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  sort: LibrarySort;
  onSortChange: (value: LibrarySort) => void;
  onGenerate: () => void;
  onOpen: (id: string) => void;
  onReuse: (id: string) => void;
  onRename: (id: string, currentTitle: string) => void;
  onShare: (item: LibraryWorksheetItem) => void;
  renderWorksheetActions?: (item: LibraryWorksheetItem) => React.ReactNode;

  page: number;                            // server pagination, worksheets only
  pageCount: number;
  onPageChange: (page: number) => void;

  deletedItems: readonly LibraryDeletedItem[]; // { id, title?, deletedAt }
  deletedTotalCount: number;
  isDeletedLoading?: boolean;
  onRestore: (id: string) => void;

  flashcardsSlot?: React.ReactNode;        // mounted only while that section is active
  homeworkSlot?: React.ReactNode;
}
```

No `any` in any new interface.

---

## 7. Data sources (as built, M5)

Timeline uses a deliberate two-layer split: a **pure composition layer** and a **lazy sources layer**.

### 7.1 `useStudentTimeline` — pure layer (no queries)

`src/hooks/useStudentTimeline.ts` is a `useMemo` composition over `src/lib/students/timelineEvents.ts` rules (`buildTimelineEvents`, `countByFilter`, `filterEvents`, `groupEventsByDate`). It performs **zero Supabase queries** — this is what prevents the N+1 pattern that `StudentCard` caused on the dashboard before v6.9.109. Every array it consumes is passed in by the caller.

### 7.2 `useStudentTimelineSources` — lazy sources layer

`src/hooks/useStudentTimelineSources.ts` fetches only what nothing else on `StudentPage` provides: lessons, homework assignments and tests. Worksheets and knowledge entries are reused from the page's existing `useWorksheetHistory` / `useStudentKnowledge` results. The single `useQuery` (key `['student-timeline-sources', teacherId, studentId, isDemoMode]`) is `enabled`-gated on the Timeline tab being active — it never fires on page load, and uses `staleTime: 60_000` + `refetchOnWindowFocus: false`. Errors degrade to empty lists via `devWarn`; the timeline never breaks the page.

| Source | Table / demo origin | Constraints | Limit |
|---|---|---|---|
| `lessons` | `calendar_slots` (demo: `demoData.calendarSlots` filtered by `student_id`) | `teacher_id` + `student_id`, `status != 'deleted'`, `slot_date >= today − 180 days`, order `slot_date desc, start_time desc` | 100 |
| `homework` | `homework_assignments` (demo: `demoData.homework` filtered by `student_id`) | `student_id`, order `created_at desc` | 100 |
| `tests` | `student_tests` (demo: always empty) | `student_id` + `teacher_id`, `deleted_at is null`, order `created_at desc` | 50 |

### 7.3 Event mapping (as built)

| Event type | Source | Date field | `needsAction` when |
|---|---|---|---|
| `lesson` | `lessons` (`CalendarSlot`) | `slot_date` + `start_time` | `status === 'needs_review'` → action `Mark done` → `?tab=calendar` |
| `worksheet` | page's `worksheets` (`WorksheetHistoryItem`) | `created_at` | never; href `/worksheet/{id}` |
| `homework_sent` | `homework` (`HomeworkAssignment`) | `created_at` | never |
| `homework_returned` | `homework` (`HomeworkAssignment`) | `completed_at` | `completed_at != null && completed_by_teacher !== true` (returned homework yields two events) |
| `note` | page's knowledge entries (`StudentKnowledgeEntry`) | `created_at` | never; first line of `content`, max 80 chars, href `?tab=knowledge` |
| `test_result` | `tests` (`StudentTest`) | `completed_at ?? created_at` | `completed_at != null && reviewed_at == null`; href `?tab=tests` |
| `mastery_change` | knowledge entries, `category === 'Skill Assessment'` with `metadata.mastery` (0–100) | `updated_at` | never |

Rules shared by all events: entries with `deleted_at` / `is_outdated` / `archived_at` or without a date are skipped; event `id` is `${type}:${sourceId}` (deduplicates the homework sent/returned pair); sort is `at` descending with `id` as the tiebreaker; `TIMELINE_PAGE_SIZE = 25` for client-side paging.

### 7.4 Demo mode

`useStudentTimelineSources` answers from `demoData` and issues zero Supabase calls in demo mode. Worksheets and notes come from `demoData` through the page's existing hooks; tests are always empty in demo. Every mutating action in new components goes through `useDemoGuard`.

---

## 8. Library data sources (as built, M6)

Library introduces **no new queries**. It is a pure projection of data the page already holds.

| Section | Origin | Notes |
|---|---|---|
| Worksheets | `useWorksheetHistory(studentId, page, pageSize = 10)` — the same hook the legacy Worksheets tab uses | Rows → `buildWorksheetItems` → `filterBySearch` → `sortItems`, all inside one `useMemo` on `StudentPage` |
| Deleted | `useDeletedWorksheets(studentId, …, deletedCurrentPage, pageSize)` | Mapped to `{ id, title, deletedAt }`; `onRestore` calls the hook's `restoreWorksheet` |
| Flashcards | not mounted yet (slot) | Count stays `undefined` until the section is mounted — no count query is issued |
| Homework | not mounted yet (slot) | Same rule |

Rules that follow from this:

- **Pagination is server-side** for worksheets (`page` / `pageCount` derived from `totalCount / LIBRARY_PAGE_SIZE`); search and sort apply to the current page only, matching the legacy tab's behaviour.
- **Counts are honest.** `counts.worksheets = totalCount`; sections without a mounted data source pass `undefined` and render no number rather than a wrong zero.
- **Deleted rows are restore-only.** No hard delete, no destructive icon; the section disappears entirely when `totalCount === 0`.
- **Section switching resets** `librarySearch` and the worksheet page to 1, so a teacher never returns to a filtered view they cannot see.
- Demo mode needs no special branch: both hooks already answer from `demoData`.

Library state (`librarySection`, `librarySearch`, `librarySort`) is local to `StudentPage` in M6 and moves into the URL (`?tab=library&section=…`) in M7.

---

## 9. Interaction patterns

Three patterns hold the workspace together and are defined once here:

1. **One row anatomy.** A worksheet in Prep, in Timeline and in Library is the same `EntityRow` with different props: icon, title, one context line, right-aligned date, optional amber action, `…` menu. The teacher learns the layout once.
2. **One `…` menu.** Every action other than the screen's primary action lives behind the `…` trigger, labelled `aria-label="More actions"`. Destructive actions appear only inside that menu — no visible trash icon anywhere on the page.
3. **One attention signal.** Amber dot plus an amber action button means "you must react". It is the same signal the dashboard's "Needs your attention" zone uses, so both levels speak one language.

Navigation rule: anything that leads to another address renders as `<a>` with modifier-aware `onClick`, per the existing middle-click anchor pattern, so Ctrl/Cmd/middle-click open a new tab natively.

---

## 10. Accessibility and styling contract

- Tabs: `role="tablist"`, each trigger with `aria-controls` and a visible text label.
- Snapshot: `<aside aria-label="Student snapshot">`; the mobile collapse toggle is a `button` with `aria-expanded`.
- Timeline filters: `role="group" aria-label="Filter timeline"`, each pill with `aria-pressed`.
- Every `…` trigger: `aria-label="More actions"`.
- Focus order: header → tabs → tab content → snapshot.
- Semantic tokens only. Forbidden in new code: `text-white`, `bg-white`, `bg-black`, `text-gray-*`, `text-green-*`, any `bg-[#…]`.
- Loading uses `SectionSkeleton` inside `Suspense`; full-page spinners are not introduced.

---

## 11. Migration and compatibility rules

1. Nothing is deleted until its replacement works. Dead-code removal happens only in M8.
2. Every phase ends with the application in a shippable state; no phase leaves a half-wired tab.
3. Legacy URLs work indefinitely. The alias map in section 4 is permanent.
4. Demo mode: hooks return early under `edooqoo_demo_mode`; all mutations pass `useDemoGuard`.
5. The Worksheet Generation Engine is untouched. Prep calls exactly what the page calls today: `writeAutoGenerateIntent(...)` for auto-generate, or the `sessionStorage` prefill keys (`preSelectedStudent`, `prefillWorksheet`, `prefillSuggestionId`, `prefillExercises`, `prefillMediaTypes`, `prefillExerciseFocusMap`, `forceNewWorksheet`) followed by `navigate('/')`.
6. `DSLMTab` keeps its full prop contract, including `onUseWorksheetSuggestion`, `useRoadmap`, `pacingMode`, `onMainGoalChange` and `onMainGoalTargetDateChange`.

**Deliberate divergence from the north star.** `target-teacher-experience.md` places DSLM at a dedicated route `/student/:id/model`. This specification keeps it as a fourth tab. Reason: a separate route would break `?tab=dslm&view=…&focus=…` deep links used by `OnboardingChecklist`, `AddStudentDialog`, `SlotDetailModal`, `PacingProposalsBell` and `NextStepsPresetBanner`, and would force a second page shell with its own data bootstrap. The UX goal — DSLM stops being the default landing surface and stops being called "1 MINUTE" — is achieved by moving it to fourth position, renaming it "Learning model" and lazy-loading it. This is an intentional decision, not an oversight.

---

## 12. Phase plan

| Phase | Scope | Verification |
|---|---|---|
| M0 | This document + `roadmap.md` entry | Document review; no `src/` changes |
| M1 | `workspaceTabs.ts` + alias unit tests (no UI) | `vitest`, `tsgo` |
| M2 | `EntityRow` + `MeetingLinkField` extracted | `tsgo`, no visual change |
| M3 | `StudentHeaderBar`, `StudentSnapshotPanel`, `StudentSettingsMenu` mounted beside existing tabs | Playwright on `/demo` |
| M4 | `PrepTab` with `NextLessonCard`, `LastLessonStrip`, `QuickNoteBox` | Manual pass through the generate path |
| M5 | `useStudentTimeline` + tests, then `TimelineTab` | `vitest` + Playwright |
| M6 | `LibraryTab` with segmented sections and collapsed Deleted | Playwright |
| M7 | Switch to 4 tabs, `resolveTab` routing, `studentPrepPath()` → `?tab=prep`, `React.lazy` | Every legacy `?tab=` value opens the right place |
| M8 | Dead-code removal, `docs/llm-context.md`, `public/llms.txt`, memory, `roadmap.md` | Documentation audit |

After every phase: `bunx tsgo --noEmit -p tsconfig.app.json`, unit tests, and a `/demo` pass in Playwright.

---

## 13. Acceptance criteria

Checked after M7:

1. Four labelled tabs are visible at 360 px, 768 px and 1440 px.
2. Fewer than 12 interactive elements on the first screen of Prep (3 students, no banners).
3. All 12 legacy `?tab=` values from section 4 land on the correct tab, section or filter, with pass-through params preserved.
4. Exactly one `variant="default"` button on the page.
5. No visible destructive icon outside a `…` menu.
6. A first visit mounts no Timeline, Library or Model code (verified in the network panel by absent lazy chunks).
7. `useStudentTimeline` issues zero Supabase requests (verified in the network panel).
8. Every legacy deep link with `view`/`focus`/`set`/`testId` keeps those params after the rewrite.

---

## 14. Out of scope

Worksheet Generation Engine, DSLM internals, backend, RLS, migrations, SEO, Student Hub (`/my`), guided mode beyond the dashboard.
