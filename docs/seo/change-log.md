# SEO/GEO Change Log

One row per implemented move (see `docs/seo/monthly-workflow.md`). Prompt 0 reads this table for the monthly retro: rows whose check date has passed get a verdict.

Verdicts: `worked` / `no effect` / `harmed` / `too early`.

| Date | Move | URLs / scope | Hypothesis | Metric | Baseline | Check +28d | Check +56d | Verdict |
|---|---|---|---|---|---|---|---|---|
| 2026-10-04 | Audit + workflow v2 (no site changes) | `docs/seo/audit-2026-10-04-seo-geo-direction.md`, `docs/seo/monthly-workflow.md`, `scripts/seo/audit-content-uniqueness.mjs` | Measuring body-text uniqueness exposes scaled-content risk that meta audits missed | Templated indexable pages (`npm run seo:audit-uniqueness`) | 358 of 550 | 2026-11-01 | 2026-11-29 | too early |
