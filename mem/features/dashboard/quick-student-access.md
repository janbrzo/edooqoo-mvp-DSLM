---
name: Quick student access (v6.9.110)
description: Four dashboard paths to any student — Jump-to-student search, Recent pills, inline All students list, nav switcher with filter; all reuse useStudents, no new queries
type: feature
---

## Quick student access — invariants

- Four parallel paths, all fed by the already-loaded `useStudents` result. **Never add new queries** for quick access.
  1. `StudentQuickSearch` — compact `sm:w-64` "Jump to student…" field on `/dashboard`, focus via `/` or Cmd/Ctrl+K, `role="listbox"` keyboard navigation.
  2. `RecentStudentsBar` — pills of recently touched students, excluding ids already shown in Next up; sits to the right of the search on `sm+`, stacks on mobile.
  3. `AllStudentsInline` — inline expandable list under the All students tile (own search + sorting, max 10 rows, "See all" → `/students`).
  4. `NavStudentSwitcher` in `StickyNav` — now also on `/dashboard`, with an inline filter input.
- Matching logic lives only in `src/lib/students/quickAccess.ts` (`filterStudents`, `pickRecentStudents`, `studentPrepPath`). Name matches rank above email/goal matches; default limit 8.
- Canonical destination for every quick-access click: `studentPrepPath(id)` = `/student/:id?tab=dslm` (straight into prep), never the plain student overview.
- All items render as real `<a href>` with modifier/aux-click passthrough (middle-click, Ctrl/Cmd/Shift open a new tab); plain click is `preventDefault()` + SPA `navigate`.

**Why:** with 20+ students the Today dashboard shows only 3, so teachers had no fast path to an arbitrary student.
