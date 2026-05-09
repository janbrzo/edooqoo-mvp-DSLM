# Edooqoo LLM Context (RAG)

Canonical, dense reference for AI agents operating on the Edooqoo codebase.
Written in Problem → Edooqoo.com Solution → Technical Mechanics format.

---

## v6.9.7-patch — Demo Mode Hardening + Signup Email Clarity

### Problem
1. In `/demo`, clicking an empty calendar slot or "Add lesson" early-returned with a toast and never opened the modal — UX dead-end; users couldn't see the lesson-creation flow.
2. `AllWorksheetsPage.handleBulkDelete` was unguarded; demo users could trigger Supabase delete with synthetic UUIDs.
3. Hooks `useStudents`, `useWorksheetHistory`, `useDeletedWorksheets` could resolve `loading=false` before `demoData` arrived (async lazy-load), causing flashes of empty states.
4. The demo banner (fixed top, 36px) overlapped page content because `AuthenticatedPageShell` did not reserve space.
5. After signup, users only saw "check your email" but received NO welcome email until they clicked the Supabase confirmation link → confusion ("did the welcome email fail?"). FAQ also did not explain the two-email flow.
6. `demoData.subscription_type` was `'professional'` (not a real plan name), making demo dashboard look fake.

### Edooqoo.com Solution
1. Calendar modal now opens in demo mode but blocks the SAVE step inside `UnifiedSlotModal.handleSubmit` via new `demoMode` prop + `useDemoContext`. Users can explore the form; toast fires only on submit.
2. `handleBulkDelete` early-returns with `showDemoBlockedToast('Deleting worksheets')`.
3. Demo-aware hooks gate on `!!demoData` in `queryKey`/`enabled`; `useDeletedWorksheets` early-returns `setLoading(false)` for demo.
4. `AuthenticatedPageShell` injects `style={{ paddingTop: '36px' }}` when `isDemoMode` to clear the banner.
5. `EmailConfirmationModal` "What's next" list and `/how-it-works` FAQ now explicitly describe the two-email sequence: (a) Supabase confirmation, (b) branded Edooqoo welcome from `hello@edooqoo.com`.
6. `demoData.subscription_type = 'Full-Time 30'`.

### Technical Mechanics
- `src/components/calendar/UnifiedSlotModal.tsx` — new optional prop `demoMode?: boolean`; pulls `useDemoContext` directly; `handleSubmit` short-circuits when `isDemoMode || demoMode`. `CalendarPage` passes `demoMode={isDemoMode}` and removes the early-return inside `handleAddSlot`/`handleSlotClick` (the modal handles it).
- `src/pages/AllWorksheetsPage.tsx` — imports `useDemoContext`, guards `handleBulkDelete`.
- `src/hooks/useStudents.tsx`, `src/hooks/useWorksheetHistory.tsx` — `queryKey` includes `!!demoData`; `enabled` requires demo data ready.
- `src/hooks/useDeletedWorksheets.tsx` — explicit `if (isDemoMode) { setLoading(false); return; }`.
- `src/components/AuthenticatedPageShell.tsx` — conditional `paddingTop` style.
- `src/components/EmailConfirmationModal.tsx` + `src/pages/HowItWorks.tsx` — copy updates only.
- `src/data/demoData.ts` — single literal change.

### Invariants (do not regress)
- NEVER add an early-return for `isDemoMode` inside `CalendarPage.handleAddSlot` / `handleSlotClick` — modal owns the guard.
- NEVER remove the `demoMode` prop from `UnifiedSlotModal.handleSubmit` — it is the actual write barrier.
- NEVER drop the two-email explanation from `EmailConfirmationModal` until the Supabase confirmation step is removed (it is not).
- All NEW mutating handlers in pages still MUST guard `isDemoMode` per the v6.9.6 rule.

### RAG Keywords
demo mode patch, calendar demo modal, UnifiedSlotModal demoMode prop, demo bulk delete guard, demoData loading race, AuthenticatedPageShell padding banner, signup confirmation email, two-email signup flow, EmailConfirmationModal welcome email FAQ, hello@edooqoo.com explanation, Full-Time 30 demo subscription.

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

