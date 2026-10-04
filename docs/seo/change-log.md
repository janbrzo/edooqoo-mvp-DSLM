# SEO/GEO Change Log

One row per implemented move (see `docs/seo/monthly-workflow.md`). Prompt 0 reads this table for the monthly retro: rows whose check date has passed get a verdict.

Verdicts: `worked` / `no effect` / `harmed` / `too early`.

| Date | Move | URLs / scope | Hypothesis | Metric | Baseline | Check +28d | Check +56d | Verdict |
|---|---|---|---|---|---|---|---|---|
| 2026-10-04 | Audit + workflow v2 (no site changes) | `docs/seo/audit-2026-10-04-seo-geo-direction.md`, `docs/seo/monthly-workflow.md`, `scripts/seo/audit-content-uniqueness.mjs` | Measuring body-text uniqueness exposes scaled-content risk that meta audits missed | Templated indexable pages (`npm run seo:audit-uniqueness`) | 358 of 550 | 2026-11-01 | 2026-11-29 | too early |
| 2026-10-04 | 301 repair of 38 URLs that earned impressions but returned 404 | `scripts/seo/gsc-404-repair.json` (→ registry → `_redirects`, Worker routes, stubs) | Redirecting to the closest live page recovers part of the 34 clicks / 1,042 impressions lost to 404 | Clicks + impressions on the 38 source URLs and their targets; GSC 404 count | 34 clicks / 1,042 impr (3 months, 404) | 2026-11-01 | 2026-11-29 | too early |
| 2026-10-04 | Index 5 pSEO routes that earned clicks while noindexed | `/esl-worksheets/{news-media/c1-advanced,collocations/c1-advanced,weather/a2-elementary,environment/b2-upper-intermediate}`, `/worksheets/gap-fill/ielts-writing-task-2` | Pages already ranking at pos 3–9 with clicks will keep them once they carry a self canonical and `index,follow` | Clicks and impressions on the 5 URLs; indexed status in GSC | 23 clicks / 147 impr (3 months, noindex) | 2026-11-01 | 2026-11-29 | too early |
