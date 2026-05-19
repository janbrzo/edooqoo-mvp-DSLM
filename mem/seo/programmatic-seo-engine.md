---
name: Programmatic SEO Engine (pSEO)
description: v6.9.19 — 1,425 dynamic ESL landing pages from typed matrix + 3 React Router templates
type: feature
---

Programmatic SEO engine ships 1,425 indexable URLs across three dynamic React Router routes:

- `/esl-worksheets/:topic/:level` → `src/pages/seo/programmatic/TopicLevelPage.tsx` (240 URLs)
- `/worksheets/:exerciseType/:topic` → `src/pages/seo/programmatic/ExerciseTopicPage.tsx` (1,160 URLs)
- `/english-for/:persona` → `src/pages/seo/programmatic/PersonaPage.tsx` (25 URLs)

Source of truth: `src/constants/pseoMatrix.ts` (40 topics × 6 CEFR levels × 29 exercise types × 25 personas + path helpers).
Shared shell: `src/components/seo/ProgrammaticSeoLayout.tsx` — emits BreadcrumbList + FAQPage JSON-LD, optional LearningResource. Includes TL;DR aside for AEO snippet extraction.
Unknown slug → `<Navigate>` redirect to closest hub.
CTAs pre-seed signup via query params: `/signup?topic=...&level=...&exerciseType=...&persona=...`.
Sitemap: `public/sitemap.xml` lists all 1,454 URLs (29 static + 1,425 pSEO).

**Sanctity guard:** NO worksheet generation prompt change. NO new Supabase tables. NO new edge functions in Sprint 1+2. Public Gallery and Free Tools (Sprints 3-4) are separate phases tracked in `.lovable/plan.md` v6.9.19.

**Adding new combinations:** extend the four arrays in `pseoMatrix.ts`, re-run sitemap generator, deploy. No new files needed.

**RAG keywords:** programmatic SEO, pSEO, dynamic landing pages, topic-level grid, exercise-type-topic, persona pages, English for nurses, ProgrammaticSeoLayout, pseoMatrix, BreadcrumbList LearningResource JSON-LD, AEO, LLMO, 1454 sitemap, signup query preset.