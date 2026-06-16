---
name: v6.9.60 generation transport recovery, multi-job UI, mini-panel, form restore
description: SSE disconnects are now decoupled from generation failure (send/close idempotent, transport errors handed to DB reconciliation, in-flight job stays running for refresh-safe polling); GeneratingModal renders a row of selectable cards when multiple generations run concurrently; ActiveGenerationMiniPanel uses a single flex stack so cards stay adjacent without overlap, stays visible on the generation page, and reflects per-job status correctly; selectedStudentId is now persisted in the WorksheetForm 24h draft so a failed generation never drops student/CEFR/exercise context.
type: feature
---

## What changed

1. **Backend SSE is idempotent** — `streaming.ts` `send()` returns a boolean,
   `close()` is a no-op when already closed, and any enqueue failure flips
   `closed = true` instead of logging once per write. `safeSend` /
   `safeClose` in `generateWorksheet/index.ts` trust the boolean and flip
   into background-only mode silently. `EdgeRuntime.waitUntil(backgroundWork)`
   still keeps the DB insert alive after the client disconnects.

2. **Monotonic fallback progress** — when Gemini stream fails and OpenAI
   takes over, `lastExerciseCount` is preserved and progress events are
   only emitted when the OpenAI run exceeds the previously visible count.
   Refresh / parse-stream errors no longer visually regress UI from 3/8
   back to 1/8.

3. **Transport loss is recoverable on the client** — `worksheetStreamService`
   routes `TypeError` / `Failed to fetch` / `NetworkError` / `net::ERR` to
   `onStreamEndedWithoutTerminalEvent(lastProgress)` whenever any progress
   has streamed. `useWorksheetGeneration` first tries DB reconciliation by
   `clientGenerationId`; if not found, it closes the in-page modal for that
   submit but **leaves the persistent job in `running`**. The global
   `useActiveWorksheetGenerationJobs` polling finishes the job from the
   DB write, so refreshing two parallel generations no longer surfaces a
   spurious `network error` toast.

4. **Job-scoped mutations** — every `completeGenerationJob`,
   `failGenerationJob`, `markTokenConsumed`, `markSuggestionUsed`, and the
   new `patchGenerationJob` call in `useWorksheetGeneration` is scoped to
   the exact `jobId` returned by `startGenerationJob`. Job A finishing or
   failing no longer mutates job B.

5. **Per-job live progress** — `WorksheetGenerationJob` gained an optional
   `progress` field updated on every SSE `progress` event. `Index.tsx`
   prefers `activeJob.progress` over the local `streamProgress`, so the
   modal shows the correct values for whichever card is selected.

6. **Multi-generation card switcher** — `GeneratingModal` accepts a `jobs`
   array (`{jobId, studentName, topic, progress}`) and renders a horizontal
   row of selectable cards when `jobsCount > 1`. Each card shows the
   generation number, student name, truncated topic, and `X/Y`. The single
   generation UI is unchanged.

7. **Mini panel layout fix** — `ActiveGenerationMiniPanel` is now a single
   `fixed right-4 bottom-4 flex flex-col-reverse gap-2` container. Cards
   have natural height, sit adjacent without overlap, and stay visible on
   the generation page (no longer hidden because the foreground modal is
   mounted in the same tab). Running cards also render live progress.

8. **Form draft includes selectedStudentId** — `WorksheetDraft` now stores
   `selectedStudentId`, and `WorksheetForm` hydrates it on mount. A failed
   generation that re-mounts the form keeps the student selected, which
   also keeps CEFR band and exercise defaults consistent with the chosen
   learner. Successful generation still clears the draft.

## Sanctity

No worksheet generation prompt, model parameters, or pedagogical pipeline
were modified. Token consumption remains idempotent at the DB level
(`consume_token` advisory lock + reference_id check, v6.9.59).

## Verification

- Refresh with one running generation → no `network error`; job resumes
  and completes via DB polling.
- Refresh with two running generations → both resume independently; both
  complete; mini-panel shows correct per-job status.
- Backend logs no longer emit `Failed to send SSE message` / `Failed to
  close SSE stream` after a client refresh.
- Two concurrent generations show two selectable cards in the modal,
  each with its own timer/topic/student/progress.
- Mini-panel: visible on `/`, cards adjacent (no big gap), finished card
  shows ready while the other still shows in-progress.
- After generation error: student, CEFR, exercise types, focus map all
  restored on retry.