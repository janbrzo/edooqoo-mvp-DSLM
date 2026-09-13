# M3 — Student Workspace: szczegółowy plan małych klocków

## Cel fazy

M3 buduje stałą ramę kontekstu ucznia, zanim zmienimy zawartość zakładek. Po tej fazie nauczyciel, niezależnie od otwartej starej zakładki, zawsze widzi: **u kogo jest, jaki jest poziom i cel, kiedy jest następna lekcja, co wymaga uwagi oraz gdzie są ustawienia ucznia**.

M3 nie przełącza jeszcze strony na `Prep / Timeline / Library / Learning model`. Obecne zakładki i ich adresy pozostają aktywne do M7. Dzięki temu nowa rama może zostać zweryfikowana osobno, bez jednoczesnego ryzyka zmiany routingu i całej zawartości strony.

## Affected surface

- `src/pages/StudentPage.tsx` — montaż nowego nagłówka, panelu i menu; istniejące dane oraz handlery pozostają właścicielem strony.
- `src/components/student/StudentHeaderBar.tsx` — nowy, prezentacyjny nagłówek rekordu ucznia.
- `src/components/student/StudentSnapshotPanel.tsx` — nowy desktopowy panel i mobilne rozwinięcie.
- `src/components/student/StudentSettingsMenu.tsx` — nowe menu ustawień, dialog linku spotkania i type-to-confirm delete.
- `src/hooks/useStudentNextLesson.ts` — jeden lekki, ograniczony odczyt najbliższej lekcji, z pełną gałęzią demo.
- `src/lib/students/studentSnapshot.ts` — czyste selektory i formatowanie dla M3.
- `src/lib/students/__tests__/studentSnapshot.test.ts` — testy bez DOM.
- `docs/ux/student-workspace-spec.md` — zapis ostatecznych kontraktów M3 i świadomych stanów przejściowych.
- `roadmap.md` — M3 oznaczone jako wykonane dopiero po pełnej weryfikacji.

Nie dotykamy: Worksheet Generation Engine, logiki DSLM, Supabase schema/RLS, Edge Functions, Student Hub `/my`, M4–M8 ani nowych czterech zakładek.

## Potwierdzony stan i root cause

`StudentPage.tsx` nadal zarządza starym modelem siedmiu widocznych zakładek, lokalnym `activeTab`, danymi ucznia, ustawieniami, usuwaniem i modalami. M1 (`workspaceTabs.ts`) oraz M2 (`EntityRow`) istnieją, ale celowo nie są jeszcze podłączone do routingu strony. Informacje o uczniu i akcje są dziś dostępne głównie wewnątrz `Overview`, więc znikają z pola widzenia po zmianie zakładki.

**Root cause:** kontekst ucznia i ustawienia są częścią jednej zakładki roboczej zamiast stałej ramy rekordu, dlatego nauczyciel traci orientację podczas przechodzenia między modułami.

## Badania UX i wnioski zastosowane w Edooqoo

Wzorce stron rekordu w narzędziach profesjonalnych rozdzielają trzy warstwy: trwałą identyfikację rekordu, bieżącą pracę i rzadkie ustawienia. ServiceNow, Blackbaud SKY UX i Infor opisują nagłówek rekordu jako stały punkt orientacyjny; Nielsen Norman Group i Primer zalecają progressive disclosure dla rzadkich oraz destrukcyjnych działań; Workday stosuje panel boczny do kontekstu pomocniczego, nie do duplikowania głównej pracy.

Źródła referencyjne:

- ServiceNow Workspace record page: https://horizon.servicenow.com/workspace/page-templates/record
- Blackbaud record page: https://developer.blackbaud.com/skyux/design/guidelines/page-layouts/record-page
- Infor profile record: https://design.infor.com/patterns/page-layouts/profile-record/
- Nielsen Norman Group, progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Primer, progressive disclosure: https://primer.github.io/design/ui-patterns/progressive-disclosure/
- Workday side panel: https://canvas.workday.com/components/containers/side-panel/

