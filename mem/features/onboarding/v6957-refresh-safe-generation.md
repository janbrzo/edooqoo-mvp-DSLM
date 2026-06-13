---
name: v6.9.57 refresh-safe worksheet generation
description: Backend keeps generating after client disconnect (EdgeRuntime.waitUntil + safeSend); modal rehydrates after refresh; mini panel event-gated; Next Step is_used and tokens never charged on failed attempts.
type: feature
---

## What changed

1. **Backend lifecycle hardening** — `supabase/functions/generateWorksheet/index.ts`
   wraps the streaming IIFE in `EdgeRuntime.waitUntil(backgroundWork)` and
   replaces every `send`/`close` with `safeSend`/`safeClose`. After client
   disconnect (refresh) the writer flips into background-only mode and the
   `INSERT INTO worksheets` still completes. Worksheet Generation Engine
   prompt/pipeline untouched.

2. **Modal rehydration** — `src/lib/worksheet/generationJobRegistry.ts` gains
   `formMeta` (requiresAudio/Image, hasGrammar, selectedExercises, student
   name/email). `src/pages/Index.tsx` derives
   `isResumedGeneration = !!activeJob && activeJob.status === 'running' && !isGenerating`
   and re-renders `GeneratingModal` with an amber "Generation resumed" banner.
   Fresh runs show a one-line "Refreshing this page won't stop generation"
   hint under the progress bar.

3. **Mini panel gating** — `GeneratingModal` dispatches
   `generation-modal:mount`/`unmount` window events while `isOpen`.
   `ActiveGenerationMiniPanel` subscribes and hides only when the modal is
   actually mounted, so the panel is visible on every other route AND on `/`
   when no modal is rendered.

4. **Next Step + token integrity** — `handleWorksheetCompletion` no longer
   falls back to `sessionStorage.getItem('prefillSuggestionId')`. Both
   `onError` and `onStreamEndedWithoutTerminalEvent` defensively
   `sessionStorage.removeItem('prefillSuggestionId')`. Token consumption
   policy documented inline: consumed strictly after a DB-saved + validated
   worksheet; idempotent via `consume_token` RPC keyed on worksheet_id; zero
   tokens on any failure before insert.

## Sanctity

No Worksheet Generation Engine change. No DB migration. No RLS change.
No prompt edits. No model change.

## Verification

- Fresh generation works identically (SSE start/progress/done).
- Refresh mid-stream → backend completes, row appears, polling fires
  `worksheetGenerationSuccess`, modal closes, user lands on /worksheet/:id.
- Network failure mid-stream → mini panel switches to "failed", no token
  deducted, suggestion `is_used` stays false.
- Mini panel appears on `/one-minute-prep`, `/dashboard`, and `/` when no
  modal is mounted.