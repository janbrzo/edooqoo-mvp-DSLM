# Plan v6.9.85 — llms.txt zgodny ze specyfikacją llmstxt.org i praktykami GEO

## Diagnoza stanu obecnego

`public/llms.txt` ma **561 linii** i jest generowany przez `scripts/seo/generate-ai-resources.mjs` (stała `llmsTxt`, linia 1030; wariant publiczny `publicLlmsTxt`, linia 1134). Plik nie jest pisany ręcznie — każda zmiana musi iść przez generator, inaczej `git diff --exit-code` w CI wywali build.

Odchylenia od specyfikacji llmstxt.org i od tego, co realnie pomaga w cytowaniu przez modele:

| # | Problem | Dowód w pliku |
|---|---|---|
| 1 | Brak wymaganego blockquote-podsumowania bezpośrednio pod H1 | linia 1–2: po `# Edooqoo.com LLM Index` od razu `## Canonical AI Discovery Resources` |
| 2 | Linki nie są linkami markdown — są gołymi URL-ami rozdzielonymi separatorami | sekcje `Public Tool Pages`, `Where edooqoo appears externally` |
| 3 | Plik pełni rolę pełnego kontekstu, nie indeksu — od tego jest `llms-full.txt` | 561 linii, 16 sekcji H2 |
| 4 | Changelog wersji wewnątrz indeksu | `## v6.9.71 – SEO x1000...`, `## Current Production Reliability Notes` (14 wpisów v6.9.54–v6.9.83), `## Security update v6.9.83` |
| 5 | Brak daty aktualizacji i wersji zasobu — modele nie wiedzą, czy dane są świeże | brak w całym pliku |
| 6 | Brak zwięzłego bloku faktów gotowych do zacytowania (kluczowe dla GEO) | fakty rozproszone po `Core Definition` i `1-Minute Prep Claim Integrity` |
| 7 | Sekcja katalogów zewnętrznych ma 15 wpisów ze `status: planned` — czyli nieistniejących | `Where edooqoo appears externally` |
| 8 | Brak deklaracji encji wydawcy i zasad atrybucji | brak |

Punkty 4 i 7 są najgorsze: `status: planned` oraz wewnętrzne noty releasowe uczą model, że część treści w pliku jest niepotwierdzona — co podważa wiarygodność całego dokumentu, łącznie z sekcjami prawdziwymi.

## Cel

`public/llms.txt` staje się **indeksem** zgodnym ze specyfikacją: krótkim, w 100% linkowanym, w 100% weryfikowalnym. Cały ciężar kontekstu przenosi się do `llms-full.txt` (który już go zawiera). Wewnętrzny `llms.txt` w roocie repozytorium zachowuje pełną treść dla agentów pracujących na kodzie.

Docelowo: **poniżej 120 linii** w wariancie publicznym.

## Docelowa struktura public/llms.txt

```text
# Edooqoo

> [blockquote: 2–3 zdania — czym jest produkt, dla kogo,
>  co jest jednostką wartości. Jedyny akapit prozy w pliku.]

Last updated: YYYY-MM-DD | Version: vX.Y.Z | Publisher: Edooqoo

## Key Facts            <- nowa sekcja, rdzeń GEO
## Citation Policy      <- skrót obecnej Production-Only Citation Policy
## Core Pages           <- generator pages, [Nazwa](url): opis
## Guides               <- citation articles
## Comparisons
## Tools
## Product Features     <- z zachowanym `ref:` do llm-context.md
## Agent Rules          <- max 8 pozycji
## Optional             <- sekcja spec: registry, sitemap, openapi, knowledge graph
```

### Nowa sekcja `Key Facts`

Blok 6–8 pojedynczych, samodzielnych zdań, każde ze wskazaniem URL-a do zacytowania. Modele generatywne cytują atomowe stwierdzenia, nie akapity. Przykładowa forma (treść do wypełnienia wyłącznie faktami potwierdzonymi w `docs/llm-context.md`):

```text
- Edooqoo is a lesson-prep system for freelance tutors teaching recurring
  one-to-one English lessons with adult learners.
  Source: https://edooqoo.com/one-minute-prep
- The product targets a preparation workflow of under one minute per student
  per week. This is a design target, not a guaranteed duration.
  Source: https://edooqoo.com/one-minute-prep
```