## v6.9.8

### Student Knowledge — Quick Capture + AI Classification
- **Problem**: Forced category+subtype+element+nano_skill+mastery selection on every add blocked teachers from capturing notes mid-lesson.
- **Solution**: Frictionless capture — textarea only. AI classifies in background after save.
- **Mechanics**: 
  - Migration: `ALTER TABLE student_knowledge_entries ADD COLUMN ai_classified, ai_confidence, archived_at, used_in_worksheet_id`.
  - Edge function `classify-knowledge-entry`: Lovable AI Gateway (`google/gemini-2.5-flash`) with constrained tool-call schema returning `{category, confidence, tags, skill_subtype?, element_type?, nano_skill?, suggested_mastery?, sub_category?}`.
  - `useStudentKnowledge.addMutation`: inserts as `Notes`, then async fetches student `english_level/main_goal`, invokes classifier, patches row when `confidence>=0.6`.
  - `StudentKnowledgeQuickAddModal`: textarea + optional tags + Save. No category picker.
  - `StudentKnowledgeSidePanel` retained as advanced editor (full metadata controls).
- **RAG Keywords**: notes, student notes, knowledge base, ai categorize, auto-tag, frictionless input, quick capture, 1-minute prep input

### Welcome Email v2 — Add Student CTA
- **Problem**: CTA pointed to /dashboard; reply went to hello@ (no admin notification); list missed Welcome Test + Calendar.
- **Solution**: Primary CTA = "Add your first student" → `/dashboard?action=add-student`. Reply-to = `edooqoo@gmail.com`. New 5-item list with Welcome Placement Test + Calendar availability. Removed AI-sounding "a real human reads it".
- **Mechanics**: 
  - `send-welcome-email/index.ts` — new HTML, `reply_to: 'edooqoo@gmail.com'`.
  - `Dashboard.tsx` — `useSearchParams().get('action')==='add-student'` → opens `AddStudentDialog`, strips param.
- **RAG Keywords**: welcome email, onboarding email, resend, edooqoo gmail reply, add student CTA

### Mail #1 (Supabase Confirmation)
- **Decision**: Stay on native Supabase auth email (no auth-email-hook to avoid DNS delegation conflict). Customize HTML+sender name in Supabase Dashboard → Auth → Email Templates. See `docs/operational/supabase-confirmation-template.md`.

