# Plan v6.9.36 — Problem Resolution Cycle

Zakres jest zamknięty do 8 zgłoszonych problemów. Nie dotykamy Worksheet Generation Engine, promptów generowania worksheetów, Stripe, RLS ani schematu bazy poza odczytową diagnostyką. Wszystkie zmiany w kodzie i dokumentacji będą po angielsku.

## Global dependency scan

Affected surface:
- `src/components/dashboard/AddStudentDialog.tsx`
- `src/hooks/useWelcomeTestActions.ts`
- `src/hooks/useStudentTests.tsx` — tylko jeśli trzeba usunąć istniejący filtr `deleted_at` z hooka współdzielonego
- `src/components/dashboard/WelcomeTestSuggestion.tsx` — tylko jeśli trzeba ujednolicić ensure/send z nowym helperem
- `src/pages/Index.tsx`
- `src/pages/Signup.tsx`
- `src/components/GoogleSignInButton.tsx`
- `src/components/WorksheetForm/index.tsx`
- `src/pages/StudentPage.tsx`
- `src/components/dslm/DSLMTab.tsx`
- `src/components/dslm/GoalsView.tsx`
- `src/components/gallery/GalleryExerciseRenderer.tsx`
- `src/pages/gallery/PublicGalleryWorksheetPage.tsx`
- `src/components/landing/HeroHeadline.tsx`
- `supabase/functions/audit-llm-models/index.ts`
- `supabase/functions/send-model-audit-email/index.ts` — tylko weryfikacja / drobne logowanie, jeśli potrzebne
- `docs/llm-context.md`
- `public/llms.txt`
- opcjonalnie nowa pamięć `mem/features/onboarding/v6936-runtime-hardening.md`

Zero regressions confirmed before implementation:
- no Worksheet Generation Engine prompt/logic/parameter changes
- no database migration planned
- no RLS/policy changes planned
- no Stripe/token/payment changes planned
- no auth provider config changes planned
- no changes to public/private data boundaries
- UI copy remains English

---

## Problem 1 — Add Student + automatic Welcome Test still fails

### Dependency scan
Affected surface:
- `AddStudentDialog.tsx` inline autosend block, lines around current `student_tests` select/insert/update/function invoke
- `student_tests` table constraints verified from Supabase: status check allows only `draft`, `assigned`, `in_progress`, `completed`, `reviewed`
- `generate_test_share_token` RPC usage pattern in `useStudentTests.tsx`
- `send-test-email` Edge Function
- `profiles` read for teacher name

Runtime facts found:
- `student_tests.deleted_at` exists in DB, so the previous plan’s “column missing” diagnosis is incomplete.
- The autosend insert currently writes `status: 'pending'`, but the real DB constraint rejects it. Allowed statuses do not include `pending`.
- The frontend then catches the failure and shows: “Welcome Test could not be sent automatically…”
- 406 console noise is likely from `.single()` on profiles/session-type calls where zero rows can happen; the critical autosend failure path is the `student_tests` write/query flow.

### Root cause
Root cause: `AddStudentDialog` duplicated the Welcome Test creation flow manually and drifted from the canonical database workflow, using invalid `student_tests.status = 'pending'` instead of creating a draft/assigned test via the same status/RPC mechanics used elsewhere.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. Patch only invalid status | Change inserted status from `pending` to `draft`, then call token RPC/update to `assigned`. | Smallest diff, but leaves duplicated Welcome Test logic in `AddStudentDialog`. | Medium |
| B. Extract a shared non-hook helper | Create a plain async helper for ensure + questions + token + email and use it from `AddStudentDialog`, optionally later from hooks. | Slightly more code, removes drift and makes future fixes single-source. | Low |
| C. Navigate first and let `WelcomeTestSuggestion` autosend | Add `autosend=1` to URL and remove inline send. | Simpler client dialog, but depends on page mount timing and does not help inline-add contexts. | Medium |

