# Sprint 2 — Intent realignment, conquest, higiena pSEO (Plan v6.9.96)

## Najpierw odpowiedź na Twoje pytanie

Nie, to nie jest zaległość ze Sprintu 1. Sprint 1 jest domknięty i zweryfikowany w kodzie:
15 stron ma ręczne snippety (mapy `SEO_TITLE_OVERRIDES` / `SEO_DESCRIPTION_OVERRIDES`
w `scripts/seo/x1000-editorial-plan.mjs`, linie 96 i 108), audyt
`scripts/seo/audit-duplicate-meta.mjs` działa, jest wpięty w CI i przechodzi
(current 131 / 92 / 128 / 406 / 122 poniżej baseline 135 / 100 / 135 / 415 / 130).

Zdanie „Poza zakresem (do Sprintu 2): pozostały dług…” to dokładnie ta sama pozycja co
„Faza 5 — higiena pSEO” w Sprincie 2. Sprint 1 z założenia dotykał tylko 15 stron
o najwyższej wartości; reszta długu metadanych była od początku zaplanowana na Sprint 2.
Nie ma więc nic do „dokończenia” — wchodzimy w Sprint 2 zgodnie z kolejnością:
Faza 2 (intent realignment) + conquest + Faza 5 (higiena pSEO).

## Diagnoza (zweryfikowana w plikach, nie z pamięci)

### Root cause 1 — 131 duplikatów opisu to bug prerenderu, nie treści

Sprawdziłem: 131 plików w `public/**` ma **dwa** tagi `<meta name="description">`.
Przykład `public/about/index.html`:

```text
linia 5:   <meta name="description" content="1-Minute Prep for 1:1 English teachers. Use student goals, DSLM …">  <- z index.html
linia 122: <meta name="description" content="Edooqoo is a 1-Minute Prep system …" data-rh="true">                  <- z Helmet
```

`scripts/seo/prerender-spa-routes.mjs` zapisuje snapshot SPA razem ze statycznym `<head>`
z `index.html`, a react-helmet **dokleja** swoje tagi zamiast nadpisać. Audyt czyta pierwszy
tag — stąd „131 stron z tym samym opisem”. Google przy dwóch tagach description w head
również zwykle bierze pierwszy, więc to nie jest wyłącznie artefakt pomiaru: 131
prerenderowanych tras marketingowych realnie serwuje opis strony głównej. To najtańsza
i największa wygrana Sprintu 2 — jedna poprawka w skrypcie zeruje metrykę.

### Root cause 2 — 92 slug-title, 406 za długich opisów i 122 zakazane frazy to jeden fallback

`articleSpec()` w `scripts/seo/x1000-editorial-plan.mjs` (linia ~148):

```js
const title = SEO_TITLE_OVERRIDES[slugKey] || explicitTitle || titleFromSlug(slug);
const description = SEO_DESCRIPTION_OVERRIDES[slugKey] || explicitDescription ||
  `${title}: adult 1:1 English tutor reference with Edooqoo workflow links, teacher review, evidence-led planning, and non-school-like framing.`;
```

Ten jeden szablon produkuje wszystkie trzy metryki naraz: tytuł = slug w Title Case, opis
prawie zawsze >155 znaków i zawierający trzy frazy z listy zakazanej. Naprawa musi być
w fallbacku, nie w ręcznym pisaniu 90 stron.

### Root cause 3 — intent

- `public/blog/esl-games-for-kids.html` i wszystkie 17 pozycji z `noindexLegacy` **są już**
  `noindex,follow` — zweryfikowane skryptem 17/17. Tego nie ruszamy.
- `public/blog/best-apps-learning-english-2026.html` jest indeksowana, ma
  `<title>Best Apps Learning English 2026 | Edooqoo</title>` i pełny opis-boilerplate
  z zakazanymi frazami. 1 422 wyświetlenia, 1 klik — intencja ucznia na stronie dla
  nauczyciela. Decyzja: **keep & re-angle na intencję tutora**, nie noindex (900+ wyświetleń
  klastra to za dużo, by wyrzucić).
- 14 stron `edooqoo-vs-*` dzieli dwa szablony opisu (10 + 4 strony, dosłownie identyczne).
  `/edooqoo-vs-islcollective.html`: 447 wyśw., poz. 5,8, 1 klik.

## Zakres Sprintu 2 — 5 zadań

Silnik generowania worksheetów nietknięty. Zero zmian w bazie, RLS i logice produktu.

### S2-A — Deduplikacja `<head>` w prerenderze (naprawia 131 stron)

Plik: `scripts/seo/prerender-spa-routes.mjs`.

Po pobraniu HTML z Chromium, przed zapisem snapshotu, uruchomić nową funkcję
`dedupeHeadMeta(html)`:

1. Dla każdego z selektorów: `meta[name="description"]`, `meta[property="og:description"]`,
   `meta[property="og:title"]`, `meta[name="twitter:description"]`,
   `meta[name="twitter:title"]`, `meta[property="og:url"]`, `meta[name="robots"]` — jeśli
   w head istnieje wariant z `data-rh="true"`, usuń wszystkie warianty **bez** `data-rh`
   (Helmet jest źródłem prawdy per-route).
2. Jeśli wariantu `data-rh` nie ma — nie ruszaj niczego (fallback z `index.html` zostaje).
3. `<title>` już działa poprawnie (Helmet nadpisuje) — nie dotykamy.

Rozszerzenie `validateCompletedSnapshotSet()` (linia ~177): dla każdej trasy reguła
„dokładnie jeden `meta[name=description]` i jeden `og:description`”, analogicznie do
istniejącego `canonicalCount !== 1`. Regresja wysypie wtedy build, a nie audyt SEO.

Wykonanie: `npm run prerender:seo -- --out=public`, potem
`node scripts/seo/audit-duplicate-meta.mjs`.
Oczekiwany wynik: `duplicateGroups 0`, `duplicatePages 0`.

### S2-B — Nowy fallback snippetów (naprawia 92 + 406 + 122)

Plik: `scripts/seo/x1000-editorial-plan.mjs`. Dodajemy deterministyczną funkcję
`buildFallbackSnippet(slug)` i podmieniamy nią oba fallbacki w `articleSpec()`.

Zasady (bez losowości — ten sam slug zawsze daje ten sam snippet, więc `git diff` po
podwójnej regeneracji jest pusty):

```text
topicPhrase = titleFromSlug(slug) bez sufiksu "| Edooqoo", z mapą skrótów:
  "One To One" -> "1:1", "Cefr" -> "CEFR", "Ai" -> "AI", "Esl" -> "ESL", "Clil" -> "CLIL"

hash = suma kodów znaków slugu (stabilna, deterministyczna)

TITLE_ANGLES (8 pozycji, wybór hash % 8):
  "A Tutor's Checklist", "What Works in 1:1 Lessons", "Adult Learner Guide",
  "Practical Guide for Tutors", "Step-by-Step for 1:1 Tutors",
  "How to Run It With Adults", "Tutor Playbook", "Setup and Common Mistakes"

title = `${topicPhrase}: ${angle}`
  jeśli > 60 znaków -> najpierw krótszy angle z listy posortowanej po długości,
  potem przycięcie topicPhrase na granicy słowa; twardy limit 60.

DESC_PATTERNS (6 pozycji, wybór hash % 6) — każdy kończy się akcją tutora:
  1. "Practical notes on {topic} for adult 1:1 lessons: what to prepare, what to skip. {action}"
  2. "{topic} explained for private tutors of adults, with the decisions that change the lesson. {action}"
  3. "How experienced 1:1 tutors handle {topic} without turning the lesson into a school class. {action}"
  4. "{topic}: what to check in your student's evidence before you plan the next session. {action}"
  5. "A working approach to {topic} for recurring adult learners, plus the traps to avoid. {action}"
  6. "{topic} for professional adult learners: choices, sequence and review. {action}"

ACTIONS (4 pozycje, wybór (hash >> 3) % 4):
  "Generate a matching worksheet in one minute."
  "Turn it into an editable task for your next lesson."
  "Build the exercise for your student's level."
  "Prepare the follow-up homework in one click."

description: twardy limit 155 znaków — przy przekroczeniu skracamy {topic} na granicy słowa,
akcja zostaje zawsze (to ona daje klik).
```

Gwarancja unikalności: `{topic}` jest unikalny per slug, więc opisy nie mogą się powtórzyć.
Gwarancja braku zakazanych fraz: żaden pattern ich nie zawiera, a dodatkowo
`buildFallbackSnippet` ma asercję `BANNED.every(p => !description.includes(p))` — błąd leci
przy generowaniu, nie dopiero w audycie.

`SEO_TITLE_OVERRIDES` / `SEO_DESCRIPTION_OVERRIDES` zachowują pierwszeństwo — Sprint 1
pozostaje nietknięty.

### S2-C — Intent realignment: klaster „best apps 2026”

Plik: `scripts/seo/x1000-editorial-plan.mjs`, dopisanie do map override:

```js
// title (55 znaków)
'best-apps-learning-english-2026': 'Best English Learning Apps 2026: What to Tell Students',
// description (152 znaki)
'best-apps-learning-english-2026':
  'Which apps actually help your adult 1:1 students between lessons, which waste their time, and what to do in the lesson instead. Compare the shortlist.',
```

Strona pozostaje `index,follow` (900+ wyświetleń klastra), ale snippet i H1 kierują na
intencję tutora („co polecić uczniowi”), nie ucznia („czego użyć”). W generowanej treści
dodajemy jeden blok CTA do `/esl-worksheets`.

Przed edycją: `rg -l "best-apps" public/blog` — override obejmujemy tylko istniejące
warianty long-tail z tego klastra.

Stron kids/teen nie ruszamy — są już `noindex,follow`.

