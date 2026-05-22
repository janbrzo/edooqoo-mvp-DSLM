---
name: DSLM always-visible sub-navigation
description: DSLMTab renders sub-section buttons for all categories simultaneously with active section highlighted
type: design
---

`DSLMTab.tsx` shows sub-section pills under EVERY top-section button, not only the active one. Active top section is highlighted via `border-primary` ring. Reason: first-time teachers couldn't discover sub-sections that were hidden until click.

Sub-buttons dispatch `dslm:openSubsection` window event with `{detail:{id}}`. Matching `CollapsibleSection` listens and opens itself + scrolls into view (with `scroll-mt-24` offset for the sticky nav).