### Selected solution + why
Selected: Option B. The structural problem is duplicated workflow logic inside a UI dialog; fixing one status string is too fragile. A plain helper preserves existing UX, supports inline callers, uses canonical RPC `generate_test_share_token`, and avoids calling React hooks outside React.

### Impact analysis
Expected impact:
- Add Student with autosend ON creates or reuses one welcome test.
- Test status becomes `assigned`, not `pending`.
- Questions are seeded once.
- Email send happens after token generation.
- Existing manual Welcome Test buttons remain unchanged.

Zero regressions confirmed:
- no schema change
- no RLS change
- no email template rewrite beyond existing `send-test-email`
- no student creation behavior change except fixing autosend

### Full implementation plan
1. Add a new utility file, for example `src/lib/welcomeTest/ensureWelcomeTest.ts`, with English code:
   - export `ensureWelcomeTest({ studentId, teacherId, studentName })`
   - query latest welcome test with `.select('id, share_token, status')`, `.eq(student_id)`, `.eq(teacher_id)`, `.eq(test_type, 'welcome')`, `.is('deleted_at', null)`, `.order('created_at', { ascending: false })`, `.limit(1)`
   - do not use `.single()`; use array first row or `.maybeSingle()` only when uniqueness is guaranteed
   - if no row: insert `student_tests` with `status: 'draft'`, `attempt_number: 1`, `total_questions: ALL_WELCOME_TEST_QUESTIONS.length`
   - seed `student_test_questions` only after checking if count for `test_id` is zero
   - generate token using `supabase.rpc('generate_test_share_token', { p_test_id: testId, p_teacher_id: teacherId, p_expires_hours: 90 * 24 })`
   - after token RPC, update status to `assigned` and `assigned_at` if RPC does not already do it
   - return `{ testId, token, shareUrl }`
2. Add `sendWelcomeTestEmail({ token, recipientEmail, studentName, teacherId })` helper in same file or adjacent file:
   - fetch teacher profile using `.maybeSingle()` instead of `.single()`
   - invoke `send-test-email` with existing body shape
   - if invoke returns `{ error }`, throw an explicit error with function response details
3. Replace the inline autosend block in `AddStudentDialog.tsx`:
   - remove dynamic import of `useWelcomeTestActions`
   - call the helper inside the existing best-effort async block
   - keep existing success/error toasts
   - keep default navigation logic after add
4. Keep `send-test-email` Edge Function unchanged unless logs show email body/function-level failure.
5. Optional hardening in `useWelcomeTestActions.ts`: replace `.single()` profile read with `.maybeSingle()` to remove avoidable 406 console noise.

### Verification checklist
- Add student with autosend ON creates `student_tests.status = assigned`.
- `student_test_questions` count equals canonical Welcome Test question count.
- `share_token` is non-null.
- `send-test-email` receives a valid token and returns success.
- Toast is success, not fallback error.
- No `student_tests?select=id` 400 in browser network.
- No duplicate welcome test row for the same student/teacher on repeated click.

---

## Problem 2 — 1-Minute Prep “Generate worksheet ↗” fills form but does not auto-start

### Dependency scan
Affected surface:
- `PathwayView.tsx` sets `autoGenerate` through `onUseWorksheetSuggestion`
- `StudentPage.tsx` writes `preSelectedStudent`, `prefillWorksheet`, `prefillExercises`, `autoGenerateWorksheet`
- `Index.tsx` reads `preSelectedStudent` and passes `preSelectedStudent` to `WorksheetForm`
- `WorksheetForm/index.tsx` hydrates state and requests submit
- `useWorksheetGeneration` consumes submitted form data

### Root cause
Root cause: auto-start is tied to React state hydration (`lessonTopic`, `selectedStudentId`) but the effect can fire before `selectedStudentId` is committed from `preSelectedStudent`, and the flag is removed before the real “student + topic + exercises ready” state is guaranteed.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. More timeouts/rAF | Increase delays and retry more. | Quick but repeats the same race-condition pattern. | Medium |
| B. Queue-based readiness gate | Store one structured auto-generate request ID/payload, wait until topic + intended student + exercises are hydrated, then submit once. | Slightly more code, deterministic. | Low |
| C. Submit directly from StudentPage without form | Bypass form and call generation handler with payload. | Fastest UX but bypasses visible form validation and current form behavior. | High |

