# Sprint 3 — Faza 3: 4 huby klastrowe (plan v6.9.97)

Cel: zbudować autorytet tematyczny wokół 4 klastrów, które JUŻ mają zmierzony popyt w GSC,
i przekierować istniejące wyświetlenia (9 020/mies.) na strony, które konwertują na nauczyciela.
Zero nowych treści blogowych — huby agregują i linkują to, co już rankuje, i pchają ruch do darmowych narzędzi.

Sprint 1 (CTR recovery) i Sprint 2 (intent + higiena pSEO + snippety) są domknięte, w tym pełna spłata
długu snippetów (0 długich opisów, 3 długie tytuły w bazlinie audytu). Sprint 3 rusza bez zaległości.

## Dlaczego huby, a nie kolejne artykuły

441 URL-i rankuje, ~40 dostaje klik. Treść istnieje, brakuje struktury: każdy artykuł jest sierotą,
która sama walczy o pozycję 12–18. Hub-and-spoke robi trzy rzeczy naraz: (1) konsoliduje sygnał
linkowania wewnętrznego na jednym URL-u per temat, (2) daje LLM-om jeden ekstrahowalny blok definicyjny
per klaster (GEO), (3) daje ścieżkę „artykuł → hub → darmowe narzędzie → signup”, której dziś nie ma.

## Zakres: 4 huby

Wszystkie jako trasy SPA w `src/App.tsx`, komponenty w `src/pages/seo/hubs/`, na istniejącym
`SeoLandingLayout` (bez nowego layoutu), metadane w `src/constants/seoMeta.ts`, prerender przez
`CORE_SEO_ROUTES` w `scripts/seo/seo-route-manifest.mjs`.

| # | Hub URL | Dowód popytu (GSC) | Lejek do narzędzia |
|---|---|---|---|
| H1 | `/cefr-assessment` | `cefr level checker` poz. 23,4; `cefr word level checker` poz. 10,9; `/tools/vocab-cefr-checker` 276 wyśw.; `/features/placement-test` 308 wyśw. | `/tools/vocab-cefr-checker` + `/tools/cefr-level-test` |
| H2 | `/teaching-english-pronunciation` | `/blog/teaching-english-intonation-stress` 309 wyśw. poz. 10,8; minimal pairs 86 wyśw.; zapytania cytatowe („stressed syllables occur at roughly regular intervals” 137 wyśw.) | `/esl-worksheets` (minimal pairs, audio) |
| H3 | `/esl-exercise-design` | fill-in-the-blanks 112, word formation 112, cloze 60, `modal-verbs-worksheets-esl` 187 | `/exercise-types` → generator |
| H4 | `/tutor-operations` | `digital-homework-tools-esl-teachers` 51 wyśw. poz. **4,35 / 0 klików**; progress reports; `/features/homework` | `/tools/what-should-i-teach-next` |

### Mapa spoke'ów (istniejące strony, nic nie piszemy od zera)

- H1: `/features/placement-test`, `/tools/cefr-level-test`, `/tools/vocab-cefr-checker`,
  `/blog/diagnostic-testing-english-learners.html`, `/blog/what-should-adult-english-placement-test-include.html`,
  `/blog/formative-assessment-english-teaching.html`, `/blog/cefr-aligned-worksheet-generation-workflow.html`.
- H2: `/blog/teaching-english-intonation-stress.html`, `/blog/teaching-minimal-pairs-esl.html`,
  `/blog/accent-reduction-activities-esl.html`, `/blog/teaching-collocations-esl.html`, `/exercise-types`.
- H3: `/blog/fill-in-the-blanks-exercises-best-practices.html`, `/blog/cloze-test-design-esl.html`,
  `/blog/word-formation-exercises-english.html`, `/modal-verbs-worksheets-esl.html`,
  `/blog/esl-exercise-type-selection-guide.html`, `/blog/task-based-language-teaching-worksheets.html`, `/exercise-types`.
- H4: `/blog/digital-homework-tools-esl-teachers.html`, `/blog/writing-student-progress-reports-esl.html`,
  `/blog/english-homework-ai-grading-workflow.html`, `/blog/how-long-should-private-english-tutors-spend-on-lesson-prep.html`,
  `/features/homework`, `/features/calendar`, `/what-to-teach-next`.

