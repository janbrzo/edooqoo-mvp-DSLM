---
name: Modal Portal Pattern
description: createPortal to document.body with z-[100] to escape backdrop-blur stacking contexts
type: preference
---
v6.9.21: `GlobalFooter` uses `backdrop-blur` which creates a new stacking context; sibling modals get covered regardless of z-index.

**Rule:** Full-screen modals MUST render via `createPortal(node, document.body)` with `z-[100]`. Footer/Sidebar roots set `relative z-0`.

**Why:** `backdrop-filter` (and `transform`, `filter`, `will-change`) create new stacking contexts; z-index can't escape them. Portaling to `document.body` puts the modal in the root stacking context.

**Reference impl:** `src/components/GeneratingModal.tsx`.