### Selected solution + why
Selected: Option B. The bug is not insufficient delay; it is missing deterministic readiness. A structured queue keeps the current form UX but makes submit conditional on exact required state.

### Impact analysis
Expected impact:
- Clicking `Generate worksheet ↗` navigates to `/`.
- Form fields populate.
- Generation starts automatically only after the intended student and topic are present.
- Manual `Use this` remains prefill-only.

Zero regressions confirmed:
- no worksheet prompt changes
- no exercise selection algorithm changes
- no token/paywall changes
- no anonymous form behavior change unless `autoGenerateWorksheet` exists

### Full implementation plan
1. In `StudentPage.tsx`, when `autoGenerate === true`, write a richer marker:
   - keep `sessionStorage.setItem('autoGenerateWorksheet', 'true')` for backward compatibility
   - add `sessionStorage.setItem('autoGenerateWorksheetRequest', JSON.stringify({ studentId: student.id, suggestionId, createdAt: Date.now() }))`
2. In `WorksheetForm/index.tsx`:
   - add refs: `autoSubmitFiredRef`, `autoSubmitAttemptsRef`, `autoSubmitTimerRef`
   - parse `autoGenerateWorksheetRequest` safely
   - readiness conditions:
     - `autoGenerateWorksheet === 'true'`
     - `lessonTopic.trim().length > 0`
     - if request has `studentId`, `selectedStudentId === request.studentId`
     - if request has no studentId, allow existing selected student/no-student flow
     - `selectedExercises.length >= 1`
     - `formRef.current` exists
   - if not ready, do nothing; effect reruns on `[lessonTopic, selectedStudentId, selectedExercises.length, selectedMediaTypes.length, exerciseFocusMap]`
   - when ready, schedule one micro-delay: `window.setTimeout(..., 0)` plus one `requestAnimationFrame`, then call `requestSubmit()`
   - remove flags only immediately before `requestSubmit()`
   - if `requestSubmit()` throws or formRef missing, keep the flag until watchdog expires
3. Increase watchdog to be semantic:
   - after 30s, remove `autoGenerateWorksheet` and `autoGenerateWorksheetRequest`
   - log via `devWarn`, not `console.error`
4. In `handleSubmit`, if generation proceeds, no change.
5. Preserve existing DOM fallback for `lessonTopic`.

### Verification checklist
- Click top banner `Generate worksheet ↗` → form opens, selected student is correct, generation modal starts automatically.
- Click compact card play icon → same.
- Click phase step play icon → same.
- Click `Use this` → fills form but does not auto-submit.
- If teacher has no tokens, auto-submit reaches existing paywall behavior instead of silently doing nothing.
- Suggestion is marked used only after `worksheetGenerationSuccess`, unchanged.

---

## Problem 3 — after signup/email confirmation first login should open Add Student modal

### Dependency scan
Affected surface:
- `Signup.tsx`
- `GoogleSignInButton.tsx`
- `Index.tsx`
- Supabase redirect behavior after email confirmation/OAuth

### Root cause
Root cause: the post-signup intent is split between URL param and localStorage, but OAuth currently redirects signup users to `/dashboard`, and `Index.tsx` renders the AddStudentDialog only in the anonymous/public branch, not in the authenticated branch.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. Force all signup redirects to `/?action=add-student` | Minimal route fix. | Does not fix authenticated branch if modal is mounted only in public branch. | Medium |
| B. Mount AddStudentDialog for both authenticated and public Index branches + redirect Google signup to `/` | Fixes both email/password and Google. | Small UI mount duplication or shared render helper. | Low |
| C. Open modal on `/dashboard` instead | Align Google redirect with dashboard. | User requested generator page + modal; changes intended onboarding surface. | Medium |

