## Diagnoza problemów

### Problem 1 — "Auto-apply did not complete"
**Przyczyna:** Wynik Wiktorii powstał ZANIM wdrożyliśmy auto-apply (v6.9.29). Jej `student_tests.status = 'completed'`, dlatego UI pokazuje żółty banner. Auto-apply uruchamia się tylko podczas `process-welcome-test` — historyczne testy nie zostały reprocessowane. To NIE jest bug w nowych testach (Johny ma `reviewed` — bez bannera), ale UX dla starych testów jest mylący i wymaga jednego z dwóch działań:
- ręcznego kliknięcia "Apply to Progress" (działa, ale niewygodne), albo
- backfillu: jednorazowo wywołać auto-apply dla wszystkich starych testów ze statusem `completed`.

**Decyzja:** zrobimy obie rzeczy — UI bez zmian (fallback nadal potrzebny na wypadek przyszłych awarii AI), + jednorazowy backfill który przeprocesuje istniejące `completed` testy.

### Problem 2 — "58/54 answered"
**Przyczyna:** `student_tests.total_questions` zapisywane jest w momencie tworzenia testu (DB row Wiktorii ma 54). Później dodaliśmy nowe pytania do `ALL_WELCOME_TEST_QUESTIONS` (jest ich 58) i seedują się do `student_test_questions`, ale stara wartość `total_questions = 54` została. Stąd `58/54`.

**Decyzja:** 
- Frontend: zawsze używać `Math.max(answered_count, total_questions)` lub `questions.length` (rzeczywista liczba zseedowanych pytań) jako mianownika.
- Migracja jednorazowa: `UPDATE student_tests SET total_questions = (SELECT COUNT(*) FROM student_test_questions WHERE test_id = student_tests.id) WHERE test_type='welcome'`.

### Problem 3 — Brak dat utworzenia/wypełnienia
**Stan:** Tabela `student_tests` ma `created_at`, `started_at`, `completed_at`, `reviewed_at`. Karty w `StudentTestsTab.tsx` i nagłówek w `TestDetailsView.tsx` nie wyświetlają żadnej z nich.

**Decyzja:** Dodać dwie linie w trzech miejscach:
- Welcome Test card (linia ~282): pod opisem dodać `Created: dd Mmm yyyy · Completed: dd Mmm yyyy` (lub "—" jeśli null).
- `TestCard` (linia ~379): analogicznie.
- `TestDetailsView` header (linia ~267): w `<p className="text-muted-foreground">` po opisie dodać linijkę z datami.

Format: `format(date, 'dd MMM yyyy, HH:mm')` z `date-fns` (już używane w projekcie).

### Problem 4 — Listening: "—" zamiast %
**Przyczyna:** W `WelcomeTestResults.tsx` (linia 217) Listening ma `profileKey: null, useAiScore: false`. Jeśli `test_skill_results` nie zawiera wiersza dla listening (np. uczeń pominął pytanie audio lub agregacja nie powstała), wyświetla się "—". Confidence (1-5) niżej działa, bo to oddzielne dane (`profile.confidence_listening` z Q44).

**Decyzja:** W `WelcomeTestResults.tsx`:
1. Dla listening (i dla wszystkich skill rows): jeśli brak `test_skill_results`, policz na bieżąco z `student_test_questions` filtrując `element_type='listening'` i licząc `is_correct === true / total z odpowiedziami`. Wymaga przekazania `questions` propem (już jest w `TestDetailsView`).
2. Jeśli element istnieje w teście ale ZERO odpowiedzi → wyświetlić chip "Skipped" zamiast "—".
3. Jeśli elementu w teście brak → ukryć wiersz (brak pomiaru = brak danych).

To wymaga drobnego refactoru: `WelcomeTestResults` musi dostać `questions` (np. przez prop lub osobny query).

### Problem 5 — AI Analysis odwołuje się do "q3c", "q45"
**Przyczyna:** Prompt w `process-welcome-test/index.ts` (linia 935-968) jawnie pozwala AI cytować `wt_q3c`, `wt_q45` itd. To są ID systemowe — nauczyciel widzi numery sekwencyjne 1-58.

