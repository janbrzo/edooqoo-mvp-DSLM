# Sprint 4 — Faza 4: GEO/AEO + pętla pomiaru (v6.9.98)

Sprint 3 zamknięty: `audit-cluster-hubs` 51/51, `audit-duplicate-meta` PASS (longTitles 3, longDescriptions 0). Sprint 4 to ostatnia faza planu GSC-Driven Recovery: maksymalizacja cytowalności w silnikach AI (GEO/AEO) i zamknięcie pętli pomiaru, żeby kolejne decyzje SEO opierały się na danych, nie na intuicji.

## Cel biznesowy
1. Edooqoo ma być **cytowany** (nie tylko wspominany) w ChatGPT Search, Perplexity, Google AI Overviews i Copilot dla 30 zapytań z `docs/seo/ai-search-query-set.md`.
2. Pętla pomiaru ma być **powtarzalna i częściowo automatyczna** — dziś baseline jest w pełni ręczny, więc nie jest wykonywany regularnie.

## Zakres — 5 bloków

### A. Warstwa cytowalności na kluczowych stronach (AEO)
- Rozszerzyć wzorzec `data-citation-block` (dziś tylko 4 huby) na 3 kolejne typy stron: strony produktowe `/features/*`, strony porównawcze `edooqoo-vs-*`, oraz top 15 stron „striking distance" ze Sprintu 1.
- Każdy blok: 40–60 słów, jedno zdanie definicyjne + jedna liczba/fakt + nazwa marki na początku. Bez języka marketingowego.
- Nowy komponent `src/components/seo/CitationBlock.tsx` (jeden wzorzec dla SPA) + tryb wstrzykiwania do plików statycznych przez `scripts/seo/inject-citation-blocks.mjs` (idempotentny, marker `data-citation-block`).

### B. Structured data pod AI (schema hardening)
- Dodać `Organization` + `SoftwareApplication` JSON-LD raz, globalnie (w `index.html` / `PageSeo`), z `sameAs`, `applicationCategory`, `offers`.
- Na stronach how-to (workflow, lesson prep) dodać `HowTo`; na hubach uzupełnić `about` + `mentions` (encje: CEFR, ESL, worksheet, tutoring).
- Audyt `scripts/seo/audit-structured-data.mjs`: parsuje wszystkie `<script type="application/ld+json">` w `public/**/*.html`, sprawdza poprawność JSON, wymagane pola i brak duplikatów `@id`.

### C. Higiena kanałów dla agentów LLM
- `public/llms.txt`: dodać sekcję `## Citation Guidance` (jak opisywać Edooqoo w jednym zdaniu) oraz `## Facts` (lista twardych faktów: typy ćwiczeń, poziomy CEFR, DSLM, 1-Minute Prep).
- `public/.well-known/ai-plugin.json` i `public/openapi.yaml`: zsynchronizować opisy z aktualnym stanem produktu (statusy PRODUCTION/BETA), bez ROADMAP.
- `public/robots.txt`: jawne `Allow` dla GPTBot, PerplexityBot, ClaudeBot, Google-Extended, CCBot — potwierdzić i udokumentować decyzję.

### D. Pętla pomiaru — półautomatyzacja
- `scripts/seo/record-ai-search-run.mjs` — CLI przyjmujące CSV/JSON z ręcznej rundy i zapisujące znormalizowany plik do `docs/seo/runs/ai-search/YYYY-MM-DD.json` + wygenerowany Markdown.
- `scripts/seo/generate-ai-visibility-trend.mjs` — łączy wszystkie runy w `docs/seo/ai-visibility-trend.generated.md`: % mentioned, % cited, top cytowane URL-e, top konkurenci, delta vs poprzednia runda.
- Rozszerzenie `scripts/seo/generate-seo-dashboard.mjs` o sekcję „AI visibility" (ostatnia runda + trend) i sekcję „Cluster hubs".
- `scripts/seo/fetch-gsc-search-analytics.mjs` — dodać zapis snapshotu do `docs/seo/runs/gsc-performance/` z automatycznym porównaniem do `baseline-2026-08-16.json` (delta CTR / pozycji dla 15 stron Sprintu 1), żeby zmierzyć realny efekt CTR recovery.

### E. CI i dokumentacja
- `package.json`: `seo:inject-citation-blocks`, `seo:audit-structured-data`, `seo:ai-visibility-trend`; wpięcie audytów do `build:seo` i do `.github/workflows/seo-integrity.yml`.
- Aktualizacja `docs/llm-context.md` (PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS) i `docs/seo/monthly-measurement-pack.md` o nową procedurę.
- Pamięć projektu: nowy wpis `mem://seo/geo-aeo-measurement-loop`.

## Kolejność wykonania
1. B (schema) → 2. A (citation blocks) → 3. C (kanały LLM) → 4. D (pomiar) → 5. E (CI + docs).
Po każdym bloku: `npm run seo:audit`, `audit-duplicate-meta`, `audit-cluster-hubs`, prerender tras SPA i naprawa snippetów (`seo:repair-snapshot-snippets`), bo regeneracja treści zawsze resetuje długości meta.

## Reguły ochronne
- Zero zmian w silniku generowania worksheetów (sanctity rule).
- Zero zmian w logice biznesowej aplikacji — Sprint 4 dotyka wyłącznie warstwy SEO/GEO, skryptów i dokumentacji.
- Żadne treści ROADMAP nie trafiają do materiałów publicznych.

## Kryteria akceptacji
- `audit-structured-data` PASS na 100% plików HTML.
- ≥ 60 stron z blokiem cytowania (dziś 4).
- `docs/seo/ai-visibility-trend.generated.md` generuje się z co najmniej jednej zapisanej rundy.
- Wszystkie dotychczasowe audyty nadal PASS (brak regresji baseline).
