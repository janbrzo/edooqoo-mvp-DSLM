# v6.9.111 — Student Workspace: średnie klocki dla `/student/:id`

Szkielet (duże klocki) pozostaje bez zmian: 4 zakładki **Prep / Timeline / Library / Model** + stały panel **Snapshot**, DSLM zostaje zakładką, „Prepare next lesson" z dashboardu prowadzi do Prep. Ten dokument schodzi poziom niżej: co dokładnie jest w środku każdej zakładki, skąd bierze dane, jak elementy zazębiają się ze sobą i co technicznie musi zadziałać.

---

## 1. Punkt wyjścia — co dziś naprawdę jest na stronie

`src/pages/StudentPage.tsx` ma 1256 linii i trzyma w jednym pliku: nawigację, 11 paneli zakładek, lokalny komponent `MeetingLinkField`, cztery modale (edycja ucznia, share, rename, quick note), obsługę stronicowania worksheetów i usuniętych worksheetów oraz kilka zapytań do Supabase w `useEffect`.

Zakładka Overview zawiera dziś w jednym ekranie: baner welcome testu, `OneMinutePrepCard`, baner Student Hub, kartę Student Details (poziom, cel, e-mail, język, e-maile o zaległościach, liczba worksheetów, data dołączenia, link do spotkania, przyciski edycji i usuwania), kartę Recent Worksheets z listą i akcjami, kartę notatek. To około 35 elementów interaktywnych naraz.

Dane są już pobierane przez hooki: `useStudent`, `useWorksheetHistory`, `useDeletedWorksheets`, `useStudentKnowledge`, `useAllWorksheetHomework`, `useStudentAttentionDots`, plus komponenty zakładek pobierają swoje własne (`StudentHomeworkTab`, `StudentTestsTab`, `StudentCalendarTab`, `DSLMTab`, `FlashcardSetsSection`). To ważne: **wszystkie dane potrzebne do nowego układu już są pobierane** — nie dokładamy zapytań, tylko inaczej je składamy i renderujemy leniwie.

---

## 2. Rama strony — co widać zawsze

Nad zakładkami stoi jeden pasek kontekstu (`StudentHeaderBar`): powrót, imię ucznia, poziom CEFR, cel w skrócie, termin najbliższej lekcji i jedno menu `…`. Pasek nie ma żadnego przycisku destrukcyjnego — usuwanie i edycja żyją w menu.

Po prawej stronie (od `lg`) stoi `StudentSnapshotPanel` szerokości ok. 280 px, `sticky top-20`. Poniżej `lg` snapshot zwija się w jeden pasek pod nagłówkiem, rozwijany kliknięciem. Snapshot pokazuje: poziom, cel, deadline, trzy obszary do poprawy (z DSLM/knowledge), status Student Hub (jest e-mail / brak e-maila) oraz przycisk „Open learning model →", który przełącza zakładkę na Model. Snapshot jest jedynym miejscem z ustawieniami ucznia — jego menu `…` zawiera: Edit details, Meeting link, Hub access & email, Notification settings, Delete student (type-to-confirm).

Zakładki są zawsze z etykietą tekstową, nigdy same ikony. Cztery pozycje mieszczą się na telefonie, więc znika tryb „7 nieopisanych ikon".

---

## 3. Zakładka Prep — domyślna, tu spędza się 90% czasu

Prep czyta się z góry na dół jako jedno zdanie: „oto co było trudne → oto propozycja lekcji → generuj → oto co ostatnio zrobiliście".

1. **Next lesson card** — jedna karta zamiast dzisiejszego duetu `OneMinutePrepCard` + Next Lesson Ideas. W środku: temat proponowany przez DSLM, dwa–trzy punkty uzasadnienia („past simple — 3 błędy w ostatnim worksheecie", „prosił o słownictwo z rozmowy kwalifikacyjnej"), i jeden główny przycisk **Generate worksheet**. Obok przycisk dodatkowy „Use a different idea", który rozwija listę pozostałych sugestii bez opuszczania karty. To jedyny przycisk `variant="default"` na całym ekranie.
2. **Last lesson strip** — wąski pasek z ostatnim worksheetem: tytuł, data, wynik/postęp jeśli jest, i dwie akcje: „Open" oraz „Reuse". Reszta akcji (rename, duplicate, share, delete) w menu `…`.
3. **Quick note** — jedno pole tekstowe „What happened in the last lesson?" z zapisem do `student_knowledge_entries` przez istniejący `StudentKnowledgeQuickAddModal`/`addEntry`; pod nim trzy ostatnie notatki jako lekki tekst, bez kart.
4. **Warunkowe banery** — `WelcomeTestSuggestion` tylko gdy profil pusty, `IntakeExtractionBanner` gdy w URL jest `?intake=`. Baner Student Hub znika z Prep i przenosi się do snapshotu jako jeden wiersz statusu.

