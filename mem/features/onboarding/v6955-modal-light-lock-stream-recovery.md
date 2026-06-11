---
name: v6.9.55 generation modal student email, hard light lock, stream EOF recovery, Welcome Test no-translate
description: GeneratingModal renders student name+email from inputParams, worksheet/homework surfaces use useHardLightSurface, stream EOF reconciles via clientGenerationId, Next Step is_used only after a saved worksheet, Welcome Test blocks Chrome auto-translate
type: feature
---

## Generation modal (Problem 1)
- `WorksheetForm` attaches `studentName` and `studentEmail` to the submit payload (looked up from `students` by `selectedStudentId`). `autoGenerateBootstrap` mirrors both fields into the persistent intent and `buildAutoGeneratePayload`. `StudentPage` passes `student.name` and `student.student_email` to `writeAutoGenerateIntent`.
- `GeneratingModal` now accepts `studentEmail` and renders `For {name} · {email}` (or `· no student email set`). When no student is selected the line is hidden.
- `Index.tsx` feeds modal from `worksheetState.inputParams.studentName/Email`, falling back to legacy `sessionStorage.worksheetStudentName`.
- Desktop layout: container `lg:overflow-hidden lg:max-h-[calc(100dvh-2rem)]`, padding `lg:p-5`, tighter `WorkflowSummaryCard` and `GenerationContextPanel` (screenshot `h-28 sm:h-32 lg:h-32`, smaller text, `line-clamp-3` description, `min-w-0/min-h-0` everywhere) so the modal fits 1280×720 without a scrollbar. Mobile still scrolls.

## Hard light lock (Problem 2)
- New hook `src/hooks/useHardLightSurface.ts`: ref-counted lock that removes `.dark`, sets `color-scheme: light`, and installs a `MutationObserver` on `<html>` to immediately strip `.dark` if any later code path re-adds it. Restores `color-scheme` and re-applies `.dark` only if the teacher explicitly stored `edooqoo-theme=dark`.
- `useForceLightTheme` is now a wrapper over `useHardLightSurface('public-light')` so every existing caller (WorksheetPage, SharedWorksheet, Welcome Test, Student Hub, Public Gallery, Public Booking) automatically inherits the strong lock.
- Added direct `useHardLightSurface` on `WorksheetDisplay` (covers inline render on `/`), `HomeworkPage`, `HomeworkReviewPage`.

## Generation reconciliation + Next Step gating (Problems 3 + 4)
- `useWorksheetGeneration` generates a `clientGenerationId` per attempt (reuses `__autoGenerateRequestId` when present). It is injected into `formDataForStorage.clientGenerationId` so the backend persists it under `worksheets.form_data->>clientGenerationId`. The generation job in `generationJobRegistry` is started with this id as `requestId`.
- `worksheetStreamService` adds `onStreamEndedWithoutTerminalEvent(lastProgress)`. When the SSE EOFs without `done/error` AND ≥1 exercise streamed, control returns to the hook instead of immediately surfacing a `Stream ended unexpectedly...` error.
- New helper `recoverWorksheetAfterStreamLoss({ clientGenerationId, teacherId, studentId, startedAt })` polls `worksheets` every 2s up to 30s, filtered by `form_data->>clientGenerationId`. If a row exists, the hook treats it as success and runs `handleWorksheetCompletion` (token consumption, suggestion-used flip, mini panel CTA). If nothing is found, it sets a clear error, marks job/intent `failed`, and invokes `notify-generation-failure` with `errorType='client_stream_lost_no_saved_worksheet'`.
- `useActiveWorksheetGenerationJob.locateBackendWorksheet` first matches by `form_data->>clientGenerationId = job.requestId` and only falls back to the `teacherId/studentId/since` window for legacy jobs. This eliminates false matches across concurrent attempts.
- `future_worksheet_suggestions.is_used` is only flipped from `handleWorksheetCompletion` after a real `finalWorksheetId` is available; failure paths (audio/image generation, stream timeout, recovery exhausted, manual cancel, `clearGenerationError`) never mark the suggestion used.

## Welcome Test no-translate (Problem 5)
- New hook `src/hooks/useNoTranslatePage.ts`: sets `<html translate="no">`, adds `notranslate` class on `<html>`, injects `<meta name="google" content="notranslate">` on mount and reverts every change on unmount. `WelcomeTestPage` calls it next to `useForceLightTheme`.
- The in-app language selector still works (we serve the translations ourselves).

## Sanctity
- Worksheet Generation Engine (prompt, parameters, pedagogical logic) untouched. `clientGenerationId` lives only inside transport metadata (`form_data`), never inside the AI prompt.