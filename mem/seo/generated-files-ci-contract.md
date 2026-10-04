---
name: Generated SEO files CI contract
description: Why the "Verify generated files are committed" CI step is deterministic and what regenerates the committed snapshots
type: infrastructure
---

- Committed generated files = output of the CI generation chain PLUS post-processing (`seo:inject-citation-blocks`, `seo:dedupe-jsonld`, `seo:repair-snapshot-snippets`, `seo:repair-snapshot-head`). `.github/workflows/seo-integrity.yml` runs both before `git diff --exit-code`.
- `npm run seo:sync-generated` runs the whole chain locally in CI order; run it and commit the result whenever a generator, content registry or route changes.
- `generate-ai-resources.mjs` uses a fixed `RELEASE_DATE` (bump with `VERSION`), never today's date; wording of `llms.txt` entries lives in that generator, not in the output file.
- `audit-seo-assets.mjs` expects persona routes in the prerender manifest (noindex personas are prerendered so each URL owns its robots meta; they stay out of the sitemap).
- Verified in a fresh clone: chain + post-processing leaves `git diff` empty; `seo:audit`, duplicate-meta, JSON-LD, structured-data, sitemap-integrity, pSEO-policy and `content:audit` pass.

**Why:** the committed snapshots had drifted from the generators for months (and the llms date changed daily), so every PR failed the CI check.
