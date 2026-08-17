# Sprint 1 — CTR Recovery (Plan v6.9.93, Faza 1)

Cel: podnieść CTR z 2,0% do 4,5–5% bez zmiany pozycji i bez pisania nowych treści.
Szacunek: +200–250 klików/mies. przy obecnych 9 020 wyświetleniach.
Zero zmian w logice biznesowej, bazie i silniku worksheetów.

## Ustalenie krytyczne przed startem

Sprawdziłem, skąd biorą się metadane. Większość stron blogowych jest generowana skryptami,
a workflow `.github/workflows/seo-integrity.yml` regeneruje je przy każdym PR:

- `scripts/seo/x1000-editorial-plan.mjs`, funkcja `articleSpec()` (ok. linii 111), ma zaszyty
  szablon opisu "TITLE: adult 1:1 English tutor reference with Edooqoo workflow links…"
  oraz `title = titleFromSlug(slug)`.
- To jest źródło 137 identycznych meta description i 381 tytułów typu "Slug | Edooqoo".
- HTML zapisują `scripts/seo/generate-citable-pages.mjs` i `generate-strategic-content.mjs`.

Wniosek: ręczna edycja `public/blog/*.html` dla stron generowanych zostanie nadpisana przy
pierwszym PR. Naprawę robimy na poziomie generatora. Strony pisane ręcznie
(m.in. `teaching-english-intonation-stress.html`, `teaching-minimal-pairs-esl.html`)
edytujemy bezpośrednio.

## Krok 1 — Odblokowanie generatora

W `scripts/seo/x1000-editorial-plan.mjs`:

1. `articleSpec()` przyjmuje opcjonalne `description`; szablon zostaje wyłącznie jako fallback.
2. Nowy eksport `SEO_TITLE_OVERRIDES` i `SEO_DESCRIPTION_OVERRIDES` — mapy `slug -> string`,
   jedno miejsce prawdy dla ręcznie napisanych snippetów.
3. `articleSpec()` czyta override przed fallbackiem; brak override = zachowanie bez zmian.

Dzięki temu kolejne sprinty dopisują tylko wpisy do mapy, bez dotykania generatora.

## Krok 2 — 15 stron do przepisania (title ≤60 znaków, meta ≤155)

Wybór: pozycja 4–19, ≥35 wyświetleń, CTR poniżej 2,5% (Strony.csv). Typ: G = generowana
(override w mapie), R = ręczna (edycja HTML), SPA = `src/constants/seoMeta.ts`.

| # | Strona | Dane GSC | Typ | Nowy title (propozycja) |
|---|---|---|---|---|
| 1 | blog/teaching-english-intonation-stress | 309 wyśw., poz. 10,8 | R | English Stress & Intonation: 10 Drills for Adults |
| 2 | blog/teaching-collocations-esl | 192 wyśw., poz. 18,9 | R | Teaching Collocations: 10 Activities That Stick |
| 3 | modal-verbs-worksheets-esl | 187 wyśw., poz. 7,7 | R | Modal Verbs Worksheets — 8 Ready ESL Exercise Types |
| 4 | blog/fill-in-the-blanks-exercises-best-practices | 112 wyśw., poz. 12,8 | G | Fill-in-the-Blank Tasks: 7 Rules That Make Them Work |
| 5 | blog/word-formation-exercises-english | 112 wyśw., poz. 11,6 | G | Word Formation Exercises: 60 Prefix & Suffix Prompts |
| 6 | blog/diagnostic-testing-english-learners | 110 wyśw., poz. 10,4 | G | Diagnostic Testing Adult English Learners in 15 Min |
| 7 | blog/teaching-minimal-pairs-esl | 86 wyśw., poz. 10,0 | R | Minimal Pairs: 12 Drills Sorted by Learner's L1 |
| 8 | blog/how-to-create-grammar-worksheets-with-ai | 81 wyśw., poz. 13,7 | G | Create Grammar Worksheets With AI in Under a Minute |
| 9 | blog/error-correction-techniques-esl | 63 wyśw., poz. 12,4 | G | ESL Error Correction: 6 Techniques for 1:1 Lessons |
| 10 | blog/cloze-test-design-esl | 60 wyśw., poz. 8,7 | G | Cloze Tests: Every-Nth-Word vs Rational Deletion |
| 11 | /features/flashcards | 59 wyśw., poz. 9,6 | SPA | Flashcards for Adult Learners — Spaced Repetition |
| 12 | blog/cambridge-exam-preparation-tips-teachers | 54 wyśw., poz. 17,1 | G | Cambridge B2 First & C1 Advanced: Tutor Prep Plan |
| 13 | blog/digital-homework-tools-esl-teachers | 51 wyśw., poz. 4,35, 0 klików | G | Digital Homework Tools for ESL Tutors — 2026 Compared |
| 14 | blog/accent-reduction-activities-esl | 41 wyśw., poz. 9,6 | G | Accent Reduction: 9 Activities for Adult Professionals |
| 15 | blog/using-films-english-teaching | 41 wyśw., poz. 12,8 | R | Using Films in English Lessons: 8 Clip-Based Tasks |

