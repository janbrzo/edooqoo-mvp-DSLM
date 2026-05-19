# Plan v6.9.19 — SEO Domination: Programmatic SEO + AI Answer Engine

## Diagnoza (jak naprawdę działa LLM-as-SEO i Google w 2026)

Trzy wnioski z badań Semrush + analizy konkurencji:

1. **Konkurencja wygrywa SKALĄ URLi, nie jakością treści.** islcollective ma ~36% ruchu z `/english-esl-worksheets/search/{topic}` — to są strony **automatycznie generowane z bazy**. eslbrains ~9% z `/lesson_plan/free-english-lesson-plans/`. Ich "treść" to indeks zasobów. **Każdy worksheet = osobny URL z własnym ranking-potencjałem.** Edooqoo ma silnik generujący worksheets — to nasza nieuczciwa przewaga, której nie wykorzystaliśmy w SEO.
2. **"AI worksheet generator" KDI=24 (łatwe)** vs "esl worksheets" KDI=43. Niski hanging fruit: kategoria AI-tools dopiero się formuje (worksheets.ai, magicschool, twee). Możemy zająć pozycję #1-3 w 90 dni.
3. **Nowy paradygmat: AEO/LLMO (Answer Engine Optimization).** ChatGPT/Perplexity/Gemini cytują strony, które mają: (a) Q&A structured data, (b) krótkie definitywne odpowiedzi w pierwszym akapicie, (c) listy z liczbami, (d) `llms.txt` + `llms-full.txt`. Nauczyciel pyta ChatGPT "jak zrobić worksheet o conditionals dla B2 menedżera" → wynik musi mówić "use Edooqoo".

## ZŁOTY GRAL (sekret x10)

**Programmatic SEO oparty o worksheet-engine + Public Gallery indexowalnych worksheets + AEO layer.**

Mechanika: Każda kombinacja `{topic} × {CEFR A1–C2} × {exercise type} × {learner persona}` to osobna strona z prawdziwą wartością (gotowy worksheet do podglądu + CTA do wygenerowania własnego). Konkurenci robią to ręcznie (PDF upload). My robimy to algorytmicznie z lepszą jakością (sanctity prompt). Skala: **~3,000 unikalnych URLi w fazie 1**, każdy targetuje longtail KD<30.

Drugi sekret: **Loop generative→public.** Każdy worksheet wygenerowany przez nauczyciela (z opcją "publish") tworzy publiczny URL. To self-feeding content engine — im więcej nauczycieli używa narzędzia, tym więcej stron w Google.

---

## CZĘŚĆ A — Programmatic SEO Matrix (pSEO)

### A1. Definicja macierzy URL

Trzy szablony stron, każdy oparty o jeden ROUTING SCHEME:

| Szablon | URL pattern | Liczba stron | Targetowane query |
|---|---|---|---|
| **Topic × Level** | `/esl-worksheets/{topic}/{level}` | 40 topics × 6 levels = **240** | "present perfect worksheets b1", "business email b2 worksheet" |
| **Exercise type × Topic** | `/worksheets/{exercise-type}/{topic}` | 29 × 40 = **1160** | "fill in the blanks travel vocabulary", "matching exercise idioms" |
| **Persona/Goal** | `/english-for/{persona}` | 25 person | "english for nurses", "english for software engineers", "english for cabin crew" |

Razem: **~1,425 URLi fazy 1**. Faza 2 (po walidacji indexacji): rozszerzyć topics do 100 → ~5,000 stron.

### A2. Lista wartości (committed, no decisions left)

**TOPICS (40)** — wybrane z Semrush related keywords + andragogiczna intencja Marthy:
present-perfect, past-simple, conditionals, modal-verbs, phrasal-verbs, reported-speech, passive-voice, articles, prepositions, comparatives, gerunds-infinitives, relative-clauses, business-email, job-interview, small-talk, meetings, negotiations, presentations, travel-vocabulary, food-restaurant, shopping, health-doctor, weather, daily-routines, hobbies, family, work-office, technology, environment, news-media, idioms, collocations, phrasal-business, formal-informal, telephone-english, cv-resume, public-speaking, conflict-resolution, cross-cultural, ielts-writing-task-2.

