---
name: No em dashes in English text
description: Em dashes (U+2014) are banned in user-facing, generated and SEO English text; replacement rules and exclusions
type: constraint
---

## Decision (v6.9.72)

Em dashes read as AI-generated English, so they are not used in any English user-facing, generated or SEO text. En dashes in numeric ranges (`1–6`) stay.

## Replacement rules

- Brand titles: `Topic | Edooqoo` (or `Topic: Subtitle` without a brand).
- Label or definition: `Term: explanation`.
- Mid-sentence aside: commas or parentheses. Trailing clause: comma, semicolon or new sentence.
- Empty-value placeholder in UI: `-`.
- Regexes and normalizers use the `—` escape, never the literal character.

## Exclusions (intentional)

- `supabase/migrations/**` (already applied), `src/data/welcomeTestTranslations.ts` (non-English locales), `docs/seo/runs/**` (historical data), `mem/`, `.lovable/`, internal `docs/` history, generated `llms.txt` (fixed in the generator).
- Protected Worksheet Generation Engine (`generateWorksheet`, `format-worksheet-prompt`) is untouched until the literal instruction "update the Worksheet Generation Engine".

## AI prompts

`supabase/functions/_shared/writingStyle.ts` exports `NO_EM_DASH_RULE`, appended to the system prompts of `extract-student-profile`, `generate-curriculum-phases`, `generate-timeline`, `suggest-exercises`, `generate-media-exercises`, `verify-open-answers` and both `process-welcome-test` analyses. Not applied to JSON-only classification, translation, TTS or audit prompts, nor to the protected engine.

## Guard

`src/lib/__tests__/noEmDash.test.ts` fails on any literal U+2014 or `&mdash;` outside the exclusions. Calendar slot titles are now `Name: English lesson`; `useCalendarSlots` parses both the new and the legacy `Name — English lesson` form.