### Selected solution + why
Selected: Option B. The modal state already exists in `Index.tsx`; the real blocker is that authenticated rendering returns before the modal JSX. Moving the dialog outside branch-specific returns or adding it to authenticated branch fixes the actual runtime path.

### Impact analysis
Expected impact:
- Email signup after confirmation lands on `/` and opens Add Student.
- Google signup lands on `/` and opens Add Student.
- Existing login/signin mode remains unchanged.
- Users with pending anonymous worksheet claims still go to claimed worksheet, preserving current ownership flow.

Zero regressions confirmed:
- no auth configuration changes
- no profile schema changes
- no dashboard behavior change for normal logged-in users without post-signup flag

### Full implementation plan
1. In `GoogleSignInButton.tsx`:
   - if `mode === 'signup'` and no pending worksheet claim, set `redirectPath = '/?action=add-student'`, not `/dashboard`
   - keep signin mode redirect unchanged
2. In `Index.tsx`:
   - render `<AddStudentDialog triggerButton={false} open={addStudentOpen} onOpenChange={setAddStudentOpen} />` inside authenticated branch too, after `TokenPaywallModal`
   - or create a small `addStudentDialogNode` constant and include it in both branches
3. Strengthen the effect:
   - if flag exists but `authLoading` is true, wait
   - if `isRegisteredUser` is true, open modal
   - clear localStorage only after setting open true
   - strip `action` param after open
4. Keep existing `Signup.tsx` `emailRedirectTo` and localStorage flag.

### Verification checklist
- New email signup with confirmation → `/` authenticated generator view appears and Add Student modal is open.
- Google signup → `/` authenticated generator view appears and Add Student modal is open.
- Normal visit to `/` as registered user without flag → modal does not open.
- Pending worksheet claim still redirects to claimed worksheet.

---

## Problem 4 — after autosent Welcome Test, Student page scrolls to Goals but Add Learning Goals modal does not open

### Dependency scan
Affected surface:
- `AddStudentDialog.tsx` navigation target: `/student/:id?tab=dslm&view=goals&focus=add-goal-modal&_={ts}`
- `StudentPage.tsx` tab param handling
- `DSLMTab.tsx` focus param handling
- `GoalsView.tsx` `pendingAddGoal` prop and modal state

### Root cause
Root cause: `DSLMTab` dispatches the add-goal focus before `GoalsView` is reliably mounted through `LazySection`, so scrolling works but the one-time modal signal can be lost.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. Increase timeout before dispatch | Small diff. | Still race-prone with lazy render/slow devices. | Medium |
| B. State-driven pending focus | Convert focus into React state (`pendingAddGoal`) and keep it true until `GoalsView` consumes it. | Deterministic and already partially supported. | Low |
| C. Pass URL params directly to GoalsView | Direct but spreads router concern into child component. | Medium |

### Selected solution + why
Selected: Option B. `GoalsView` already supports `pendingAddGoal`; the fix is to avoid relying on a transient window event for URL-driven focus.

### Impact analysis
Expected impact:
- Autosend ON navigation opens Add Goal modal.
- Existing Roadmap “Add goal” event still works.
- Repeated same action works because `_` cache-buster remains supported.

Zero regressions confirmed:
- no goal table changes
- no DSLM generation logic changes
- no Roadmap/Pathway behavior removal

### Full implementation plan
1. In `DSLMTab.tsx`, change `focusParam === 'add-goal-modal'` handling:
   - call `handleScrollTo('goals')`
   - call `setPendingAddGoal(true)` directly
   - do not dispatch `dslm:addGoal` for URL focus path
2. Keep `window.dispatchEvent('dslm:addGoal')` for other non-URL internal calls if still needed.
3. Delay URL cleanup until after `setPendingAddGoal(true)` and scroll has started.
4. In `GoalsView.tsx`, keep existing effect, but add one defensive line:
   - when `pendingAddGoal` becomes true, set `newGoal.type = 'supporting'` before `setShowAddGoal(true)` so the modal opens in the expected “supporting goal” mode.

