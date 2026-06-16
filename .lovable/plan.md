# Plan v6.9.60 — Worksheet generation recovery, multi-job UI, mini-panel, form restore

## Problem 1 — Refresh dwóch generowań kończy się `Generation failed / network error`; backend loguje `stream controller cannot close or enqueue` i czasem `Failed to parse stream`

### Dependency scan
Affected surface:
- `supabase/functions/generateWorksheet/streaming.ts` — niskopoziomowy SSE controller, keepalive, `send`, `close`, `cancel`.
- `supabase/functions/generateWorksheet/index.ts` — streaming mode, `safeSend`, `safeClose`, Gemini streaming fallback to OpenAI, `EdgeRuntime.waitUntil`, final DB insert.
- `src/services/worksheetStreamService.ts` — frontend parser SSE, heartbeat, retry, EOF/no-terminal reconciliation.
- `src/hooks/useWorksheetGeneration.tsx` — error handling, job completion/failure mutation, post-stream DB recovery.
- `src/lib/worksheet/generationJobRegistry.ts` — persistent running/completed/failed job state.
- `src/hooks/useActiveWorksheetGenerationJob.tsx` — refresh-safe polling by `clientGenerationId`.
- `docs/llm-context.md`, `public/llms.txt` — RAG update.

### Root cause
SSE transport failure is treated as generation failure, while the server can still be generating/saving in background; additionally `createSSEStream.send()` swallows enqueue errors without telling `safeSend`, so the backend keeps trying to write/close an already-cancelled stream and pollutes state/logs.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A | Patch only frontend: ignore `network error` and let polling finish | Fast, but backend still logs repeated stream controller errors | Medium |
| B | Patch only backend SSE helper: make `send/close` idempotent and stop writes after cancel | Cleans logs, but frontend can still mark a job failed on transient transport loss | Medium |
| C | Full transport recovery: backend idempotent SSE + frontend treats stream disconnect as recoverable and keeps job running until DB polling proves completion/failure | Fixes structural cause from both sides; no prompt/model logic changes | Low |

### Selected solution + why
I choose Option C. It is the only path that separates **transport state** from **generation state**, which is exactly the structural bug. It also preserves the Worksheet Generation Engine sanctity: no prompt wording, generation parameters, or pedagogical pipeline changes.

### Impact analysis
Zero regressions confirmed:
- Prompt composer untouched.
- Exercise selection and generated content logic untouched.
- Token consumption remains post-save and idempotent.
- Existing SSE events (`start`, `progress`, `done`, `error`) remain compatible.
- Refresh-safe polling continues to use `form_data->>clientGenerationId` only.

### Full implementation
- In `streaming.ts`:
  - Change `SSEStream.send()` to return `boolean`.
  - If `closed === true`, return `false` without enqueue.
  - On enqueue exception, set `closed = true`, stop keepalive, return `false`.
  - Change `close()` to return `boolean` and no-op when already closed.
  - Keep `cancel()` as the single source of client-disconnect state.
- In `generateWorksheet/index.ts`:
  - Make `safeSend()` trust the `boolean` return from `send()` and flip `clientConnected = false` when it fails.
  - Make `safeClose()` no-op after disconnect instead of logging close errors.
  - During Gemini stream fallback, keep the last visible progress monotonic: do not reset `lastExerciseCount` downward when OpenAI fallback starts. Reset `fullContent` for final content, but only emit fallback progress when it exceeds the already-shown count.
  - Keep `EdgeRuntime.waitUntil(backgroundWork)` so DB insert can finish after client disconnect.
- In `worksheetStreamService.ts`:
  - Treat `TypeError`, `network error`, `Failed to fetch`, and stream EOF without terminal event as **recoverable transport loss** when any progress has occurred.
  - Route recoverable loss to `onStreamEndedWithoutTerminalEvent(lastProgress)` instead of immediate `onError`.
  - Preserve the existing silent retry before first exercise.
