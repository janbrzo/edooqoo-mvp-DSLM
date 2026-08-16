# Plan v6.9.93 — GSC-Driven SEO/GEO Recovery (90 dni: 184 → 1500+ klików/mies.)

## Diagnoza — potwierdzona w kodzie, nie zgadywana

Dane GSC (2026-05-15 → 2026-08-14): 184 kliki / 9 020 wyświetleń / CTR 2,0% / poz. 14,2.
441 URL-i rankuje, klik zdobywa ~40. To **nie jest problem rankingów — to problem snippetów**.

Weryfikacja w plikach projektu (przeczytana przed napisaniem planu):

- **137 stron w `public/` ma IDENTYCZNY meta description**: „…: adult 1:1 English tutor
  reference with Edooqoo workflow links, teacher review, evidence-led planning, and
  non-school-like framing." Google widzi 137 klonów.
- **381 tytułów ma wzorzec `Slug Title Case | Edooqoo`** — tytuł = slug. Zero korzyści,
  zero liczby, zero persony. Przykład najdroższy: `/blog/digital-homework-tools-esl-teachers.html`
  stoi na **pozycji 4,35 i ma 0 klików** (Strony.csv, 51 wyśw.) — na poz. 4 zero klików jest
  możliwe wyłącznie przy złym tytule/opisie.
- `public/llms.txt` = 17 KB, `docs/llm-context.md` = 341 KB (za duży do retrievalu),
  sitemap = 548 URL-i.
- `src/data/pseoIndexPolicy.json` = 10 topics × 10 personas (polityka już zawężona).

**Root cause #1 (CTR 2% na poz. 14):** treść generowana szablonowo dostała też szablonowe
metadane — snippet nie zawiera żadnego powodu do kliknięcia dla nauczyciela.

**Root cause #2 (US: 3 965 wyśw., CTR 0,4% vs PL 10,9%):** w US rankujemy głównie klastrem
„best apps … 2026" (intencja **ucznia**, 1 422 wyśw. / 1 klik na
`/blog/best-apps-learning-english-2026.html`) — pokazujemy tutorską stronę osobie szukającej
aplikacji dla siebie. Intent mismatch, nie problem jakości.

## Zakres — 5 faz

### Faza 1 — CTR Recovery Sprint (bez nowych treści, największe ROI)