Przekład na Edooqoo: nagłówek identyfikuje ucznia, snapshot podaje wyłącznie informacje potrzebne do decyzji o kolejnej lekcji, a edycja i usuwanie nie konkurują wizualnie z pracą nauczyciela.

## Rozważone rozwiązania

| Opcja | Podejście | Zaleta | Ryzyko regresji |
|---|---|---|---|
| A. Tylko nowy nagłówek | Dodać imię, poziom i menu nad starymi zakładkami | Najmniejsza zmiana | Wysokie UX: cel, deadline i focus nadal są rozproszone |
| B. Nagłówek + snapshot z `useCalendarSlots` | Użyć pełnego hooka kalendarza również w ramie strony | Szybkie użycie istniejącego kodu | Średnie/wysokie: pełny zakres dat, realtime i możliwe zdublowane odczyty z zakładką Calendar |
| C. Nagłówek + snapshot + lekkie źródło najbliższej lekcji | Jeden limitowany odczyt najbliższego terminu, a focus z już pobranych wpisów wiedzy | Najmniej danych, pełny kontrakt M3, dobra separacja | Niskie |

**Wybrane rozwiązanie: C.** Zapewnia docelową ramę bez podpinania M7 i bez uruchamiania pełnego kalendarza tylko po to, by wyświetlić jedną datę. Czyste selektory oddzielają reguły prezentacji od komponentów i mogą być sprawdzone testami bez dodawania biblioteki do renderowania React.

## Docelowa kompozycja M3

```text
StickyNav (bez własnego przycisku Back)
└── StudentHeaderBar
    ├── Back to dashboard
    ├── H1: student name
    ├── level badge
    ├── goal summary
    ├── next lesson summary
    └── More actions

mobile: StudentSnapshotPanel (collapsed summary → expandable details)

grid lg:grid-cols-[minmax(0,1fr)_280px]
├── existing 7-tab workspace (unchanged routing and content)
└── desktop StudentSnapshotPanel (sticky)
```

`IntakeExtractionBanner`, jeśli aktywny przez `?intake=`, pozostaje pomiędzy nagłówkiem a obszarem roboczym. Nie może zostać przeniesiony do snapshotu ani utracić parametru URL.

## 1. Czysty model danych snapshotu

Utworzyć `src/lib/students/studentSnapshot.ts` bez Reacta i Supabase.

### `selectFocusAreas(entries)`

- przyjmuje `StudentKnowledgeEntry[]`;
- bierze wyłącznie aktywne wpisy `category === 'Skill Assessment'`;
- pomija `deleted_at`, `is_outdated === true` i wpisy z `archived_at`;
- uwzględnia `metadata.skill_subtype` równe `weakness`, `mistake` lub `practice`; strength nie jest „focus area”;
- etykieta: najpierw niepusty `metadata.nano_skill`, potem pierwsza niepusta linia `content`;
- usuwa duplikaty bez rozróżniania wielkości liter, zachowując najnowszy wpis;
- sortuje deterministycznie po `updated_at`, potem `created_at`, malejąco;
- zwraca maksymalnie trzy krótkie etykiety; tekst dłuższy niż 60 znaków jest skracany z wielokropkiem.

### `formatNextLessonLabel(lesson, now)`

- wejście: `{ date: string; time: string } | null`;
- wynik: `Today 18:00`, `Tomorrow 18:00` albo `Tue 18:00`;
- nie pokazuje sekund;
- nie parsuje daty przez niejawny UTC; łączy lokalny dzień i godzinę zgodnie z semantyką istniejącego kalendarza nauczyciela;
- `null` daje `null`, a interfejs pokazuje wtedy „No lesson booked”.

Testy obejmą: kolejność, duplikaty, wszystkie dozwolone subtype, pomijanie strength/outdated/deleted/archived, fallback do content, limit trzech, skracanie, dziś/jutro/dzień tygodnia oraz `null`.

## 2. Lekki odczyt najbliższej lekcji

Utworzyć `src/hooks/useStudentNextLesson.ts` oparty na React Query.

Kontrakt:

