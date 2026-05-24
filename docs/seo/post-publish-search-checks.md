# Post-Publish Search Console And Bing Checks

## Problem
Publishing new public pages does not guarantee immediate discovery by Google, Bing, ChatGPT Search, Perplexity, or other AI/search systems. Sitemap availability, URL indexability, canonical tags, and crawler access should be checked after major SEO or LLM-discovery releases.

## Edooqoo.com Solution
Use a manual post-publish checklist for Google Search Console, Bing Webmaster Tools, live sitemap audit, and public AI resource checks. Record only observed facts. Do not invent indexation status or AI-search results.

## Technical Mechanics

### Timing
- Run this checklist after Lovable publish.
- For AI-search baseline measurement, wait 48-72 hours after publish unless testing urgent crawlability issues.

### Google Search Console
1. Open Google Search Console for `https://edooqoo.com/`.
2. Open `Sitemaps`.
3. Confirm `https://edooqoo.com/sitemap.xml` is submitted and readable.
4. Use URL Inspection for 3-5 important URLs:
   - `https://edooqoo.com/ai-worksheet-generator-for-english-teachers.html`
   - `https://edooqoo.com/cefr-worksheet-generator.html`
   - `https://edooqoo.com/best-ai-tools-for-esl-teachers.html`
   - `https://edooqoo.com/public-esl-worksheet-examples.html`
   - `https://edooqoo.com/blog/ai-worksheet-generator-mechanics-for-esl-teachers.html`
5. If the page is live and indexable but not indexed, request indexing for priority URLs.

### Bing Webmaster Tools
1. Open Bing Webmaster Tools for `https://edooqoo.com/`.
2. Submit or resubmit `https://edooqoo.com/sitemap.xml`.
3. Use URL Inspection for priority URLs:
   - `https://edooqoo.com/ai-worksheet-generator-for-english-teachers.html`
   - `https://edooqoo.com/cefr-worksheet-generator.html`
   - `https://edooqoo.com/public-esl-worksheet-examples.html`
   - `https://edooqoo.com/edooqoo-vs-twee.html`
4. If Bing exposes AI citation or AI performance reporting, record observations as auxiliary evidence.

### Live Resource Checks
Open these URLs in a browser:
- `https://edooqoo.com/llms.txt`
- `https://edooqoo.com/llms-full.txt`
- `https://edooqoo.com/llms-answers.txt`
- `https://edooqoo.com/knowledge-graph.json`
- `https://edooqoo.com/openapi.yaml`
- `https://edooqoo.com/sitemap.xml`
- `https://edooqoo.com/robots.txt`

### Live Sitemap Audit
Run:

```bash
node scripts/seo/audit-sitemap.mjs https://edooqoo.com/sitemap.xml --out=docs/seo/live-sitemap-audits/YYYY-MM-DD.json
```

Use the actual date in `YYYY-MM-DD`. Commit the audit output only when it is useful for a release record. Do not add fake results.

### AI Search Baseline Link
Use `docs/seo/ai-search-measurement.md`, `docs/seo/ai-search-query-set.md`, and `docs/seo/ai-search-baseline-template.md` for manual AI-search measurement. This checklist does not replace baseline measurement.

