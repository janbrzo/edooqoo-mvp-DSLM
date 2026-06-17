---
name: v6.9.61 recovery window, global modal, draft snapshot, Gemini image migration
description: Refresh-killed jobs recoverable for 60s via DB poller, GlobalGeneratingModal mounted in App.tsx, saveDraftNow eliminates word-order draft regression, generate-image migrated to gemini-3.1-flash-image-preview on Vertex.
type: feature
---

## Recovery window for failed jobs
- `WorksheetGenerationJob.recoveryDeadlineAt` (epoch ms). `failGenerationJob` sets it to now + 60s; `cancelGeneration` sets it to null.
- `useActiveWorksheetGenerationJob{,s}` polls jobs where `running || (failed && recoveryDeadlineAt && now < recoveryDeadlineAt)`. DB hit on a failed job → `recoverJobToCompleted(jobId, worksheetId)` and the normal completion side effects run (token consumed once via idempotent RPC, suggestion flipped, success event dispatched).
- `expireStaleRunningJobs()` runs every 30s in both hooks, flipping `running` jobs older than 4 minutes to `failed` with `recoveryDeadlineAt = null`.
- `useWorksheetGeneration.onError` tries `recoverWorksheetAfterStreamLoss` once before calling `failGenerationJob`.

## Global multi-job modal
- `src/components/generation/GlobalGeneratingModal.tsx` reads job registry + tabId and renders one `GeneratingModal` instance with the multi-job card switcher.
- Mounted in `App.tsx` next to `ActiveGenerationMiniPanel`. Index no longer mounts `GeneratingModal`.
- Filters by `originTabId === tabId` AND pollable (running or in recovery window).
- `GeneratingModal` gained `recovering?: boolean` — when true shows a "Checking server… no tokens were consumed yet." screen instead of the destructive error UI.

## Deterministic form draft on submit
- `useWorksheetFormPersistence.saveDraftNow(draft)` writes localStorage synchronously, bypassing the 600 ms debounce.
- `WorksheetForm.submitForm` calls it with `finalExercises` (post auto-complete), `selectedMediaTypes`, `exerciseFocusMap`, `selectedStudentId`, etc., right before `onSubmit`.
- `WorksheetForm.applyPreset` also calls it with the normalized preset payload.

## Vertex Gemini Image migration
- `supabase/functions/generate-image/index.ts` → `gemini-3.1-flash-image-preview` (Nano Banana 2) via `:generateContent`.
- Same `GEMINI_VERTEX_API_KEY` service-account auth, same `us-central1`, same project.
- Body: `contents[{ role:'user', parts:[{ text }] }]` + `generationConfig.responseModalities:["IMAGE"]` + `imageConfig.aspectRatio:"16:9"` + `safetySettings`.
- Parser: `candidates[0].content.parts.find(p => p.inlineData)?.inlineData.{data, mimeType}`. Dynamic `mimeType` threaded into the data URL and into the downstream Gemini vision description call.
- `MediaSection.tsx` credit updated to "Google Gemini 3.1 Flash Image".

## Sanctity
Worksheet Generation Engine prompt wording, parameters, repair pipeline, and pedagogical logic unchanged.