### Verification checklist
- Add student with autosend ON → navigates to DSLM Goals and Add Learning Goal dialog opens.
- Closing modal leaves user on Goals section.
- Repeating Add Student on another student opens modal again.
- Manual Roadmap add-goal buttons still open the same modal.

---

## Problem 5 — `/gallery` renderer still fails for Word Order, Complete the Word, Matching Halves

### Dependency scan
Affected surface:
- `GalleryExerciseRenderer.tsx`
- `PublicGalleryWorksheetPage.tsx` parsing of `ai_response`
- public worksheet stored JSON shapes
- screenshots show two failure classes:
  - blank body for `word-order`
  - blank body for `matching-halves`
  - `complete-word` renders full answers rather than visible missing-letter prompts in some cases

### Root cause
Root cause: the gallery preview renderer is a separate static renderer with incomplete normalization for generated worksheet JSON variants; it does not share the robust private worksheet renderers and treats several valid stored shapes as empty arrays.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. Add more aliases to current switch | Small targeted fix. | May need repeated patches as shapes appear. | Low-medium |
| B. Add normalization helpers per exercise type | Keep current renderer but normalize `items` centrally for affected types. | More robust without importing interactive worksheet UI. | Low |
| C. Reuse private worksheet exercise renderers | Best fidelity, but private renderers may include editing/interactive assumptions. | High |

### Selected solution + why
Selected: Option B. The public gallery must stay static/read-only, so importing private worksheet components creates regression risk. Normalizers fix the exact static preview failures safely.

### Impact analysis
Expected impact:
- Matching Halves never renders a blank card when valid data exists.
- Word Order renders shuffled tokens from array/string/object variants.
- Complete the Word renders clue + masked/incomplete word, not only full answer.
- Unknown types still degrade safely.

Zero regressions confirmed:
- no publishing workflow change
- no private worksheet editor change
- no database change
- public preview remains read-only

### Full implementation plan
1. In `GalleryExerciseRenderer.tsx`, add helper functions:
   - `asArray(value)` — returns array for arrays, object values, or empty array
   - `firstNonEmpty(...values)`
   - `splitTokens(value)` — handles arrays, `|`, `/`, commas, whitespace
   - `maskWordFromAnswer(answer)` — vowels or middle letters replaced with underscores when no explicit masked form exists
2. Matching normalizer:
   - accept `ex.pairs`, `ex.items`, `ex.matches`, `ex.questions`, `ex.sentences`
   - accept `ex.halves`, `ex.matching_halves`, `ex.sentence_halves`
   - accept object maps like `{ left: [...], right: [...] }`, `{ starts: [...], endings: [...] }`
   - accept item keys `start`, `ending`, `first_half`, `second_half`, `sentence_start`, `sentence_end`, `answer`
   - if only prompts/options exist, render MC list
   - if no pairs but `word_bank` exists, render starts + word bank, not blank
3. Word Order normalizer:
   - accept top-level `ex.sentences`, `ex.items`, `ex.questions`, `ex.scrambled_sentences`, `ex.word_order`, `ex.prompts`
   - item keys: `words`, `tokens`, `scrambled`, `shuffled`, `shuffled_words`, `scrambled_words`, `shuffled_sentence`, `scrambled_sentence`, `sentence`, `prompt`
   - for sentence strings, split into token chips
   - if answer exists, render it as muted answer preview
   - if no tokens, render the original prompt as a text line rather than blank
4. Complete Word normalizer:
   - accept `items`, `questions`, `words`, `prompts`, `vocabulary`
   - left column: clue/definition/context/sentence/prompt
   - right column: masked word from `gapped`, `masked`, `incomplete`, `before + blank + after`, or generated mask from `answer/full_word/word`
   - show full answer muted only if preview policy wants teacher answer visible; otherwise keep current gallery behavior consistent with existing answer previews.
5. In `PublicGalleryWorksheetPage.tsx`, add defensive parsing for `ai_response` shapes:
   - if `parsed.exercises` missing but `parsed.worksheet.exercises` or `parsed.sections` exists, normalize to an exercise array
   - do not change storage.

