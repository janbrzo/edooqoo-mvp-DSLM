---
name: v6.9.50 single auto-generate path, WT reviewed-status guard, queue gate, calendar Pending UX
description: Index.tsx is sole auto-generate dispatcher; calculate_test_results preserves applied_at + reviewed; WT email regex; 5-queue soft gate; calendar Pending merged confirm + 1-Minute Prep CTA
type: feature
---

## P1 — single auto-generate dispatcher
`src/components/WorksheetForm/index.tsx` no longer runs the RAF poll or the 1.5 s watchdog. It only listens for `worksheet:autoGenerateStarted` (sets `autoSubmitFiredRef.current` and removes `autoGenerateWorksheet*` from sessionStorage). `src/pages/Index.tsx` is the single dispatcher; it tracks `lastBootstrappedRequestIdRef` so a second click on a different "Generate worksheet ↗" suggestion (without page reload) re-fires.

## P2 — calculate_test_results idempotent + applied_at preserved
Migration `<ts>_calculate_test_results_preserve_review.sql` deduplicates existing `(test_id, element_type)` rows (preferring those with `applied_at`), adds `UNIQUE (test_id, element_type)`, and rewrites `public.calculate_test_results`:
- `status = CASE WHEN current_status = 'reviewed' THEN status ELSE 'completed' END` — never downgrade.
- `INSERT ... ON CONFLICT (test_id, element_type) DO UPDATE SET ...` — `applied_at` and `applied_to_element_id` intentionally untouched.

`supabase/functions/process-welcome-test/index.ts` extracts `applyAndPromote(supabase, test_id, student_id)` and calls it twice (after WT-4 status update and again as the final pass after AI rescoring). The helper is idempotent: skips rows already `applied_at`, looks up matching `student_learning_elements` by `element_type`, updates `current_rating` + `last_rated_at`, sets `applied_at`, then `UPDATE student_tests SET status='reviewed' WHERE id=$ AND status<>'reviewed'`.

## P3 — Welcome Test email regex
`WelcomeTestPage.handleVerifyEmail` rejects values that fail `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`. Input adds `inputMode='email'`, `autoComplete='email'`, `aria-invalid` when non-empty + invalid. Continue button disabled until regex passes.

## P4 — next-steps queue soft gate
`GenerateStepsDialog` new prop `activeQueueSize` (default 0). When `mode==='more' && activeQueueSize >= 5` and the teacher has not acknowledged yet, the dialog footer becomes an amber banner: "DSLM gets sharper after each completed worksheet, homework, flashcard set, or note — generating more now risks stale suggestions" with `Wait` (closes) and `Generate anyway` (acknowledges, swaps footer back to normal Cancel/Generate). `NextStepsSection` passes `items.length`.

## P5 — calendar Pending modal UX
`src/components/calendar/SlotDetailModal.tsx`:
- `useNavigate` import; `Sparkles` icon import.
- `handleSave(opts: { skipClose?: boolean } = {})` — when `skipClose=true`, does not close the modal so it can be chained before `handleConfirm()`.
- Worksheet field wrapped in `cn(isPending && 'rounded-md ring-2 ring-primary/40 ring-offset-1 p-1 -m-1')`.
- Empty-state CTA below select: when `studentWorksheets.length === 0`, renders "No worksheets yet — generate one with 1-Minute Prep" (button → `navigate(/student/{id}?tab=dslm)`).
- Pending button bar: confirm button label switches to `Confirm & assign worksheet` when `editWorksheetId !== 'none' && hasChanges`; that handler calls `handleSave({ skipClose: true })` then `handleConfirm()`.
- Pending button bar: 3rd outline button `Confirm & open 1-Minute Prep` visible only when `editWorksheetId === 'none' && slot.student_id`; runs `handleConfirm()` then navigates.
- Bottom `Save Changes` is suppressed when `isPending && editWorksheetId !== 'none'` (now part of the Confirm button).

## Sanctity
No Worksheet Generation Engine prompt or pipeline change. No RLS change. No Stripe change. One DB migration (calculate_test_results + test_skill_results unique constraint).