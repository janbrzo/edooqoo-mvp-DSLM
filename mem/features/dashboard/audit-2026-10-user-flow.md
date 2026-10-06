---
name: User-flow audit 2026-10
description: Decisions from the end-to-end audit - demo student page, wrap-safe toolbars, Prep-first CTAs, teacher login redirect, homework error card
type: feature
---

## Invariants

- Demo student page must render: `useWorksheetHistory.refetch` returns early in demo; `StudentPage` shows the full skeleton only until the first worksheet load (`worksheetsReady`).
- Demo ids never reach Supabase: `demoFetchGuard` (first import of `main.tsx`) short-circuits REST reads with `demo-` ids. Demo flag value is the locale code, not `'true'`. Welcome Test banner actions show the demo-blocked toast. `useStudentKnowledge` reads `demoData.knowledgeEntries`.
- `Prepare next lesson` (NextUpCard) and the calendar slot CTAs open Prep via `studentPrepPath`; onboarding, AddStudentDialog, PacingProposalsBell and emails keep legacy `?tab=dslm` on purpose (permanent aliases).
- Teacher-only pages (`/dashboard`, `/students`, `/worksheets`, `/profile`, `/teacher/alerts`) use `useTeacherAuthRedirect`: no session -> `/login` with `state.from`; signed out while on the page -> `/`.
- `/homework/:token` never redirects students to `/`: invalid link -> "Homework not available" card + Student Hub; network error -> "Try again".
- Worksheet toolbar, header, exercise header and All worksheets header use `flex-wrap`; verified scrollWidth == viewport at 360/1024/1280/1440.
- `npm test` (vitest) runs in `.github/workflows/seo-integrity.yml`.
- 2026-10-05 follow-up: `/calendar` (booking email target), `/calendar/settings`, `/calendar/logs`, `/settings/mcp` and `/homework/:id/review` also use `useTeacherAuthRedirect`; `/worksheet/:id` without a session and without a visible row goes to `/login` with `state.from` (was `/` + "Worksheet Not Found"); Signup "Sign in here" forwards `state.from`.
- Prep fallback topic is generator input: built from `selectFocusAreaTexts` (untrimmed) and clamped to `FIELD_LIMITS.lessonTopic` on a word boundary, never from the display labels of `selectFocusAreas` (60 chars + "…"). `NextLessonCard` clamps the title visually (`line-clamp-2`).
- Generator suggestion tiles never repeat a set (`getRandomSuggestionSets(count, excludeIds)`); `NextStepsPresetBanner` is hidden in demo (it claimed the demo student had no context).
- `StickyNav` takes `tokensLoading` (from `useTokenSystem().loading`) and shows `Tokens: …` instead of a misleading `0` while the balance loads.
- Mobile (360/390 px) worksheet rows must wrap: Fill in the Blanks stacks sentence and answer below `sm`, answer/focus rows use `min-w-0 break-words`; verified `scrollWidth == viewport` for all five demo worksheets.

**Why:** an end-to-end browser audit found the demo student page stuck on a skeleton, export buttons off-screen on laptops, and several dead-end redirects.
