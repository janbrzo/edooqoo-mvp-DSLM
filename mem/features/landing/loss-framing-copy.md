---
name: Loss-framing copy on landing & calculator
description: Hero/pricing copy uses loss-aversion framing (prospect theory ~2.25x); never revert to gain-only phrasing
type: preference
---

## Rule (v6.9.28b)

All copy in `PricingCalculator.tsx`, `PricingSection.tsx` headers, and any future landing-page calculator surfaces MUST frame outcomes as losses (what the teacher loses today), not as gains (what they will save/earn).

## Mapping (do not revert)

| Surface | Loss phrasing (current) |
|---|---|
| Calculator title | `See how much prep is silently costing you` |
| Calculator subtitle | `See how many hours, lessons and dollars you currently lose to prep every month...` |
| Results section header | `What prep is costing you monthly` |
| KPI 1 label | `hours lost to prep every month` |
| KPI 2 label | `paid lessons you can't fit in` |
| KPI 3 label | `revenue you leave on the table monthly` |
| PricingSection lead | `Estimate how much recurring prep is costing you — and how much you stop losing with 1-Minute Prep.` |

## Scope guard

Do NOT change `HeroHeadline.tsx` subhead/CTAs, `featurePromptCopy.ts`, SEO `seoMeta.ts`, `faqItems.ts`, `HowItWorks.tsx`, public/*.html, or any Codex-owned files (see `mem/decisions/reconciliation-v6926-codex.md`). Calculator badge (`Side-Gig fit` / `Full-Time fit`) stays neutral.

**Why:** Prospect theory — losses weigh ≈2.25× more than equivalent gains; conversion improves under loss framing.