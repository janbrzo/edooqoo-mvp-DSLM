---
name: Nav student switcher
description: Global student picker in StickyNav; shown for authenticated teachers everywhere except /profile (since v6.9.110 also on /dashboard), with inline filter
type: feature
---
`NavStudentSwitcher` (`src/components/landing/NavStudentSwitcher.tsx`) is rendered inside `StickyNav` when `isRegisteredUser && !isProfile` (both mobile + desktop branches). Since v6.9.110 it is also shown on `/dashboard`.

**Behavior**:
- Popover with scrollable student list sorted `updated_at DESC` (via `useStudents`).
- Inline filter input (name / email / goal), shown only when the teacher has students; cleared when the popover closes.
- Items are `<a href="/student/{id}">` so middle-click and Ctrl/Cmd/Shift-click open in a new tab natively.
- Plain click → `e.preventDefault()` + SPA `navigate(url)` and close popover.
- `onAuxClick` handles middle button explicitly as defense-in-depth.

**Sanctity**: Do not render the switcher on `/profile` — that page has its own account UI and the duplicate would clutter the nav.