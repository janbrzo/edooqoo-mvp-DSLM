# Analiza feedbacku dwóch nauczycielek — triage i plan naprawczy

Dwa raporty pilotażowe (`My_feedback.pdf`, `Eqoodoo.pdf`). Poniżej: co jest realnym defektem (potwierdzonym w kodzie), co jest problemem UX/discovery, a co świadomie odrzucamy jako sprzeczne ze strategią produktu.

## Wynik weryfikacji w kodzie (fakty, nie domysły)

| Zarzut | Weryfikacja w kodzie | Werdykt |
|---|---|---|
| Poprawne odpowiedzi oznaczane jako błędne | `ExerciseErrorCorrection.tsx` porównuje `studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()`. Brak obsługi wariantów „A OR B", brak obsługi „This sentence is correct". `answersMatch()` z `src/utils/textNormalization.ts` jest użyty tylko w 2 z ~12 ćwiczeń tekstowych | POTWIERDZONY BUG (krytyczny) |
| Oba głosy w dialogu brzmią tak samo | `supabase/functions/generate-audio/index.ts`: jeden losowy głos (`randomVoice`) dla całego skryptu, jedno wywołanie TTS | POTWIERDZONY BUG |
| Procenty (rd 93% / wr 88% / sp 38%) w PDF nauczyciela | `NanoSkillBadge.tsx` renderuje `confidencePercent` bez `data-no-pdf`; `pdfUtils.ts` usuwa tylko elementy z `data-no-pdf="true"` | POTWIERDZONY BUG |
| Timing i przycisk „Regenerate" w PDF ucznia | `ExerciseHeader.tsx` renderuje Regenerate/Clock/Move/Delete bez `data-no-pdf` | POTWIERDZONY BUG |
| „Nie da się zobaczyć wyników testu" | `TestDetailsView.tsx` + `QuestionCard` mają pełny widok per-pytanie z `student_answer`/`is_correct`. Funkcja ISTNIEJE, ale nauczycielka jej nie znalazła | PROBLEM DISCOVERY, nie brak funkcji |
| Test wstępny mierzy profil psychologiczny zamiast poziomu | `welcomeTest.ts`: sekcje z `trait_name` (anxiety, motivation) obok `element_type` (grammar/vocab/...). Miks jest zamierzony, ale poziom liczony jest na podmiotowej próbce | CZĘŚCIOWO ZASADNY |
| Zmiany w ćwiczeniach nie zapisują się / nie ma ich w PDF | Wymaga dodatkowego audytu ścieżki zapisu (nie potwierdzone jednoznacznie w tej turze) | DO ZDIAGNOZOWANIA |

## Triage — co robimy

### P0 — Naprawiamy natychmiast (podważają zaufanie do produktu)

1. **Silnik walidacji odpowiedzi.** Jeden współdzielony moduł `src/lib/answers/matchAnswer.ts`: normalizacja (case, interpunkcja, białe znaki, apostrofy typograficzne, kolapsy spacji), rozbicie wariantów po `" OR "` / `"/"` / `";"`, obsługa sentinela „This sentence is correct" (odpowiedź poprawna = zdanie źródłowe), tolerancja skróceń (`don't`/`do not`). Podpięcie do WSZYSTKICH ćwiczeń tekstowych (error correction, sentence transformation, gap text, complete word, word order, fill-in-blanks, paraphrasing, answer questions). Fallback: gdy odpowiedź nie pasuje dosłownie, oznaczamy jako „needs teacher review" (żółty), a nie „wrong" (czerwony) — nigdy nie mówimy uczniowi, że ma źle, gdy nie jesteśmy pewni.
2. **Higiena eksportów PDF/HTML.** Dodanie `data-no-pdf="true"` na: `NanoSkillBadge`, blok czasu i Regenerate w `ExerciseHeader`, przyciski Move/Delete/Mark Done. Osobno: wersja ucznia nie może zawierać żadnych `Suggested answer` — audyt 5 komponentów, które je renderują.
3. **Różne głosy w dialogach.** Parsowanie skryptu na tury mówców, przypisanie stałego głosu per speaker (A: `onyx`, B: `nova`), scalanie segmentów audio. Zero zmian w prompcie generacji worksheetów (zasada świętości) — zmiana dotyczy wyłącznie `generate-audio`.

### P1 — Naprawiamy w drugiej kolejności (blokują realne użycie)

