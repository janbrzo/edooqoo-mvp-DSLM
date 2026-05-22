---
name: Type-to-confirm delete dialog
description: Reusable ConfirmTypeToDeleteDialog gating all destructive curriculum/step actions in DSLM
type: feature
---

v6.9.15c — type-to-confirm requirement REPEALED by product owner. New rule:
Destructive DSLM actions (delete phase, delete next-step) MUST use `src/components/dslm/ConfirmDeleteDialog.tsx`: a single-click `Cancel` / `Confirm` modal with destructive variant. No typed confirmation.

Wired into: `MacroTimeline.tsx` (phase delete), `NextStepBanner.tsx` (step delete). `ConfirmTypeToDeleteDialog` remains in the codebase but should not be used for new destructive UI.
