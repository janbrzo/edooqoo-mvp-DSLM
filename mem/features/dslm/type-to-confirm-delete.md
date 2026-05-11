---
name: Type-to-confirm delete dialog
description: Reusable ConfirmTypeToDeleteDialog gating all destructive curriculum/step actions in DSLM
type: feature
---

Any destructive action on `dslm_curriculum_phases` or `future_worksheet_suggestions` (delete phase, delete next-step) MUST use `src/components/dslm/ConfirmTypeToDeleteDialog.tsx`. The dialog requires the user to type the exact `itemLabel` (e.g. `Phase 2`, `Next Step #1`) before the confirm button enables. This prevents one-click data loss.

Wired into: `MacroTimeline.tsx` (phase delete), `NextStepBanner.tsx` (step delete). Future destructive UI MUST follow this pattern — do not introduce raw `confirm()` or single-click delete buttons.