### Verification checklist
- Screenshot case `Matching Halves` shows rows or MC options, not blank.
- Screenshot case `Word Order` shows token chips, not blank.
- Screenshot case `Complete the Word` shows clue + missing-letter word/answer consistently.
- Public gallery page still loads with nav and SEO metadata.
- Unknown exercise type still shows safe fallback.

---

## Problem 6 — homepage headline clips the letter “g”

### Dependency scan
Affected surface:
- `src/components/landing/HeroHeadline.tsx`
- H1 typography classes and hero section overflow

### Root cause
Root cause: gradient-clipped text (`text-transparent bg-clip-text`) with tight `leading-[1.1]` inside a large heading leaves too little descender space for lowercase “g” on some browser/font combinations.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. Increase H1 line-height | Simple, safe. | Moves hero slightly. | Low |
| B. Add bottom padding to gradient span | Fixes descender without changing full H1 rhythm much. | Needs precise small padding. | Low |
| C. Reduce font size | Avoids clipping but weakens hero. | Low visually undesirable |

### Selected solution + why
Selected: Option B plus tiny line-height relaxation if needed. It addresses only the clipped gradient span and preserves the hero composition.

### Impact analysis
Expected impact:
- “English teachers.” displays full descenders.
- No layout shift large enough to cover CTA/calculator.

Zero regressions confirmed:
- no content rewrite
- no SEO/head changes
- no calculator changes

### Full implementation plan
1. In `HeroHeadline.tsx`, update H1/span classes:
   - H1 from `leading-[1.1]` to `leading-[1.14]` or keep H1 and add span padding.
   - gradient span add `pb-1` and possibly `leading-[1.16]`.
   - if clipping is caused by section overflow, keep section `overflow-hidden` only for background but ensure text block itself is not clipped. Current clipping appears text-line based, not section-based.
2. Do not alter copy.

### Verification checklist
- Desktop hero screenshot: lowercase “g” fully visible.
- Mobile H1 still wraps cleanly.
- Hero CTA and right calculator remain visible.

---

## Problem 7 — LLM audit smoke test, CRON_SECRET, daily model error, email reporting

### Dependency scan
Affected surface:
- `audit-llm-models/index.ts`
- `send-model-audit-email/index.ts`
- `model_health_checks` table
- `docs/operational/audit-llm-models-cron.md`
- Supabase deployed function call with `x-cron-secret`

Runtime facts found:
- Daily audit still fails on `lovable-gateway/openai/gpt-5-mini` with `Could not finish the message because max_tokens or model output limit was reached`.
- Direct OpenAI model checks pass, including `gpt-5-mini-2025-08-07`.
- Project code search shows `openai/gpt-5-mini` via Lovable Gateway appears only in the audit/docs, while real generation code uses direct OpenAI `gpt-5-mini-2025-08-07` and Gemini gateway models.
- Monthly mode already attempts to send email through `send-model-audit-email` to `edooqoo@gmail.com`.

Security note:
- The pasted CRON value is an authentication secret even if it is not a user password. I will not hardcode it or repeat it in docs/code. In implementation, I can use it once as a request header for a smoke test, but it should later be rotated because it was pasted into chat.

### Root cause
Root cause: the audit monitors a Gateway alias (`openai/gpt-5-mini`) that is not actually used by the app runtime and whose minimal chat completion probe is incompatible with GPT-5 reasoning-token behavior, so daily monitoring creates a persistent false failure.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. Increase Gateway GPT-5 token cap to 512/1024 | Keeps same target. | Still probes a non-runtime alias and may keep failing/cost more. | Medium |
| B. Remove Gateway GPT-5 alias from daily targets; monitor real direct OpenAI model instead | Aligns audit with actual code paths. | Loses Gateway OpenAI alias coverage that is not used. | Low |
| C. Change probe from chat completion to model listing | Avoids generation tokens. | Gateway may not expose equivalent model endpoint; less representative for chat calls. | Medium |

