# v6.9.111 — Student Workspace: 7 zakładek → 3 + snapshot

Kontynuacja north star z `docs/ux/target-teacher-experience.md` (punkt 5, sekwencja krok 2). Dashboard „Today" (v6.9.109) i szybki dostęp do ucznia (v6.9.110) są gotowe. Teraz porządkujemy stronę ucznia.

## Przypomnienie planu z dużych klocków

Strona ucznia ma jedno zadanie: **przygotować następną lekcję i domknąć poprzednią.**

Zamiast 7 widocznych zakładek (+4 ukrytych w kodzie) wchodzą:

```text
┌──────────────────────────────────────────────┬────────────────────┐
│  Anna Kowalska · B1 · next lesson Tue 18:00  │  STUDENT SNAPSHOT  │
│  [ Prep ] [ Timeline ] [ Library ] [ Model ] │  Level  B1         │
├──────────────────────────────────────────────┤  Goal   job intervw│
│   treść aktywnej zakładki                    │  Deadline 12 Nov   │
│                                              │  Focus areas       │
│                                              │  [Full learning    │
│                                              │   model →]         │
└──────────────────────────────────────────────┴────────────────────┘
```

- **Prep** (domyślna) — jedyne miejsce, gdzie powstaje lekcja: propozycja tematu (OneMinutePrepCard + Next Lesson Ideas w jednej karcie), jeden przycisk **Generate worksheet**, ostatni worksheet z „Reuse / Continue", szybka notatka, baner welcome testu tylko przy pustym profilu.
- **Timeline** — jeden chronologiczny strumień: lekcje, worksheety, homework wysłany/zwrócony, notatki, wyniki testów, zmiany mastery. Zastępuje zakładki Homework, Tests, Calendar (część uczniowska) i Events. Filtry typów jako pigułki nad strumieniem.
- **Library** — worksheety, fiszki i przypisany homework tego ucznia. Archiwum i ponowne użycie, gęsta lista zamiast kafelków.
- **Model (DSLM)** — zgodnie z Twoją decyzją **zostaje zakładką** (czwartą), nie osobną stroną. Nazwa „1 MINUTE" znika, zostaje „Learning model".
- **Snapshot** — stały panel po prawej (na mobile zwijany): poziom, cel, deadline, trzy focus areas, skrót do Modelu oraz menu `…` z ustawieniami (Student Details, edycja, usuwanie, Hub, link do spotkania, e-mail).

Zasady, których nie łamiemy: nic nie usuwamy — przenosimy o poziom głębiej; jedna główna akcja na ekranie; ikony zawsze z etykietą; tylko tokeny semantyczne. Silnik generowania worksheetów, logika DSLM, backend, RLS i migracje pozostają nietknięte.

„Prepare next lesson" z dashboardu przestaje prowadzić do `?tab=dslm` i prowadzi do zakładki **Prep**.

## Etapy wdrożenia (osobne commity, jak przy dashboardzie)

**Faza 0 — dokumentacja i roadmapa.** `docs/ux/student-workspace-spec.md` (mapowanie stara zakładka → nowe miejsce, kontrakty propsów, reguły migracji URL), wpis w `roadmap.md`.

**Faza 1 — logika bez UI.** `src/lib/students/workspaceTabs.ts`: kanoniczne wartości zakładek (`prep` | `timeline` | `library` | `model`), mapa aliasów ze starych URL-i (`overview`→`prep`, `dslm`/`1minute`→`model`, `worksheets`/`flashcards`→`library`, `homework`/`tests`/`calendar`/`events`/`progress`→`timeline`, `skills`/`knowledge`→`model`), `resolveTab()`. Hook `useStudentTimeline.ts` scalający istniejące dane (lekcje, worksheety, homework, notatki, testy) w jeden posortowany strumień — bez nowych zapytań do bazy, tylko kompozycja hooków już używanych na stronie. Testy jednostkowe dla mapy aliasów i sortowania/filtrowania strumienia.

**Faza 2 — snapshot.** `src/components/student/StudentSnapshotPanel.tsx` + menu `…` z przeniesionymi ustawieniami. Montaż obok istniejących zakładek (jeszcze bez zmiany ich liczby), żeby zmiana była odwracalna.

**Faza 3 — zakładka Prep.** `src/components/student/prep/PrepTab.tsx` scalająca OneMinutePrepCard, Next Lesson Ideas, ostatni worksheet i szybką notatkę.

**Faza 4 — zakładka Timeline.** `TimelineTab.tsx` + `TimelineEventRow.tsx` + pigułki filtrów.

**Faza 5 — zakładka Library.** `LibraryTab.tsx` — gęsta lista worksheetów, fiszek i homeworku z akcjami w menu `…`.

**Faza 6 — przełączenie nawigacji i routingu.** `StudentPage.tsx` schodzi do 4 zakładek, stare `?tab=` przekierowywane przez `resolveTab()` z `replace: true`; `studentPrepPath()` w `src/lib/students/quickAccess.ts` zmienia się na `?tab=prep`; przegląd wszystkich linków `?tab=` w kodzie (dashboard, nav, e-maile w Edge Functions — tam tylko odczyt i ewentualna korekta linków, bez zmian logiki).

**Faza 7 — porządki i RAG.** Usunięcie martwych paneli, aktualizacja `docs/llm-context.md`, `public/llms.txt`, pamięci projektu i `roadmap.md`.

## Szczegóły techniczne

- `src/pages/StudentPage.tsx` (1256 linii) jest rozbijany na komponenty zakładek; plik strony zostaje kontrolerem: dane, routing zakładek, shell.
- Zero nowych zapytań i zero zmian schematu — Timeline składa dane z hooków już pobieranych przez stronę.
- Kompatybilność URL: każdy stary `?tab=` nadal działa (przekierowanie po stronie klienta), więc linki w wysłanych e-mailach i zakładkach przeglądarki nie umierają.
- Tryb demo, `AuthenticatedPageShell`, dark mode nauczyciela i guardy demo pozostają bez zmian.
- Po każdej fazie: `bunx tsgo --noEmit -p tsconfig.app.json` + testy + weryfikacja Playwright na `/demo`.

## Poza zakresem

Worksheet Generation Engine, logika DSLM (zmieniamy tylko punkt wejścia i nazwę), backend, RLS, migracje, SEO, Student Hub (`/my`), guided mode poza dashboardem (osobny etap 3 sekwencji).
