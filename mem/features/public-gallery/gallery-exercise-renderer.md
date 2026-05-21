---
name: Gallery Exercise Renderer
description: Read-only switch by exercise type for /gallery/:slug; renders all 29 taxonomy types statically
type: feature
---
v6.9.21 — `src/components/gallery/GalleryExerciseRenderer.tsx`.

- Switch over normalized exercise type (matching → table, multiple-choice → A/B/C/D list, listening → `<audio>` + transcript, gap-text → `___` placeholders, etc.).
- Zero state, zero inputs, zero API. Pure presentation for SEO + human preview.
- Used by `PublicGalleryWorksheetPage.tsx` inside Preview-mode banner.
- CTA narrative is **"1-Minute Prep"** (NOT "30 seconds").
- Default fallback for unknown types: `<pre>{JSON.stringify(ex)}</pre>` — new types degrade safely.