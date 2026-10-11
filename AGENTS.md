# AGENTS.md — Technical Rules

One rule per entry, with a one-line why. Replace an existing rule instead of adding a second one on the same topic. Product/UX decisions live in project memory (`mem://`) and `docs/ux/*-spec.md`, not here.

## Protected Systems

- The Worksheet Generation Engine (prompt wording, parameters, pipeline in `supabase/functions/generateWorksheet` and `format-worksheet-prompt`) is never modified without the literal instruction "update the Worksheet Generation Engine" — because it is the core product IP.

## Student Workspace

- Student Workspace tab and Learning plan segment state live only in the URL and are resolved via `src/lib/students/workspaceTabs.ts` (`resolveModelSegment` for `view=`); legacy `?tab=` and `view=` values are permanent — because sent emails and bookmarks carry them.
- The next lesson shown anywhere (Prep card, Learning plan Up next) is ordered only by `orderUpNext` in `src/lib/dslm/learningPlan.ts` — because suggestion `sequence_number` restarts per phase and two selectors once proposed different lessons.

## Answers & Evaluation

- All worksheet text answer checking goes through `src/lib/answers/matchAnswer.ts`; an uncertain match returns `review`, never `wrong` — because false negatives destroy learner trust and DSLM accuracy.
- "Homework waiting for review" is decided only by `isHomeworkAwaitingReview` in `src/lib/homework/reviewState.ts`, and every review entry point links to `/homework/:id/review` — because the dashboard, timeline and homework list used to disagree and the review page was unreachable after the first review.

- Closed exercise key verdict is computed once by `calculateItemMastery` in `supabase/functions/_shared/itemMastery.ts` and exposed as `key_verdict` by `_shared/closedItemContext.ts`; AI adds only the explanation, never lowers a key-correct score or reveals answers, and is displayed only through `ClosedAiExplanations` - because model errors must never contradict the key or DSLM.

## Runtime Safety

- Homework and shared worksheet answers are autosaved only through `createPendingSaves` in `src/lib/answers/pendingSaves.ts` (one debounce timer per exercise, `flush()` on submit and unmount), never a single shared timer — because a shared timer dropped the pending save of one exercise whenever another was edited within 1.5 s.
- Student-facing pages never infer "unassigned" or "not shared" from an anonymous read of `worksheets` (RLS hides the row, so null means unknown, see `isKnownUnassigned` in `src/lib/worksheet/shareAssignment.ts`); access is decided by `verify_worksheet_student_email` — because that inference blocked every anonymous student on shared worksheet links.
- Client logging goes through `src/utils/logger.ts`, never raw `console.*` — because production logs must not leak student data.
- Supabase hooks return early when demo mode (`edooqoo_demo_mode`) is active; `src/lib/demo/demoFetchGuard.ts` (first import of `main.tsx`) answers any remaining REST read carrying a `demo-` id with an empty result — because demo IDs are not UUIDs and crash queries.
- Teacher-only pages call `useTeacherAuthRedirect` instead of ad-hoc `navigate('/')` — because email deep links must survive login via `state.from`.
- Edge Functions build links from the `APP_BASE_URL` secret, never a hardcoded domain — because preview, published and custom domains differ.
- Student-facing pages (Welcome Test, homework) log DSLM events only through token/email-authorised RPCs (`log_welcome_test_event_by_share_token`, `log_homework_submitted_event`), never `add_student_event` or direct `student_events` writes — because those are teacher-only and anonymous calls fail silently with 401.
- The profile billing guard trigger tests `current_user = 'authenticated'`, never `auth.role()` — because the JWT role is still `authenticated` inside SECURITY DEFINER billing functions like `consume_token`, which then could not charge tokens.
- Every AI model id used in `supabase/functions/**` is registered in `supabase/functions/_shared/modelRegistry.ts` (enforced by `src/lib/__tests__/modelAudit.test.ts`) — because `audit-llm-models` monitors and advises only on registered models.

## Writing Style

- No em dashes (U+2014, `&mdash;`) in English user-facing, generated or SEO text; use a comma, colon, parentheses, period or a pipe in titles, and use `\u2014` escapes in regexes (enforced by `src/lib/__tests__/noEmDash.test.ts`) — because they read as AI-generated English. En dashes in numeric ranges (`1–6`) stay.

## Documentation & AI Resources

- `public/llms.txt` and root `llms.txt` are generated only by `scripts/seo/generate-ai-resources.mjs` (`npm run seo:generate-ai`) and gated by `scripts/seo/audit-seo-assets.mjs`; never hand-edit them or append release notes, and change wording in the generator, not the output; generators stay deterministic (no `new Date()`; bump `RELEASE_DATE`/`VERSION`) and `npm run seo:sync-generated` must leave `git diff` clean — because CI runs `git diff --exit-code` after regenerating.
- `docs/llm-context.md` is updated only for architectural changes (new module, table, Edge Function, route contract) in the `PROBLEM -> EDOOQOO SOLUTION -> TECHNICAL MECHANICS -> RAG KEYWORDS` format — because per-fix changelog entries bloat agent context and go stale.