```ts
interface StudentNextLesson {
  date: string;
  time: string;
}

interface UseStudentNextLessonResult {
  lesson: StudentNextLesson | null;
  isLoading: boolean;
}
```

Reguły:

- query key: `['student-next-lesson', teacherId, studentId, isDemoMode]`;
- query jest wyłączone bez obu identyfikatorów;
- produkcja: `calendar_slots`, tylko wskazany nauczyciel i uczeń, od dzisiaj wzwyż, status `booked`, sort `slot_date` + `start_time`, `limit(1)`;
- brak realtime i brak automatycznej mutacji statusu;
- demo: wybór z `demoData.calendarSlots`, zero wywołań Supabase;
- błąd degraduje do `null`, logowany przez `src/utils/logger.ts`, bez blokowania całej strony;
- `staleTime: 60_000`, bez refetch przy focusie, zgodnie z rolą pomocniczego podsumowania.

Nie używamy `useCalendarSlots`, ponieważ pobiera zakres widoku, uruchamia realtime i posiada operacje kalendarza niepotrzebne nagłówkowi.

## 3. `StudentHeaderBar`

Komponent jest prezentacyjny i nie wykonuje zapytań.

Ostateczny kontrakt:

```ts
interface StudentHeaderBarProps {
  name: string;
  englishLevel: string | null;
  mainGoal: string | null;
  nextLessonLabel: string | null;
  isNextLessonLoading: boolean;
  menu: React.ReactNode;
}
```

Budowa:

- semantyczny `<header>` i jeden `<h1>` z imieniem;
- prawdziwy link do `/dashboard` jako opisany przycisk „Back”; zachowuje middle-click i Cmd/Ctrl+click;
- poziom jako `Badge variant="secondary"`, pomijany, gdy brak wartości;
- cel przez wspólny `formatGoal()`; maksymalnie jedna linia desktop i dwie linie mobile;
- termin z ikoną kalendarza; skeleton podczas odczytu, potem termin albo „No lesson booked”;
- jeden przycisk ikonowy `MoreHorizontal`, ale z `aria-label="More actions"` i tooltipem;
- brak przycisku Generate — pojawi się dopiero w Prep w M4 i ma pozostać jedyną primary action.

Responsywność:

- desktop: Back, tożsamość i termin w jednym stabilnym rzędzie;
- mobile: Back + imię + menu w pierwszym rzędzie, poziom/cel/termin w drugim;
- długie imię i cel używają `min-w-0`, `truncate`/`line-clamp`, nigdy nie wypychają menu;
- minimalny obszar dotyku przycisku menu: 44×44 px.

Dotychczasowy `Back` zostaje usunięty z `StickyNav.leftContent` dopiero po zamontowaniu nowego linku. Nie mogą istnieć dwa przyciski Back.

## 4. `StudentSnapshotPanel`

Komponent czysto prezentacyjny; nie pobiera danych i nie zapisuje zmian.

Ostateczny kontrakt:

```ts
interface StudentSnapshotPanelProps {
  englishLevel: string | null;
  mainGoal: string | null;
  mainGoalTargetDate: string | null;
  focusAreas: string[];
  hubEmail: string | null;
  onOpenModel: () => void;
}
```

`studentId`, `teacherId` i `menu` zostają usunięte z kontraktu, bo panel ich nie potrzebuje. Menu istnieje tylko raz — w nagłówku.

Zawartość w stałej kolejności:

1. **Level** — wartość lub „Not set”.
2. **Goal** — `formatGoal()` lub „Not set”.
3. **Deadline** — lokalnie sformatowane `MMM d, yyyy` lub „Not set”. Pole `main_goal_target_date` jest obecne w wygenerowanym typie `students`, więc nie używamy `any`.
4. **Focus areas** — maksymalnie trzy pozycje z selektora; pusty stan „No focus areas yet”.
5. **Student Hub** — „Enabled” i skrócony email, jeśli `student_email` istnieje; w przeciwnym razie „Not set”. Nie utożsamiamy tego ze stanem automatycznych emaili.
6. **Open learning model** — secondary/ghost action wywołująca w M3 istniejące `handleTabChange('dslm')`. Dopiero M7 przełączy ją na kanoniczne `tab=model`.