4. **Trwałość edycji + PDF odzwierciedlający zmiany.** Audyt ścieżki `isEditing → onChange → persist → reload → export`. Cel: jawny stan „Saved/Unsaved" i eksport zawsze z aktualnej wersji z bazy.
5. **Generowanie z obrazkami i z zadanym słownictwem.** Diagnoza z `error_logs`: czy to timeout, czy limit 5000 znaków, czy błąd modelu obrazów. Naprawa + czytelny komunikat zamiast cichego faila.
6. **Dostęp ucznia do `/my`.** Uczeń trafił na ekran „Welcome Test Completed" zamiast Student Hub. Weryfikacja routingu `/my` → `/my/:teacherToken` i stanu po ukończeniu testu.
7. **Share otwierający wersję live z odpowiedziami.** Domyślny share MUSI dawać wersję ucznia; wersja live/z odpowiedziami tylko jako świadomy, oznaczony wybór.
8. **Nagrywanie nie działa.** Odtworzenie na uczniowskiej ścieżce (uprawnienia mikrofonu, upload, MIME).

### P2 — Robimy, bo tanie i realnie zmniejszają tarcie

9. **Auto-email przy przypisaniu zadania** (dziś wymaga osobnego kliknięcia) — z możliwością wyłączenia.
10. **Rozwinięte domyślnie „extra lesson information"** zamiast chowania pod przyciskiem.
11. **Podpowiedzi w polu tematu lekcji jako ikona z tooltipem**, nie ściana przykładów.
12. **Widoczny link „See every answer" z wyników testu** do `TestDetailsView` — funkcja istnieje, brakuje jej wejścia.
13. **Ukrycie nano-skill/confidence za trybem „Advanced"** — domyślnie nauczyciel widzi materiał, nie telemetrię.

### P3 — Wymaga osobnej decyzji strategicznej (nie robimy teraz)

14. **Zgodność z zamówionymi typami ćwiczeń i zadanym słownictwem.** To dotyka Worksheet Generation Engine — objęty zasadą świętości. Propozycja bez ruszania promptu: warstwa post-walidacji, która porównuje wygenerowany zestaw z zamówieniem i pokazuje nauczycielowi ostrzeżenie „you asked for 4 grammar exercises, got 7" z opcją usunięcia nadmiarowych jednym kliknięciem.
15. **Test wstępny: rozdzielenie diagnozy językowej od profilu.** Duży temat — oddzielny sprint. Kierunek: krótszy blok językowy z adaptacyjną trudnością + jawny raport „gdzie popełnił błąd", profil psychologiczny jako opcjonalny drugi krok.

### ODRZUCAMY (świadomie, ze strategii)

16. **„Dodajcie gry dla nastolatków."** Edooqoo to system dla dorosłych uczniów 1:1. Gry dla nastolatków to inny produkt i inny rynek. Nie budujemy.
17. **„Worksheety powinny zastąpić całą lekcję."** Pozycjonowanie jest jawne: 1-Minute Prep = materiał do przeglądu przez nauczyciela, nie autopilot. Zamiast budować „lekcję pod klucz", poprawiamy jakość i przewidywalność tego, co generujemy.
18. **„Za dużo funkcji" jako całość.** Nie usuwamy funkcji; obniżamy gęstość interfejsu (punkty 10–13). Sam zarzut jest jednak sygnałem — jeśli powtórzy się u kolejnych 3 nauczycieli, wracamy do niego jako do osobnego sprintu redukcji.

## Kolejność wdrożenia

```text
Sprint A (P0)  → walidacja odpowiedzi + higiena PDF + głosy w dialogach
Sprint B (P1)  → trwałość edycji, generowanie z obrazami/słownictwem, dostęp ucznia, share, nagrywanie
Sprint C (P2)  → auto-email, odchudzenie UI, wejście do szczegółów testu
Sprint D (P3)  → warstwa zgodności zamówienia + redesign testu wstępnego (osobna decyzja)
```

## Uwagi techniczne

- Nie dotykamy `supabase/functions/generateWorksheet/prompts/**` — zasada świętości silnika. Wszystkie naprawy P0/P1 są poza tą warstwą.
- Walidacja odpowiedzi trafia do jednego modułu z testami jednostkowymi (vitest), aby regresja nie wróciła przy kolejnym ćwiczeniu.
- Higiena eksportu wymaga jednego przejścia audytowego po `src/components/worksheet/*` — atrybut `data-no-pdf` jest jedynym kontraktem, jaki rozumieją `pdfUtils.ts` i `htmlExport.ts`.
- Zmiana w `generate-audio` zwiększy liczbę wywołań TTS (jedno na turę mówcy) — trzeba oszacować wpływ na koszt przy dialogach 90-sekundowych.

## Następny krok

Wskaż, który sprint planujemy szczegółowo jako pierwszy. Rekomendacja: Sprint A — trzy defekty, które w raportach obu nauczycielek pojawiają się jako powód braku zaufania do narzędzia.