### S2-D — Conquest: 14 stron `edooqoo-vs-*`

Plik: `scripts/seo/generate-citable-pages.mjs`, tablica `comparisonPages` (linia ~1220).

1. Każda z 14 pozycji dostaje **unikalny** `description` ≤155 znaków wg wzorca:
   `"{Competitor} vs Edooqoo for adult 1:1 tutors: {konkretna różnica}. {kiedy wybrać konkurenta}."`
   Przykład dla iSLCollective (poz. 5,8 — największy potencjał):
   - title: `iSLCollective vs Edooqoo — Which for Adult 1:1?` (47 znaków)
   - description: `A shared worksheet library versus generation from your own student's evidence. See when a ready-made ESL worksheet is still the faster choice.` (145)
2. Do szablonu strony porównawczej dochodzi sekcja **„When NOT to choose Edooqoo”**
   (3 uczciwe punkty, np. grupy szkolne, praca z dziećmi, potrzeba gotowej biblioteki).
   To jest fragment, który cytują LLM-y, i jedyny sposób, by strona vs. wyglądała
   wiarygodnie dla nauczyciela na pozycji 5.
3. `FAQPage` schema: 3 pytania sformułowane jak prompty do chatbota
   („What should I use instead of iSLCollective for adult 1:1 students?”).
   Zero `AggregateRating` — nie mamy prawdziwych recenzji.

### S2-E — Obniżenie baseline, CI i dokumentacja

Plik: `scripts/seo/audit-duplicate-meta.mjs`, stała `BASELINE` (linia 35). Nowe wartości
ustawiamy **po** S2-A..S2-D: `node scripts/seo/audit-duplicate-meta.mjs --write-baseline`,
odczyt liczb, wpisanie ich ręcznie. Cele kontrolne (jeśli metryka nie zejdzie do celu,
wpisujemy realny pomiar i notujemy różnicę w planie Sprintu 3):

| Metryka | Dziś | Cel po Sprincie 2 |
| --- | --- | --- |
| duplicateGroups | 1 | 0 |
| duplicatePages | 131 | 0 |
| slugTitles | 92 | <= 10 |
| longTitles | 128 | <= 25 |
| longDescriptions | 406 | <= 40 |
| bannedPhrases | 122 | 0 |

Dokumentacja: sekcja „Metadata debt burn-down (Sprint 2)” w `docs/llm-context.md`
(PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS) oraz aktualizacja
`mem://seo/metadata-ownership`: „prerender snapshots — Helmet is the single source of head
truth; static index.html meta is stripped when a data-rh counterpart exists”.

## Kolejność wykonania (jedna sesja)

1. S2-A (prerender dedupe) -> `npm run prerender:seo -- --out=public` -> audyt.
2. S2-B (fallback snippetów) -> `npm run seo:generate-citable` +
   `npm run seo:generate-strategic-content` + `node scripts/seo/build-blog-index.mjs` -> audyt.
3. S2-C (override „best apps”) -> regeneracja jak wyżej.
4. S2-D (comparisonPages + sekcja „when NOT” + FAQ) -> `npm run seo:generate-citable`.
5. Podwójna regeneracja i `git diff` — musi być pusty (test determinizmu).
6. S2-E: `--write-baseline`, wpisanie liczb, `docs/llm-context.md`, pamięć projektu.
7. `bunx tsgo --noEmit -p tsconfig.app.json` (skrypty to .mjs, ale `seoMeta.ts` może się
   zmienić przy S2-C).

## Definition of Done

- `audit-duplicate-meta` zielony przy nowym, niższym baseline; `duplicatePages` = 0.
- Żaden prerenderowany snapshot nie ma dwóch tagów description / og:description —
  egzekwowane w `validateCompletedSnapshotSet()`.
- Zero stron z frazami „reference”, „evidence-led planning”, „non-school-like framing” w meta.
- 14 stron `edooqoo-vs-*` ma unikalny snippet, sekcję „When NOT to choose Edooqoo” i FAQPage.
- Podwójna regeneracja daje pusty `git diff`.
- `docs/llm-context.md` i pamięć projektu zaktualizowane.

## Pomiar

Kontrolny odczyt GSC 14 i 28 dni po deployu, porównanie do
`docs/seo/runs/gsc-performance/baseline-2026-08-16.json`. Metryki sukcesu Sprintu 2:
CTR 131 tras prerenderowanych (dziś serwują opis strony głównej) oraz CTR klastra
`edooqoo-vs-*` (dziś 0,22% przy poz. 5,8 — cel >2%).

## Poza zakresem Sprintu 2 (Sprint 3 i 4)

Huby klastrowe (CEFR assessment, Pronunciation, Exercise design, Tutor operations),
przepisanie `llms.txt` pod GEO, bloki cytowalne, pętla pomiaru AI-visibility, zmiany
mobile-first w layoutach, hreflang i lokalizacja PL/BR/IT.