Panel nie jest kartą w karcie. Desktop używa `<aside aria-label="Student snapshot">`, pionowej granicy i typografii. Jest `lg:sticky lg:top-20 lg:self-start`.

Na mobile ten sam komponent renderuje wariant `Collapsible`: zamknięty rząd pokazuje „Student snapshot”, poziom i skrócony cel; przycisk ma `aria-expanded`, opisany chevron i rozwija pełne dane. Stan początkowy jest zamknięty, aby stare siedem zakładek nie zostało zepchnięte poza pierwszy ekran.

Komponent może renderować wariant mobile i desktop w jednym pliku z klasami `lg:hidden` / `hidden lg:block`. Ukryty wariant nie wykonuje efektów ani zapytań, więc nie powiela pracy.

## 5. `StudentSettingsMenu`

Menu jest jedynym nowym wejściem do ustawień ucznia.

Kontrakt:

```ts
interface StudentSettingsMenuProps {
  student: Tables<'students'>;
  teacherId: string;
  gcalEnabled: boolean;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}
```

Pozycje:

1. **Edit student details** — otwiera istniejący `StudentEditDialog`; obejmuje również email, Student Hub i overdue-email setting, więc nie tworzymy drugiego formularza tych samych danych.
2. **Meeting link** — otwiera kontrolowany `Dialog` zawierający istniejący `MeetingLinkField`.
3. separator;
4. **Delete student** — destructive item otwiera kontrolowany `AlertDialog` z istniejącym type-to-confirm.

Zasady:

- trigger korzysta z projektu `Button variant="ghost" size="icon"`;
- pozycje mają ikony i tekst; Delete jest ostatnie i używa semantycznego `text-destructive`;
- wpisane potwierdzenie jest zerowane po anulowaniu i zamknięciu;
- przy usuwaniu menu/dialog pokazuje stan oczekiwania i blokuje wielokrotne wywołanie;
- `onDelete` zamyka dialog tylko po pomyślnym wyniku; nawigacją do dashboardu nadal zarządza `StudentPage`;
- otwieranie edycji, linku spotkania i usuwania przechodzi przez `useDemoGuard`; demo pokazuje istniejący komunikat i nie otwiera formularza mutacji;
- komponent nie wykonuje własnych zapytań poza już istniejącym zachowaniem `MeetingLinkField`.

## 6. Montaż w `StudentPage.tsx`

1. Wyliczyć `focusAreas` przez `useMemo` z już istniejącego `studentKnowledge.entries`; bez nowego odczytu wiedzy.
2. Pobrać `nextLesson` przez nowy lekki hook i sformatować czystym helperem.
3. Utworzyć jedną instancję `StudentSettingsMenu` przekazaną tylko do `StudentHeaderBar`.
4. Zamontować nagłówek bezpośrednio pod `StickyNav`.
5. Zachować `IntakeExtractionBanner` i wszystkie query params.
6. Objąć obecny `<Tabs>` oraz desktop snapshot gridem `lg:grid-cols-[minmax(0,1fr)_280px]`.
7. Mobile snapshot umieścić między bannerem a zakładkami; desktop snapshot w prawej kolumnie.
8. `onOpenModel` w M3 wywołuje starą ścieżkę `handleTabChange('dslm')`, zachowując `view` zgodnie z aktualnym zachowaniem strony.
9. Po potwierdzeniu działania menu usunąć ze starej karty Overview wyłącznie zdublowane kontrolki Edit/Delete oraz inline `MeetingLinkField`; dane karty pozostają do M4/M7. Nie usuwamy pozostałej zawartości Overview.
10. Usunąć stary lokalny stan `deleteConfirmName` i importy używane wyłącznie przez przeniesiony dialog.

To daje stan przejściowy bez dwóch destrukcyjnych przycisków i bez dwóch edytorów meeting linku, ale nie zmienia żadnego starego celu zakładki.

