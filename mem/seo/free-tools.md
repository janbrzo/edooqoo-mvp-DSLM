---
name: Free Tools (Sprint 4)
description: v6.9.20 — 3 browser-only link-magnet tools under /tools/* with zero backend
type: feature
---

Three indexable, embeddable browser tools shipped to earn backlinks and AEO citations:

- `/tools/cefr-level-test` → `src/pages/tools/CefrLevelTest.tsx` (25 Qs, `scoreCefr` thresholds A1→C2, Quiz + FAQPage JSON-LD)
- `/tools/lesson-plan-generator` → `src/pages/tools/LessonPlanGenerator.tsx` (6 andragogical stages scaled by duration, Copy text + Download HTML via Blob, HowTo + FAQPage JSON-LD)
- `/tools/vocab-cefr-checker` → `src/pages/tools/VocabCefrChecker.tsx` (EVP wordlist Map + length/suffix heuristic, SoftwareApplication + FAQPage JSON-LD)
- `/tools` hub → `ToolsIndex` with ItemList JSON-LD

Data: `src/data/cefrLevelTestQuestions.ts`, `src/data/cefrWordlist.ts` (~480 lemmas A1–C1, lower levels never overwritten by higher).

**Sanctity:** NO worksheet prompt change. NO Supabase tables. NO edge functions. NO AI Gateway calls. Tools are 100% client-side.

CTAs route to `/signup` (CEFR test additionally passes `?level=<lower>`).
Footer Resources column links to hub + all 3 tools.
`public/sitemap.xml` lists all 4 URLs.

RAG keywords: free tools, link magnets, CEFR level test, ESL lesson plan generator, vocab CEFR checker, EVP wordlist, browser-only tools, Quiz HowTo SoftwareApplication ItemList JSON-LD, Sprint 4 Plan v6.9.19.