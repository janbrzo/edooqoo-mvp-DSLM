---
name: Legacy .html Link Resolver
description: v6.9.22 — 277 static .html pages restored under public/; resolver simplified; never delete .html with content
type: constraint
---
v6.9.22 corrects the v6.9.21 mistake of treating 279 hand-crafted .html pages as
placeholders. Archive (`public.rar`) contained full content (h1+h2×8+tables+FAQ
+JSON-LD BlogPosting) likely already indexed by Google.

**Restored layout:**
- `public/blog/*.html` — 207 blog posts
- `public/*.html` — 70 top-level landings (CEFR, grammar topics, edooqoo-vs-*, personas)
- `public/sitemap.xml` — 1736 URLs (1459 React/pSEO + 277 static .html)

**Serving:** Lovable hosting returns the static file before SPA fallback fires
(HTTP 200). Vite copies `public/` → `dist/` at build.

**Link rendering:** components use a thin helper — `<a href>` when href ends in
`.html` (full-page nav, leaves SPA scope), `<Link to>` otherwise. See
`Blog.tsx`, `Resources.tsx`, `GlobalFooter.tsx`.

**Generated index:** `scripts/seo/build-blog-index.mjs` parses every .html in
`public/blog/` + `public/` for title/description/datePublished and writes
`src/data/blogIndex.ts`. Re-run after adding/removing .html files. Also
re-emits sitemap entries.

**Sanctity rules:**
- NEVER delete a `.html` in `public/` with real content — Google may index it.
- NEVER render a "Coming soon" stub for a missing href (Martha quality rule).
  If the file is missing, omit the link entirely.
- `legacyLinkMap.ts` exists but should be empty under normal conditions —
  every legacy URL has a real file now.
- `resolveLegacyHref` is reduced to a passthrough; do not reintroduce
  `comingSoon` semantics.