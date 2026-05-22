# Edooqoo LLM Context (RAG)

Canonical, dense reference for AI agents operating on the Edooqoo codebase.
Written in Problem → Edooqoo.com Solution → Technical Mechanics format.

---

## v6.9.7 — IP Protection Hardening (part 1) + Welcome Email Pipeline (part 2)

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

## v6.9.7 (part 2) — Welcome Email Pipeline

### Problem
1. New users received only Supabase's default, generic confirmation email and then landed in the app cold — no onboarding, no brand impression, no clear "what's next".
2. Email and Google OAuth signup paths produced no consistent post-signup notification, breaking the onboarding loop.
3. Setting up Lovable Emails would have required delegating `notify.edooqoo.com` to Lovable's nameservers, conflicting with the Resend-based stack already used elsewhere (homework, bug reports).

### Edooqoo.com Solution
1. **Branded post-signup welcome email via Resend** from `Edooqoo <hello@edooqoo.com>` — single onboarding touchpoint, brand-consistent (white background, primary `#5E3FD9`, dashboard CTA).
2. **Single trigger covers both email and Google OAuth signup** — fired by `auth.users` UPDATE when `email_confirmed_at` transitions NULL → NOT NULL. Email signup hits this on confirmation-link click; Google OAuth hits it on first callback.
3. **Idempotent per recipient** — `email_send_log` (`recipient_email`, `template_name='welcome_email'`, `status='sent'`) is checked before each send; second invocation returns `{ skipped: true }`. Safe against trigger replays, account re-creation, manual resend attempts.
4. **No new infrastructure** — reuses the existing `RESEND_API_KEY` secret. No pgmq queues, no cron jobs, no NS delegation.

### Technical Mechanics
- **DB trigger:** `public.handle_email_confirmed()` (SECURITY DEFINER, `search_path = public`) attached to `auth.users` AFTER UPDATE OF `email_confirmed_at`. Guards `OLD IS NULL AND NEW IS NOT NULL`. Uses `pg_net.http_post` to call the edge function asynchronously (fire-and-forget; trigger never blocks signup).
- **Auth between trigger and edge function:** shared secret `welcome_email_secret` stored in `public.app_internal_config` (RLS enabled, no policies → only `service_role` can read; trigger reads it via SECURITY DEFINER). Sent in `x-internal-secret` header. Edge function loads the same secret server-side and constant-compares.
- **Edge Function:** `supabase/functions/send-welcome-email/index.ts`. `verify_jwt = false` (no user JWT — trigger calls it). In-code: shared-secret check, Zod-light body validation (`email`, `firstName`, `signupSource`, `userId`), idempotency check against `email_send_log`, render inline-styled HTML, POST to `https://api.resend.com/emails`, append result row to `email_send_log` (`status` ∈ `sent` | `failed`, `provider_message_id`, `error_message`, `metadata`).
- **Tables:**
  - `public.email_send_log` (id, recipient_email, template_name, status, provider_message_id, error_message, metadata jsonb, sent_at, created_at) — append-only audit trail. RLS: `service_role` only.
  - `public.app_internal_config` (key, value, updated_at) — server-only secrets keyed by string. RLS enabled, no policies.
- **Source disambiguation:** `signupSource` derived from `auth.users.raw_app_meta_data->>'provider'` (`'google'` vs default `'email'`). Email body uses one of two opening lines accordingly. No timing offset — Google users get the mail immediately on first login.
- **Sender:** `Edooqoo <hello@edooqoo.com>`, `reply_to: hello@edooqoo.com` (verified Resend domain `edooqoo.com`). Links in template use `APP_BASE_URL` env (never hardcoded).

### Invariants (do not regress)
- NEVER call `send-welcome-email` from client code — DB trigger is the sole entry point.
- NEVER drop or truncate `email_send_log` — it enforces idempotency.
- NEVER hardcode the welcome-email secret in code or config.toml — it lives in `app_internal_config`.
- NEVER change Resend `from` away from `hello@edooqoo.com` — only this mailbox is verified.
- NEVER add a `BEFORE` trigger or remove the `OLD IS NULL` guard — would resend on every profile update.
- NEVER expose `app_internal_config` to anon/authenticated roles.

### RAG Keywords
welcome email, post-signup email, onboarding email, email confirmation trigger, Google OAuth welcome, Resend transactional, hello@edooqoo.com, send-welcome-email edge function, on_user_email_confirmed trigger, email_send_log, app_internal_config, idempotent email, pg_net http_post, x-internal-secret header, branded welcome template, signup source detection, edooqoo.com Resend domain.

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
