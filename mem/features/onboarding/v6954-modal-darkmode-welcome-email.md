---
name: v6.9.54 generation modal polish, dark mode lockdown, welcome test email RPC
description: Modal shows for-student line and 15s carousel, anonymous CTA opens new tab, dark mode is explicit teacher-only via useForceLightTheme, Welcome Test email validated via verify_welcome_test_email RPC
type: feature
---

## Generation modal (`src/components/GeneratingModal.tsx`)
- New optional prop `studentName?: string`. When present, renders "for {name}" under the gradient title. `src/pages/Index.tsx` passes `sessionStorage.worksheetStudentName` in both authenticated and anonymous branches.
- The generation modal now uses concise audience-specific slides with an eight-second interval and independent hover/focus pause; see `mem://ux/generation-modal-conversion` for the current design.
- Grid column gap reduced from `lg:gap-6` to `lg:gap-4` so the right context panel fits without a horizontal scrollbar.

## Left generation status
- Keep progress, exercise status and Expected time only; the duplicate workflow card below Expected time is retired.

## Right context panel (`GenerationContextPanel.tsx`)
- Anonymous CTA "Create free account" now renders as `<a href="/signup" target="_blank" rel="noopener noreferrer">` to preserve in-progress generation in the current tab.
- Keep two brief benefits for anonymous visitors and three practical steps for signed-in teachers, with a real product preview and one audience-appropriate next action.

## Dark mode lockdown
- `index.html` boot script applies `.dark` ONLY when `localStorage['edooqoo-theme'] === 'dark'`. `prefers-color-scheme` is no longer consulted.
- `src/hooks/useTheme.ts` resolves `'system'` → light. Teacher dark mode requires explicit opt-in.
- New hook `src/hooks/useForceLightTheme.ts` removes `.dark` on mount and re-adds it on unmount only when the stored preference is `'dark'`.
- Hook applied as first line in `WorksheetPage`, `SharedWorksheet`, `StudentHubWorksheets`, `StudentHubHomework`, `PublicGalleryWorksheetPage`, `PublicBookingPage`, `WelcomeTestPage`.

## Welcome Test email RPC
- New `SECURITY DEFINER` function `public.verify_welcome_test_email(p_share_token text, p_email text) RETURNS TABLE(has_email boolean, matches boolean)`. Joins `student_tests` → `students` and returns whether the student has an email set and whether it matches (case-insensitive, trimmed).
- `GRANT EXECUTE` to `anon`, `authenticated`, `service_role`.
- `WelcomeTestPage.handleVerifyEmail` now calls this RPC. Rejects with toast when `has_email = false` ("requires the student email") or `matches = false` ("doesn't match the student assigned to this test"). RLS visibility no longer bypasses the check.

## Sanctity
- Worksheet Generation Engine (prompt, parameters, pipeline) untouched.