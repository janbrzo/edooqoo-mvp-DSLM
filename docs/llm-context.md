# Edooqoo LLM Context (RAG)

Canonical, dense reference for AI agents operating on the Edooqoo codebase.
Written in Problem → Edooqoo.com Solution → Technical Mechanics format.

---

## v6.9.6 — Demo Mode Lockdown, Dashboard Compact Stats, Mobile Landing Fixes

### Problem
1. `/demo` mutating actions (delete, duplicate, share, add student, calendar slot create, calendar settings save) hit Supabase with synthetic IDs (`demo-student-1`) and crashed with Postgres `invalid input syntax for type uuid`.
2. `/worksheets` route hung on infinite spinner inside demo because `useDeletedWorksheets` had no demo branch.
3. `/calendar/settings` rendered blank in demo (no settings row + no fallback).
4. `/dashboard` displayed 4 oversized stat tiles + a separate Student Hub info banner — broke single-row symmetry, hid the `edooqoo.com/my` CTA on mobile.
5. Public landing (`/`) inherited system dark mode on mobile → low contrast hero, CTA overflowed viewport on `<sm`.

### Edooqoo.com Solution
1. Hard read-only lockdown for demo: every UI handler that mutates state checks `isDemoMode` BEFORE calling Supabase, returns early with toast `"<Action> is disabled in demo mode. Sign up free to unlock all features!"`.
2. Demo data hooks (`useStudents`, `useStudent`, `useWorksheetHistory`, `useDeletedWorksheets`, `useCalendarSettings`, `useStudentSelector`, `useTokenSystem`, `useUpcomingLessonsCount`) early-return seeded `demoData` instead of querying.
3. `CalendarSettingsPage` shows amber "Demo view" banner + disables inputs.
4. `CompactStatsBar` replaces old grid + Hub Info banner. 2-column layout on `lg+`: left = Student Hub CTA with full copy ("students log in with just their email at edooqoo.com/my — no login needed"), right = 6 inline stat pills.
5. `Index.tsx` runs a `useEffect` that removes `dark` class from `<html>` while landing is mounted; restores on unmount. `HeroHeadline` uses responsive padding/text size and shorter "Generate Free Worksheet" copy on `<sm`.

### Technical Mechanics
- **Guard primitive:** `src/hooks/useDemoGuard.ts` exposes `{ isDemoMode, guardAction(label, fn) }`. `DemoContext.showDemoBlockedToast(action)` provides unified toast copy.
- **Storage key:** `localStorage.edooqoo_demo_mode` (country code or `DEFAULT`). `forceExitDemo()` clears storage + redirects to `/`.
- **Seed data:** `src/data/demoData.ts` (synthetic students/worksheets/lessons) + `src/data/demoWorksheetContent.ts` (~950 KB of real production `ai_response`/`html_content` for 10 worksheets, dynamically merged in `buildDemoData`).
- **Components guarded:** `DeleteWorksheetButton`, `DuplicateWorksheetButton`, `ShareWorksheetModal`, `dashboard/AddStudentButton`, `CalendarPage.handleAddSlot/handleSlotClick/handleShare`.
- **Dashboard:** `src/components/dashboard/CompactStatsBar.tsx` — `lg:grid-cols-2`, left column matches Students card width, right column matches Worksheets card width. 6 stats: Tokens left, This month, All time, Students, Active homework, Upcoming lessons (7d). New hook `src/hooks/useUpcomingLessonsCount.tsx` (single SELECT on `calendar_slots` where `status='booked'`).
- **Landing theme guard:** `src/pages/Index.tsx` `useEffect(() => { html.classList.remove('dark'); return () => restore })`.
- **Hero responsive:** `src/components/landing/HeroHeadline.tsx` uses `text-base sm:text-lg`, `px-4 sm:px-8`, `h-12 sm:h-14`, copy `"Generate Free Worksheet"` on `<sm`.

### Invariant (do not regress)
Every NEW mutating handler MUST start with:
```ts
if (isDemoMode) { showDemoBlockedToast('<Action>'); return; }
```
or wrap with `guardAction('<Action>', () => mutate())`.

### RAG Keywords
demo mode, lockdown, read-only demo, demo guard, useDemoGuard, guardAction, edooqoo_demo_mode, fake user, sandbox preview, /demo route, demo worksheets, demo calendar, demo settings, mutation block, UUID error, demo toast, public demo, sign up unlock, compact stats bar, dashboard stats, student hub CTA, edooqoo.com/my, upcoming lessons count, mobile dark mode hero, landing light theme, hero CTA mobile overflow.
