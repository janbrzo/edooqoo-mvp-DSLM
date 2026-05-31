---
name: Onboarding Checklist v2 + Bulk Gallery Publish + Brain-Reset Trio
description: v6.9.31 — 7-step onboarding split into one-time setup + weekly 1-Minute Prep, realtime progress, bulk-publish-worksheets edge function, BrainResetGames orchestrator with 3 language-neutral minigames, full profiling translation parity across 25 languages
type: feature
---

## Onboarding Checklist v2
- `OnboardingStep` union (in `src/hooks/useOnboardingProgress.tsx`) has 7 ordered IDs:
  - One-time student setup: `add_student`, `send_welcome_test`, `add_goals`, `generate_roadmap`
  - Weekly 1-Minute Prep: `view_next_lesson_ideas`, `pick_idea`, `create_worksheet`
- Hook subscribes via Supabase realtime to `student_tests`, `student_progress_goals`, `dslm_curriculum_phases`, `student_knowledge_entries`, `worksheets` — updates live, no F5.
- `OnboardingChecklist.tsx` renders two sections divided by a separator; deep-links into the relevant target (e.g. `?action=add-student`, `?tab=dslm&section=goals`).
- FAB position unchanged: `bottom-6 right-6 z-30` (avoids bug-report FAB at `bottom-4 right-4 z-40`).
- DO NOT remove legacy step IDs from the union — older teacher localStorage references them.

## Bulk Public Gallery Publish
- Edge Function: `supabase/functions/bulk-publish-worksheets/index.ts` (config `verify_jwt = false`, in-code `x-cron-secret` validation).
- Body: `{ "limit": number, "dryRun"?: boolean }`. Idempotent: skips already-public rows.
- Filters: minimum 6 tasks, valid JSON structure, PII regex (email/phone) on title + content.
- Errors → `error_logs (source='edge-function', source_name='bulk-publish-worksheets')`.
- Single sitemap refresh after batch.
- One-shot trigger SQL:
  ```sql
  select net.http_post(
    url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/bulk-publish-worksheets',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body    := '{"limit":1000}'::jsonb
  );
  ```

## Brain-Reset Game Trio
- Orchestrator: `src/components/welcome-test/BrainResetGames.tsx` — randomly picks one of 3 games on mount.
- Games (all language-neutral, emoji/visual only):
  - `BrainResetGame.tsx` — emoji memory pairs (existing).
  - `BrainResetReactionGame.tsx` — reaction time test.
  - `BrainResetSequenceGame.tsx` — Simon-style sequence recall.
- Each exposes `onComplete()`; only shared localized string is "Resume test" CTA.
- DO NOT add localized text inside individual minigames.

## Profiling Translation Parity
- 5 scenario_reactions (`wt_q3c`, `wt_q5c`, `wt_q7b`, `wt_q13c`, `wt_q39`) now translated for all 25 supported languages in `src/data/welcomeTestTranslations.ts`.
- Skill items (grammar/vocabulary/reading MC/fill-blank/listening) DELIBERATELY remain English-only — translating them defeats the placement signal.
