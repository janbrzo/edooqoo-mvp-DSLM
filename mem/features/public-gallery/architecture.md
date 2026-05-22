---
name: Public Worksheet Gallery
description: Sprint 3 / Plan v6.9.20 — teachers publish worksheets to /gallery; read-only public access via is_public + public_slug; SEO via LearningResource JSON-LD
type: feature
---

## Public Worksheet Gallery (Sprint 3, Plan v6.9.20)

### Database (worksheets table)
- `is_public BOOLEAN` (default false)
- `public_slug TEXT UNIQUE` — kebab-case + 6-char id hash via `generate_public_slug(title, id)` RPC
- `published_at TIMESTAMPTZ`
- `public_view_count INTEGER`
- `public_topic`, `public_level`, `public_exercise_types TEXT[]` — denormalized for filtering
- Indexes: `(is_public, published_at DESC) WHERE is_public`, `(public_slug) WHERE NOT NULL`, `(public_topic) WHERE is_public`
- RLS: new policy "Public worksheets readable by anyone" → `SELECT USING (is_public = true)`. Existing teacher-owner policies untouched.

### Edge functions
- `publish-worksheet` — auth required; ownership check; validates ≥6 exercises, real title, no PII (email/phone regex) in `additionalInformation`; calls `generate_public_slug` RPC; denormalizes topic/level/exercise_types; best-effort fires `regenerate-gallery-sitemap`.
- `unpublish-worksheet` — flips `is_public=false`, keeps slug → soft "removed" page (better SEO than 404).
- `regenerate-gallery-sitemap` — returns sitemap-gallery.xml for all `is_public=true` rows (up to 50k).

### Frontend
- `/gallery` → `PublicGalleryIndex.tsx` — paginated grid (24/page), filter by level + topic via URL params, `ItemList` JSON-LD.
- `/gallery/:slug` → `PublicGalleryWorksheetPage.tsx` — read-only worksheet preview, `LearningResource` JSON-LD, sign-up CTA. Unpublished slugs show "no longer public" notice.
- `PublishWorksheetButton.tsx` — teacher toolbar action; modal confirm + copy public URL; integrated into `WorksheetToolbar`.

### Sanctity rule
Worksheet engine prompts UNTOUCHED. Publish flow is metadata-only — no AI regeneration.

### RAG keywords
public gallery, worksheet sharing, is_public, public_slug, /gallery, publish worksheet, gallery sitemap, LearningResource JSON-LD, denormalized filtering