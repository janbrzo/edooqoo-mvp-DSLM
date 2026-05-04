# Edooqoo LLM Context (RAG)

Canonical, dense reference for AI agents operating on the Edooqoo codebase.
Written in Problem → Edooqoo.com Solution → Technical Mechanics format.

---

## v6.9.7 — IP Protection Hardening (part 1 of 2)

### Problem
1. The browser bundle exposed `src/utils/promptFormatter.ts`, including the full language-style ladder (1–5), CEFR ladder (A1/A2 → C1/C2), and exercise-spec mapping. A casual `view-source` on a generated worksheet revealed Edooqoo's prompt-engineering scaffolding ("Heart of Edooqoo" IP).
2. Production builds shipped `console.log` calls scattered across 78 files, leaking user IDs, tokens, emails, and worksheet payloads into the browser console.
3. Production source maps were emitted, allowing line-perfect reconstruction of the minified bundle.
4. `~150 KiB` of demo content (`demoWorksheetContent.ts`) was statically imported by `demoData.ts` and shipped in the main chunk on every page load — even for users who never visited `/demo`.
5. `mockNewExercisesData` was statically imported by `/test-exercises`, leaking 60+ KiB of mock exercise payloads.
6. Production builds preserved `debugger` statements, enabling devtools breakpoints on minified symbols.

### Edooqoo.com Solution
1. **Prompt formatting moved to authenticated edge function** `format-worksheet-prompt`. Client now calls it via `supabase.functions.invoke` and receives the rendered prompt string. Language ladder, CEFR ladder, and helpers are deleted from the client. The Worksheet Engine prompt itself (`generate-worksheet`) is untouched.
2. **Dev-only logger** at `src/utils/logger.ts` exposes `devLog`/`devWarn` that are no-ops in production (`import.meta.env.DEV` guard). Codemod replaced all `console.log`/`console.warn` in `src/`. `console.error` remains active in production for critical debugging.
3. **Production source maps disabled** in `vite.config.ts` (`sourcemap: mode === 'development'`).
4. **Demo/mock content lazy-loaded.** `buildDemoData` is now `async` and uses `await import('./demoWorksheetContent')`. `TestExercises.tsx` uses `useEffect` + dynamic `import("@/mockNewExercisesData")`. Combined with `manualChunks` (split into `demo-content` and `mock-data` rollup chunks), neither chunk is fetched until the user actually visits `/demo` or `/test-exercises`.
5. **`debugger` statements stripped** by esbuild (`esbuild: { drop: ['debugger'] }` in `vite.config.ts`).

### Technical Mechanics
- **Edge Function:** `supabase/functions/format-worksheet-prompt/index.ts`. Verifies JWT in code (rejects anonymous), in-memory rate-limit (60 req/min/user), Zod-light body validation (`{ formData }`). Config: `[functions.format-worksheet-prompt] verify_jwt = false` in `supabase/config.toml` (validation done in code per `mem://infrastructure/edge-function-cors-pattern`).
- **Client wrapper:** `src/utils/promptFormatter.ts` exports `async formatPromptForAI(data) → string` with 1-retry fallback (250 ms backoff). Throws on persistent failure; caller (`useWorksheetGeneration.tsx:128`) surfaces the error.
- **Logger:** `src/utils/logger.ts` — `devLog`, `devWarn` (DEV only). 78 files in `src/` migrated. Special files preserved: `src/main.tsx` (`console.log = () => {}` global override), `src/utils/consoleInterceptor.ts` (intentional warn listener).
- **Lazy demo:** `src/data/demoData.ts` `buildDemoData` returns `Promise<DemoDataSet>`. Consumers: `src/contexts/DemoContext.tsx` (mount + `enterDemo`), both use `.then(setDemoData)`.
- **Lazy mock:** `src/pages/TestExercises.tsx` — `useState<any>(null)` + `useEffect` import → renders skeleton until ready.
- **Vite config (`vite.config.ts`):** `sourcemap: mode === 'development'`, `target: 'es2020'`, `manualChunks` isolates `demoWorksheetContent`, `mockWorksheetData`, `mockNewExercisesData`, `react-vendor`, `supabase`, `lucide`. `esbuild.drop: ['debugger']`.

### Invariants (do not regress)
- NEVER add `console.log` / `console.warn` to client code — use `devLog` / `devWarn`.
- NEVER reintroduce static imports of `demoWorksheetContent`, `mockWorksheetData`, `mockNewExercisesData` — always lazy.
- NEVER move prompt formatting back into the client. New prompt fields go into `format-worksheet-prompt`.
- NEVER touch the Worksheet Engine prompt in `generate-worksheet` (Sanctity rule).

