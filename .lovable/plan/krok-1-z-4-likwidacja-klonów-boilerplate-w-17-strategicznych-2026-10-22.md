# Krok 1 z 4: Likwidacja klonów boilerplate w 17 strategicznych artykułach bloga

## Werdykt konsylium

17 indeksowanych artykułów bloga ma `maxContainment` 0.843–0.942 (8-word shingles, `docs/seo/content-uniqueness.generated.json`). Wspólna przyczyna: domyślne `commonProblem`, `commonSolution`, `commonMechanics`, `workflowFocus` i fallbackowe FAQ w `scripts/seo/x1000-editorial-plan.mjs`, renderowane przez `renderArticle()` w `scripts/seo/generate-citable-pages.mjs`. Wszystkie 17 to strony strategiczne (`STRATEGIC_BLOG_SLUGS`) lub cele 301, więc **nie noindex, nie redirect**. Naprawa: własny materiał źródłowy per URL w `ARTICLE_REWRITES` (istniejący mechanizm `bespoke` wyłącza wtedy boilerplate). Zero zmian w URL-ach, canonicalach, sitemapie, registry i grafie linków.

## Zakres: 17 URL-i

| # | Slug | Containment | Własna oś redakcyjna | Evidence w przykładzie |
|---|---|---:|---|---|
| 1 | extensive-reading-programs-esl | 0.942 | dobór tekstu i transfer czytania do pracy | retell, reuse leksyki, difficulty fit |
| 2 | learning-pacing-scientific-vs-pragmatic-esl | 0.938 | tempo jako decyzja obciążenia i retencji | spacing, nieudany recall, deadline |
| 3 | student-progress-to-worksheet-feedback-loop | 0.934 | sygnał postępu → jeden format ćwiczenia | wzorzec mastery, typ błędu |
| 4 | best-lesson-prep-tool-for-english-tutors | 0.930 | ocena narzędzia w cyklu 4 lekcji | odtwarzanie kontekstu, koszt edycji |
| 5 | english-tutor-material-organization-workflow | 0.928 | materiały wokół ucznia, nie folderów | źródło, ponowne użycie |
| 6 | how-english-tutors-track-what-to-teach-next | 0.928 | minimalny rejestr sygnałów | cel, blokująca luka, samodzielny sukces |
| 7 | cefr-aligned-worksheet-generation-workflow | 0.922 | CEFR jako poziom zadania, nie etykieta osoby | deskryptor, wsparcie, output |
| 8 | business-english-material-generation-workflow | 0.918 | materiał pod konkretne działanie biznesowe | rola, odbiorca, konsekwencja, rejestr |
| 9 | homework-mistakes-next-english-lesson | 0.915 | triage błędów zadania domowego | slip vs luka vs źle zrozumiane zadanie |
| 10 | can-ai-plan-one-to-one-english-lesson | 0.914 | granica draft AI vs decyzja lektora | cel, stosowność, punkt review |
| 11 | how-long-should-private-english-tutors-spend-on-lesson-prep | 0.912 | pomiar i redukcja tarcia przygotowania | retrieval, adaptacja, review |
| 12 | english-homework-ai-grading-workflow | 0.911 | AI jako sygnał do review, nie ocena końcowa | klucz, odpowiedź niepewna |
| 13 | formative-assessment-english-teaching | 0.911 | mikro-pętla evidence → feedback → retry | exit evidence, re-check |
| 14 | adult-esl-student-profile-lesson-planning | 0.906 | minimalny profil i prywatność | stały kontekst vs bieżąca obserwacja |
| 15 | how-to-plan-english-lessons-effectively | 0.905 | sekwencja od celu do transferu | outcome, scaffolding, delayed check |
| 16 | esl-exercise-type-selection-guide | 0.852 | format jako test hipotezy | recognition, controlled, transfer |
| 17 | process-writing-approach-esl | 0.843 | draft jako dowód następnej interwencji | cel rewizji, odbiorca, zmieniony draft |

Uwaga: część slugów (np. 4, 6, 9, 10, 11, 14) jest też generowana przez `generate-strategic-content.mjs` z dokumentu źródłowego. W Fazie A ustalamy dla każdego sluga, który generator zapisuje plik ostatni (`seo:sync-generated` uruchamia `generate-citable-pages` dwukrotnie), i rewrite trafia do właściwego źródła. Jeśli właścicielem jest generator strategiczny, unikalną treść dodajemy w jego źródle, nie w `ARTICLE_REWRITES`.

