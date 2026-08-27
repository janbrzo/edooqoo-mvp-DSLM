# P0.1 — Silnik walidacji odpowiedzi (matchAnswer)

## Co ustaliłem w kodzie (fakty, nie domysły)

Walidacja odpowiedzi tekstowych jest dziś **rozsypana po komponentach** i istnieje w **dwóch niezależnych implementacjach**, które potrafią dać różny wynik dla tej samej odpowiedzi:

**Ścieżka A — warstwa wizualna (co widzi uczeń/nauczyciel).** Każde ćwiczenie liczy poprawność u siebie:

| Plik | Obecna logika |
|---|---|
| `ExerciseFillInBlanks.tsx:107` | jedyny używa `answersMatch()` z `src/utils/textNormalization.ts` |
| `ExerciseFillInBlanksAudio.tsx:106` | `toLowerCase().trim()` |
| `ExerciseGapText.tsx:74,110` | `toLowerCase().trim()`, warianty rozbijane tylko po `/` |
| `ExerciseCompleteWord.tsx:46` | `toLowerCase().trim()` |
| `ExerciseNegativePrefixes.tsx:43` | `toLowerCase().trim()` |
| `ExerciseSentenceTransformation.tsx:40` | `toLowerCase().trim()` |
| `ExerciseErrorCorrection.tsx:75` | `toLowerCase().trim()` |
| `ExerciseAnswerQuestions.tsx:141` | brak walidacji — pokazuje „Suggested answer” (poprawnie, zostaje) |
| `ExerciseParaphrasing.tsx` | brak walidacji (otwarte) — zostaje |

**Ścieżka B — `src/utils/masteryCalculator.ts` (co trafia do DSLM).** To druga, całkowicie odrębna implementacja tych samych porównań (linie 259, 265, 297, 306, 315, 337, 345, 366, 376, 385) — również `toLowerCase().trim()`. Jej wynik to `100` albo `0` i zasila `calculateItemMastery` → `calculateOverallMastery` → oceny mastery ucznia.

**Root cause:** brak jednego kontraktu poprawności. Poprawność jest liczona ad hoc w miejscu renderowania, przez ścisłe równość stringów, a drugi raz — innym kodem i **innymi kluczami danych** — w kalkulatorze mastery.

**Trzy konkretne konsekwencje, które zgłosili nauczyciele:**

1. **Fałszywe „źle”.** `don't` vs `do not`, kropka na końcu, typograficzny apostrof `’`, podwójna spacja, `A OR B` w kluczu odpowiedzi, sentinel „This sentence is correct” — wszystko to dziś wypada na czerwono.
2. **Rozjazd UI ↔ DSLM.** `ExerciseErrorCorrection` czyta klucz `sentence.answer`, a `masteryCalculator:342` czyta `sentence.correct || sentence.corrected || sentence.correct_sentence || sentence.correction` — czyli ten sam item może być zielony w UI i `0` w mastery (albo `null`).
3. **Brak stanu pośredniego.** System zna tylko `true`/`false`. Nie ma sposobu, by powiedzieć „nie jestem pewien — do decyzji nauczyciela”.

## Zasada bezpieczeństwa tej zmiany

Nowy matcher jest **wyłącznie łagodniejszy** od obecnego: każda odpowiedź uznana dziś za poprawną pozostaje poprawna. Zmiana może przenieść item tylko z `wrong` → `correct` lub `wrong` → `review`. Nigdy odwrotnie. Dzięki temu żaden istniejący wynik mastery nie spadnie.

## Rozwiązanie

### 1. Nowy moduł `src/lib/answers/matchAnswer.ts`

Jedno publiczne API:

```ts
export type MatchVerdict = 'correct' | 'review' | 'wrong' | 'empty';

export interface MatchResult {
  verdict: MatchVerdict;
  matchedVariant?: string;   // wariant klucza, który zadziałał
  reason?: string;           // 'exact' | 'normalized' | 'contraction' | 'variant' | 'sentinel' | 'near'
  acceptedAnswers: string[]; // wszystkie warianty do wyświetlenia
}

export function matchAnswer(
  studentAnswer: unknown,
  correctAnswer: unknown,
  options?: {
    sourceSentence?: string;      // dla sentinela „This sentence is correct”
    mode?: 'word' | 'sentence';   // word = pojedyncze słowo/prefix, sentence = pełne zdanie
    caseSensitive?: boolean;      // domyślnie false
  }
): MatchResult;

export function isAnswerCorrect(...): boolean;      // adapter zgodności wstecznej
export function splitAnswerVariants(raw: string): string[];
```

Warstwy porównania, w kolejności:

