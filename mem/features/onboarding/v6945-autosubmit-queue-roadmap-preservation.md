---
name: v6.9.45 — 1-Minute Prep auto-submit queue + hard roadmap preservation
description: Auto-generate from DSLM suggestion is queued until tokensLoading=false (40×300ms); useWorksheetGeneration prefers data.studentId; generate-curriculum-phases physically preserves done/in_progress phase rows + verifies invariant after write.
type: feature
---

## P1 — Auto-submit queue (replaces v6.9.44 "exercises optional" fix)
- `WorksheetForm/index.tsx` now stamps every auto-generated submission with `__autoGenerateFromSuggestion: true` (transport flag in `FormData`; never sent to AI).
- `Index.tsx` `handleGenerateWorksheet` reads that flag. While `tokensLoading` is true:
  - manual submit keeps the legacy `2 × (250ms,500ms)` budget;
  - auto-generate retries silently up to `40 × 300ms (~12s)` so the request survives slow profile/token fetches.
- `useWorksheetGeneration.tsx` computes `effectiveStudentId = data.studentId || studentId || null` for both the streaming payload AND the post-success `studentUpdated` event, so an unsynced parent never causes the generator to fall back to "no student".

## P2 — Roadmap regeneration physically preserves done + in_progress
- `supabase/functions/generate-curriculum-phases/index.ts`:
  - `KEPT_STATUSES = ['done', 'in_progress']`, plus `keptPhaseIds`, `replaceablePhaseIds`, `hasKeptInProgress`.
  - Soft-delete on `replace` is restricted to `replaceablePhaseIds` AND scoped to `student_id + teacher_id`.
  - If a kept `in_progress` phase exists, every freshly generated phase is forced to `planned` (no double-active).
  - `generationContext` records `kept_phase_ids`, `replaceable_phase_ids`, `preserved_phase_count`.
  - Post-write invariant: re-reads kept rows; if any are missing or `deleted_at IS NOT NULL`, returns `500 { preservationInvariantFailed: true }`.
- Because kept phase row IDs survive, every `future_worksheet_suggestions.phase_id` pointing at them stays valid — no UI work needed to keep their next steps visible.
- `GenerateRoadmapDialog`, `MacroTimeline` AlertDialog, and `useCurriculumPhases` toast now state precisely: "regenerates only planned/draft; kept N active/completed phases".

## Sanctity
No Worksheet Generation Engine prompt/parameter/logic change. No RLS, no DB schema, no Stripe.

RAG keywords: 1-minute prep auto-generate queue, tokensLoading retry budget, __autoGenerateFromSuggestion transport flag, effectiveStudentId precedence data over parent, dslm suggestion to worksheet handoff, roadmap regenerate preserves in_progress, KEPT_STATUSES done in_progress, soft delete only planned draft, hasKeptInProgress force planned, preservation invariant post-write, preservationInvariantFailed 500, future_worksheet_suggestions phase_id stability, regenerate planned phases keep active completed, MacroTimeline AlertDialog copy precision, GenerateRoadmapDialog regeneration copy