Pozycja 13 to najostrzejszy dowód diagnozy: poz. 4,35 i zero klików jest możliwe wyłącznie
przy snippetcie, który nikogo nie przekonuje.

### Reguły copy (egzekwowane w review)

- Keyword na początku tytułu; liczba lub konkretne rozróżnienie, jeśli jest prawdziwe.
- Bez sufiksu "| Edooqoo" na stronach blogowych — marnuje znaki, Google i tak dokleja brand.
- Meta kończy się akcją tutora, np. "Generate a matching worksheet in one minute."
- Zakazane w meta: "reference", "evidence-led planning", "non-school-like framing".
- Każdy meta unikalny, zero wspólnych zdań między stronami.
- Martha Test: żadnego szkolnego tonu, żadnych dzieci, tylko dorosły uczeń 1:1.

## Krok 3 — Audit script blokujący regresję

Nowy `scripts/seo/audit-duplicate-meta.mjs`, uruchamiany w `seo-integrity.yml` po krokach
generujących. Failuje build, gdy:

1. ten sam meta description występuje na więcej niż 3 stronach w `public/**/*.html`,
2. `<title>` jest dosłownym slugiem przekonwertowanym na Title Case,
3. title przekracza 60 znaków lub meta przekracza 155 znaków,
4. meta zawiera którekolwiek z zakazanych sformułowań.

Raport: `docs/seo/duplicate-meta.generated.md` (lista offenderów + liczby), żeby kolejne
sprinty widziały pozostały dług (dziś: 137 duplikatów, 381 slug-titles).

Próg startowy ustawiamy jako baseline lock — CI ma przejść po Sprintcie 1, a kolejne sprinty
tylko obniżają próg. Inaczej pipeline padnie na 122 stronach, których jeszcze nie tkniemy.

## Krok 4 — Regeneracja i weryfikacja

1. `node scripts/seo/generate-citable-pages.mjs` oraz `npm run seo:generate-strategic-content`
   — sprawdzić, że 11 stron generowanych ma nowe title/meta w wyjściowym HTML.
2. `node scripts/seo/build-blog-index.mjs` — `src/data/blogIndex.ts` i sitemap spójne.
3. `node scripts/seo/audit-duplicate-meta.mjs` — zielone.
4. `tsgo --noEmit` po zmianie w `seoMeta.ts`.
5. Spot-check w przeglądarce: `/features/flashcards` renderuje nowy title przez `PageSeo`.

## Definition of Done

- 15 stron ma unikalny, ręcznie napisany title i meta.
- Żadna zmiana nie ginie po regeneracji: uruchomić generatory dwa razy, `git diff` pusty.
- `audit-duplicate-meta.mjs` wpięty w CI i przechodzi.
- `docs/llm-context.md` i `public/llms.txt` zaktualizowane o zasadę własności metadanych.
- Wpis do pamięci projektu: nie edytować metadanych stron generowanych bezpośrednio w `public/`.

## Pomiar

Baseline z dzisiejszego eksportu zapisujemy do
`docs/seo/runs/gsc-performance/baseline-2026-08-16.json` (CTR i pozycja dla 15 stron).
Odczyt kontrolny po 14 i 28 dniach, porównanie CTR przy pozycji ±1. Jeśli CTR nie drgnie
przy niezmienionej pozycji, przyczyną jest intencja zapytania, nie snippet — strona trafia
do Sprintu 2 (intent realignment).

## Poza zakresem Sprintu 1

Nowe treści, huby klastrowe, przepisanie `llms.txt` na GEO, polityka pSEO, strony
`edooqoo-vs-*`, klaster "best apps 2026", kids content. To Sprinty 2–4.