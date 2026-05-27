---
name: SSE Keepalive Pattern (Worksheet Stream)
description: Server emits :keepalive every 15s, client 45s watchdog with one silent retry before surfacing error
type: feature
---

## v6.9.27 — SSE robustness for `generateWorksheet`

- Server (`supabase/functions/generateWorksheet/streaming.ts`): every 15s write `: keepalive\n\n` SSE comment while response body is open. Clear interval in `finally`.
- Client (`src/services/worksheetStreamService.ts`): `HEARTBEAT_MS = 45_000`. On watchdog fire, if `exercisesGenerated === 0 && !retryAttempted` → set `retryAttempted=true`, fresh `AbortController`, re-fetch with identical body, continue silently (no `onError`). Otherwise abort + `onError` with current count.
- SSE comment lines (`:` prefix) reset EventSource heartbeat without dispatching message events.

**Why:** model warm-up >40s aborted runs that would have succeeded.