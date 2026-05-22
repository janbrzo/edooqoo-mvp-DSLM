---
name: Legacy .html Link Resolver
description: Three-bucket strategy for ~80 historical .html hrefs across Blog/Resources/Footer
type: feature
---
v6.9.21 cleanup of ~330 `.html` hrefs in `src/`.

- `src/data/legacyLinkMap.ts` — explicit map: legacy href → existing programmatic SEO route.
- `src/lib/resolveLegacyHref.ts` — `(href) => { url, comingSoon }`. If mapped → live URL. If unmapped + `.html` suffix → `comingSoon: true`.
- `Blog.tsx` / `Resources.tsx`: mapped → `<Link to={url}>`, comingSoon → non-clickable card with "Coming soon" badge.
- `GlobalFooter.tsx`: mapped → render; unmapped → removed from DOM. "Compare" column removed (4 `/edooqoo-vs-*.html` had no content).
- `public/sitemap.xml` pruned to live URLs only.
- **NEVER create stub blog pages** to satisfy a broken link (Martha quality rule). Map to real content, or render Coming Soon.