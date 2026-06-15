---
name: v6.9.59 multi-generation per-tab UX + idempotent token consumption
description: Worksheet generation jobs now carry an `originTabId` (sessionStorage) so the full-screen GeneratingModal only resurrects on the tab that started the job; opening edooqoo.com in another tab shows the job only as a mini panel. Modal in Index renders one card per concurrent running job with arrow + dot switcher. Mini panel cards no longer overlap (height 144 / gap 12, max 4 stacked). `consume_token` RPC is idempotent on (teacher_id, worksheet_id) via advisory lock + existence check, fixing double/triple charges when multiple pollers raced.
type: feature
---

## What changed

1. **Per-tab modal scoping** — `src/lib/worksheet/tabId.ts` issues a
   sessionStorage-backed tab id. `startGenerationJob` stores it as
   `originTabId`. `Index.tsx` only renders the GeneratingModal for jobs
   matching the current tab. Other tabs see the job as a mini-panel only.

2. **Multi-generation switcher** — Index uses
   `useActiveWorksheetGenerationJobs()` and tracks `activeJobIdx`.
   `GeneratingModal` accepts `jobsCount`, `currentIndex`, `onSelectIndex`
   and renders a `‹ Generation N/M ›` header with dot pills when
   `jobsCount > 1`. Each rendered job keeps its own `startedAt`, so
   timer/progress continue independently when switching cards.

3. **Mini panel polish** — `ActiveGenerationMiniPanel`:
   `PANEL_HEIGHT_PX = 144`, `PANEL_GAP_PX = 12`, capped at 4 visible.
   Visibility filter now keeps a running job visible when its modal is
   mounted in another tab (`mountedJobIds.has && originTabId === tabId`
   is required to hide it). Fixes "no mini panel on the generation
   page" and stacking overlap.

4. **No false completions** — `locateBackendWorksheet` drops the legacy
   teacher/student/time-window fallback. Without a `requestId` it returns
   `null` instead of guessing. This prevents job B being falsely marked
   completed using a worksheet row actually saved by job A.

5. **Idempotent `consume_token`** — Migration redefines the RPC to:
   - `pg_advisory_xact_lock(hashtextextended(teacher||':'||worksheet, 0))`
   - short-circuit `RETURN TRUE` if a `usage` row already exists for
     `(teacher_id, reference_id = worksheet_id)`.
   Plus client-side `markTokenConsumed` is applied optimistically BEFORE
   the RPC call inside `applyCompletionSideEffects`, so only the first
   poller in a tab issues the network call.

## Sanctity

Worksheet Generation Engine untouched. No schema or RLS change beyond
redefining the existing SECURITY DEFINER function body.

## Verification

- Start two generations from one tab → modal shows `Generation 1/2`
  with arrows; switching keeps each timer correct.
- Open edooqoo.com in another tab while a generation runs → mini panel
  visible bottom-right; no full-screen modal.
- Two concurrent mini-panel cards never overlap.
- Generate two worksheets back to back → exactly two `usage` rows in
  `token_transactions`, `available_tokens` drops by 2.
