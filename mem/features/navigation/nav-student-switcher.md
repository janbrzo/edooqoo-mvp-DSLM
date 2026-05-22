---
name: Nav student switcher
description: Global student picker in StickyNav; shown for authenticated teachers everywhere except /dashboard and /profile
type: feature
---
`NavStudentSwitcher` (`src/components/landing/NavStudentSwitcher.tsx`) is rendered inside `StickyNav` when `isRegisteredUser && !isDashboard && !isProfile` (both mobile + desktop branches).

**Behavior**:
- Popover with scrollable student list sorted `updated_at DESC` (via `useStudents`).
- Items are `<a href="/student/{id}">` so middle-click and Ctrl/Cmd/Shift-click open in a new tab natively.
- Plain click → `e.preventDefault()` + SPA `navigate(url)` and close popover.
- `onAuxClick` handles middle button explicitly as defense-in-depth.

**Sanctity**: Do not move student switcher onto `/dashboard` or `/profile` — those pages already have their own student management UIs and the duplicate would clutter the nav.