### Particles Landing Background
- **Problem**: Static landing background — wanted animated particles per particles.js config (250 nodes, #643cdd).
- **Solution**: `tsparticles` (slim) modern fork, React 18 compatible.
- **Mechanics**: 
  - Deps: `@tsparticles/react @tsparticles/slim @tsparticles/engine`.
  - `src/components/landing/ParticlesBackground.tsx` — `initParticlesEngine(loadSlim)`, mobile downgrade to 80 particles, fixed `-z-10` `pointer-events-none`.
  - Mounted in `Index.tsx` only on anon path (return after `isRegisteredUser` early-return).
- **RAG Keywords**: particles, animated background, tsparticles, landing hero, network nodes, vincentgarreau

### Demo Mode Fixes (Lockdown v3)
- **Problem**: Save Changes on demo worksheet threw "invalid input syntax for type uuid: demo-ws-1". Students/worksheets pages empty. Calendar modal blocked from opening. Dashboard Generate (navigation) wrongly blocked.
- **Solution**: Guard at MUTATION sites only; navigation/modals stay open in demo.
- **Mechanics**:
  - `WorksheetContent.saveWorksheetChanges` — early-return + toast when `localStorage.edooqoo_demo_mode==='true'`.
  - `useStudents.loading` — `(isDemoMode && !demoData) || query.isLoading` — synthetic loading until demoData arrives.
  - `CalendarPage.handleSlotClick` — removed demo guard (modal opens).
  - `SlotDetailModal.handleSave` — added demo guard with toast.
  - `Dashboard.handleGenerateWorksheet` — removed demo guard (it only navigates).
- **Invariant**: Demo navigation handlers NEVER guard. Demo modals CAN open. Demo MUTATION handlers MUST guard.
- **RAG Keywords**: demo mode, public demo, read-only, fake auth, demoData, isDemoMode, edooqoo_demo_mode, demo guard

## Student Knowledge v6.9.9 — Three Views + Manual Archive
**Problem**: Single timeline view of `student_knowledge_entries` made DSLM-style skill aggregation and 1‑minute lesson prep impossible. `Next Lesson Ideas` accumulated forever with no signal of what was already used. AI background classifications were invisible to teachers, causing distrust.
**Edooqoo Solution**: `StudentKnowledgeSection` exposes 3 tabs — **Timeline** (existing), **By Skill** (groups `Skill Assessment` rows by `metadata.nano_skill`, shows latest mastery), **For Next Lesson** (shared data source with `OneMinutePrepCard`). Each `Next Lesson Ideas` card gets a one-click `CheckCircle2` "mark as used" button that archives via `archiveEntry`, immediately removing it from the prep view. AI classifications surface as a `Sparkles "AI organized"` badge with confidence tooltip on each card.
**Technical Mechanics**:
- `useStudentKnowledge.archiveEntry(entryId, worksheetId?)` mutation sets `archived_at = now()` and optional `used_in_worksheet_id`. Invalidates both `['knowledge', 'entries', ...]` and `['one-minute-prep', ...]` query keys.
- `useOneMinutePrep` (existing, unchanged) filters `archived_at IS NULL` → archived ideas vanish.
- `StudentKnowledgeSection` uses `Tabs` from `@/components/ui/tabs`; `By Skill` view groups `entries.filter(e => e.category === 'Skill Assessment')` client-side by `metadata.nano_skill` (fallback `metadata.element_type` → `'Other'`).
- `StudentKnowledgeEntryCard` reads `entry.ai_classified` + `entry.ai_confidence` (added to `StudentKnowledgeEntry` type) and renders `Tooltip` with `Sparkles` icon when both present and confidence ≥ 0.6.
- Auto-link `used_in_worksheet_id` from `worksheetService.create` is INTENTIONALLY OMITTED to keep the worksheet engine pristine (Sanctity rule). Only manual archive flow is wired.
**RAG Keywords**: student knowledge tabs, by skill view, for next lesson, archive entry, used in worksheet, AI organized badge, manual archive, mark as used, three views student notes, lesson prep digest

## Email v6.9.9 — Footer Honesty + Confirm Personalization
**Problem**: Both Supabase confirmation email and Resend welcome email displayed `Edooqoo · hello@edooqoo.com` in their footer. The mailbox does not exist; replies are silently dropped. Confirm signup was generic with no recipient personalization despite `first_name` being captured at signup.
**Edooqoo Solution**: Removed literal `hello@edooqoo.com` from both email footers. Confirmation email greets users by name via Supabase Go template `{{ if .Data.first_name }}Welcome, {{ .Data.first_name }}!{{ else }}Confirm your email{{ end }}`. Welcome email keeps `from: 'Edooqoo <hello@edooqoo.com>'` (Resend-verified domain, display-only) with `reply_to: 'edooqoo@gmail.com'` (real inbox).
**Technical Mechanics**:
- Source of truth for confirmation HTML: `docs/operational/supabase-confirmation-template.md` — must be manually pasted to Supabase Dashboard → Auth → Email Templates → Confirm signup.
- Welcome footer change: `supabase/functions/send-welcome-email/index.ts` line 70 now reads `Edooqoo · helping English tutors save prep time` (no email address).
- `first_name` arrives via `signUp({ options: { data: { first_name: firstName } } })` in `src/pages/Signup.tsx` (line 90) → stored in `auth.users.raw_user_meta_data.first_name` → exposed to Supabase email templates as `{{ .Data.first_name }}`.
**RAG Keywords**: email footer, hello@edooqoo.com, confirm signup template, first_name personalization, raw_user_meta_data, supabase auth template, reply_to gmail, resend from address

## Particles Background v6.9.9 — Authenticated Non-Interactive Mode
**Problem**: Authenticated teachers got the same hover-reactive `tsparticles` background as anonymous landing page; the "grab" mode pulled lines toward the cursor and was distracting during work.
**Edooqoo Solution**: `ParticlesBackground` accepts `interactive?: boolean` (default `true`). `AuthenticatedPageShell` passes `interactive={false}` → disables `onHover` and `onClick` event modes; raises link opacity to 1 to compensate for the lost hover highlight. Landing page (`src/pages/Index.tsx`) renders without the prop → keeps reactive behaviour.
**Technical Mechanics**:
- `src/components/landing/ParticlesBackground.tsx` — prop drilled into `useMemo([interactive])` options; `onHover.enable` and `onClick.enable` bound to `interactive`; `links.opacity` ternary.
- `src/components/AuthenticatedPageShell.tsx` — `<ParticlesBackground interactive={false} />` when `pattern === 'particles'`.
**RAG Keywords**: particles interactive false, hover disabled, authenticated background, tsparticles non-interactive, AuthenticatedPageShell pattern particles

## v6.9.10 — Worksheet Form Next-Step Preset + Stale Knowledge Badge

### Worksheet Form Next-Step Preset
**Problem**: After teachers built a learning plan via `useFutureTimeline` (Next Steps / Phase Steps), the WorksheetForm was unaware of it. They restated topic/goal/exercises by hand, ignoring the plan; cohesion across worksheets degraded; `future_worksheet_suggestions.is_used` rarely flipped, so suggestions accumulated as stale clutter.
**Edooqoo Solution**: Thin banner on `WorksheetForm` directly above the Exercise Selection Cards, surfaces up to 3 `phase_step` (preferred) + `next_step` chips for the currently selected student. Click prefills the form. Empty state = soft amber CTA "Open Learning Plan" → `/student/{id}?tab=progress`. Banner collapses (`return null`) when `selectedStudentId === 'no-student'` or `!userId`.
**Technical Mechanics**:
- `src/components/WorksheetForm/NextStepsPresetBanner.tsx` — consumes `useFutureTimeline({studentId, teacherId})`. Presets selector: `[...phaseSteps, ...nextSteps].slice(0,3)`. Loading state = `Skeleton h-10` inside `min-h-[44px]` wrapper to prevent layout shift. Tooltip on each chip renders `goal — rationale`.
- Apply path uses parent's `applyPreset(p: PresetPayload)` which calls `normalizeSuggestionPrefill` (single source of truth, shared with DSLM `prefillExercises` sessionStorage path) — guarantees coherent `selectedExercises` / `selectedMediaTypes` / `exerciseFocusMap` triple, exact target count (6 for 45min, 8 for 60min), one media family at most.
- Origin tracking: `applyPreset` writes `sessionStorage.appliedPresetSuggestionId = p.sourceSuggestionId`. `WorksheetForm`'s existing `worksheetGenerationSuccess` handler reads it and dispatches `markPresetUsed` `CustomEvent` with `{suggestionId, worksheetId}`. `NextStepsPresetBanner` listens for `markPresetUsed` and calls `useSuggestion(id, worksheetId)` → flips `is_used=true`, `used_at=now()`, `used_worksheet_id=worksheetId` in `future_worksheet_suggestions`.
- `inferMediaTypes(exercises)` in banner: picture > audio > none, based on `PICTURE_EXERCISE_IDS` / `AUDIO_EXERCISE_IDS` constants exported from `normalizeSuggestionPrefill.ts`.
- Sanctity preserved: zero changes to worksheet generation prompt, `format-worksheet-prompt`, `generate-curriculum-phases`, `generate-timeline`, `useWorksheetGeneration`.
**Mental Model — Knowledge ↔ Plan ↔ Worksheet** (canonical for future agents):
```
Goals (student profile + Knowledge: Skill Assessment, Personal, Goals)
  ↓
generate-curriculum-phases  → 3-6 macro phases (dslm_curriculum_phases) — multi-week blocks
  ↓
generate-timeline           → 1-3 worksheet ideas (future_worksheet_suggestions)
                              kinds: 'next_step' (free) | 'phase_step' (bound via phase_id)
  ↓
WorksheetForm preset chip   → prefill via normalizeSuggestionPrefill
  ↓
worksheet generation engine (UNTOUCHED prompt, Sanctity)
```
Two distinct edge functions live ONLY in Supabase deployment (not in repo): `generate-curriculum-phases` (macro) and `generate-timeline` (micro). Hooks `useCurriculumPhases` / `useFutureTimeline` are the only client surface.
**RAG Keywords**: worksheet form preset, next step chip, learning plan banner, prefill from suggestion, future timeline preset, phase step preset, suggestion used flag, mark preset used, applied preset session storage, normalize prefill, knowledge plan worksheet pipeline, curriculum phases vs timeline, macro vs micro plan

### Stale Knowledge Badge
**Problem**: `student_knowledge_entries` of category Personal / Skill Assessment / Goals older than 90 days may be obsolete (job change, mastered skill, life change), but the UI gave no signal — teacher trusted a 6-month-old "works at startup X, learning negotiation phrases" as fresh truth.
**Edooqoo Solution**: Pure client-side amber badge on `StudentKnowledgeEntryCard` reading "Stale ({age}d old) — still true?" with two inline actions: `Yes, still current` resets the freshness clock; `Mark outdated` reuses existing flow. No cron, no email, no edge function, no schema change.
**Technical Mechanics**:
- `freshnessAnchor = max(created_at, metadata.last_confirmed_at)`. `isStale = !is_outdated && !archived_at && category ∈ {Personal, Skill Assessment, Goals} && differenceInDays(now, freshnessAnchor) >= 90`.
- New mutation `confirmCurrent(entryId)` in `useStudentKnowledge`: read row → patch `metadata = { ...metadata, last_confirmed_at: new Date().toISOString() }`. Invalidates `['knowledge','entries',...]`.
- `metadata.last_confirmed_at` is a free-form JSONB key; never persisted as column. `created_at` is NEVER mutated.
- Badge only renders in `StudentKnowledgeSection` (passes `onConfirmCurrent`); other consumers (DSLM `SkillsView`, `GoalsView`, `ProfileView`, `PathwayView`, `StudentPage`) omit the prop → badge silently hidden, zero regression.
**RAG Keywords**: stale note, knowledge freshness, last confirmed at, 90 days outdated, confirm current mutation, knowledge audit prompt, freshness anchor, isStale, metadata last_confirmed_at

## v6.9.11 — Worksheet Form Next Steps Preset (UX upgrade) + Critical Hook Fix
**Problem**:
1. Teachers couldn't tell where the chip suggestions came from ("random AI suggestions?" vs. Learning Plan).
2. Chips order ignored phase order — `[...phaseSteps, ...nextSteps].slice(0,3)` showed Phase 4 before Phase 1.
3. Only 3 chips visible with no way to browse N>3.
4. Empty state ("no learning plan") had weak CTA.
5. `StudentProgressTab` crashed white-screen with React error #310 because `useGoalProgress` was called below an early `return` when `loading`.

**Edooqoo Solution**:
1. Banner header now reads `Next Steps from Learning Plan` (Map icon) + `View plan ↗` link to `/student/{id}?tab=progress`. Each chip shows `#displayIndex topic` and tooltip with `Step #N • Phase X / Free step`, full topic, goal, rationale.
2. Banner imports `useCurriculumPhases` and replicates `PathwayView` sort: currentPhase first → phaseOrder ASC → sequence_number ASC. `displayIndex` is per-phase (matches Profile UI).
3. Sliding-window carousel (3 visible, advance by 1) with `<` `>` arrows + `windowStart+1–end of total` label. `windowStart` resets to 0 on `studentId` change and after `applyPreset`.
4. Empty state expanded to 2-line copy: "No learning plan… Students with a structured Learning Plan get worksheets that build on each other instead of being standalone exercises. Strongly recommended." + `Open Learning Plan ↗` button.
5. Hook `useGoalProgress(...)` moved above `if (loading) return ...` in `StudentProgressTab.tsx`. `useGoalProgress` already handles empty `goals` safely.

**Technical Mechanics**:
- `NextStepsPresetBanner.tsx`: now uses `useFutureTimeline` + `useCurriculumPhases`. `useState<number>(windowStart=0)`. Memoizes `sortedItems` containing `{ s, displayIndex, phaseLabel }`. Visible slice = `sortedItems.slice(windowStart, windowStart+3)`. Carousel controls disabled at boundaries.
- `WorksheetForm/index.tsx`: student select trigger gets `border-amber-400 ring-1 ring-amber-300 bg-amber-50/40` when `selectedStudentId === 'no-student'`. Placeholder: `Choose a student`. Item label: `Generic worksheet (no student)` (value still `'no-student'` for back-compat). Subtle amber hint paragraph below.
- `NextStepBanner.tsx`: empty state adds "Just added some? Refresh the page to see them." + `Refresh` ghost button when `!hasGoals`.
- `NextStepsSection.tsx`: empty-state generate now opens a count Dialog (1-6, default 3) before calling `onGenerateMore`. Identical UX to "Generate more next steps" dropdown.
- `useFutureTimeline.tsx`: `generateNextSteps` catch differentiates 402 / 429 / generic via `error.context?.status` and shows specific toast.

## Pathway Generation Counts (Why 3-6 Phases, 1-3 Next Steps)
**Problem**: Why these specific ranges? Are they arbitrary?

**Edooqoo Solution**:
- **3-6 phases (`generate-curriculum-phases`)**: Maps to a typical course/B2B cycle — 3 phases × 4 weeks ≈ a quarter, 6 phases × 4-6 weeks ≈ a semester (12-24 weeks). <3 = no narrative arc (student can't feel progress); >6 = phases collapse into single lessons, contradicting the definition of "phase" as a 3-6 week block. Actual count is AI-selected within the band, driven by: number of student goals, `nearest_goal_deadline` horizon, breadth of `mainGoal`.
- **1-3 next steps (`generate-timeline` default)**: 1 = the always-visible Banner #1; 3 = optimal short-horizon planning ("rolling 3-lesson plan"). >3 hard-coded = staleness risk: by lesson 2, items 4-5 are stale because feedback has shifted context. Teacher can override via dialog (1/2/3/5/6).

**Technical Mechanics**: Counts are enforced by the AI prompt (in the deployed edge function — sanctity, not in repo). UI now offers count picker for first generation too (parity with "Generate more").

**RAG Keywords**: phase count rationale, why 3 to 6 phases, next steps count, rolling 3 lesson plan, semester pacing, curriculum block size, AI suggestion count, worksheet horizon, dydaktyczny powod liczby faz

## Critical Fix v6.9.11: useGoalProgress Hook Order
**Problem**: `/student/{id}?tab=progress` rendered as a blank page. Console: `Minified React error #310: Rendered more hooks than during the previous render`. Root cause: `useGoalProgress(...)` was called on line 154, AFTER `if (loading) return <Loader/>` on line 148. First render returned early (1 hook fewer); second render after data loaded had 1 more hook → React aborted.

**Edooqoo Solution**: Move the `useGoalProgress` call above the early return. The hook already returns an empty `Map` when `goals` is empty, so no behavioral change.

**Technical Mechanics**: Single edit in `src/components/student-progress/StudentProgressTab.tsx`. New invariant in `mem://index.md` Core: "Hooks must be called above any early return."

**RAG Keywords**: react error 310, rules of hooks, conditional hook call, white screen progress tab, useGoalProgress crash, early return before hook
