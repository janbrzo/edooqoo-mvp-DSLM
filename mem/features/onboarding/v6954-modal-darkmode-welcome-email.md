---
name: v6.9.54 generation modal polish, dark mode lockdown, welcome test email RPC
description: Modal shows for-student line and 15s carousel, anonymous CTA opens new tab, dark mode is explicit teacher-only via useForceLightTheme, Welcome Test email validated via verify_welcome_test_email RPC
type: feature
---

## Generation modal (`src/components/GeneratingModal.tsx`)
- New optional prop `studentName?: string`. When present, renders "for {name}" under the gradient title. `src/pages/Index.tsx` passes `sessionStorage.worksheetStudentName` in both authenticated and anonymous branches.
- Carousel interval is 15000 ms (was 8000 ms). Pause-on-hover/focus still applies.
- Grid column gap reduced from `lg:gap-6` to `lg:gap-4` so the right context panel fits without a horizontal scrollbar.

## Left workflow card (`WorkflowSummaryCard.tsx` + `generationModalSlides.ts`)
- Exported constant `MAX_LEFT_CARD_ITEMS = 4`. The card renders `slide.items.slice(0, 4)` so the 5-item Lesson-time signal slide never grows to 3 rows.

## Right context panel (`GenerationContextPanel.tsx`)
- Anonymous CTA "Create free account" now renders as `<a href="/signup" target="_blank" rel="noopener noreferrer">` to preserve in-progress generation in the current tab.
- Padding compressed (`p-3`, `mt-3 space-y-1.5`, `py-1.5`), screenshot reduced to `h-36 sm:h-40`, header sized down to `text-base` so the panel does not produce an inner scrollbar at 1280×720.

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