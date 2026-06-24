# SEO / GSC / AI Search Dashboard

Generated: 2026-06-24T10:52:45.835Z

## Current Health

| Signal | Current | Target | Notes |
|---|---:|---:|---|
| Live routing failed checks | 57 | 0 | docs/seo/live-routing.generated.md |
| GSC indexed rows | 452 | rising for strategic URLs | docs/seo/gsc-coverage-analysis.generated.md |
| GSC discovered not indexed | 1000 | falling or intentional noindex |  |
| GSC crawled not indexed | 27 | falling for sitemap URLs |  |
| GSC 404 | 24 | 0 | Only meaningful after live redirects return 301. |
| AI mention rate | 0.0% | 20% after 60 days | docs/seo/runs/ai-search/2026-06-24.json |
| AI avg correctness | not scored | 2.6 after 90 days |  |

## Latest Run Files

| Area | Latest JSON | Status |
|---|---|---|
| GSC performance | docs/seo/runs/gsc-performance/2026-06-24.json | skipped |
| URL inspection sample | docs/seo/runs/url-inspection/2026-06-24.json | skipped |
| AI search baseline | docs/seo/runs/ai-search/2026-06-24.json | manual-template |

## GSC Performance Highlights

| Query plan | Rows | Clicks | Impressions |
|---|---:|---:|---:|

## Operating Cadence

- Weekly: run live routing, GSC Search Analytics, URL Inspection sample, AI baseline template/scoring, and regenerate this dashboard.
- Every 7/14/28 days after deploy: manually export GSC Page Indexing coverage and run the coverage analyzer with --previous.
- Monthly: fill AI UI answers for ChatGPT, Claude, Perplexity, and Gemini, then rerun the AI baseline script with --answers.
- Do not request indexing for signup query URLs or noindex long-tail pSEO pages.

## RAG Keywords

SEO dashboard, GSC monitoring, AI search baseline, Edooqoo LLM visibility, Search Console coverage, URL Inspection sample, adult 1:1 English tutor SEO.