**Decyzja:** dwuwarstwowa naprawa:
1. **Prompt (twarda zasada):** dodać instrukcję: *"NEVER mention question IDs (wt_qXX, q3c, q45, etc.) in summary, recommendations, or key_observations. Refer to questions by topic only (e.g. 'the latent-goal scenario', 'the homework-commitment question'). per_question_scores keys still use wt_qXX format — that is the only place IDs are allowed."*
2. **Sanitizer (bezpiecznik):** w `WelcomeTestResults.tsx` (lub w funkcji renderującej AI summary) przed wyświetleniem usuń regexem `\b(wt_)?q\d+[a-z]?\b` zastępując pustą stringiem oraz wyczyść podwójne spacje / dangling "in ", "from " (najprostszy regex: zamienić "in q3c" / "from q45" / "(q3c)" na "in this scenario" / pusty).

Najczystsze: prompt wystarczy w 95% przypadków, a sanitizer to safety net dla starych rekordów (które już są w DB i nie chcemy ich reprocessować dla samego tekstu).

### Problem 6 — Tłumaczenia
**Realny stan:** sprawdziłem plik `welcomeTestTranslations.ts` — z **58 unikalnych ID pytań** przetłumaczone są **tylko 29**. Brakuje:
```
wt_q3c, wt_q5c, wt_q7b, wt_q13c, wt_q16s, wt_q18, wt_q18l, wt_q19,
wt_q20, wt_q21, wt_q22, wt_q23, wt_q24, wt_q25, wt_q26, wt_q27, wt_q28,
wt_q29, wt_q30, wt_q31, wt_q32, wt_q33, wt_q34, wt_q35, wt_q36s, wt_q37,
wt_q38, wt_q39, wt_q41s
```
To 29 ID × 10 języków = 290 pełnych bloków do dodania. UWAGA: część z nich to pytania ściśle testowe (gramatyka/słownictwo) których nie tłumaczymy z założenia (komentarz na początku pliku: *"Grammar/vocabulary test items are NOT translated"*). Należy oddzielić:
- **Profilowe (TŁUMACZYĆ):** `wt_q3c, wt_q5c, wt_q7b, wt_q13c, wt_q37, wt_q38, wt_q39` (scenariusze i refleksje).
- **Skill (NIE TŁUMACZYMY treści, ale możemy dodać samo `description` — instrukcję typu "Choose the correct answer"):** `wt_q18-q35` (grammar/vocab MC), `wt_q16s, wt_q36s, wt_q41s` (speaking — prompt tłumaczymy, bo to instrukcja co powiedzieć), `wt_q18l` (listening — instrukcję tłumaczymy, audio NIE).

**Decyzja:** dodać tłumaczenia w dwóch turach:
1. **Tura A (profilowe, pełne):** 7 pytań × 10 języków = 70 bloków (question + options + description).
2. **Tura B (instrukcje do skill):** dla każdego skill question dodajemy tylko `description` w 10 językach (instrukcja typu "Wybierz prawidłową odpowiedź", "Posłuchaj nagrania i odpowiedz", "Nagraj swoją odpowiedź"). To NIE jest tłumaczenie testu, tylko pomoc proceduralna.

## Plan implementacji (kolejność wykonania)

### Krok 1 — Migracja DB (jednorazowa)
```sql
UPDATE public.student_tests
SET total_questions = sub.cnt
FROM (
  SELECT test_id, COUNT(*)::int AS cnt
  FROM public.student_test_questions
  GROUP BY test_id
) sub
WHERE sub.test_id = public.student_tests.id
  AND test_type = 'welcome'
  AND (total_questions IS NULL OR total_questions <> sub.cnt);
```
Naprawia rozjazd 58/54 dla istniejących rekordów. Brak zmian schematu.

### Krok 2 — Backfill auto-apply dla historycznych testów
Nowa funkcja jednorazowa `backfill-welcome-test-auto-apply` (edge function, secured `x-cron-secret`). Logika:
1. Wybiera wszystkie `student_tests WHERE test_type='welcome' AND status='completed' AND deleted_at IS NULL` (limit 50/run, paginacja po `created_at`).
2. Dla każdego wywołuje wewnętrznie ten sam pipeline co `process-welcome-test` (refaktor: wyciągnąć funkcję `applyResultsToProgress(testId)` z `process-welcome-test/index.ts` do shared modułu).
3. Po sukcesie ustawia `status='reviewed', reviewed_at=now()`.
4. Loguje błędy do `error_logs` (severity='warning').