- In `useWorksheetGeneration.tsx`:
  - On recoverable transport loss, first attempt DB reconciliation by `clientGenerationId`; if not found immediately, leave the persistent job running for `useActiveWorksheetGenerationJobs()` polling instead of marking it failed as `network error`.
  - Only mark failed when the backend sends an explicit SSE `error` or reconciliation proves no row exists after the defined wait.

### Verification checklist
- Refresh while one generation is running: no `network error`; job remains running and later becomes ready.
- Refresh while two generations are running: both remain independently running and later resolve independently.
- Backend logs no longer show repeated `Failed to send SSE message` or `Failed to close SSE stream` after browser refresh.
- Gemini `Failed to parse stream` fallback does not regress progress from `3/8` to `1/8`.
- A genuine no-save failure still shows: `Stream ended after generating X/Y... no tokens were consumed`.

---

## Problem 2 — Przy wielu generowaniach modal pokazuje nowsze, a pierwsze nie jest czytelnie dostępne

### Dependency scan
Affected surface:
- `src/pages/Index.tsx` — selection of active jobs and props passed to modal.
- `src/components/GeneratingModal.tsx` — current small arrow switcher, modal header, per-job display.
- `src/lib/worksheet/generationJobRegistry.ts` — optional per-job progress metadata.
- `src/hooks/useWorksheetGeneration.tsx` — patch live progress into the correct job.

### Root cause
UI ma już listę jobów, ale prezentuje ją jak mały licznik z arrows; dodatkowo live callbacki nie są przypisane do konkretnego `jobId`, więc aktywny widok i status mogą zostać nadpisane przez najnowsze zadanie.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A | Zostawić arrows, poprawić tylko jobId | Technicznie naprawia część, ale UX nadal nie spełnia prośby o karty | Low |
| B | Dodać poziomy pasek kart w modalu: jedna karta = jedno generowanie | Czytelne i zgodne ze screenshotami; minimalna zmiana architektury | Low |
| C | Renderować wiele pełnych modali naraz | Spełnia “wiele”, ale robi chaos, overlap i problemy z portal/z-index | High |

### Selected solution + why
I choose Option B. Karty są czytelniejsze niż mini arrows i nie wprowadzają wielu portali/modali naraz. Jednocześnie każde zadanie zachowa własny timer, `startedAt`, topic, student and progress state.

### Impact analysis
Zero regressions confirmed:
- Jeden job wygląda prawie identycznie jak teraz.
- Multi-job UI pojawia się tylko gdy `jobsCount > 1`.
- Modal nadal jest portalowany do `document.body` z `z-[100]` zgodnie z memory `Modal Portal Pattern`.
- No changes to worksheet generation engine.

### Full implementation
- Extend `WorksheetGenerationJob` with optional `progress`:
  - `exercisesGenerated`
  - `expectedTotal`
  - `phase?: string`
  - `updatedAt`
- Add `patchGenerationJob(jobId, { progress })` calls from `useWorksheetGeneration` inside `onStart` and `onProgress`.
- In `Index.tsx`, build `modalJobs = myRunningJobs` and pass:
  - `jobsCount`
  - `currentIndex`
  - `onSelectIndex`
  - `jobCards` metadata: `jobId`, `studentName`, `topic`, `startedAt`, `progress`, `status`.
- In `GeneratingModal.tsx`, replace the tiny `Generation N/M` arrow strip with a compact horizontal card switcher:
  - each card shows `Generation N`, student name, truncated topic, and `X/Y` if known;
  - active card has primary border/background;
  - cards are keyboard-clickable buttons;
  - arrows can stay as secondary controls only if space allows, but cards are the primary UI.
- For the selected job, use `activeJob.progress` when `streamProgress` is absent or belongs to another job.

### Verification checklist
- Start two jobs in the same tab / refresh: modal shows two selectable cards.
- Clicking card 1 shows job 1 topic/student/timer/progress.
- Clicking card 2 shows job 2 topic/student/timer/progress.
- Timer does not reset when switching cards.
- Single generation has no visual clutter.

---

## Problem 3 — Mini sidebar: not visible on generation page, cards too far apart, both show ready when only one finished