### RAG Keywords
IP protection, prompt protection, prompt scraping, console log leak, dev logger, devLog, devWarn, source map disabled, sourcemap off, debugger drop, manualChunks, lazy demo, lazy mock, demoWorksheetContent lazy, mockNewExercisesData lazy, format-worksheet-prompt edge function, language style ladder, CEFR ladder, server-side prompt, Heart of Edooqoo IP, plagiarism prevention, bundle hardening, Vite hardening, rate limit prompt formatter.

---

## v6.9.6 — Demo Mode Lockdown, Dashboard Compact Stats, Mobile Landing Fixes

### Problem
1. `/demo` mutating actions (delete, duplicate, share, add student, calendar slot create, calendar settings save) hit Supabase with synthetic IDs (`demo-student-1`) and crashed with Postgres `invalid input syntax for type uuid`.
2. `/worksheets` route hung on infinite spinner inside demo because `useDeletedWorksheets` had no demo branch.
3. `/calendar/settings` rendered blank in demo (no settings row + no fallback).
4. `/dashboard` displayed 4 oversized stat tiles + a separate Student Hub info banner — broke single-row symmetry, hid the `edooqoo.com/my` CTA on mobile.
5. Public landing (`/`) inherited system dark mode on mobile → low contrast hero, CTA overflowed viewport on `<sm`.

### Edooqoo.com Solution
1. Hard read-only lockdown for demo: every UI handler that mutates state checks `isDemoMode` BEFORE calling Supabase, returns early with toast `"<Action> is disabled in demo mode. Sign up free to unlock all features!"`.
2. Demo data hooks (`useStudents`, `useStudent`, `useWorksheetHistory`, `useDeletedWorksheets`, `useCalendarSettings`, `useStudentSelector`, `useTokenSystem`, `useUpcomingLessonsCount`) early-return seeded `demoData` instead of querying.
3. `CalendarSettingsPage` shows amber "Demo view" banner + disables inputs.
4. `CompactStatsBar` replaces old grid + Hub Info banner. 2-column layout on `lg+`: left = Student Hub CTA with full copy ("students log in with just their email at edooqoo.com/my — no login needed"), right = 6 inline stat pills.
5. `Index.tsx` runs a `useEffect` that removes `dark` class from `<html>` while landing is mounted; restores on unmount. `HeroHeadline` uses responsive padding/text size and shorter "Generate Free Worksheet" copy on `<sm`.

### Technical Mechanics
- **Guard primitive:** `src/hooks/useDemoGuard.ts` exposes `{ isDemoMode, guardAction(label, fn) }`. `DemoContext.showDemoBlockedToast(action)` provides unified toast copy.
- **Storage key:** `localStorage.edooqoo_demo_mode` (country code or `DEFAULT`). `forceExitDemo()` clears storage + redirects to `/`.
- **Seed data:** `src/data/demoData.ts` (synthetic students/worksheets/lessons) + `src/data/demoWorksheetContent.ts` (~950 KB of real production `ai_response`/`html_content` for 10 worksheets, dynamically merged in `buildDemoData`).
- **Components guarded:** `DeleteWorksheetButton`, `DuplicateWorksheetButton`, `ShareWorksheetModal`, `dashboard/AddStudentButton`, `CalendarPage.handleAddSlot/handleSlotClick/handleShare`.
- **Dashboard:** `src/components/dashboard/CompactStatsBar.tsx` — `lg:grid-cols-2`, left column matches Students card width, right column matches Worksheets card width. 6 stats: Tokens left, This month, All time, Students, Active homework, Upcoming lessons (7d). New hook `src/hooks/useUpcomingLessonsCount.tsx` (single SELECT on `calendar_slots` where `status='booked'`).
- **Landing theme guard:** `src/pages/Index.tsx` `useEffect(() => { html.classList.remove('dark'); return () => restore })`.
- **Hero responsive:** `src/components/landing/HeroHeadline.tsx` uses `text-base sm:text-lg`, `px-4 sm:px-8`, `h-12 sm:h-14`, copy `"Generate Free Worksheet"` on `<sm`.

### Invariant (do not regress)
Every NEW mutating handler MUST start with:
```ts
if (isDemoMode) { showDemoBlockedToast('<Action>'); return; }
```
or wrap with `guardAction('<Action>', () => mutate())`.

### RAG Keywords
demo mode, lockdown, read-only demo, demo guard, useDemoGuard, guardAction, edooqoo_demo_mode, fake user, sandbox preview, /demo route, demo worksheets, demo calendar, demo settings, mutation block, UUID error, demo toast, public demo, sign up unlock, compact stats bar, dashboard stats, student hub CTA, edooqoo.com/my, upcoming lessons count, mobile dark mode hero, landing light theme, hero CTA mobile overflow.