### Selected solution + why
Selected: Option B. Monitoring should protect real production paths, not create noise for an unused alias. Direct OpenAI model checks already pass and reflect actual fallback/runtime usage.

### Impact analysis
Expected impact:
- Daily `model_health_checks` no longer records recurring false GPT-5 Gateway 400.
- Monthly audit email continues to send summary.
- Status page only surfaces meaningful model failures.

Zero regressions confirmed:
- no generation model changes
- no worksheet prompt changes
- no secrets in code
- no table/schema changes

### Full implementation plan
1. In `audit-llm-models/index.ts`:
   - remove `{ provider: 'lovable-gateway', model: 'openai/gpt-5-mini' }` from `TARGETS_DAILY`
   - keep `google/gemini-2.5-flash` and `google/gemini-2.5-flash-lite`
   - add/keep direct OpenAI `gpt-4o-mini` and direct OpenAI `gpt-5-mini-2025-08-07` if daily coverage is desired
   - de-duplicate monthly list so `gpt-4o-mini` is not checked twice
   - keep `google/gemini-3-flash-preview` monthly
2. Keep GPT-5 Gateway request compatibility code only if another target still starts with `openai/gpt-5`; otherwise leave harmless.
3. In `send-model-audit-email/index.ts`:
   - keep recipient `edooqoo@gmail.com`
   - optionally add `text` fallback so Resend email is easier to inspect
4. Deploy edge function(s) after code changes.
5. Smoke test after deploy using Supabase function call:
   - call `/audit-llm-models` with header `x-cron-secret` and body `{ "mode": "monthly" }`
   - do not print the secret
   - inspect returned `results` and `failed` count
   - inspect `send-model-audit-email` logs for dispatch status
6. Documentation update:
   - `docs/operational/audit-llm-models-cron.md` should list current monitored targets and state monthly mode sends email.

### Verification checklist
- Manual monthly smoke test returns `ok: true`.
- No Gateway `openai/gpt-5-mini` false failure in new result rows.
- Email dispatch logs show 200 from `send-model-audit-email` or explicit Resend error.
- If email fails due to domain/API key, report exact cause and do not hide it.

---

## Problem 8 — DSLM/nano-skills explanation for future rebrand/content work, no code change yet

### Dependency scan
Affected surface for analysis only:
- `docs/llm-context.md` already documents DSLM at a high level.
- `public/llms.txt` mentions DSLM but not enough nano-skill mechanics.
- Code references found:
  - `student_skill_metrics`
  - `student_events`
  - `student_learning_profiles`
  - `student_progress_goals`
  - `student_learning_elements`
  - `future_worksheet_suggestions`
  - `student_knowledge_entries`
  - Welcome Test question `nano_skill`
  - `student_test_questions.skill_tags`
  - `process-welcome-test` nano-skill ratings/events
  - homework/open-answer evaluation emits student events
  - flashcard progress and worksheet vocabulary feed student context indirectly

### Root cause
Root cause: the code contains DSLM mechanics across many tables/hooks/functions, but the public/product documentation abstracts them as “DSLM signals” and does not explain the nano-skill event graph clearly enough for another LLM to reconstruct the system from code alone.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A. No code/docs now; provide standalone explanation in final report | Satisfies “na razie nie zmieniaj”. | Not reusable by future agents unless copied. | None |
| B. Add RAG docs now only | Future agents benefit. | User asked content input, but global requirement also asks RAG update. | Low |
| C. Change UI/product copy now | Too early; user said this will be done elsewhere. | High scope creep |

### Selected solution + why
Selected: A for product/UI, B only for mandatory RAG injection about implemented fixes. I will not change UI copy for DSLM/nano-skills now. In the implementation report I will provide a detailed Polish explanation for the user and English RAG notes only for what was technically changed.

### Impact analysis
Expected output:
- A clear, non-marketing DSLM/nano-skills explanation for use in another LLM.
- No app behavior changes.
- No user-facing content changes unless separately requested later.

