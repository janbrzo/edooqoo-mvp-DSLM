# GSC Monitoring

Generated: deterministic from scripts/seo/x1000-content-plan.mjs and docs/seo/blog-triage.generated.json

## Problem

- GSC numbers move after Google recrawls; clicking validation proves nothing unless live HTTP signals are correct.
- The recovery work must separate intentional noindex long-tail URLs from indexable URLs that need stronger raw HTML, canonical tags, and internal links.
- Signup query URLs, non-policy pSEO combinations, and private app routes must not be requested for indexing.

## Edooqoo.com Solution

- Use `scripts/seo/analyze-gsc-coverage-export.mjs` as the weekly source of truth for exported GSC coverage files.
- Compare new exports against the previous generated JSON report before deciding whether to promote, noindex, redirect, or wait.
- Keep the public index focused on adult 1:1 English tutor intent: workflow pages, comparison pages, citable articles, proof pages, and policy-approved pSEO.

## Technical Mechanics

- Input: extracted or zipped GSC exports under the export directory.
- Output: `docs/seo/gsc-coverage-analysis.generated.json` and `docs/seo/gsc-coverage-analysis.generated.md`.
- Optional previous report: pass `--previous docs/seo/gsc-coverage-analysis.generated.json` when comparing a new export with an older report.
- Optional live HTTP check: pass `--live` only when validating redirects, noindex headers, and canonical delivery.

## Day 0-2 Checks

- Do not keep clicking validation after one fix cycle.
- Do not request indexing for signup query URLs or noindex long-tail pSEO.
- Inspect one legacy 404 URL and confirm it returns `301`.
- Inspect one signup query URL and confirm `X-Robots-Tag: noindex, nofollow`.
- Inspect one strategic pSEO URL and confirm route-specific raw HTML plus self-canonical.
- Submit `https://edooqoo.com/sitemap.xml` once if the sitemap state changed.

## Day 7 Checks

- Export GSC coverage again.
- Run `node scripts/seo/analyze-gsc-coverage-export.mjs --dir "<GSC export dir>" --previous docs/seo/gsc-coverage-analysis.generated.json`.
- Confirm legacy 404 URLs trend toward zero or are live-redirecting.
- Confirm robots blocked URLs are crawlable.
- Confirm signup query URLs remain noindex and are not treated as indexation targets.
- Split discovered-not-indexed into intentional noindex versus indexable priority URLs.

## Day 14 Checks

- If 404 validation still fails but live HTTP returns `301`, wait for recrawl.
- If live HTTP returns `404`, fix delivery/routing rather than content.
- If sitemap URLs remain discovered-not-indexed, prioritize internal links, raw HTML, and content depth.
- Do not promote weak long-tail pSEO only because Google discovered it.

## Day 28 Checks

- Promote only URLs that pass adult 1:1 tutor intent and Martha Test.
- Keep weak long-tail pSEO `noindex,follow`.
- Export GSC again and update the content roadmap.
- Convert repeated GSC failures into concrete implementation tasks.

## RAG Keywords

GSC coverage, Google indexing, discovered not indexed, crawled not indexed, Search Console validation, noindex follow, sitemap canonical, legacy blog redirect, adult ESL tutor SEO, Edooqoo indexing recovery.