1. **Pusto** → `empty` (żadnego koloru, tak jak dziś).
2. **Normalizacja:** lowercase, trim, kolaps białych znaków, apostrofy typograficzne `’‘` → `'`, cudzysłowy `“”` → `"`, myślniki `–—` → `-`, usunięcie końcowej interpunkcji `.?!,;:` (tylko na końcu, nie w środku).
3. **Warianty klucza:** rozbicie po ` OR `, ` / `, `;`, `|` oraz nawiasach opcjonalnych `he (has) gone` → `he has gone` + `he gone`. Każdy wariant testowany osobno.
4. **Skrócenia:** dwustronna ekspansja/kontrakcja na słowniku (`don't↔do not`, `isn't↔is not`, `I'm↔I am`, `won't↔will not`, `it's↔it is`, `'ll/'ve/'re/'d`). Porównanie po sprowadzeniu obu stron do formy rozwiniętej.
5. **Sentinel:** jeśli klucz to jedna z fraz `this sentence is correct` / `no error` / `correct as is` / `no mistake`, to za poprawne uznajemy również powtórzenie `sourceSentence` (po normalizacji) oraz `ok`/`correct`/`no error`.
6. **Near-match → `review`:** jeżeli nic nie pasuje, liczymy dystans Levenshteina do najbliższego wariantu. Dla `mode: 'word'` próg to `<= 1` znak przy słowie ≥ 4 znaków; dla `mode: 'sentence'` próg to znormalizowany dystans `<= 15%` długości **lub** identyczny zbiór słów w innej kolejności. Trafienie → `review`.
7. W pozostałych przypadkach → `wrong`.

Moduł jest czysty (bez importów Reacta), w pełni testowalny.

`src/utils/textNormalization.ts` zostaje na miejscu; jego `answersMatch` staje się cienkim wrapperem na `matchAnswer(...).verdict === 'correct'`, żeby nie łamać innych importów.

### 2. Jeden wspólny komponent statusu

`src/components/worksheet/AnswerStatusBadge.tsx` — renderuje trzy stany zamiast dwóch:

- `correct` → zielony `✓ Correct` (bez zmian względem dziś)
- `review` → **żółty** `● Needs teacher review` + w nawiasie oczekiwana odpowiedź
- `wrong` → czerwony `✗ (klucz)`

Kolory z tokenów semantycznych (`text-success`, `text-warning`, `text-destructive`), bez hardkodowanych klas. Pola input dostają odpowiadające obramowanie żółte dla `review`.

### 3. Podpięcie do ćwiczeń

Podmiana lokalnego porównania na `matchAnswer` + `AnswerStatusBadge` w:
`ExerciseErrorCorrection` (`mode: 'sentence'` + `sourceSentence`), `ExerciseSentenceTransformation` (`sentence`), `ExerciseGapText` (`word`, per-blank), `ExerciseCompleteWord` (`word`), `ExerciseFillInBlanks` (`word`), `ExerciseFillInBlanksAudio` (`word`), `ExerciseNegativePrefixes` (`word`), `ExerciseWordOrder` (`sentence`).

`ExerciseAnswerQuestions` i `ExerciseParaphrasing` pozostają otwarte (ocena AI/nauczyciela) — zmieniamy w nich tylko opis na „Suggested answer”, żeby uczeń nie czytał tego jako jedynej poprawnej wersji.

### 4. Uspójnienie z DSLM (`masteryCalculator.ts`)

- Wszystkie porównania tekstowe w `calculateItemMastery` przechodzą na `matchAnswer`.
- Ujednolicenie kluczy danych: dla `error-correction` czytamy **ten sam** łańcuch fallbacków co UI (`sentence.answer || sentence.correct || sentence.corrected || sentence.correct_sentence || sentence.correction`). To likwiduje rozjazd UI↔DSLM.
- **Mapowanie werdyktu na mastery:** `correct` → `100`, `wrong` → `0`, **`review` → `null`** (item nie wchodzi do średniej, dokładnie tak jak dziś „nie da się ustalić”). Zgodne z regułą, że niepewne dane nie psują precyzyjnych wyników mastery.

### 5. Testy

`src/lib/answers/__tests__/matchAnswer.test.ts` — tabela ~60 przypadków: kontrakcje w obie strony, apostrof typograficzny, końcowa kropka, `A OR B`, `a/b`, nawiasy opcjonalne, sentinel z powtórzeniem zdania, literówka 1-znakowa (→ review), zamieniona kolejność słów (→ review), realnie zła odpowiedź (→ wrong), pusta (→ empty). Plus test regresyjny: dla zestawu par, które dziś zwracają `true`, nowy matcher też zwraca `correct`.

## Pliki

**Nowe:** `src/lib/answers/matchAnswer.ts`, `src/lib/answers/contractions.ts`, `src/lib/answers/__tests__/matchAnswer.test.ts`, `src/components/worksheet/AnswerStatusBadge.tsx`

**Modyfikowane:** `src/utils/textNormalization.ts`, `src/utils/masteryCalculator.ts`, oraz 8 komponentów ćwiczeń wymienionych w pkt. 3

**Nietykane:** silnik generowania worksheetów (prompty, pipeline), ścieżka ocen AI dla ćwiczeń otwartych, RLS/schema bazy

## Weryfikacja przed zamknięciem

1. `bunx vitest run src/lib/answers` — wszystkie przypadki zielone.
2. Test regresyjny „nigdy surowiej niż dziś”.
3. Smoke w przeglądarce na worksheecie z error-correction + gap-text: wpisanie `don't` przy kluczu `do not` → zielone; literówka → żółte „Needs teacher review”; bzdura → czerwone.
4. Sprawdzenie, że dla itemu `review` mastery nie zapisuje `0`.