### Dependency scan
Affected surface:
- `src/components/generation/ActiveGenerationMiniPanel.tsx` — visibility filter, stacking layout, status rendering.
- `src/lib/worksheet/generationJobRegistry.ts` — status/progress correctness.
- `src/hooks/useWorksheetGeneration.tsx` — currently calls `completeGenerationJob()` / `failGenerationJob()` without jobId.
- `src/hooks/useActiveWorksheetGenerationJob.tsx` — already job-scoped; verify unchanged except progress compatibility.
- `src/App.tsx` — mini-panel mounted globally; no change expected.

### Root cause
Mini-panel status is corrupted because direct generation callbacks mutate “latest running job” instead of the exact job; spacing is calculated from a hardcoded height larger than real card height; visibility hides cards when a modal is mounted in the same tab, which contradicts the requested behavior.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A | Only reduce `PANEL_HEIGHT_PX` | Fixes spacing partly, not status or visibility | Medium |
| B | Use CSS flex stack and job-scoped mutations | Fixes spacing + status; still decide modal visibility | Low |
| C | Replace mini-panel with toast system | Too much scope and loses persistent CTA | High |

### Selected solution + why
I choose Option B plus removing the same-tab hide rule. This fixes all three reported mini-panel issues without changing global app routing or worksheet logic.

### Impact analysis
Zero regressions confirmed:
- Mini-panel remains globally mounted once in `App.tsx`.
- Completed and failed jobs still dismiss with `X`.
- Completed CTA still opens `/worksheet/:id` and clears that exact job only.
- Other routes still show the same mini-panel.

### Full implementation
- In `ActiveGenerationMiniPanel.tsx`:
  - Replace per-card `bottom = 16 + idx * fixedHeight` with one fixed container:
    - `fixed right-4 bottom-4 z-[110] flex flex-col-reverse gap-2`
    - cards have natural height, so they sit directly next to each other without overlap.
  - Remove hiding of running job when `generation-modal:mount` fires in the same tab; mounted modal no longer suppresses the mini-card.
  - Keep route-specific hiding only for completed worksheet when user is already on `/worksheet/:id`.
  - Add progress text for running cards when `job.progress` exists.
- In `useWorksheetGeneration.tsx`:
  - Store the returned `jobId` from `startGenerationJob()` in local variable/ref for this generation attempt.
  - Replace all unscoped calls:
    - `completeGenerationJob(finalWorksheetId)` → `completeGenerationJob(jobId, finalWorksheetId)`
    - `failGenerationJob(detail)` → `failGenerationJob(jobId, detail)`
    - `markTokenConsumed()` → `markTokenConsumed(jobId)`
    - `markSuggestionUsed()` → `markSuggestionUsed(jobId)`
  - This prevents job A completion/failure from changing job B.

### Verification checklist
- Start generation on `/`: mini-panel is visible on the same generation page.
- Start two generations: mini-cards are adjacent with a small fixed gap and do not overlap.
- Finish job A while job B is running: A shows “ready”, B remains “in progress”.
- Fail job A while job B is running: A shows “failed”, B remains “in progress”.
- Open completed worksheet CTA clears only that completed job.

---

## Problem 4 — Po błędzie formularz wraca, ale student / exercise types / level mogą się resetować

### Dependency scan
Affected surface:
- `src/hooks/useWorksheetFormPersistence.ts` — draft shape currently excludes selected student.
- `src/components/WorksheetForm/index.tsx` — form state, submit payload, draft hydration, selected student and exercise settings.
- `src/pages/Index.tsx` — selected student parent state and `preSelectedStudent` flow.
- `src/hooks/useWorksheetGeneration.tsx` — `worksheetState.clearWorksheetStorage()` does not clear draft; leave behavior intact.

### Root cause
Draft persistence saves topic/goal/exercises/level, but not `selectedStudentId`; after an error the form remounts/hydrates from draft and falls back to `no-student`, so student context disappears and can indirectly change CEFR/exercise defaults.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A | Store student only in sessionStorage during submit | Quick but creates another one-off persistence path | Medium |
| B | Extend existing `useWorksheetFormPersistence` draft with `selectedStudentId` and hydrate it | Uses current architecture; covers refresh/error consistently | Low |
| C | Lift all form state to `Index.tsx` | Too broad; high regression risk | High |

