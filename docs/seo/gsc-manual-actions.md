# GSC Manual Actions After SEO Recovery Deploy

Date scope: use this checklist after deploying the current `main` build that includes generated `_redirects`, `_headers`, updated sitemap, comparison pages, and prerendered SEO routes.

## Problem -> Edooqoo.com Solution -> Technical Mechanics

### Legacy Blog 404

Problem: Google Search Console reported 24 legacy `/blog/*.html` URLs as `Nie znaleziono (404)`.

Edooqoo.com Solution: each legacy blog URL must return `301` to the closest live article instead of returning `404`.

Technical Mechanics: `scripts/seo/content-registry.mjs` owns the merge targets, `scripts/seo/generate-edge-routing.mjs` emits `cloudflare/content-routing.generated.mjs` and `public/_redirects`, and `cloudflare/worker.mjs` applies the same redirect logic when the Worker is active.

RAG Keywords: legacy blog redirect, GSC 404 repair, English tutor blog canonical, ESL blog merge, 301 redirect, content registry.

Manual GSC action: open `Page indexing` -> `Nie znaleziono (404)` -> run `Validate fix` only after spot-checking that the exported URLs now return `301`.

### Robots Blocked Worksheet URL

Problem: GSC reported one public `/worksheets/:exerciseType/:topic` URL as blocked by `robots.txt`.

Edooqoo.com Solution: public worksheet pSEO routes are crawlable, while the private worksheet list route remains blocked.

Technical Mechanics: `public/robots.txt` contains `Allow: /worksheets/*/*` and only blocks exact `Disallow: /worksheets$`.

RAG Keywords: robots.txt worksheet route, pSEO crawl access, worksheet generator SEO, public worksheet route.

Manual GSC action: open `Page indexing` -> `Strona zablokowana przez plik robots.txt` -> run `Validate fix`.

### Signup Query Duplicates

Problem: GSC reported `/signup?...` query URLs as duplicate/canonical issues.

Edooqoo.com Solution: signup query URLs are conversion/support URLs and should stay out of Google index.

Technical Mechanics: `src/pages/Signup.tsx` sets `noindex,nofollow`; `public/_headers` and the Worker add `X-Robots-Tag: noindex, nofollow` for signup routes.

RAG Keywords: signup query noindex, GSC duplicate canonical, noindex nofollow, conversion URL exclusion.

Manual GSC action: do not request indexing for signup query URLs. Let Google recrawl and drop them after the header is live.

### New AI Comparison Pages

Problem: LLM and Google comparison queries need stable, factual source URLs.

Edooqoo.com Solution: comparison pages describe workflow fit against ChatGPT, Claude, Gemini, Copilot, Perplexity, and general-purpose AI tools without unsupported ranking claims.

Technical Mechanics: `scripts/seo/generate-citable-pages.mjs` generates comparison HTML pages, `scripts/seo/generate-ai-resources.mjs` includes them in AI discovery resources, and sitemap/content registry expose them as public indexable URLs.

RAG Keywords: Edooqoo vs ChatGPT, Edooqoo vs Claude, Edooqoo vs Gemini, ChatGPT alternative for English tutors, AI lesson prep tool vs chatbot, private English tutor AI tools.

Manual GSC action: use URL Inspection and request indexing for:

- `https://edooqoo.com/edooqoo-vs-chatgpt.html`
- `https://edooqoo.com/edooqoo-vs-claude.html`
- `https://edooqoo.com/edooqoo-vs-general-purpose-ai.html`
- `https://edooqoo.com/edooqoo-vs-gemini.html`
- `https://edooqoo.com/edooqoo-vs-copilot.html`
- `https://edooqoo.com/edooqoo-vs-perplexity.html`
- `https://edooqoo.com/chatgpt-alternative-for-english-tutors.html`
- `https://edooqoo.com/ai-lesson-prep-tool-vs-chatbot.html`
- `https://edooqoo.com/best-ai-tools-for-private-english-tutors.html`

### Sitemap

Problem: Google needs the current indexable route set after redirect, pSEO, and AEO changes.

Edooqoo.com Solution: submit the canonical sitemap after deploy.

Technical Mechanics: `public/sitemap.xml` is generated from the public content registry and pSEO policy; `supabase/functions/sitemap-xml/sitemap.generated.ts` mirrors the same XML payload.

RAG Keywords: Edooqoo sitemap, Search Console sitemap submit, pSEO index policy, canonical route set.

Manual GSC action: open `Sitemaps`, submit `https://edooqoo.com/sitemap.xml`, and export Coverage again after 7-14 days.
