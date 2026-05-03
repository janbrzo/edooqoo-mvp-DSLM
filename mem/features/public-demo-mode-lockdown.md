---
name: Public Demo Mode Lockdown
description: Hard read-only lockdown for /demo route — every mutating handler guarded
type: feature
---
# Demo Mode Lockdown (v6.9.6)

## Problem
Mutating actions in `/demo` triggered Postgres UUID errors (`demo-student-1` is not a valid UUID). `/worksheets` hung on spinner forever (`useDeletedWorksheets` had no demo branch and skipped `setLoading(false)`). `/calendar/settings` rendered blank. Public Share button redirected to settings.

## Edooqoo.com Solution
Every UI handler that mutates state checks `isDemoMode` BEFORE calling Supabase. Either early-return with `showDemoBlockedToast(label)` or wrap with `guardAction(label, fn)`. Read-only views remain visible; only writes are blocked. Data hooks return `demoData` instead of querying.

## Technical Mechanics
- Guard primitive: `src/hooks/useDemoGuard.ts` exposes `{ isDemoMode, guardAction }`. `DemoContext` provides `showDemoBlockedToast(action)`.
- Seed data: `src/data/demoData.ts` + `src/data/demoWorksheetContent.ts` (~950 KB) ship full production `ai_response`/`html_content` for 10 demo worksheets.
- Hooks with demo early-return: `useStudents`, `useStudent`, `useWorksheetHistory`, `useDeletedWorksheets`, `useCalendarSettings` (returns `DEMO_CALENDAR_SETTINGS`), `useStudentSelector`, `useTokenSystem`, `useUpcomingLessonsCount`.
- Pages: `CalendarPage.handleAddSlot/handleSlotClick/handleShare` early-return on demo. `CalendarSettingsPage` shows amber banner + disables inputs. `AllWorksheetsPage` skips spinner if demo.
- Components guarded: `DeleteWorksheetButton`, `DuplicateWorksheetButton`, `ShareWorksheetModal`, `dashboard/AddStudentButton`.
- Toast copy: `"<Action> is disabled in demo mode. Sign up free to unlock all features!"`.
- Exit: `forceExitDemo()` clears `localStorage.edooqoo_demo_mode` + `sessionStorage` then `window.location.replace('/')`.

## Invariant (do not regress)
Every NEW mutating handler MUST start with:
```ts
if (isDemoMode) { showDemoBlockedToast('<Action>'); return; }
```
or be wrapped via `guardAction('<Action>', () => mutate())`.

## RAG Keywords
demo mode, lockdown, read-only demo, demo guard, useDemoGuard, guardAction, edooqoo_demo_mode, fake user, sandbox preview, /demo route, demo worksheets, demo calendar, demo settings, mutation block, UUID error, demo toast, public demo, sign up unlock.