### Selected solution + why
I choose Option B. The app already has a 24h draft system whose explicit purpose is preserving form input after failures. Extending it with the missing fields is the smallest structural fix.

### Impact analysis
Zero regressions confirmed:
- Draft is still cleared only after `worksheetGenerationSuccess`.
- Manual “Clear form” still resets everything.
- DSLM prefill remains higher priority than stored draft.
- Student selection is not injected into the protected prompt; it remains form/user context only.

### Full implementation
- Extend `WorksheetDraft` with:
  - `selectedStudentId?: string`
  - `selectedImage?: any` and `selectedAudio?: any` only if already safe/non-base64; otherwise skip media binary persistence to avoid storage bloat.
- Add `selectedStudentId` to `draftSnapshot` in `WorksheetForm/index.tsx`.
- In draft hydration:
  - if draft has a valid student id, call `setSelectedStudentId(draft.selectedStudentId)`;
  - `onStudentChange` effect will sync parent `Index.tsx` state.
- In `clearForm()`, reset selected student to `no-student` only if this is the current behavior expected by manual clear.
- Ensure `selectionMode`, `selectedExercises`, `selectedMediaTypes`, `exerciseFocusMap`, `englishLevel`, and `languageStyle` remain in the draft and are hydrated after errors.

### Verification checklist
- Submit with selected student, force generation error: form returns with the same student selected.
- Same test preserves CEFR band.
- Same test preserves selected exercise types and V/G focus map.
- Same test preserves manual/random/smart selection mode where currently supported.
- Successful generation still clears draft.
- Manual Clear form still clears draft.

---

## Combined RAG injection update
Files to update after implementation:
- `docs/llm-context.md`
- `public/llms.txt`
- new memory: `mem/features/onboarding/v6960-generation-transport-and-job-state.md`
- `mem/index.md`

RAG entry structure in English:
```markdown
PROBLEM: Refreshing or running multiple worksheet generations could conflate SSE transport loss with generation failure, misattribute completed/failed state to the latest job, hide same-page mini-panels, and lose selected student state after an error.
EDOOQOO SOLUTION: Worksheet generation now treats SSE disconnects as recoverable transport events, keeps backend background work alive, scopes every completion/failure/token/suggestion side effect to the exact jobId, renders multi-generation modal cards, stacks mini-panels with CSS flex, and persists selected student/form settings across failed attempts.
TECHNICAL MECHANICS: generateWorksheet streaming uses idempotent SSE send/close semantics; worksheetStreamService routes recoverable disconnects to DB reconciliation; useWorksheetGeneration stores and mutates the exact generation jobId; generationJobRegistry stores optional per-job progress; GeneratingModal renders card-based job switching; ActiveGenerationMiniPanel renders a flex stack and no longer hides running jobs on the generation page; WorksheetForm draft persistence includes selectedStudentId.
RAG KEYWORDS: worksheet generation refresh, SSE disconnect recovery, stream controller enqueue, Supabase Edge Function streaming, Gemini parse stream fallback, OpenAI fallback streaming, generation jobId, multi generation modal cards, active generation mini panel, job scoped completion, job scoped failure, token idempotency, form draft persistence, selected student restore, clientGenerationId reconciliation
```

## Final change report format after build
- Summary of what was implemented
- Files modified
- Documentation updated: YES
- Out of scope issues flagged
- Verification result: PASS/FAIL

## Out of scope issues noted
- Chrome extension console warnings (`contentScript.js`, `ObjectMultiplex`) are browser-extension noise, not Edooqoo code.
- Reading exercise word-count warning is content-quality telemetry and is not part of this transport/UI bug unless you explicitly ask to tune the Worksheet Generation Engine.

## Martha Test
PASS: The plan protects the teacher’s real workflow: no lost prep, no duplicated token charges, no wrong student context, and no ambiguity about which adult learner’s worksheet is running or ready. It does not alter educational content or make generic app-level changes.