Zero regressions confirmed:
- no DSLM algorithm changes
- no prompt changes
- no SEO/public copy rewrite now

### Full explanation to provide after implementation
I will include a dedicated section in the final report:

1. What DSLM is in Edooqoo:
   - not a single model file
   - a student-specific signal graph built from goals, tests, worksheet history, homework, flashcards, knowledge notes, pacing, and events
2. What nano-skills are:
   - atomic skill labels such as grammar/vocabulary/communication subskills
   - stored as question skill tags, event payload ratings, and skill metric records
   - used to transform broad CEFR/student goals into concrete next-lesson focus
3. Where signals enter:
   - Welcome Test: static questions include `nano_skill`; completion emits event payloads and profile/skill metrics
   - Homework/shared worksheet answers: answer evaluations emit mastery-like signals
   - Flashcards: card/progress data supplies vocabulary retention context
   - Student Knowledge/Notes: teacher notes become classified context entries
   - Goals/Learning Elements: teacher target objectives become structured progress goals
   - Worksheets/future suggestions: generated/used materials close the loop
4. Where signals are stored:
   - `student_events`
   - `student_skill_metrics`
   - `student_learning_profiles`
   - `student_knowledge_entries`
   - `student_progress_goals`
   - `student_learning_elements`
   - `future_worksheet_suggestions`
5. How 1-Minute Prep uses it:
   - `generate-timeline` reads student profile, skill metrics, knowledge entries, goals, worksheets, phases, existing suggestions
   - it writes next worksheet suggestions with topic, goal, grammar focus, additional info, exercise list, and exercise focus map
   - teacher selects or edits suggestion
   - worksheet is generated as output layer
   - successful generation marks suggestion used
6. What is not inferable from code:
   - exact protected worksheet generation prompt
   - full pedagogical weighting logic if embedded inside protected Edge Function prompts
   - strategic product narrative unless documented

### Verification checklist
- Final report includes “czy da się to zrozumieć z kodu?” answer.
- No UI/content changes for DSLM unless separately approved.
- RAG docs do not expose protected worksheet prompt text.

---

## Combined RAG injection update

### Files
- `docs/llm-context.md`
- `public/llms.txt`
- optional `mem/features/onboarding/v6936-runtime-hardening.md`

### Required structure
For the new update section, use English dense factual Markdown:

```markdown
## v6.9.36 - Onboarding Runtime Hardening, Gallery Static Rendering, Model Audit Alignment

PROBLEM: ...
EDOOQOO SOLUTION: ...
TECHNICAL MECHANICS: ...
RAG KEYWORDS: ...
```

### RAG content to include
- Welcome Test autosend uses canonical draft → questions → share token → assigned → email path.
- Auto-generation from 1-Minute Prep uses structured readiness gate, not timeout-only submit.
- Post-signup AddStudent modal opens for authenticated Index route.
- Add Goal modal is state-driven from URL focus.
- Gallery renderer normalizes Word Order, Matching Halves, Complete Word static preview shapes.
- Hero descender clipping fixed by spacing adjustment.
- Model audit now monitors actual runtime model paths and monthly email report can be smoke-tested with `x-cron-secret` without storing the secret.
- No Worksheet Generation Engine change.

---

## Final change report template after implementation

- Summary of implemented changes
- Files modified
- Documentation updated: YES
- Edge functions deployed/tested: list names
- Out of scope issues flagged:
  - Supabase CRON_SECRET was pasted in chat; rotate it later.
  - Browser extension `contentscript.js MaxListenersExceededWarning` is likely from an extension, not Edooqoo app code.
  - If Resend email dispatch fails, it will be reported separately with exact logs.
- Verification result: PASS/FAIL per problem

## Martha Test gate

All education-facing changes here pass the Martha Test because they do not generate new lesson content and they reduce teacher operational friction for adult 1:1 workflows. Gallery rendering changes only make already-published worksheet previews readable; they do not alter worksheet pedagogy or generation logic.