1. Przepisać title + meta dla **15 stron striking-distance** (poz. 4–13, ≥30 wyśw., CTR <2%):
   intonation-stress (309 wyśw., poz. 10,8), modal-verbs-worksheets-esl (187 / 7,7),
   fill-in-the-blanks (112 / 12,8), diagnostic-testing (110 / 10,4), minimal-pairs (86 / 10,0),
   how-to-create-grammar-worksheets-with-ai (81 / 13,7), error-correction (63 / 12,4),
   cloze-test-design (60 / 8,7), `/features/flashcards` (59 / 9,6), cambridge-exam-prep (54 / 17,1),
   digital-homework-tools (51 / **4,35**), esl-speaking-assessment-rubric (42 / 8,9),
   accent-reduction (41 / 9,6), using-films (41 / 12,8), teaching-future-tenses (35 / 9,5).
   Reguła: ≤60 znaków, keyword na początku, liczba lub konkret („7 minimal-pair drills…"),
   meta ≤155 znaków kończący się akcją tutora. Zero słowa „reference".
2. Zabić szablon: nowy `scripts/seo/audit-duplicate-meta.mjs` failuje CI, gdy >3 strony
   dzielą ten sam meta description lub gdy title jest dosłownym slugiem w Title Case.
3. Strony statyczne edytujemy w `public/**/*.html`; strony React (`/features/flashcards`,
   `/tools/vocab-cefr-checker`, `/esl-worksheets`) przez `src/constants/seoMeta.ts` + `PageSeo`.

Oczekiwany efekt: CTR 2,0% → 4,5–5% przy tych samych pozycjach ≈ +200–250 klików/mies.

### Faza 2 — Intent realignment (naprawa przecieku US)

- **Klaster „best apps … 2026"** (≈900 wyśw., 0 klików): nie kasujemy. Re-angle na
  „Best English Learning Apps 2026 — What to Recommend to Adult 1:1 Students (and What to
  Do in the Lesson Instead)". Nad foldem tabela porównawcza aplikacji + sekcja „what the app
  can't do: assess, personalise, review homework" → CTA do `/esl-worksheets`.
- **Kids cluster** (`esl-games-for-kids.html`, poz. 31–55 na `esl games for kids`, `esl kids`):
  łamie pozycjonowanie „adults only" → `noindex,follow` + przekierowanie linkowania
  wewnętrznego na `/blog/esl-games-for-teachers`. Z pozycji 46 i tak nie ma ruchu.
- Każda utrzymana strona learner-intent dostaje jeden tutorski CTA path
  (`/esl-worksheets` lub `/signup`).

### Faza 3 — 4 klastry topical authority (tylko popyt widoczny w CSV)

| Hub | Spokes istniejące | Lejek do narzędzia |
|---|---|---|
| CEFR assessment | diagnostic-testing, how-to-assess-english-level-cefr, how-to-give-english-level-test | `/tools/vocab-cefr-checker` (12 klików, 276 wyśw.), `/features/placement-test` (10 klików, 308 wyśw.) |
| Pronunciation & phonology | intonation-stress, minimal-pairs, connected-speech (7 klików), IPA, accent-reduction | `/esl-worksheets` (audio exercise types) |
| Exercise design | cloze, fill-in-the-blanks, sentence-transformation, word-formation | worksheet generator |
| Tutor operations | digital-homework-tools, progress-reports, substitute-plans, one-to-one lesson plans | `/features/homework` |

Dla każdego huba: nowa strona w `src/pages/seo/` (wzorzec `SeoLandingLayout`), mapa
linkowania wewnętrznego z konkretnym anchor textem, wpis w `seoMeta.ts` + `sitemap.xml`.

### Faza 4 — Warstwa GEO/AEO (efekt złożony)

- **Citation-shaped queries już są w danych**: `"stressed syllables occur at roughly regular
  intervals"` (111+21+5 wyśw., poz. ~9), `"good girl" /gʊg gɜːl/ assimilation` (20 wyśw., poz. 6,6).
  To LLM-y i ludzie weryfikujący konkretne zdanie. Każdy hub dostaje **citation block**:
  definicja 40–60 słów, tabela porównawcza, 3 pary Q&A sformułowane jak prompt do chatbota.
- `public/llms.txt` — przepisany na gęsty indeks faktów (produkt, 29 typów ćwiczeń, DSLM,
  ceny, dla kogo NIE jest). `docs/llm-context.md` (341 KB) rozbić na katalog
  `docs/llm-context/` + slim `index.md` ≤ 20 KB — obecny rozmiar jest nieretrievalny.
- Schema: FAQPage (huby), HowTo (workflow), SoftwareApplication (`/`, `/pricing`),
  LearningResource (pSEO), BreadcrumbList. **AggregateRating zakazany** — brak realnych recenzji.
- Pętla pomiaru: 25 seed promptów (ChatGPT/Gemini/Perplexity), cykl miesięczny, wyniki do
  `docs/seo/runs/ai-search/`.

### Faza 5 — Mobile, geo, conquest, higiena

- **Mobile**: CTR 5,21% @ poz. 8,84 vs desktop 1,67% @ 14,91. Nad foldem na hubach blok
  odpowiedzi (40–60 słów) + sticky CTA; budżet LCP <2,5 s, CLS <0,1.
- **Geo**: PL/BR/IT/FR/EG mają CTR 7–11% przy małym wolumenie — zostajemy przy angielskim,
  **bez hreflang** (za wcześnie); decyzję o lokalizacji odkładamy do progu 500 wyśw./kraj.
- **Conquest**: `/edooqoo-vs-islcollective.html` = 447 wyśw., poz. 5,8, 1 klik. Nowy szablon
  porównania z sekcją „When NOT to choose Edooqoo" (to cytują LLM-y), zastosowany do
  wszystkich 8 stron `edooqoo-vs-*`.
- **Higiena pSEO**: sitemap 548 URL-i vs 441 rankujących — zaostrzenie `pseoIndexPolicy.json`
  (`noindex,follow` dla kombinacji bez unikalnych kryteriów decyzyjnych) i egzekwowanie przez
  `scripts/seo/audit-pseo-index-policy.mjs`.

## Szczegóły techniczne

Pliki dotykane: `public/**/*.html` (title/meta/schema), `src/constants/seoMeta.ts`,
`src/pages/seo/*` (4 nowe huby), `src/App.tsx` (lazy routes), `public/sitemap.xml`,
`public/llms.txt`, `docs/llm-context*`, `src/data/pseoIndexPolicy.json`,
`scripts/seo/audit-duplicate-meta.mjs` (nowy), `docs/seo/keyword-strategy.md`.

Nie dotykamy: silnika generowania worksheetów (protected IP), Supabase, edge functions,
schematu bazy. Zero nowych tabel, zero zmian w logice biznesowej.

## Guardrails — czego świadomie NIE robimy

- Nie gonimy head terma `esl` (110k/mies., zero różnicowania komercyjnego).
- Nie tworzymy treści dla dzieci ani dla uczniów-samouków (łamie Martha Test).
- Nie rozdmuchujemy pSEO — zawężamy indeksowanie zamiast dodawać URL-e.
- Nie dodajemy zmyślonych recenzji ani AggregateRating.
- Nie ruszamy worksheet engine.

## Kolejność wdrożenia

- **Sprint 1** = Faza 1 (CTR recovery: 15 stron + audit script) — najszybszy zwrot.
- **Sprint 2** = Faza 2 + 5 (intent realignment, conquest, higiena pSEO).
- **Sprint 3** = Faza 3 (4 huby klastrowe).
- **Sprint 4** = Faza 4 (GEO/AEO + pętla pomiaru).