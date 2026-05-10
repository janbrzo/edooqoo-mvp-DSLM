---
name: Middle/Ctrl-click anchor nav pattern
description: Pattern for nav buttons that must support open-in-new-tab via middle-click and Ctrl/Cmd/Shift-click
type: preference
---
Any global-nav button that targets a route MUST render as `<Button asChild><a href onClick={handleAnchorNav(path)}>…</a></Button>`.

`handleAnchorNav` in `StickyNav.tsx`:
```ts
const handleAnchorNav = (path: string) => (e: React.MouseEvent) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let browser open new tab
  e.preventDefault();
  navigate(path);
};
```

**Why**: `<button onClick={navigate}>` swallows modifier clicks; users lose the OS-native "open in new tab" affordance. Anchor + guard preserves both SPA navigation and native browser behavior.

**How to apply**:
- Calendar button → `<a href="/calendar">`
- Generate Worksheet (off-dashboard) → `<a href="/">` (worksheet form lives on Index/`/`)
- React Router `<Link>` already renders `<a href>` so it inherits the same behavior — no change needed for Dashboard/Profile.

**Do NOT** convert pure action buttons (open modal, trigger API call) — only navigational buttons.