Uruchamiamy ręcznie raz przez SQL Editor (`select net.http_post(...)`). Nie dodajemy crona — to jednorazówka.

### Krok 3 — Frontend: total_questions consistency
Pliki: `src/components/student-tests/StudentTestsTab.tsx`, `src/components/student-tests/TestDetailsView.tsx`.
- Wprowadzić helper `getTotal(test) = Math.max(test.answered_count ?? 0, test.total_questions ?? 0)` w `src/utils/welcomeTestNumbering.ts`.
- Podmienić wszystkie miejsca wyświetlające `{x}/{total_questions}`.
- W `TestDetailsView` zachować `questions.length` (już jest źródłem prawdy dla widoku szczegółów).

### Krok 4 — Frontend: daty utworzenia/wypełnienia
Nowy komponent `src/components/student-tests/TestDates.tsx`:
```tsx
export function TestDates({ createdAt, completedAt, reviewedAt }: Props) {
  // wyświetla "Created: dd MMM yyyy · Completed: dd MMM yyyy" / "—"
  // używa date-fns format
}
```
Wpięcie:
- `StudentTestsTab.tsx` linia ~287 (Welcome card) i linia ~381 (TestCard).
- `TestDetailsView.tsx` linia ~268 (pod opisem).

### Krok 5 — Listening: spójność danych
`src/components/student-tests/WelcomeTestResults.tsx`:
1. Dodać prop `questions: StudentTestQuestion[]` przekazywany z `TestDetailsView`.
2. Helper `computeSkillFromQuestions(questions, elementType)` → zwraca `{score, correct, total, attempted}`.
3. Dla wiersza Listening (i fallback dla pozostałych): jeśli brak `test_skill_results`, fallback do helpera.
4. Render reguły:
   - `attempted > 0` → `{score}% ({correct}/{total})`,
   - `total > 0 && attempted == 0` → chip `Skipped`,
   - `total == 0` → ukryj wiersz.

### Krok 6 — AI Analysis bez ID w tekście
1. **Prompt update** w `supabase/functions/process-welcome-test/index.ts` (linie ~935-968):
   - Dodać blok `OUTPUT RULES`: *"NEVER reference question IDs (e.g. wt_q3, q3c, q45) in `summary`, `recommendations`, or `key_observations`. Use topical paraphrases ('the latent-goal scenario', 'the homework-commitment scenario', 'the optional external-resources question'). IDs are allowed ONLY as keys inside `per_question_scores`."*
   - W przykładach existujących (q3c, q5c, q13c, q7b) zmienić tekst objaśniający tak, by nie sugerował AI cytowania ID.
2. **Sanitizer (runtime, frontend):** nowy util `src/utils/sanitizeAiSummary.ts`:
   ```ts
   const ID_RE = /\b(?:in |from |\()?(?:wt_)?q\d+[a-z]?\)?/gi;
   export const sanitizeAiText = (s: string) => s.replace(ID_RE, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
   ```
   Zastosować w `WelcomeTestResults.tsx` przed renderowaniem `summary`, `recommendations[]`, `key_observations[]`.

### Krok 7 — Tłumaczenia (Tura A: profilowe)
Rozszerzenie `src/data/welcomeTestTranslations.ts` o 7 ID × 10 języków:
- `wt_q3c` (latent goal scenario — "wake up 2 years from now")
- `wt_q5c` (homework commitment scenario)
- `wt_q7b` (correction preference)
- `wt_q13c` (plateau response)
- `wt_q37` (open reflection)
- `wt_q38` (preference choice)
- `wt_q39` (preference choice)

Treść każdego: `question`, `options[]`, `description?` — kopiowane z `welcomeTestQuestions.ts` i tłumaczone przez AI Gateway (`google/gemini-2.5-flash`, jednorazowy skrypt `scripts/translate-welcome-test.ts` z weryfikacją wizualną). 10 języków: PL, ES, DE, FR, PT, IT, TR, RU, CS, UK.

