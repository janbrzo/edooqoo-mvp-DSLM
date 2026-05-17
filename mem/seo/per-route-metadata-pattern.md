---
name: Per-route SEO metadata pattern
description: PageSeo + seoMeta — single source of truth for per-route title/description/canonical/og/JSON-LD on Edooqoo marketing pages.
type: feature
---
- Reusable `<PageSeo>` in `src/components/seo/PageSeo.tsx` wraps react-helmet-async; props {title, description, path, ogType?, jsonLd?}.
- All marketing-page metadata centralized in `src/constants/seoMeta.ts` as typed `SEO_META` (keys: pricing, about, blog, glossary, exerciseTypes).
- Title <60 chars, description <160 chars — enforced manually.
- FAQPage JSON-LD generated via `buildFaqPageLd(faqItems)` and passed via `jsonLd` prop.
- Static `<link rel="canonical">` REMOVED from `index.html` — canonical owned per-page by Helmet to prevent duplicate canonical anti-pattern.
- Sitewide og:* in `index.html` stays as fallback for non-JS social crawlers.
- Canonical domain: `edooqoo.com` (NOT lovable.app preview URL). GSC verified on `https://edooqoo.com/`.
- Do NOT reintroduce `useEffect(() => document.title = ...)` patterns on pages that already use `<PageSeo>`.