## Fazy wdrożenia (tryb Build)

### Faza A: kontrakt i mapa własności
1. Stała `STRATEGIC_BOILERPLATE_REWRITE_SLUGS` (17 pozycji) w `scripts/seo/article-rewrites.mjs`, eksportowana dla testów i audytu.
2. Dla każdego sluga potwierdzić generator-właściciel i ścieżkę renderowania (bespoke vs strategic markdown).

### Faza B: 17 własnych wpisów źródłowych
Każdy wpis: `h1`, `updated`, unikalne `keywords`, `directAnswer`, 3–5 `problem`, 4–6 `solution`, `mechanics` (tylko fakty PRODUCTION z `docs/llm-context.md`), `works`, `notEnough`, `tutorDecision`, `example` oznaczony „Constructed example”, 3–5 `faqs` specyficznych dla intencji, `sources` tylko gdy wspierają konkretne zdanie.
Zasady: Martha Standard (dorośli 1:1, realny cel komunikacyjny, zero dzieci/klas/zabaw), bez wymyślonych statystyk, klientów, cytatów, bez em dash, Edooqoo opisane oszczędnie (lektor zatwierdza). Zachowane slug, metadane (SEO_*_OVERRIDES) i linki.

### Faza C: bramki regresji
1. `scripts/seo/__tests__/strategic-boilerplate-rewrites.test.mjs`: lista kompletna (17), każdy wpis ma wszystkie pola, `bespoke === true`, żaden nie jest w `templatedCloneNoindexSlugs`; wygenerowany HTML: brak `noindex`, self-canonical, jeden H1, brak tekstów `commonProblem/commonSolution/commonMechanics` i fallbackowego FAQ chatbota, brak `<p>undefined</p>` i U+2014.
2. `audit-content-uniqueness.mjs --strategic-gate`: każdy z 17 musi mieć `maxContainment < 0.80`, inaczej exit 1 z raportem najbliższej strony; podpięty do `content:audit`. Globalny audyt pozostaje raportowy (bez zaostrzania pSEO).
3. Globalne `commonProblem/commonSolution/commonMechanics` i nagłówki szablonu bez zmian (to Krok 2).

### Faza D: regeneracja i weryfikacja
1. `seo:sync-generated` dwa razy, czysty diff po drugim.
2. `seo:audit-uniqueness` + gate, `seo:audit`, `content:audit`, `seo:audit-duplicate-meta`, `seo:check-jsonld`, `seo:audit-structured-data`, `npm test`.
3. Ręczny przegląd 3 losowych stron (czytelność, Martha) przez niezależnego recenzenta.

### Faza E: dokumentacja
1. `AGENTS.md`: zastąpić istniejącą regułę o templated clones wersją rozszerzoną: strategiczne strony z containment >= 0.80 naprawia się własnym źródłem treści (gate w content:audit), nigdy noindex ani edycją HTML.
2. `roadmap.md`: Krok 1 odhaczony po bramkach; Kroki 2–4 otwarte.
3. `docs/llm-context.md` i `mem://` bez zmian (brak zmiany architektury ani decyzji produktowej). `llms.txt` tylko przez generator.

## Kryteria akceptacji
- 17 URL-i indeksowalnych, te same adresy, canonical, registry i sitemap (252).
- Każda z 17 stron `maxContainment < 0.80`; brak tekstów boilerplate.
- Graf linków: orphan=0, weakTop40=0, weakTop120=0.
- Drugi `seo:sync-generated` bez zmian; wszystkie testy i audyty PASS.

## Ryzyka
| Ryzyko | Zabezpieczenie |
|---|---|
| Edycja nadpisana przez inny generator | Faza A: mapa własności per slug |
| Przepisanie zmieni intencję zapytania | directAnswer odpowiada na zapytanie URL; metadane bez zmian |
| Fałszywe twierdzenia o produkcie | tylko fakty PRODUCTION, przykłady oznaczone jako konstrukcyjne |
| Powrót boilerplate w przyszłości | test kompletności + gate containment w CI |
| Rozlanie zmian na cały blog | brak zmian w globalnym szablonie |

## Poza zakresem
Krok 2 (nagłówki citable, metatekst RAG, powtarzalne FAQ globalnie), Krok 3 (filtr Marthy ~65 artykułów), Krok 4 (pSEO + Gallery), publikacja, Cloudflare Worker, GSC, silnik arkuszy, DSLM, Supabase.
