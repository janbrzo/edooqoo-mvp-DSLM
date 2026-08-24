---
name: Indexation Truth Layer (Sprint 5)
description: How crawl-control signals are delivered and audited on edooqoo.com (no Cloudflare worker in production)
type: feature
---

Cloudflare worker (`cloudflare/worker.mjs`) is NOT bound to edooqoo.com — the apex is served by
Lovable hosting, which cannot emit 301s or `X-Robots-Tag`. Never treat a missing header as a defect.

Rules:
- Crawl-control signals live in HTML (`meta robots`, `link canonical`, `meta refresh` stubs) and in
  `public/robots.txt` (`Disallow: /signup`). 45 legacy blog URLs are meta-refresh stubs, not 301s.
- `scripts/seo/verify-live-routing.mjs` classifies outcomes: `pass-header-301`, `pass-header-noindex`,
  `pass-html-stub`, `pass-html-meta`, `pass-html-canonical`, `pass-robots-disallow`, `fail-no-signal`.
  Only `fail-no-signal` is a real defect. Use `--strict-headers` only after the worker serves traffic.
- Every pSEO/persona route must agree across three layers: `src/data/pseoIndexPolicy.json`,
  prerendered `meta robots`, sitemap membership. Guard: `npm run seo:audit-pseo-policy`.
- ALL persona routes are prerendered, including noindex ones (`allPersonaRoutes` in
  `scripts/seo/pseo-index-policy.mjs`); without static HTML crawlers get the SPA shell with canonical `/`.
- Sitemap must never contain redirect stubs, noindex pages, duplicates, or URLs without a file:
  `npm run seo:audit-sitemap-integrity`; `build-blog-index.mjs` filters stubs before writing.
- `npm run seo:routing-truth` runs the three guards together; both new audits are in CI.