Spójność z resztą: przycisk Generate używa dokładnie tej samej ścieżki co dziś (`writeAutoGenerateIntent` lub prefill w `sessionStorage` + `navigate('/')`) — nie dotykamy silnika generowania. „Reuse" korzysta z istniejącego `DuplicateWorksheetButton`.

---

## 4. Zakładka Timeline — jedna oś czasu zamiast czterech zakładek

Timeline zastępuje Homework, Tests, Calendar (część ucznia) i Events. Jeden strumień w dół, pogrupowany nagłówkami dat („Today", „This week", „September").

Każdy wiersz ma stałą anatomię: ikona typu → tytuł → jedna linia kontekstu → data po prawej → menu `…` z akcjami właściwymi dla typu. Wiersz jest klikalny i prowadzi do miejsca docelowego (worksheet, przegląd homeworku, wynik testu, szczegóły lekcji).

Typy zdarzeń: `lesson` (odbyta/zaplanowana), `worksheet` (wygenerowany), `homework_sent`, `homework_returned`, `note`, `test_result`, `mastery_change`. Nad strumieniem pigułki filtrów: All · Lessons · Worksheets · Homework · Notes · Tests. Wybór filtra trafia do URL jako `?tab=timeline&filter=homework`, żeby dało się podesłać link.

Zdarzenia wymagające reakcji nauczyciela (zwrócony homework, ukończony test) dostają bursztynową kropkę i przycisk akcji wprost w wierszu („Review") — to ten sam sygnał, którego dashboard używa w sekcji „Needs your attention", więc oba ekrany mówią jednym językiem.

Technicznie: nowy hook `useStudentTimeline(studentId, teacherId)` **nie odpytuje bazy sam** — jest czystą funkcją kompozycji nad danymi z hooków, które strona już trzyma (`useWorksheetHistory`, `useAllWorksheetHomework`, `useCalendarSlots`, `useStudentTests`, `useStudentKnowledge`). Mapuje każde źródło na wspólny typ `TimelineEvent { id, type, at, title, subtitle, needsAction, href, actions }`, scala, sortuje malejąco po `at` i zwraca `{ events, counts, isLoading }`. Ładowanie porcjami po 30 zdarzeń z przyciskiem „Load more" — bez wirtualizacji, bo wolumen jest mały.

---

## 5. Zakładka Library — archiwum i ponowne użycie

Trzy podsekcje przełączane segmentem u góry, nie zagnieżdżonymi zakładkami: **Worksheets · Flashcards · Homework**. Segment zapisuje wybór w URL (`?tab=library&section=flashcards`), żeby powrót „wstecz" działał sensownie.

Worksheets to gęsta lista (wiersz = tytuł + data + odznaki mediów + menu `…`), a nie siatka kart — zgodnie z zasadą „karta to jednostka pracy, lista to archiwum". Zachowujemy stronicowanie i sekcję usuniętych worksheetów, ale usunięte chowają się pod zwijanym „Deleted (n)" na dole. Flashcards renderują istniejący `FlashcardSetsSection` bez zmian logiki. Homework renderuje istniejący `StudentHomeworkTab`.

---

## 6. Zakładka Model — DSLM bez zmian merytorycznych

Zostaje dzisiejszy `DSLMTab` z całym kontraktem propsów (roadmap, pacing, main goal, target date, `onUseWorksheetSuggestion`). Zmieniamy trzy rzeczy: etykietę z „1 MINUTE" na „Learning model", pozycję (czwarta, nie druga) oraz ładowanie leniwe. `DslmExplainerBanner` zostaje. Zero ingerencji w logikę DSLM.

---

## 7. Jak to się spina w całość

Trzy powtarzalne wzorce trzymają spójność między zakładkami:

- **Jeden wiersz, jedna anatomia.** Worksheet w Timeline, w Library i w Prep to ten sam komponent `EntityRow` z różnymi propsami. Nauczyciel uczy się jednego układu raz.
- **Jedno menu `…`.** Każda akcja poza główną chowa się w menu. Nigdy nie ma widocznej ikony kosza obok tytułu.
- **Jeden sygnał uwagi.** Bursztynowa kropka + „Review" znaczy to samo na dashboardzie, w pasku nagłówka i w Timeline.

Przepływ dnia nauczyciela: dashboard → Prep (generuj) → po lekcji Quick note → zwrócony homework pojawia się w Timeline z kropką → Review → mastery zmienia się w Model → następna propozycja w Prep jest lepsza. Pętla się domyka i widać, dlaczego produkt nazywa się 1-Minute Prep.

---

## 8. Szczegóły techniczne

**Rozbicie pliku.** `StudentPage.tsx` schodzi do roli kontrolera (~250 linii): dane, routing zakładek, shell, modale. Nowe pliki:

```text
src/components/student/StudentHeaderBar.tsx
src/components/student/StudentSnapshotPanel.tsx
src/components/student/StudentSettingsMenu.tsx
src/components/student/MeetingLinkField.tsx      (wyciągnięty z StudentPage)
src/components/student/EntityRow.tsx
src/components/student/prep/PrepTab.tsx
src/components/student/prep/NextLessonCard.tsx
src/components/student/prep/LastLessonStrip.tsx
src/components/student/prep/QuickNoteBox.tsx
src/components/student/timeline/TimelineTab.tsx
src/components/student/timeline/TimelineEventRow.tsx
src/components/student/timeline/TimelineFilters.tsx
src/components/student/library/LibraryTab.tsx
src/lib/students/workspaceTabs.ts
src/hooks/useStudentTimeline.ts
```

**Routing i kompatybilność URL.** `workspaceTabs.ts` eksportuje `WORKSPACE_TABS`, typ `WorkspaceTab` oraz `resolveTab(raw)` z mapą aliasów: `overview→prep`, `dslm|1minute|progress|skills|knowledge→model`, `worksheets|flashcards→library`, `homework|tests|calendar|events→timeline`. Nieznana wartość → `prep`. Gdy alias zadziała, `StudentPage` przepisuje URL przez `setSearchParams(..., { replace: true })`, więc stare linki z e-maili i zakładek przeglądarki nadal działają, ale nie zaśmiecają historii. Parametry pomocnicze zachowujemy: `set` (edytowany zestaw fiszek), `intake`, nowe `section` i `filter`.

**Wydajność.** Dziś wszystkie panele montują się razem, każdy ze swoimi zapytaniami. Wchodzi `React.lazy` na Timeline, Library i Model plus `Suspense` z istniejącym `SectionSkeleton`. Prep ładuje się od razu. Efekt: pierwsze wejście na stronę ucznia odpala tylko zapytania potrzebne do Prep i snapshotu.

**Stan i cache.** Wszystko zostaje na React Query z obecnymi kluczami. `useStudentTimeline` nie tworzy własnego klucza — memoizuje wynik z `useMemo` na podstawie tablic wejściowych, więc nie ma ryzyka rozjechania cache po mutacji. Po każdej mutacji (rename, delete, share, note) unieważniamy te same klucze co dziś.

**Tryb demo.** Każde nowe zapytanie musi wcześnie wracać przy `edooqoo_demo_mode`; `useStudentTimeline` nie odpytuje bazy, więc dziedziczy zachowanie źródeł. Wszystkie akcje mutujące w nowych komponentach przechodzą przez `useDemoGuard`.

**Dostępność i styl.** Zakładki jako `role="tablist"` z etykietami, snapshot jako `<aside aria-label="Student snapshot">`, filtry Timeline jako grupa `role="group"` z `aria-pressed`. Wyłącznie tokeny semantyczne (`bg-card`, `text-muted-foreground`, `border-border`) — zero `text-white`, `bg-white`, `text-gray-*`. Linki nawigacyjne renderowane jako `<a>` (wzorzec middle-click), żeby otwieranie w nowej karcie działało.

**Ryzyka i jak je tniemy.** Największe to regresja w akcjach worksheetów przy przenoszeniu ich do `EntityRow` — dlatego w Fazie 2 `EntityRow` powstaje z testami i jest najpierw użyty w jednym miejscu (Prep), zanim wejdzie do Library i Timeline. Drugie to rozjazd danych w Timeline — dlatego mapowanie każdego typu zdarzenia dostaje test jednostkowy na sortowanie, deduplikację i wykrywanie `needsAction`.

---

## 9. Kolejność wdrożenia (średnie klocki, osobne commity)

| Faza | Zakres | Weryfikacja |
|---|---|---|
| M0 | `docs/ux/student-workspace-spec.md` + wpis w `roadmap.md` | przegląd dokumentu |
| M1 | `workspaceTabs.ts` + testy aliasów (bez UI) | testy |
| M2 | `EntityRow` + `MeetingLinkField` wyciągnięty z `StudentPage` | typecheck, brak zmian wizualnych |
| M3 | `StudentHeaderBar` + `StudentSnapshotPanel` + `StudentSettingsMenu`, montaż obok starych zakładek | Playwright na `/demo` |
| M4 | `PrepTab` (NextLessonCard, LastLessonStrip, QuickNoteBox) | ręczne przejście ścieżki generowania |
| M5 | `useStudentTimeline` + testy, potem `TimelineTab` | testy + Playwright |
| M6 | `LibraryTab` z segmentem i sekcją Deleted | Playwright |
| M7 | Przełączenie na 4 zakładki, `resolveTab` w routingu, `studentPrepPath()` → `?tab=prep`, `React.lazy` | przejście wszystkich starych linków `?tab=` |
| M8 | Usunięcie martwego kodu, `docs/llm-context.md`, `public/llms.txt`, pamięć, `roadmap.md` | audyt dokumentacji |

Po każdej fazie: `bunx tsgo --noEmit -p tsconfig.app.json`, testy jednostkowe, wejście na `/demo` przez Playwright.

---

## 10. Poza zakresem

Worksheet Generation Engine, logika DSLM (tylko nazwa, pozycja i lazy-load), backend, RLS, migracje, SEO, Student Hub (`/my`), guided mode poza dashboardem.