## Krok 1 — Struktura strony huba (jednakowa dla 4, zero decyzji przy wdrożeniu)

Kolejność sekcji w `SeoLandingLayout`:

1. H1 + lead (≤ 2 zdania, persona: tutor dorosłych 1:1).
2. **Citation block** — pierwszy element `body`: 40–60 słów, definicja klastra, jedno zdanie = jeden fakt,
   opakowana w `<p data-citation-block="true">`. To jest fragment, który mają cytować LLM-y i AI Overviews.
3. Tabela porównawcza (`<table>`): 4–6 wierszy, kolumny „Situation | What to use | Why | Where in Edooqoo”.
4. Sekcja spoke'ów przez prop `list` — każdy element z `href` do istniejącego artykułu, anchor = fraza z GSC
   (nie „read more”): np. „Teaching stress and intonation to adults”, „Cloze test design: rational deletion”.
5. Blok narzędzia (CTA wtórne prowadzi do free toola danego klastra, nie do `/signup`).
6. FAQ: 3 pytania sformułowane tak, jak ludzie pytają chatboty
   (np. „How do I check a student's CEFR level without a full exam?”), odpowiedź 40–70 słów.

Limity metadanych: title ≤ 60, description ≤ 155 (egzekwuje `audit-duplicate-meta.mjs`).

Gotowe metadane hubów (do wklejenia w `seoMeta.ts`):

- H1 `CEFR Assessment for Adult 1:1 English Tutors` / `Place an adult student on the CEFR scale in one lesson: free level test, vocabulary checker, and what to do with the result.`
- H2 `Teaching English Pronunciation to Adults — Tutor Hub` / `Stress, intonation, minimal pairs and connected speech for adult 1:1 lessons, with drills you can turn into a worksheet in a minute.`
- H3 `ESL Exercise Design — Cloze, Gap-Fill, Transformation` / `How to design cloze, gap-fill, word formation and transformation tasks that actually diagnose an adult learner, not just fill lesson time.`
- H4 `Tutor Operations — Homework, Reports, Lesson Records` / `Run a 1:1 English tutoring practice: homework review, progress reports, what-to-teach-next decisions and lesson records in one workflow.`

## Krok 2 — Linkowanie zwrotne spoke → hub (to jest właściwa dźwignia)

Sam hub bez linków zwrotnych nie zadziała. Dla każdego spoke'a dodajemy jeden link kontekstowy do huba:

- Strony generowane (`public/blog/*.html`, root HTML): rozszerzamy `scripts/seo/x1000-editorial-plan.mjs`
  o nową mapę `CLUSTER_HUB_BY_SLUG` (`slug -> { hubPath, hubAnchor }`) i wstrzykujemy zdanie
  „Part of the Edooqoo <a href="{hubPath}">{hubAnchor}</a> hub.” w bloku powiązanych linków generatora.
  Ręczna edycja HTML jest zakazana (regeneracja ją skasuje) — reguła z pamięci projektu.
- Strony React (`/features/*`, `/tools/*`, `/exercise-types`): jeden link inline w istniejącym akapicie.
- `/blog` i `/resources`: sekcja „Clusters” z 4 kaflami do hubów.

## Krok 3 — Schema

- Każdy hub: `CollectionPage` + `BreadcrumbList` (Home → Hub) + `FAQPage` (już generuje `SeoLandingLayout`).
- H1 dodatkowo `LearningResource` wskazujący `/tools/cefr-level-test`.
- H4 dodatkowo `SoftwareApplication` (istniejące dane produktu, bez `AggregateRating` — nie wymyślamy ocen).

## Krok 4 — Rejestracja tras (kolejność ma znaczenie)

1. `src/App.tsx` — 4 nowe `<Route>` (lazy import, jak pozostałe strony SEO).
2. `src/constants/seoMeta.ts` — 4 wpisy (title/description/path).
3. `scripts/seo/seo-route-manifest.mjs` — 4 wpisy w `CORE_SEO_ROUTES` (włącza prerender + sitemap).
4. `npm run seo:sync-sitemap-edge` → `public/sitemap.xml` i routing brzegowy.
5. `scripts/seo/audit-internal-link-graph.mjs` — dodać 4 huby do `priorityRoutes`.

## Krok 5 — Nowy audyt: `scripts/seo/audit-cluster-hubs.mjs`

Fail buildu (wpięty do `seo-integrity.yml` po krokach generujących), gdy:

1. hub nie ma `data-citation-block` w prerenderowanym HTML,
2. hub ma mniej niż 5 linków wychodzących do swoich spoke'ów,
3. spoke z mapy klastra nie ma linku zwrotnego do huba,
4. hub ma mniej niż 3 linki przychodzące z prerenderowanych stron,
5. hub nie linkuje do przypisanego darmowego narzędzia,
6. title > 60 lub description > 155.

Raport: `docs/seo/cluster-hubs.generated.md` (per klaster: liczba spoke'ów, braki linków zwrotnych).
Skrypt w `package.json` jako `seo:audit-cluster-hubs`, dołączony do `seo:audit`.

## Krok 6 — Warstwa GEO

- `public/llms.txt`: nowa sekcja „Topic clusters” — 4 wpisy `URL — 1-zdaniowa definicja — powiązane narzędzie`.
- `docs/llm-context.md`: wpis w formacie PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS.
- `docs/seo/ai-search-query-set.md`: +8 promptów seed (po 2 na klaster), np.
  „what should I use instead of ISLCollective for adult 1:1 students”, „how to test an adult student's CEFR level fast”.

## Krok 7 — Weryfikacja przed zamknięciem

1. `npm run build:seo` przechodzi (prerender generuje 4 pliki HTML hubów).
2. `node scripts/seo/audit-cluster-hubs.mjs` — zielony.
3. `node scripts/seo/audit-duplicate-meta.mjs` — zielony, baseline nie rośnie.
4. `node scripts/seo/audit-internal-link-graph.mjs` — 0 sierot, huby ≥ 10 linków przychodzących.
5. `tsgo --noEmit`.
6. Dwukrotne uruchomienie generatorów → `git diff` pusty (brak driftu).
7. Martha Test na 4 hubach: brak treści dziecięcych, brak tonu szkolnego.

## Definition of Done

- 4 huby live, prerenderowane, w sitemapie, z citation blockiem i tabelą porównawczą.
- Każdy spoke ma link zwrotny wygenerowany przez generator (nie ręcznie).
- `audit-cluster-hubs.mjs` w CI i przechodzi.
- `llms.txt`, `docs/llm-context.md`, `ai-search-query-set.md` zaktualizowane.
- Baseline pomiaru zapisany do `docs/seo/runs/gsc-performance/baseline-sprint3-<data>.json`.

## Pomiar (odczyt po 14 / 28 / 56 dniach)

- Pozycja spoke'ów w klastrze: oczekiwane −2 do −4 pozycji na spoke'ach H2 i H3 (efekt linkowania).
- Kliknięcia hubów: cel 60–90 klików/mies. łącznie na day 90.
- Wejścia do darmowych narzędzi z hubów (parametr `?src=hub-<slug>` w CTA narzędzia).
- Cytowalność: udział wzmianek w AI baseline z 0% → ≥ 10% po 60 dniach.

## Poza zakresem Sprintu 3

Nowe artykuły spoke, hreflang i lokalizacje (PL/BR/IT), mobile-first refactor pierwszego ekranu,
pełna pętla pomiaru GEO — to Sprint 4 (Faza 4). Silnik generowania worksheetów nietykalny.

## Szczegóły techniczne (pliki do dotknięcia)

`src/pages/seo/hubs/{CefrAssessmentHub,PronunciationHub,ExerciseDesignHub,TutorOperationsHub}.tsx` (nowe),
`src/App.tsx`, `src/constants/seoMeta.ts`, `scripts/seo/seo-route-manifest.mjs`,
`scripts/seo/x1000-editorial-plan.mjs` (mapa `CLUSTER_HUB_BY_SLUG`),
`scripts/seo/audit-cluster-hubs.mjs` (nowy), `scripts/seo/audit-internal-link-graph.mjs`,
`.github/workflows/seo-integrity.yml`, `package.json`, `public/llms.txt`, `docs/llm-context.md`,
`docs/seo/ai-search-query-set.md`, `public/sitemap.xml` (generowany).
