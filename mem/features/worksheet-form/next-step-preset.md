---
name: Worksheet Form Next-Step Preset
description: v6.9.10 banner above Exercise Selection Cards showing up to 3 future_worksheet_suggestions chips for selected student
type: feature
---
`NextStepsPresetBanner` (in `src/components/WorksheetForm/`) reads `useFutureTimeline` and shows up to 3 chips (`[...phaseSteps, ...nextSteps].slice(0,3)`). Click → parent `applyPreset` uses `normalizeSuggestionPrefill` to write coherent state. Empty state = soft amber CTA → `/student/{id}?tab=progress`. Hidden when no student selected.

Origin tracking: `sessionStorage.appliedPresetSuggestionId` set in `applyPreset`; on `worksheetGenerationSuccess` event WorksheetForm dispatches `markPresetUsed` `{suggestionId, worksheetId}`; banner listener calls `useSuggestion(id, worksheetId)` to flip `is_used`.

**How to apply**: never duplicate exercise/media normalization — always use `normalizeSuggestionPrefill`. Never modify the worksheet generation prompt or the `generate-curriculum-phases` / `generate-timeline` edge functions.
