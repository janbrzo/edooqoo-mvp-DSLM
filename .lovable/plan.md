# Faza M8 (szczegółowo) — domknięcie Student Workspace: sprzątanie kodu, dokumentacja, pamięć

## Średnie klocki M0–M8 (zapisane jako punkt odniesienia)

| Faza | Zakres | Status |
|---|---|---|
| M0 | docs/ux/student-workspace-spec.md + roadmap | zrobione |
| M1 | workspaceTabs.ts + testy aliasów | zrobione |
| M2 | EntityRow + MeetingLinkField | zrobione |
| M3 | Header, Snapshot, Settings menu | zrobione |
| M4 | PrepTab | zrobione |
| M5 | Timeline | zrobione |
| M6 | Library | zrobione |
| M7 | 4 zakładki, resolver, lazy | zrobione (M7.1–M7.12) |
| M8 | sprzątanie + dokumentacja + pamięć | częściowo (poniżej) |

## Co o M8 wiadomo dziś (sprawdzone przed planem)

Część M8 już weszła wcześniej (poprawki telefonu w górnym pasku, porządki w adresach, usunięte dwa nieużywane fragmenty strony ucznia). Zostało to, co w oryginalnym opisie M8 było „papierowe”, oraz trzy konkretne nieścisłości, które znalazłem:

1. **Kod:** żaden plik w folderze komponentów ucznia nie jest dziś osierocony (sprawdzone skryptem). Strona ucznia ma 907 linii i dokładnie 4 sekcje zakładek (prep, timeline, library, model). Nie ma więc wielkiego „martwego kodu” do wycięcia — zostaje drobny przegląd nieużywanych importów i stanów.
2. **Dokumentacja dla AI (llm-context):** jest wpis o poprawkach M8 (v6.9.112), ale **brak jednego wpisu opisującego cały nowy układ 4 zakładek** (v6.9.111). Dodatkowo starszy wpis (linia ~1870) twierdzi, że skrót „przejdź do ucznia” prowadzi do `?tab=dslm` — to już nieprawda (dziś `?tab=prep`).
3. **Pamięć projektu:** notatka „Quick Add Note from Overview” opisuje zakładkę Overview, której już nie ma. Brak notatki o nowym układzie strony ucznia, więc przyszła sesja mogłaby „przywrócić” stare zakładki.

## Małe klocki

### M8.1 — Przegląd nieużywanego kodu na stronie ucznia (bez zmian wyglądu)
- Uruchomić `bunx eslint src/pages/StudentPage.tsx src/components/student src/lib/students` i usunąć wyłącznie: nieużywane importy, nieużywane zmienne stanu, nieużywane propsy przekazywane do lazy zakładek.
- Sprawdzić hooki importowane tylko przez stronę ucznia (`useDeletedWorksheets`, `useStudentKnowledge` itd.) — zostają, jeśli są używane; nic nie przenosimy.
- Zakaz: zmiana logiki, przenoszenie plików, dotykanie silnika arkuszy, stare narzędzia (Homework, Tests, Calendar, Flashcards) zostają nietknięte.
- Weryfikacja: tsgo czyste, 227/227 testów, zrzut 4 zakładek na koncie +44 identyczny jak w M7.12.

### M8.2 — Wpis RAG „v6.9.111 Student Workspace” w docs/llm-context.md
Nowa sekcja w formacie wymaganym (PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS), treść:
- PROBLEM: 7 widocznych + 4 ukryte zakładki, przygotowanie lekcji rozproszone.
- SOLUTION: 4 zakładki prep | timeline | library | model; Prep ładowany od razu, reszta leniwie; stare linki `?tab=` działają na stałe przez aliasy.
- MECHANICS: `workspaceTabs.ts` (resolveTab, resolveWorkspaceParams, buildWorkspaceParams, TAB_ALIASES — 12 aliasów, PRESERVED_PARAMS), `prepPlan.ts`, `timelineEvents.ts`, `libraryItems.ts`, komponenty prep/timeline/library, `StudentHeaderBar`, `StudentSnapshotPanel`, `StudentSettingsMenu`, deep linki `set=` i `testId=`, brak zmian w bazie i silniku arkuszy.
- 15 słów kluczowych.
- Poprawić starą linię ~1870: `studentPrepPath()` zwraca `/student/:id?tab=prep`.

### M8.3 — public/llms.txt
Decyzja gotowa: **bez zmian**. Plik opisuje produkt publicznie, a przebudowa zakładek to wewnętrzny układ ekranu nauczyciela (zasada: nie opisujemy wewnętrznych szczegółów w treściach publicznych). Zapis tej decyzji jednym zdaniem w sekcji 18 specyfikacji.

### M8.4 — Pamięć projektu
- Nowa notatka `mem://features/student-page/workspace-4-tabs`: 4 zakładki są ostateczne, aliasy są trwałe, nie dodawać z powrotem Overview/Worksheets/Skills jako osobnych zakładek, destrukcyjne akcje tylko w menu ustawień.
- Aktualizacja notatki „Quick Add Note from Overview”: przycisk dodawania notatki żyje dziś w Prep (QuickNoteBox) — zaktualizować opis, zachować zasadę „nie przekierowywać do modelu ucznia”.
- Dopisać obie w indeksie pamięci.

### M8.5 — AGENTS.md
Jedna reguła techniczna: „Student Workspace tab state lives only in the URL and is resolved via `src/lib/students/workspaceTabs.ts`; legacy `?tab=` aliases are permanent — because sent emails and bookmarks carry them.” (zastępuje ewentualną starszą regułę o zakładkach, nie dubluje).

### M8.6 — roadmap.md i specyfikacja
- roadmap: dopisać i odhaczyć „M8 docs/memory closure”.
- `docs/ux/student-workspace-spec.md` sekcja 18: dopisać wynik M8.

### M8.7 — Weryfikacja końcowa
- `bunx tsgo --noEmit -p tsconfig.app.json` → 0 błędów.
- `bun test` → 227/227.
- Playwright na koncie +44: 4 zakładki + jeden stary link (`?tab=flashcards&set=…` → zestaw BIG) + telefon 360 px (bez przewijania w bok).
- Checklist: każdy punkt M8.1–M8.6 DONE/FAIL.

## Poza zakresem (nie ruszamy)
Klawiatura w filtrach osi czasu i przełączniku biblioteki, ekran ładowania w wersji demo, stare adresy w e-mailach i powiadomieniach, cichy brak komunikatu dla usuniętej sugestii.

## Szczegóły techniczne
- Pliki zmieniane: `src/pages/StudentPage.tsx` (tylko importy/nieużywane zmienne, jeśli lint coś wskaże), `docs/llm-context.md`, `docs/ux/student-workspace-spec.md`, `roadmap.md`, `AGENTS.md`, `mem/…`.
- Zero zmian: baza danych, funkcje serwera, silnik generowania arkuszy, `public/llms.txt`, trasy aplikacji.