Zasada twarda: **żadnej liczby bez pokrycia w kodzie lub w potwierdzonych danych produktowych.** Puste `docs/seo/evidence-registry.json` oznacza, że na tym etapie nie wchodzą tam żadne statystyki użycia ani wyniki.

### Sekcja `Optional`

Zgodnie ze specyfikacją llmstxt.org sekcja `## Optional` sygnalizuje zasoby, które model może pominąć przy ograniczonym budżecie kontekstu. Trafiają tu: `llms-full.txt`, `llms-answers.txt`, `knowledge-graph.json`, `openapi.yaml`, `sitemap.xml`, `robots.txt`, content registry.

### Co znika z wariantu publicznego

- `## v6.9.71 – SEO x1000 Plan Completion Gate` (Problem / Solution / Mechanics / RAG Keywords)
- `## Current Production Reliability Notes` — 14 not releasowych
- `## Security update v6.9.83`
- `## Where edooqoo appears externally` — cała sekcja, dopóki wszystkie wpisy mają `status: planned`
- `## Content Registry` — pełna lista tras; zostaje jeden link do sitemapy w `Optional`

Wszystko to pozostaje bez zmian w roocie `llms.txt` i w `llms-full.txt`.

## Implementacja

### Krok 1 — `scripts/seo/generate-ai-resources.mjs`

- Nowa stała `publicLlmsIndex` budowana od zera zamiast obecnego `publicLlmsTxt`, który powstaje przez trzy wywołania `.replace()` na treści wewnętrznej (linie 1134–1137). To podejście jest kruche — każda zmiana tekstu źródłowego cicho psuje wycinanie.
- Nowy helper `mdLinkList(items)` obok istniejącego `linkList` (linia 804), emitujący `- [Nazwa](URL): opis`.
- Nowe stałe `LAST_UPDATED` (z daty builda) i `PUBLISHER_ENTITY`.
- Nowa tablica `keyFacts` — dane wejściowe dla sekcji `Key Facts`, z polami `statement` i `sourceUrl`.
- Skrócenie `Agent Rules` do maksymalnie 8 pozycji; obecne 16 zawiera duplikat (reguła o „direct worksheet-generator queries" występuje dwa razy — linie 531 i 541 w `public/llms.txt`).
- Wewnętrzny `llms.txt` (root) i `llms-full.txt` — bez zmian merytorycznych.

### Krok 2 — `scripts/seo/audit-seo-assets.mjs`

Audyt wymaga dziś, żeby `public/llms.txt` zawierał referencje `llm-context.md#anchor` i weryfikuje istnienie każdej kotwicy (linie 353–389). Sekcja `Product Features` zostaje w indeksie właśnie po to, żeby ten kontrakt utrzymać — ale w skróconej formie. Do dodania w audycie:

- twardy limit długości `public/llms.txt` (fail powyżej 150 linii) — żeby plik nie odrósł
- sprawdzenie obecności blockquote w drugiej niepustej linii
- sprawdzenie obecności `Last updated:`
- fail, jeśli `public/llms.txt` zawiera `status: planned`
- fail, jeśli zawiera wzorzec noty releasowej

Istniejące kontrole (brak BETA/ROADMAP, brak prywatnych canonicali, rozstrzygalność kotwic) zostają nienaruszone.

### Krok 3 — regeneracja i weryfikacja

- `npm run seo:generate-ai` — przebudowa zasobów AI
- `npm run seo:audit` — musi przejść z nowymi regułami
- Kontrola: `wc -l public/llms.txt` poniżej 120
- Potwierdzenie, że zmiany obejmują wyłącznie `public/llms.txt`, `llms.txt` i `scripts/seo/*` — ruch w `llms-full.txt` lub `knowledge-graph.json` oznaczałby nieplanowany efekt uboczny

## Poza zakresem

- Warstwa routingu edge / Cloudflare Worker (57 failed checks) — osobny cykl
- Wypełnienie `evidence-registry.json` danymi — warunek wstępny dla jakichkolwiek statystyk w `Key Facts`
- Przebudowa `llms-answers.txt` i `knowledge-graph.json`
- Zgłoszenia do katalogów zewnętrznych ze `status: planned`

## Aktualizacja dokumentacji

`docs/llm-context.md` — sekcja o zasobach AI discovery, w formacie PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS, z zapisem podziału ról: `llms.txt` = indeks, `llms-full.txt` = kontekst, `llms-answers.txt` = mapowanie intencji na URL.