### Krok 8 — Tłumaczenia (Tura B: instrukcje skill questions)
Dla 22 skill ID dodajemy tylko `description` (instrukcja):
- Grammar/Vocabulary MC (`wt_q18..wt_q35`): "Wybierz prawidłową odpowiedź" / equivalent.
- Listening (`wt_q18l`): "Posłuchaj nagrania i wybierz prawidłową odpowiedź. Treść audio pozostaje po angielsku."
- Speaking (`wt_q16s, wt_q36s, wt_q41s`): tłumaczenie polecenia + uwaga "Nagraj odpowiedź po angielsku."

Treść `question` skill items pozostaje po angielsku (zgodnie z istniejącą zasadą — testujemy znajomość angielskiego).

### Krok 9 — Dokumentacja RAG
Zaktualizować zgodnie z formułą `Problem → Edooqoo Solution → Technical Mechanics`:
- `docs/llm-context.md` — sekcje:
  1. Welcome Test Auto-Apply Backfill (Problem: legacy completed tests; Solution: backfill function; Mechanics: edge fn + shared `applyResultsToProgress`).
  2. total_questions Consistency (Problem: rozjazd seed/DB; Solution: migracja + frontend helper).
  3. Test Card Timestamps (Problem: brak dat; Solution: komponent TestDates).
  4. Listening Score Fallback (Problem: pusta wartość; Solution: compute z questions).
  5. AI Analysis ID-Free Output (Problem: cytowanie ID; Solution: prompt rule + sanitizer).
  6. Welcome Test Translation Coverage (Problem: 29 brakujących ID; Solution: Tura A profilowych + Tura B instrukcji).
- `llms.txt` — analogicznie, krótsze entries.
- `mem/features/welcome-test/auto-apply-and-brain-reset.md` — uzupełnić o backfill i sanitizer; dodać sekcję `RAG Keywords`.

## Pliki do zmiany / dodania

```text
NEW    supabase/functions/backfill-welcome-test-auto-apply/index.ts
NEW    supabase/functions/_shared/applyWelcomeTestResults.ts   (wyciągnięte z process-welcome-test)
EDIT   supabase/functions/process-welcome-test/index.ts        (prompt + import shared)
NEW    supabase/migrations/<ts>_backfill_welcome_total_questions.sql

NEW    src/utils/sanitizeAiSummary.ts
NEW    src/components/student-tests/TestDates.tsx
EDIT   src/components/student-tests/StudentTestsTab.tsx        (TestDates + helper getTotal)
EDIT   src/components/student-tests/TestDetailsView.tsx        (TestDates + przekazanie questions)
EDIT   src/components/student-tests/WelcomeTestResults.tsx     (listening fallback + sanitizer)
EDIT   src/utils/welcomeTestNumbering.ts                       (helper getTotal)

EDIT   src/data/welcomeTestTranslations.ts                     (Tura A + Tura B, 10 języków)
NEW    scripts/translate-welcome-test.ts                       (jednorazowy generator tłumaczeń przez AI)

EDIT   docs/llm-context.md
EDIT   llms.txt
EDIT   mem/features/welcome-test/auto-apply-and-brain-reset.md
EDIT   mem/index.md
```

## Co użytkownik wykona ręcznie po implementacji
1. Uruchomi SQL w Supabase SQL Editor: `select net.http_post(... 'backfill-welcome-test-auto-apply' ...)` z `x-cron-secret` (instrukcja w komentarzu migracji).
2. Otworzy stary test (Wiktoria) i potwierdzi że banner zmienił się na zielony "Results automatically applied".
3. Otworzy uczniów z różnymi językami i sprawdzi wizualnie tłumaczenia nowych pytań.

## Co NIE wchodzi w zakres
- Reprocessing AI Analysis dla starych testów (drogie, niepotrzebne — sanitizer ukryje ID).
- Tłumaczenie treści gramatyczno-słownikowej skill questions (świadoma decyzja produktowa).
- Zmiany w prompt'cie generującym worksheety (sanctity rule).

## Bezpieczeństwo regresji
- Backfill: idempotentny — sprawdza `status='completed'` przed reprocessingiem.
- Migracja: tylko `UPDATE`, bez zmian schematu, bez wpływu na nowe testy.
- Frontend: helper `getTotal` zwraca starą wartość gdy `answered_count` jest 0, więc nie zepsuje testów `pending`.
- Sanitizer: czysta funkcja string→string, bez wpływu na zapis DB.
- Tłumaczenia: dodawane jako nowe klucze, fallback do EN nadal działa.