## 7. Kompatybilność z M4–M8

- M4 dostanie gotową ramę i nie będzie ponownie projektować identyfikacji ucznia.
- M5/M6 wchodzą wyłącznie w lewą kolumnę; snapshot nie zależy od ich danych.
- M7 wymieni siedem zakładek na cztery oraz zmieni wyłącznie implementację `onOpenModel`; M3 nie importuje `resolveTab()`.
- Stare `?tab=dslm&view=pathway`, `?tab=tests&testId=...`, `?tab=flashcards&set=...` pozostają nietknięte.
- `StudentEditDialog` i `MeetingLinkField` zachowują obecne kontrakty i logikę zapisu.
- RAG (`docs/llm-context.md`, `public/llms.txt`) pozostaje świadomie w M8, zgodnie z zaakceptowaną kolejnością całego Student Workspace; M3 aktualizuje tylko specyfikację techniczną i roadmapę.

## 8. Weryfikacja atomowa

1. Testy helperów snapshotu.
2. `bunx tsgo --noEmit -p tsconfig.app.json`.
3. Uruchomienie właściwego zestawu testów Vitest dla `src/lib/students`.
4. Playwright od `/demo`: wejście do przykładowego ucznia przez interfejs, nie przez zgadywany identyfikator.
5. Screenshot 1280×1800: nagłówek, stare zakładki i desktop snapshot; brak nakładania oraz poziomego scrolla.
6. Sprawdzenie menu: Edit, Meeting link, Delete; Delete wymaga pełnego imienia.
7. Sprawdzenie demo: każda próba mutacji kończy się komunikatem demo i zerem requestów zapisu.
8. Sprawdzenie adresów: `dslm`, `overview`, `tests&testId`, `flashcards&set`, `intake` nie tracą parametrów ani nie zmieniają znaczenia.
9. Sprawdzenie klawiaturą: Back → More actions → tabs → treść → snapshot; Escape zamyka menu/dialog, focus wraca do triggera.
10. Sprawdzenie ciemnego motywu i tokenów semantycznych; brak surowych kolorów w nowym kodzie.
11. Kontrola pojedynczości: jeden H1, jeden Back, jedno menu ustawień, jeden edytor meeting linku, brak widocznego kosza przy Student Details.
12. Po PASS: aktualizacja angielskiej specyfikacji i oznaczenie M3 jako ukończonego w roadmapie.

## Zero regressions confirmed — lista obowiązkowa przed zamknięciem

- wszystkie stare zakładki nadal otwierają tę samą treść;
- URL i parametry głębokich linków nie są przepisywane w M3;
- generowanie arkusza używa dokładnie obecnego przepływu;
- DSLM i jego podwidoki nie są zmieniane;
- edycja ucznia zapisuje te same pola przez `updateStudent`;
- usuwanie nadal używa `soft_delete_student` i type-to-confirm;
- meeting link nadal używa `MeetingLinkField` oraz istniejącego `gcal-sync`;
- demo nie wykonuje mutacji;
- brak migracji, zmian RLS i nowych zależności.

## Out of scope issues noted

- Pełne przejście na cztery zakładki i kanoniczny routing — M7.
- Zastąpienie Overview przez Prep — M4/M7.
- Lazy loading zakładek — M7.
- Porządki w starych panelach i martwym kodzie — M8.
- Znany wcześniejszy przypadek zatrzymania `/demo` na szkielecie ładowania: M3 najpierw reprodukuje go przez nawigację UI; naprawa nastąpi tylko wtedy, gdy nowy kod M3 okaże się przyczyną. Inaczej zostaje osobnym zadaniem.

## Kryterium zakończenia M3

M3 jest ukończone dopiero wtedy, gdy nowa rama jest czytelna i funkcjonalna, wszystkie stare zakładki nadal działają, ustawienia nie są zdublowane, demo pozostaje read-only, testy oraz TypeScript przechodzą, a Playwright potwierdza rzeczywisty widok. Samo utworzenie trzech komponentów nie wystarcza.