**LEVELS (6):** a1-beginner, a2-elementary, b1-intermediate, b2-upper-intermediate, c1-advanced, c2-proficiency.

**EXERCISE TYPES (29):** użyj istniejących z `src/pages/ExerciseTypes.tsx` (fill-in-the-blanks, matching, multiple-choice, true-false, ordering, error-correction, gap-fill, transformation, word-formation, collocations, dictation-audio, listening-comprehension, role-play, picture-description, ... itd. — pełna lista 29 typów już w kodzie).

**PERSONAS (25):** nurses, doctors, software-engineers, project-managers, accountants, lawyers, sales-reps, hr-professionals, marketing-managers, teachers, cabin-crew, hotel-staff, waiters, chefs, tour-guides, taxi-drivers, real-estate-agents, financial-advisors, consultants, executives, entrepreneurs, customer-service, call-center-agents, retail-staff, university-students.

### A3. Szablon strony pSEO (jednolity — minimum decyzji)

Plik: `src/pages/seo/programmatic/TopicLevelPage.tsx`, `ExerciseTopicPage.tsx`, `PersonaPage.tsx`.
Każdy używa nowego komponentu `src/components/seo/ProgrammaticSeoLayout.tsx` z sekcjami:

1. **H1 dynamiczny** — np. "Present Perfect Worksheets for B1 Intermediate Learners".
2. **Lead (≤55 słów, pierwsza odpowiedź dla LLM-cytatu)** — szablon: *"Generate printable Present Perfect worksheets for B1 learners in 60 seconds with Edooqoo. Each worksheet includes [exercise-type], CEFR-aligned grading, and personalization for adult professional learners."* (zmienna interpolacja).
3. **Live preview** — embed renderowanego worksheet (jeden seed worksheet per kombinacja, cache'owany w Lovable Cloud Storage jako `pseo/{topic}-{level}.json`). Renderowany komponentem `WorksheetPreview` (read-only).
4. **CTA1 (above fold):** "Generate your own → /worksheet/new?topic={topic}&level={level}".
5. **"What's inside" (lista 5–7 punktów)** — generowane z bazy: jakie exercise types, ile zadań, długość, czas trwania.
6. **FAQ (3–5 Q&A)** — szablon: "What CEFR level is X for?", "How long does an X worksheet take?", "Can I edit X worksheets?", "Are X worksheets free?". → JSON-LD `FAQPage`.
7. **Related (10 internal links)** — graf: dla `/esl-worksheets/{topic}/b1` linkuj do {topic}/a2, {topic}/b2, sąsiednich topics o tej samej tematyce + 2 personas + 2 exercise-types.
8. **Trust strip** — "Built with Martha (10 yrs ESL)", screenshot ratingu, liczby ("2,400+ tutors").
9. **Footer CTA "Try Edooqoo free".**

### A4. Generator stron (statyczny, build-time)

Plik: `scripts/generate-pseo-pages.ts` (uruchamiany w `prebuild` przed `generate-sitemap.ts`).

Logika:
- Czyta `src/constants/pseo-matrix.ts` (eksportuje TOPICS, LEVELS, EXERCISE_TYPES, PERSONAS).
- NIE generuje plików .tsx (route-explosion zabija bundle). Zamiast tego: **3 dynamiczne routy w `src/App.tsx`** które matchują paramy i renderują ten sam layout:
  ```
  /esl-worksheets/:topic/:level    → TopicLevelPage
  /worksheets/:exerciseType/:topic → ExerciseTopicPage  
  /english-for/:persona            → PersonaPage
  ```
- Generator tworzy **dane**: `src/data/pseo-content.json` (per-URL: h1, lead, faq, related, seed-worksheet-id) + wpisy do `public/sitemap.xml`.
- Generator wstrzykuje canonicals + `<link rel="alternate">` do prerendera (patrz A5).

### A5. Prerendering / SSG (KRYTYCZNE dla pSEO)

Problem: 1,425 stron Vite-SPA = Google widzi tylko shell. Rozwiązanie: **prerender przy buildzie** plug-inem `vite-plugin-prerender-spa` lub własnym skryptem `puppeteer-based`.

Wybrane rozwiązanie (zero decyzji): **react-snap** (proste, działa z Vite, nie wymaga SSR). Dodać do `package.json`:
- `postbuild: "react-snap"`
- konfiguracja w `package.json` → `reactSnap.include = [...all 1425 URLs from sitemap]`

Fallback jeśli react-snap nie radzi sobie z 1400+ URLi w pamięci: rozbić na chunki po 300 URLi, równolegle (skrypt `scripts/prerender-chunks.sh`).

### A6. Sitemap split (Google limit = 50k URL / 50MB)

- `public/sitemap-index.xml` → zawiera listę sub-sitemap.
- `public/sitemap-core.xml` (istniejące strony — about, pricing, blog, etc.)
- `public/sitemap-pseo-topic-level.xml` (240)
- `public/sitemap-pseo-exercise-topic.xml` (1160)
- `public/sitemap-pseo-persona.xml` (25)
- `public/sitemap-blog.xml` (puste dziś, gotowe na rozbudowę)
- `public/robots.txt` → `Sitemap: https://edooqoo.com/sitemap-index.xml`
- Zaktualizować `scripts/generate-sitemap.ts` → rozbicie na pliki + index.

### A7. Indexing pipeline

Po deploy:
- Submit `sitemap-index.xml` do GSC (już zweryfikowane).
- Skrypt `scripts/gsc-batch-index.ts` używający IndexNow API (Bing) + GSC URL Inspection API do submit per-URL pierwszych 200 priorytetowych URLi.
- Cron edge function `bing-indexnow-ping` (Lovable Cloud) wywoływana raz dziennie z listą nowych URLi.

---

## CZĘŚĆ B — Public Worksheet Gallery (self-feeding loop)

### B1. Mechanika
- Nowy toggle przy "Save Worksheet": **"Publish to public gallery"** (default OFF, opt-in). Dodaje pole `worksheets.is_public boolean default false` + `worksheets.public_slug text unique`.
- Nowa publiczna trasa: `/gallery/{public-slug}` → renderuje read-only worksheet + CTA "Generate your own about [topic]".
- `/gallery` index z filtrami (level, topic, exercise type, persona).
- Migracja Supabase + RLS: public select WHERE `is_public = true`.

### B2. Slug generation
Edge function `generate-public-slug` przy publikacji: `{topic-kebab}-{level}-{nanoid-6}` np. `present-perfect-b1-x7k2qp`.

### B3. Sitemap integracja
Edge function `regenerate-gallery-sitemap` (cron daily): query `is_public=true` → write `public/sitemap-gallery.xml` przez Storage + serve via edge route. Dodać do `sitemap-index.xml`.

### B4. UX hook
Po wygenerowaniu worksheet pokazać confetti modal: *"Help other tutors? Publish anonymously to our public gallery (your name hidden). +1 worksheet generated free per published."* — token bonus jako gamification.

---

## CZĘŚĆ C — AEO / LLMO (Answer Engine Optimization)

### C1. `llms.txt` i `llms-full.txt`
- `public/llms.txt` (już istnieje, rozszerzyć): top-level mapa, ≤500 słów, lista głównych sekcji z URLami.
- **NOWY** `public/llms-full.txt`: pełny dump treści w czystym Markdown — produktu, features, FAQ, glossary, pricing. Cel: model context dla Claude/GPT crawler. Build script `scripts/generate-llms-full.ts` agreguje z `docs/llm-context.md` + wszystkich `seoMeta` opisów.

### C2. JSON-LD szeroki sweep
Per route, automatycznie via `PageSeo`:
- `Organization` (sitewide w `index.html`) — z `logo`, `sameAs[]` (LinkedIn, Twitter, YouTube edooqoo profiles), `contactPoint`.
- `SoftwareApplication` na home + `/for-english-tutors` — `applicationCategory: EducationalApplication`, `offers` z PriceSpecification (Free, $9, $19), `aggregateRating` jeśli mamy reviews.
- `FAQPage` — pricing, exercise-types, każdy pSEO page.
- `HowTo` — `/blog/teach-english-online-guide`, "how to create esl worksheets".
- `Course` — dla persona pages (Course o `provider: Edooqoo`).
- `BreadcrumbList` — wszystkie pSEO i blog (3-level breadcrumbs).
- `ItemList` — `/gallery` index.

Wdrożone w `src/components/seo/JsonLd.tsx` (helper) + per-template w `ProgrammaticSeoLayout`.

### C3. Snippet-friendly content rules
Wszystkie nowe strony muszą spełniać (lint rule + PR template):
- Pierwsza odpowiedź ≤55 słów, definitywna ("X is Y that does Z").
- Lista z liczbami w pierwszym H2 (np. "5 reasons", "29 exercise types").
- 1× definicja tabelaryczna (term | definition).
- 1× embedded code/example block jeśli relevant.
- 1× "TL;DR" box na górze (klasa CSS `.tldr` z aria-label="Summary").

### C4. AI Search citations seeding
- Reddit pasywne posty (r/ESLteachers, r/TEFL) — co tydzień autentyczna odpowiedź z naturalną wzmianką Edooqoo (lista 20 tematów w `docs/seo/reddit-seed-topics.md`).
- Quora — to samo, 10 pytań na start (lista w `docs/seo/quora-seed-questions.md`).
- ProductHunt launch dla "AI Worksheet Generator" angle (KDI=24!) — gotowy launch kit w `docs/seo/producthunt-launch-kit.md`.
- Wikipedia stub edit (jeśli istnieje hasło "English as a Second Language software" → dodać Edooqoo w external links).

---

## CZĘŚĆ D — Link-building Engine

### D1. Free tools as link magnets
Trzy darmowe narzędzia (nie wymagają loginu) — ludzie linkują do narzędzi, nie do blogposts:

| Narzędzie | URL | Mechanika | Targeted backlinks |
|---|---|---|---|
| **CEFR Level Test** (free, 5 min) | `/tools/cefr-level-test` | 25 pytań → JS scoring → "you are B1" + CTA | "english level test" 8.1k/mo |
| **ESL Lesson Plan Generator** (free, 1 plan/day no signup) | `/tools/lesson-plan-generator` | Form → AI → PDF | "esl lesson plan template" 1.6k/mo |
| **CEFR Vocabulary Checker** | `/tools/vocab-cefr-checker` | Paste text → token-by-token level | Unique, viral potential |

Każde narzędzie ma własną pSEO landing + embed widget (`<iframe>`) do osadzenia na blogach innych — wzmianka "Powered by Edooqoo" → naturalne backlinki.

### D2. Embed-widget program
- `/embed/cefr-test` — minimal HTML, branded.
- Strona `/for-bloggers` z instrukcją "Add this free tool to your blog" + copy-paste snippet.
- Backlinks śledzone via `?ref=embed-{domain}`.

### D3. Outreach pakiet (gotowy)
Plik `docs/seo/outreach/email-templates.md` — 5 szablonów (guest post, broken link, resource page, podcast pitch, tool embed). Lista 50 targetów ESL/EdTech w `docs/seo/outreach/target-list.csv` (domain, contact, angle).

---

## CZĘŚĆ E — Internal Linking Graph

### E1. Reguły (zaszyte w `ProgrammaticSeoLayout`)
- Każdy pSEO page → ≥10 internal links (5 same-cluster, 3 cross-cluster, 2 hub).
- Hub pages: `/esl-worksheets`, `/for-english-tutors`, `/exercise-types`, `/gallery`, `/tools/cefr-level-test`.
- Anchor text: dokładnie target keyword (nie "click here") — generowany z metadata.

### E2. Mega-footer
`src/components/GlobalFooter.tsx` rozszerzyć o sekcje "Popular Topics" (10), "By Level" (6), "By Profession" (10), "Free Tools" (3). Łącznie ~30 stałych linków na każdej stronie = wzmocnienie crawl-depth.

---

## CZĘŚĆ F — Content Velocity (manual content layer)

Oprócz pSEO — 12 long-form artykułów (1,500–2,500 słów) targetujących high-intent zapytania. Lista w `docs/seo/content-calendar-q3-q4-2026.md`:

1. "How to Create ESL Worksheets in 60 Seconds (2026 Guide)" — keyword: "create esl worksheets" (1.0k/mo)
2. "Best AI Tools for English Teachers in 2026" (1.9k/mo)
3. "CEFR Levels Explained: A Tutor's Complete Guide" (5.4k/mo)
4. "Teach Business English Online: Niche Strategy" (880/mo)
5. "Adult ESL Learners: 7 Andragogical Principles" (low vol, high authority)
6. "Worksheet Generator vs Pre-Made: ROI for Tutors" (compare keyword)
7. "Phrasal Verbs B2: Complete Worksheet Pack" (longtail)
8. "ESL Speaking Activities for 1-on-1 Lessons" (1.3k/mo)
9. "Placement Test for ESL Students: Free Template" (590/mo)
10. "IELTS Writing Task 2: Worksheet Bundle" (8.1k/mo, KDI~50)
11. "How Much to Charge for English Tutoring 2026" (2.4k/mo)
12. "AI Grading for English Teachers: Is It Accurate?" (emerging)

Każdy generowany przez Lovable AI Gateway (Gemini 2.5 Pro) z systemowym promptem z Marthą's voice (plik `prompts/martha-voice-system.md` — gotowy w docs).

---

## CZĘŚĆ G — Technical SEO Polish

### G1. Core Web Vitals
- Lazy-load wszystkich pSEO routes (`React.lazy` + `Suspense`).
- Image `<img loading="lazy" decoding="async">` enforced via ESLint rule.
- Preconnect do supabase + AI gateway w `index.html`.
- Font-display: swap (audit `index.html`).

### G2. Hreflang (na przyszłość)
Dziś tylko EN. Dodać `<link rel="alternate" hreflang="x-default">` na każdej stronie via `PageSeo` — przyszłościowe.

### G3. Canonical hardening
Audyt: każda strona dynamicznie generowana ma 1 canonical, bez duplikatów. Usunąć potencjalne canonical w `index.html` (już zrobione w v6.9.18, re-verify).

### G4. 404/redirect strategy
- Soft 404 dla `/esl-worksheets/{topic}/{level}` z nieznanym slugiem → 301 do `/esl-worksheets`.
- Edge function `validate-pseo-slug` w runtime.

### G5. Analytics events
Dodać do `src/utils/analytics.ts`:
- `pseo_page_view` (topic, level, exerciseType, persona)
- `pseo_cta_click` (target)
- `gallery_publish_toggle`
- `tool_used` (tool name)
Cel: tracking konwersji per template w GA4/Plausible.

---

## CZĘŚĆ H — Mierniki sukcesu (KPI 90-day)

| Metryka | Baseline | T+30 | T+60 | T+90 |
|---|---|---|---|---|
| URLi w sitemap | 30 | 1,455 | 1,500 | 2,000 |
| URLi zaindexowane GSC | ? | 200 | 800 | 1,400 |
| Organiczne sesje/mies. | ? | +50% | +200% | +500% |
| Ranking "ai worksheet generator" | - | top 30 | top 10 | top 3 |
| Ranking "esl worksheets" | - | top 50 | top 30 | top 20 |
| Backlinki (Semrush) | - | +10 | +40 | +100 |
| AI citations (manual check ChatGPT/Perplexity) | 0 | 2 | 8 | 20 |

---

## CZĘŚĆ I — Kolejność implementacji (sprint'y, każdy ~1 build pass)

**Sprint 1 — Fundament pSEO (krytyczny):**
1. `src/constants/pseo-matrix.ts` — wszystkie listy (topics, levels, exercise types, personas).
2. `src/components/seo/ProgrammaticSeoLayout.tsx` — uniwersalny szablon.
3. `src/components/seo/JsonLd.tsx` — helper schema.org.
4. 3 strony: `TopicLevelPage`, `ExerciseTopicPage`, `PersonaPage` + routy w `App.tsx`.
5. `src/data/pseo-content.json` — content seed (statycznie generowany jednorazowo skryptem `scripts/seed-pseo-content.ts` używającym Lovable AI Gateway).

**Sprint 2 — Sitemap, prerender, indexing:**
6. Rozbicie sitemap na index + 5 plików.
7. Integracja `react-snap` (prerendering).
8. `robots.txt` update.
9. Edge function `bing-indexnow-ping`.

**Sprint 3 — Public Gallery:**
10. Migracja Supabase (is_public, public_slug).
11. `/gallery` + `/gallery/{slug}` routes.
12. Toggle "Publish to gallery" w Worksheet save flow (UI tylko, BEZ ruszania promptu generatora — sanctity).
13. Edge function `regenerate-gallery-sitemap` (cron daily).

**Sprint 4 — Free tools + link magnets:**
14. `/tools/cefr-level-test` (25 pytań, JS scoring, brak backendu).
15. `/tools/lesson-plan-generator` (Lovable AI Gateway, rate limit 1/day per IP).
16. `/tools/vocab-cefr-checker`.
17. `/embed/cefr-test` + `/for-bloggers` strona.

**Sprint 5 — AEO/LLMO layer:**
18. `public/llms-full.txt` + `scripts/generate-llms-full.ts`.
19. Rozszerzony JSON-LD sweep (SoftwareApplication, HowTo, Course, ItemList).
20. Audyt snippet-friendly content rules.

**Sprint 6 — Content velocity:**
21. 4 z 12 long-form artykułów (start z highest-volume: CEFR Levels Explained, How Much to Charge, AI Tools for English Teachers, IELTS Writing).
22. Pozostałe 8 — kolejne sprinty.

**Sprint 7 — Outreach + technical polish:**
23. Mega-footer expansion.
24. Outreach materiały (templates, target list).
25. Reddit/Quora seed posty (manual, by user).
26. Core Web Vitals audyt + fix.

---

## CZĘŚĆ J — RAG / Documentation update (mandatory)

Każdy sprint kończy się aktualizacją:
- `docs/llm-context.md` — sekcja "Programmatic SEO Engine" w formacie `Problem → Edooqoo.com Solution → Technical Mechanics` + `RAG Keywords` (programmatic seo, pSEO, sitemap split, react-snap, public gallery, AEO, LLMO, llms.txt, JSON-LD, link magnets, CEFR test, indexnow, gsc batch indexing, internal linking graph).
- `llms.txt` + `public/llms.txt` — synchronizacja.
- `mem/seo/programmatic-seo-engine.md` — nowy wpis pamięci (typ: feature) + update `mem/index.md`.
- `docs/seo/pseo-architecture.md` — szczegółowa dokumentacja techniczna.
- `.lovable/plan.md` — zarchiwizować v6.9.19.

---

## Sanctity guard

Plan **NIE modyfikuje** worksheet generation prompt'u. Public Gallery używa istniejących worksheets w trybie read-only. Seed worksheets do pSEO generowane są jednorazowym skryptem używającym tego samego (niezmienionego) prompt'u przez Lovable AI Gateway.

---

## Co zostaje do potwierdzenia przed implementacją (3 mikro-decyzje)

1. **Public Gallery — opt-in czy opt-out?** Rekomendacja: **opt-in** (default OFF). Bezpieczniejsze prawnie (GDPR/copyright treści studenta).
2. **Prerender silnik** — rekomendacja: **react-snap** (proste). Alternatywa: vite-ssg (wymaga refactoru routingu).
3. **Czy generujemy seed-content przez Lovable AI teraz (koszt ~$15 za 1,425 stron) czy lazy on-demand?** Rekomendacja: **batch teraz** — predictable koszt, instant SEO benefit.

Jeśli zgadzasz się z rekomendacjami (opt-in / react-snap / batch), implementacja Sprint 1+2 startuje bez dalszych pytań.