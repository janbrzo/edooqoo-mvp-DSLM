---
name: Reconciliation with Codex v6.9.26
description: Lovable v6.9.27 must NOT touch files owned by Codex SEO claim-integrity branch
type: constraint
---

## Constraint — Files owned by Codex (v6.9.26)

Do NOT modify (unless explicitly asked):
- `scripts/seo/generate-citable-pages.mjs`
- `scripts/seo/audit-seo-assets.mjs`
- `src/components/seo/PageSeo.tsx`
- `src/constants/seoMeta.ts`
- `src/constants/faqItems.ts`
- `src/pages/HowItWorks.tsx`
- `src/pages/seo/*`
- `public/*-vs-*.html`
- `public/blog/*.html`

v6.9.26 shipped: undefined-fix in JSON-LD comparison entity, BusyTeacher neutralization, hreflang `x-default`, claim-integrity scan in audit pipeline. Lovable v6.9.27 only EXTENDED these areas by adding `state={{from}}` to existing `<Link to="/signup">` (H4 sweep) — no JSON-LD or copy changes.

**Why:** parallel Codex branch — overwriting their work causes regressions and merge conflicts.