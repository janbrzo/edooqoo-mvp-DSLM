# Faza M7 — przełączenie Student Workspace na 4 zakładki

## Cel fazy

M7 kończy okres przejściowy rozpoczęty w M3–M6. Strona `/student/:id` przestaje pokazywać dziesięć równorzędnych zakładek i staje się jednym, przewidywalnym miejscem pracy nauczyciela z czterema zadaniowymi obszarami:

1. **Prep** — co przygotować na następną lekcję,
2. **Timeline** — co wydarzyło się ze studentem i co wymaga reakcji,
3. **Library** — gdzie znaleźć oraz ponownie wykorzystać materiały,
4. **Learning model** — dlaczego system rekomenduje dany kierunek i jak nim sterować.

To nie jest kosmetyczne skrócenie paska. M7 przełącza źródło prawdy dla routingu, przenosi stan nawigacyjny do URL, opóźnia ładowanie ciężkich obszarów i utrzymuje możliwość wykonania czynności dostępnych dotąd w starych zakładkach.

M7 nie modyfikuje Worksheet Generation Engine, logiki DSLM, zapytań RLS, migracji ani Edge Functions. RAG (`docs/llm-context.md`, `public/llms.txt`) pozostaje wyłącznie w M8.

---

## 1. Zweryfikowany stan wyjściowy

### Affected surface

| Obszar | Zweryfikowany stan | Znaczenie dla M7 |
|---|---|---|
| `src/pages/StudentPage.tsx` | 1383 linie, 10 widocznych triggerów i 13 paneli `TabsContent`; `activeTab` bierze surowe `?tab=` i domyślnie wybiera `dslm` | To główny punkt przełączenia na nowy kontrakt |
| `src/lib/students/workspaceTabs.ts` | Gotowe i przetestowane: 4 kanoniczne zakładki, 12 aliasów, `resolveWorkspaceParams()`, zachowanie parametrów | Kod istnieje, ale `StudentPage` jeszcze go nie używa |
| `src/lib/students/__tests__/workspaceTabs.test.ts` | Testuje aliasy, idempotencję i zachowanie parametrów | Trzeba rozszerzyć testy o nowe helpery zmian użytkownika |
| `src/lib/students/quickAccess.ts` | `studentPrepPath()` nadal zwraca `?tab=dslm` | Wejścia z Dashboardu omijają docelny Prep |
| `PrepTab` | Gotowy, lekki komponent prezentacyjny | Pozostaje eager i staje się domyślny |
| `TimelineTab` | Gotowy strumień zdarzeń; filtr i limit są stanem lokalnym strony | Filtr trzeba zsynchronizować z `?filter=` |
| `LibraryTab` | Gotowy; sekcja, wyszukiwanie i sort są stanem lokalnym strony; sloty Flashcards/Homework istnieją, ale nie są podłączone | Sekcję trzeba zsynchronizować z `?section=` i podłączyć sloty |
| `DSLMTab` | Ciężki widok, wewnętrznie zapisuje `tab=dslm` | Musi być lazy i zapisywać `tab=model` |
| stare panele | Overview, Worksheets, Homework, Flashcards, Calendar, Tests oraz ukryte Progress/Skills/Knowledge/Events nadal znajdują się w `StudentPage` | Triggery znikają w M7; kod źródłowy komponentów usuwamy dopiero w M8 |
| producenci linków | Dashboard, powiadomienia, onboarding, kalendarz i e-mail z Edge Function nadal emitują `dslm`, `tests`, `flashcards` itd. | Alias map pozostaje trwałą granicą kompatybilności |
| `App.tsx` | Cała strona jest lazy na poziomie routingu, ale wewnętrzne zakładki nie mają osobnych chunków | M7 dodaje drugi poziom lazy-loading |

### Root cause

**Root cause:** interfejs ma już cztery nowe obszary, ale nadal używa starego, rozproszonego modelu routingu i renderuje stare panele obok nowych, więc struktura wizualna, URL oraz moment ładowania danych opisują trzy różne wersje tej samej strony.

### Ważna luka wykryta w audycie

Samo usunięcie starych triggerów i przekierowanie `tests`, `calendar` oraz `homework` do filtrów Timeline zachowałoby poprawny adres, ale mogłoby odebrać nauczycielowi pełne działania dostępne dziś w `StudentTestsTab`, `StudentCalendarTab` i `StudentHomeworkTab`. Szczególnie `?tab=tests&testId=...` pochodzi z powiadomień i e-maili, a obecny `TimelineTab` nie otwiera szczegółów testu.

Dlatego M7 musi rozróżnić dwie warstwy:

- **nawigację główną** — wyłącznie 4 zakładki,
- **narzędzia kontekstowe** — istniejące pełne widoki ładowane dopiero wtedy, gdy nauczyciel wybierze odpowiedni filtr/sekcję lub wejdzie ze starego głębokiego linku.

---

## 2. Badania UX i wynikające decyzje

### Wnioski z praktyk branżowych

- WAI-ARIA definiuje zakładki jako jeden `tablist`, jeden aktywny `tab` i odpowiadający mu `tabpanel`; strzałki powinny przenosić fokus pomiędzy zakładkami. Radix używany przez projekt zapewnia ten mechanizm, dlatego główny pasek pozostaje prawdziwym komponentem Tabs, a nie czterema przypadkowymi przyciskami. Źródło: [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
- Automatyczne przełączanie fokusem jest właściwe tylko wtedy, gdy panel pojawia się bez odczuwalnej zwłoki. Ponieważ Timeline, Library i Model będą lazy-loaded, pozostawiamy standardowe zachowanie Radix i zapewniamy natychmiastowy szkielet o stabilnej wysokości. Źródło: [WAI-ARIA Automatic Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/).
- Cztery stałe, opisane zakładki są lepsze niż dziesięć ikon bez tekstu: etykiety `Prep`, `Timeline`, `Library`, `Learning model` pozostają widoczne na każdej szerokości. Dla nieoczywistych ikon tekst jest niezbędny do szybkiego rozpoznania funkcji. Źródło: [Nielsen Norman Group — Icon Usability](https://www.nngroup.com/articles/icon-usability/).
- Na małym ekranie cztery pozycje muszą pozostać dostępne bez ukrywania nazw. Material zaleca scrollowalne zakładki, gdy pełne etykiety przestają się mieścić; tutaj wybieramy stabilną siatkę z krótszą widoczną etykietą `Model` na wąskim ekranie i pełnym dostępnym opisem `Learning model`, zamiast poziomego scrolla. Źródło: [Material Design 3 — Tabs accessibility](https://m3.material.io/components/tabs/accessibility).
- Snapshot pozostaje zwinięty na mobile i sticky na desktopie. To właściwa progresywna ekspozycja: kontekst jest dostępny, ale nie konkuruje z bieżącym zadaniem. Źródło: [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

### Martha Test

- Nauczyciel nie widzi nazw technicznych typu „DSLM” ani obiektowego katalogu funkcji.
- Pierwszy ekran odpowiada na profesjonalne pytanie: „co mam przygotować dla tej konkretnej osoby?”.
- Historia, materiały i model ucznia są oddzielone według rzeczywistych zadań tutora, nie według tabel systemowych.
- Pełne narzędzia testów, lekcji, homework i flashcards pozostają osiągalne — redukcja nawigacji nie może oznaczać redukcji pracy nauczyciela.

---

## 3. Rozważone rozwiązania

| Opcja | Podejście | Zaleta | Koszt / ryzyko | Ryzyko regresji |
|---|---|---|---|---|
| A. Tylko ukryć stare triggery | 4 zakładki na górze, stare panele pozostają w pliku, aliasy wskazują nowe filtry | Najmniej kodu | Głębokie linki do testów zachowują URL, ale mogą utracić szczegóły i akcje; ciężkie zależności nadal trafiają do chunku | Wysokie |
| B. 4 zakładki + trwały router + lazy, bez pełnych starych narzędzi | Kanoniczne URL-e i wydajność zgodne ze specyfikacją | Czysta architektura | Funkcjonalna redukcja Tests/Calendar/Homework; nie spełnia zasady zero regresji | Średnie–wysokie |
| **C. 4 zakładki + trwały router + lazy + kontekstowe narzędzia kompatybilności** | Nowe obszary pozostają główną nawigacją; stare pełne narzędzia są lazy i pojawiają się tylko w odpowiadającej sekcji/filtrze | Zachowuje prosty widok i istniejące czynności; nie ładuje ciężkich modułów bez potrzeby | Więcej dokładnego montażu i testów URL | **Niskie** |
| D. Osobne nowe podstrony dla Tests/Homework/Calendar | Każde narzędzie dostaje własną trasę | Najczystsze długoterminowo | Zmienia zatwierdzony model M0–M8, wymaga nowej architektury i migracji linków | Średnie |

### Wybrane rozwiązanie

Wybieramy **opcję C**. Jest jedyną, która jednocześnie realizuje cztery zadaniowe zakładki, ogranicza koszt początkowego ładowania i nie zamienia „kompatybilnego przekierowania” w utratę istniejącej funkcji.

Nowa nawigacja pozostaje prosta. Pełne narzędzia są drugorzędne i pojawiają się dopiero po świadomym wejściu w odpowiedni filtr lub sekcję, więc nie obciążają pierwszego ekranu Prep.

---

## 4. Docelowy widok `/student/:id` po M7

### Desktop

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ StickyNav                                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│ ‹  Anna Kowalska · B1 · job interviews · next lesson Tue 18:00      [⋯] │
├─────────────────────────────────────────────────┬────────────────────────┤
│ [ Prep ] [ Timeline ] [ Library ] [ Learning model ]                     │
│                                                 │ STUDENT SNAPSHOT       │
│ aktywny panel                                   │ Level      B1          │
│                                                 │ Goal       Job...      │
│ Prep: następna lekcja                           │ Deadline   12 Nov      │
│ Timeline: strumień + filtr + narzędzie kontekstu│ Focus areas            │
│ Library: segment + materiały                    │ Student Hub enabled    │
│ Model: pełny DSLM                               │ [Open learning model]  │
└─────────────────────────────────────────────────┴────────────────────────┘
```

### Mobile 360–1023 px

```text
┌──────────────────────────────────────┐
│ ‹ Anna Kowalska · B1             [⋯] │
│ job interviews · Tue 18:00           │
├──────────────────────────────────────┤
│ Student snapshot · B1 · Job...    ⌄  │
├──────────────────────────────────────┤
│ [Prep] [Timeline] [Library] [Model]  │
├──────────────────────────────────────┤
│ aktywny panel                         │
└──────────────────────────────────────┘
```

Rozstrzygnięcia:

- Kolejność zawsze: **Prep → Timeline → Library → Learning model**.
- Ikony: `Sparkles`, `Activity`, `FileText`, `Brain`.
- Na szerokości `sm` i wyżej pełna etykieta `Learning model`; poniżej `sm` widoczne `Model`, natomiast `aria-label` i `title` pozostają `Learning model`. Pozostałe trzy nazwy nie są skracane.
- `TabsList`: `grid w-full grid-cols-4`, stała wysokość co najmniej 44 px na mobile, bez icon-only i bez poziomego scrolla.
- Pasek nie jest sticky niezależnie od nagłówka; unikamy dwóch konkurujących sticky warstw. Sticky pozostaje tylko desktopowy Snapshot.
- Fokus klawiatury i aktywny stan zapewnia Radix. Nie tworzymy własnego systemu klawiszy.
- Każdy lazy panel ma stabilny lokalny skeleton; nagłówek, Snapshot i pasek zakładek nie znikają podczas ładowania.

---

## 5. Kanoniczny kontrakt URL

### 5.1 Cztery adresy główne

| Stan | Kanoniczny URL |
|---|---|
| Prep | `?tab=prep` |
| Timeline | `?tab=timeline&filter=<filter>` |
| Library | `?tab=library&section=<section>` |
| Learning model | `?tab=model&view=<view>` |

Brak `tab`, pusty `tab` i nieznany `tab` zawsze przechodzą do `?tab=prep`.

### 5.2 Alias map pozostaje permanentny

| Stary adres | Kanoniczny stan | Zachowana funkcja |
|---|---|---|
| `overview` | `prep` | nowy ekran przygotowania |
| `dslm`, `1minute` | `model` | pełny DSLM |
| `progress` | `model&view=pathway` | Pathway |
| `skills` | `model&view=skills` | Skills |
| `knowledge`, `events` | `model&view=profile` | profil/notatki |
| `worksheets` | `library&section=worksheets` | lista, wyszukiwanie, reuse, deleted |
| `flashcards` | `library&section=flashcards` | pełny `FlashcardSetsSection`, w tym `set` |
| `homework` | `timeline&filter=homework` | zdarzenia homework + pełne narzędzie Homework |
| `tests` | `timeline&filter=tests` | zdarzenia testowe + pełne narzędzie Tests; `testId` otwiera szczegół |
| `calendar` | `timeline&filter=lessons` | zdarzenia lekcji + pełny kalendarz ucznia |

### 5.3 Zasady historii przeglądarki

- **Automatyczna normalizacja** starego, pustego lub błędnego URL: `replace: true`. Back nie może prowadzić do tej samej strony w starej postaci ani tworzyć pętli.
- **Świadome kliknięcie głównej zakładki, filtra Timeline albo segmentu Library:** zwykły wpis historii (`push`). Back/Forward ma odtwarzać poprzedni widok.
- **Czyszczenie jednorazowych parametrów** (`focus`, `_`) pozostaje `replace: true`, jak dziś.
- Nie utrzymujemy osobnego `activeTab` w `useState`. Aktywna zakładka jest wyliczana bezpośrednio z `resolveWorkspaceParams(searchParams)`, co usuwa możliwość rozjazdu UI z paskiem adresu.

### 5.4 Parametry

- Trwale zachowywane podczas automatycznej normalizacji: `set`, `intake`, `view`, `focus`, `testId`, `_`, `editSuggestion`.
- Parametry należące do innego obszaru są usuwane przy ręcznej zmianie głównej zakładki:
  - wejście do Prep usuwa `section`, `filter`, `view`, `focus`, `testId`, `set`, `editSuggestion`, `_`, ale zachowuje `intake`;
  - wejście do Timeline usuwa `section`, `view`, `set`, `editSuggestion`; zachowuje/ustawia `filter` i ewentualny `testId` tylko dla Tests;
  - wejście do Library usuwa `filter`, `view`, `focus`, `testId`, `editSuggestion`, `_`; zachowuje `set` wyłącznie dla sekcji Flashcards;
  - wejście do Model usuwa `section`, `filter`, `testId`, `set`; zachowuje `view`, `focus`, `editSuggestion`, `_`.
- Nieznane parametry nie są kopiowane przez automatyczny resolver. To utrzymuje obecny whitelistowy kontrakt i nie pozwala narastać starym stanom w URL.
- `librarySearch`, `librarySort`, paginacje i `timelineVisibleCount` pozostają lokalnym stanem sesji widoku. Do URL trafiają tylko stany nawigacyjne: `tab`, `section`, `filter`, `view` i identyfikatory głębokich wejść.

---

## 6. Architektura techniczna

### 6.1 Jedno źródło prawdy dla URL

`workspaceTabs.ts` zostaje rozszerzony o czyste helpery używane zarówno przez komponent strony, jak i testy:

```ts
export type WorkspaceNavigationTarget =
  | { tab: 'prep' }
  | { tab: 'timeline'; filter?: TimelineFilter; testId?: string }
  | { tab: 'library'; section?: LibrarySection; set?: string }
  | { tab: 'model'; view?: string; focus?: string; cacheKey?: string };

export function buildWorkspaceParams(
  current: URLSearchParams,
  target: WorkspaceNavigationTarget,
): URLSearchParams;
```

Reguły czyszczenia z sekcji 5.4 będą zapisane raz w tym helperze. `StudentPage`, Snapshot, Prep, Timeline i Library nie będą ręcznie konstruować obiektów `{ tab: ... }`.

`resolveWorkspaceParams()` nadal odpowiada za wejścia zewnętrzne i aliasy. `buildWorkspaceParams()` odpowiada wyłącznie za świadome przejścia użytkownika wewnątrz strony.

### 6.2 Routing w `StudentPage`

Na początku komponentu:

```ts
const workspace = useMemo(
  () => resolveWorkspaceParams(searchParams),
  [searchParams],
);
const activeTab = workspace.resolved.tab;
const timelineFilter = workspace.resolved.filter ?? 'all';
const librarySection = workspace.resolved.section ?? 'worksheets';
```

Efekt normalizujący:

```ts
useEffect(() => {
  if (!workspace.changed) return;
  setSearchParams(workspace.next, { replace: true });
}, [workspace, setSearchParams]);
```

W implementacji zależności efektu muszą opierać się na stabilnym `searchParams.toString()` lub zmemowanym wyniku, aby nie powodować ponownego zapisu po każdym renderze.

`handleTabChange`, `handleTimelineFilterChange`, `handleLibrarySectionChange`, `handleFlashcardSetChange` i `handleTimelineNavigate` używają wspólnego helpera. Nie pozostaje lokalny `redirectMap`.

### 6.3 Lazy-loading

Eager:

- `PrepTab` — to domyślny i najczęściej używany panel.

Lazy, osobne importy:

- `TimelineTab`,
- `LibraryTab`,
- `DSLMTab`,
- `DslmExplainerBanner`, jeśli bundler nie wydzieli go razem z modelem,
- `FlashcardSetsSection`,
- `StudentHomeworkTab`,
- `StudentTestsTab`,
- `StudentCalendarTab`.

Każdy import ma jawny adapter dla named export, np.:

```ts
const LazyTimelineTab = React.lazy(() =>
  import('@/components/student/timeline/TimelineTab').then((module) => ({
    default: module.TimelineTab,
  })),
);
```

Warunki montażu:

- `TimelineTab` tylko przy `activeTab === 'timeline'`;
- pełne narzędzie lekcji tylko przy `timelineFilter === 'lessons'`;
- pełne narzędzie homework tylko przy `timelineFilter === 'homework'`;
- pełne narzędzie testów tylko przy `timelineFilter === 'tests'`;
- `LibraryTab` tylko przy `activeTab === 'library'`;
- Flashcards tylko przy `librarySection === 'flashcards'`;
- Homework w Library tylko przy `librarySection === 'homework'`;
- DSLM i banner tylko przy `activeTab === 'model'`.

Wszystkie lazy panele dostają `<Suspense fallback={<SectionSkeleton />}>`. Szkielet jest lokalny wewnątrz prawej kolumny treści; nie zastępuje całej strony.

### 6.4 Warstwa kompatybilności narzędzi

#### Timeline

`TimelineTab` pozostaje jednym strumieniem zdarzeń i nie dostaje logiki biznesowej starych komponentów. `StudentPage` renderuje pod nim opcjonalny, lazy-loaded panel narzędziowy:

```text
Timeline filters
Event stream for selected filter
────────────────────────────────
Context tool, only for Lessons / Homework / Tests
```

- Lessons → `StudentCalendarTab`.
- Homework → `StudentHomeworkTab`.
- Tests → `StudentTestsTab`.
- All / Worksheets / Notes → bez dodatkowego panelu.

Panel jest rodzeństwem, nie kartą wewnątrz karty, aby uniknąć card-inside-card. Dostaje krótki nagłówek sekcji, ale bez tekstu instruktażowego opisującego produkt.

`StudentTestsTab` otrzyma opcjonalny prop `initialSelectedTestId?: string | null` i efekt synchronizujący `selectedTestId`, kiedy zmieni się `testId` w URL. Dzięki temu link z e-maila/powiadomienia faktycznie otworzy wynik, a nie tylko ogólną listę.

Zdarzenie testowe w `timelineEvents.ts` będzie prowadzić do `?tab=tests&testId=<id>`, zachowując permanentny alias jako wejście do resolvera. Test reguły zostanie zaktualizowany.

#### Library

`LibraryTab` wykorzystuje istniejące sloty:

- `flashcardsSlot` → lazy `FlashcardSetsSection`,
- `homeworkSlot` → lazy `StudentHomeworkTab`.

`initialEditingSetId` bierze `set` tylko wtedy, gdy aktywna sekcja to Flashcards. `onSetChange` zapisuje kanoniczny `tab=library&section=flashcards&set=...`.

Homework celowo jest osiągalne z dwóch kontekstów:

- Timeline/Homework — reakcja na zdarzenia i zaległości,
- Library/Homework — praca z materiałami przypisanymi jako homework.

To nie są dwie osobne implementacje; oba miejsca lazy-montują ten sam komponent i nigdy jednocześnie.

### 6.5 Learning model

- Trigger i URL używają `model`; etykieta UI to `Learning model`/`Model` na mobile.
- `DSLMTab.handleScrollTo()` zapisuje `tab=model`, nie `tab=dslm`.
- Linki z `OnboardingChecklist`, `AddStudentDialog`, `SlotDetailModal`, `PacingProposalsBell` i `NextStepsPresetBanner` mogą nadal emitować `dslm`; celowo pozostają jako test trwałości aliasów.
- `view`, `focus`, `_`, `intake` i `editSuggestion` muszą dotrzeć do DSLM bez zmiany znaczenia.
- `focus` i `_` nadal są konsumowane z `replace: true`, aby ponowne kliknięcie tej samej akcji działało.
- Pełny kontrakt propsów DSLM pozostaje bez zmian. Nie refaktoryzujemy wnętrza modelu.

---

## 7. Kolejność wdrożenia — małe klocki

### M7.1 — Utwardzenie kontraktu routingu, zero UI

**Pliki:**

- `src/lib/students/workspaceTabs.ts`
- `src/lib/students/__tests__/workspaceTabs.test.ts`
- `src/lib/students/quickAccess.ts`
- `src/lib/students/__tests__/quickAccess.test.ts`

**Zmiany:**

1. Dodać `editSuggestion` do zachowywanych parametrów, ponieważ `PathwayView` konsumuje go po wejściu do modelu.
2. Dodać `WorkspaceNavigationTarget` i `buildWorkspaceParams()` z dokładnymi regułami czyszczenia per zakładka.
3. Utrzymać wszystkie 12 aliasów bez zmiany znaczenia.
4. Zmienić `studentPrepPath(studentId)` na `/student/${studentId}?tab=prep`.
5. Nie modyfikować pozostałych producentów starych URL-i — ich przejście przez resolver jest częścią testu kompatybilności.

**Testy:**

- wszystkie 4 kanoniczne zakładki;
- 12 aliasów;
- brak/pusty/nieznany/case/whitespace;
- zachowanie `set`, `intake`, `view`, `focus`, `testId`, `_`, `editSuggestion`;
- jawny parametr wygrywa z domyślną wartością aliasu;
- idempotencja;
- brak mutacji wejściowego `URLSearchParams`;
- budowanie każdej nawigacji głównej;
- usuwanie parametrów obcego obszaru;
- zachowanie `intake` przy ręcznej zmianie zakładki;
- `testId` tylko dla Timeline/Tests;
- `set` tylko dla Library/Flashcards;
- `studentPrepPath()` wskazuje Prep.

**Weryfikacja:**

```text
bunx vitest run src/lib/students
bunx tsgo --noEmit -p tsconfig.app.json
```

Ekran pozostaje bez zmian.

### M7.2 — Podłączenie resolvera i URL jako źródła prawdy

**Plik:** `src/pages/StudentPage.tsx`

**Zmiany:**

1. Importować `resolveWorkspaceParams()` i `buildWorkspaceParams()`.
2. Usunąć lokalny `activeTab` oraz efekt kopiujący surowy `tab` z URL.
3. Usunąć lokalny `timelineFilter` i `librarySection`; wyliczać je z kanonicznego URL.
4. Zachować lokalnie tylko stany nietransportowe: `timelineVisibleCount`, `librarySearch`, `librarySort`, paginacje.
5. Dodać jeden efekt normalizujący aliasy z `replace: true`.
6. Przepisać pięć handlerów na wspólny helper.
7. Zmiana filtra Timeline resetuje `timelineVisibleCount` do 25.
8. Zmiana sekcji Library resetuje wyszukiwanie i stronę arkuszy do 1.
9. Back/Forward działa przez zmianę `searchParams`, bez dodatkowego efektu synchronizującego state.
10. `useStudentTimelineSources(..., activeTab === 'timeline')` pozostaje gate'em zapytań.

**Weryfikacja:**

- typecheck;
- jednostkowe testy URL;
- ręczny odczyt URL po tab/filter/section;
- brak pętli efektu w konsoli.

### M7.3 — Przełączenie paska na 4 zakładki

**Plik:** `src/pages/StudentPage.tsx`

**Zmiany:**

1. `TabsList` z `grid-cols-10` na `grid-cols-4`.
2. Pozostawić tylko cztery triggery w kolejności z `WORKSPACE_TABS`.
3. Ustawić wartości `prep`, `timeline`, `library`, `model`.
4. Ikony: `Sparkles`, `Activity`, `FileText`, `Brain`.
5. Usunąć `hidden lg:inline`; każda zakładka ma widoczną nazwę.
6. Dla czwartej nazwy użyć `Model` poniżej `sm` i `Learning model` od `sm`, bez zmiany nazwy dostępnościowej.
7. Pozostawić Radixowi `role`, `aria-selected`, `aria-controls`, roving focus oraz klawisze strzałek.
8. Usunąć z JSX stare triggery i stare `TabsContent`; nie usuwać jeszcze plików źródłowych komponentów — to M8.
9. Przepiąć wewnętrzne akcje:
   - Prep „Open learning model” → `model`;
   - Prep „Open library” → `library/worksheets`;
   - Prep „View all notes” → `model/profile`;
   - Snapshot „Open learning model” → `model`;
   - Timeline linki względne przechodzą przez resolver zamiast ręcznego odczytu `tab`.

**Weryfikacja wizualna:**

- 360×800: wszystkie cztery etykiety widoczne, brak poziomego scrolla i nakładania;
- 768×1024: równy podział, widoczny fokus;
- 1280×1800: pasek nad treścią, Snapshot w prawej kolumnie;
- klawiatura: Tab wchodzi do aktywnej zakładki, Left/Right zmienia fokus/zakładkę zgodnie z Radix.

### M7.4 — Lazy-loading czterech obszarów

**Pliki:**

- `src/pages/StudentPage.tsx`
- istniejący `src/components/dslm/SectionSkeleton.tsx` użyty bez zmiany wyglądu albo przeniesiony do neutralnego katalogu dopiero w M8

**Zmiany:**

1. Prep pozostawić statyczny/eager.
2. Timeline, Library i DSLM zamienić na dynamiczne importy.
3. Dodać osobne lokalne `Suspense` dla każdego aktywnego panelu.
4. Renderować panel wyłącznie wtedy, gdy jego `activeTab` jest aktywny; sam import bez warunku nie może pobrać chunku na wejściu do Prep.
5. Nie dodawać pełnoekranowego spinnera ani pustego fallbacku.
6. Nie prefetchować Model, bo jest najcięższym i najrzadziej potrzebnym pierwszym widokiem.
7. Zachować istniejący route-level lazy w `App.tsx`; nie zmieniać routingu SPA ani `BrowserRouter`.

**Weryfikacja:**

- pierwsze wejście do Prep nie pobiera chunków Timeline/Library/Model;
- pierwsze kliknięcie pokazuje skeleton bez skoku nagłówka i Snapshotu;
- powrót do już pobranego panelu jest natychmiastowy;
- błąd chunku nie powoduje nieskończonego pełnoekranowego loadera; istniejąca granica błędu aplikacji pozostaje odpowiedzialna za błąd importu.

### M7.5 — Pełna kompatybilność narzędzi starych zakładek

**Pliki:**

- `src/pages/StudentPage.tsx`
- `src/components/student-tests/StudentTestsTab.tsx`
- `src/lib/students/timelineEvents.ts`
- `src/lib/students/__tests__/timelineEvents.test.ts`

**Zmiany:**

1. Lazy-importować `StudentCalendarTab`, `StudentHomeworkTab`, `StudentTestsTab`, `FlashcardSetsSection`.
2. Podłączyć Flashcards i Homework do istniejących slotów `LibraryTab`.
3. Pod Timeline renderować kontekstowy panel dla filtrów Lessons/Homework/Tests.
4. Rozszerzyć `StudentTestsTabProps` o `initialSelectedTestId?: string | null`.
5. Ustawić początkowy `selectedTestId` z URL i synchronizować go po Back/Forward.
6. Po zamknięciu szczegółu testu usuwać `testId` przez kanoniczny helper z `replace: true`, bez opuszczania filtra Tests.
7. Zdarzenie `test_result` dostaje link z `testId`.
8. `FlashcardSetsSection.onSetChange` zapisuje kanoniczny URL Library.
9. Komponenty nie są montowane w tle i nie wysyłają zapytań, gdy odpowiadający filtr/segment nie jest aktywny.
10. Wszystkie mutacje nadal przechodzą przez istniejące guardy demo; M7 nie zmienia ich logiki.

**Weryfikacja funkcjonalna:**

- legacy `tests&testId` otwiera dokładny test;
- legacy `calendar` pokazuje Lessons i kalendarz ucznia;
- legacy `homework` pokazuje wydarzenia Homework i pełne narzędzie;
- legacy `flashcards&set` otwiera wskazany zestaw;
- Library/Homework i Timeline/Homework używają tego samego komponentu, ale nigdy nie montują go jednocześnie;
- przejście do Prep zatrzymuje montaż ciężkich narzędzi.

### M7.6 — Kanoniczne zapisy wewnętrzne bez migracji wszystkich linków

**Pliki:**

- `src/components/dslm/DSLMTab.tsx`
- ewentualnie bezpośrednie dzieci, które zapisują `tab=dslm` przez `setSearchParams`

**Zmiany:**

1. Wewnętrzna nawigacja już otwartego Modelu zapisuje `tab=model`.
2. Nie przepisywać masowo zewnętrznych historycznych producentów — ich obsługa dowodzi, że alias jest permanentny.
3. Jedynym globalnym producentem zmienionym świadomie jest `studentPrepPath()`, bo jego kontraktem jest „otwórz Prep”, nie „otwórz DSLM”.
4. Edge Function z linkiem `?tab=tests` pozostaje nietknięta.
5. Nie dodawać `_redirects`, `vercel.json` ani zmian hostingu; Lovable obsługuje deep-linki SPA automatycznie.

**Weryfikacja:**

- kliknięcie Pathway/Goals/Skills/Profile w Modelu nie wraca do aliasu `dslm`;
- stare linki z onboardingiem nadal działają;
- brak utraty `focus`, `_`, `editSuggestion`.

### M7.7 — Pełna macierz regresji przeglądarkowej

Nie dodajemy nowej infrastruktury Playwright do repo tylko dla tej fazy. Weryfikacja jest wykonywana skryptem w `/tmp/browser/`, zgodnie z obecnym procesem projektu.

#### Macierz URL

| Wejście | Oczekiwany URL po normalizacji | Oczekiwany widok |
|---|---|---|
| brak `tab` | `tab=prep` | Prep |
| `overview` | `tab=prep` | Prep |
| `dslm` | `tab=model` | Learning model |
| `1minute` | `tab=model` | Learning model |
| `progress` | `tab=model&view=pathway` | Pathway |
| `skills` | `tab=model&view=skills` | Skills |
| `knowledge` | `tab=model&view=profile` | Profile/notes |
| `events` | `tab=model&view=profile` | Profile |
| `worksheets` | `tab=library&section=worksheets` | Worksheets |
| `flashcards&set=x` | `tab=library&section=flashcards&set=x` | wskazany zestaw |
| `homework` | `tab=timeline&filter=homework` | Homework + narzędzie |
| `calendar` | `tab=timeline&filter=lessons` | Lessons + kalendarz |
| `tests&testId=x` | `tab=timeline&filter=tests&testId=x` | szczegół testu |
| nieznany / pusty / whitespace | `tab=prep` | Prep |

#### Scenariusze interakcyjne

1. Direct load każdego adresu.
2. Reload po normalizacji.
3. Prep → Timeline → Library → Model.
4. Back trzy razy, następnie Forward trzy razy.
5. Zmiana Timeline filter i Library section, potem Back/Forward.
6. Deep link Model z `view`, `focus`, `_`, `intake`, `editSuggestion`.
7. Zamknięcie test details usuwa tylko `testId`.
8. Dismiss Intake usuwa tylko `intake`.
9. Console: zero nowych errorów i warningów routingu.
10. Network: brak pobrania chunków nieaktywnych paneli na pierwszym Prep.

#### Viewporty

- desktop: 1280×1800 obowiązkowy dla głównego przebiegu;
- mobile: 360×800;
- tablet/laptop: 768×1024 i 1024×900.

Ze względu na `LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged` pełne testy danych prawdziwego konta nie są dostępne. `/demo` służy do sprawdzenia ramy, URL, zakładek, skeletonów, overflow i konsoli. Głębokie funkcje wymagające realnego UUID/testu muszą zostać oznaczone jako ręczna weryfikacja po stronie użytkownika, nie jako domniemany PASS.

### M7.8 — Dokumentacja fazy, bez RAG

**Pliki:**

- `docs/ux/student-workspace-spec.md`
- `roadmap.md`

**Zmiany:**

1. Zaktualizować „Verified current state” po rzeczywistym montażu M7.
2. Uzupełnić sekcję URL o `buildWorkspaceParams`, `editSuggestion` i reguły push/replace.
3. Dopisać sekcję „M7 lazy boundaries and compatibility tools”.
4. Skorygować zapis o Timeline/Library local state: URL przejmuje tylko filtr/sekcję, nie wyszukiwanie, sort i paginację.
5. Oznaczyć M7.1–M7.8 oraz M7 jako zakończone dopiero po przejściu całej macierzy.
6. Nie aktualizować `docs/llm-context.md`, `public/llms.txt` ani pamięci — to atomowy zakres M8.

---

## 8. Pliki przewidziane do modyfikacji

### Reguły i testy

- `src/lib/students/workspaceTabs.ts`
- `src/lib/students/__tests__/workspaceTabs.test.ts`
- `src/lib/students/quickAccess.ts`
- `src/lib/students/__tests__/quickAccess.test.ts`
- `src/lib/students/timelineEvents.ts`
- `src/lib/students/__tests__/timelineEvents.test.ts`

### UI i routing

- `src/pages/StudentPage.tsx`
- `src/components/dslm/DSLMTab.tsx`
- `src/components/student-tests/StudentTestsTab.tsx`

### Dokumentacja M7

- `docs/ux/student-workspace-spec.md`
- `roadmap.md`

Nie przewidujemy zmian w `App.tsx`, bazie danych, Edge Functions ani Worksheet Generation Engine.

---

## 9. Impact analysis i zabezpieczenia regresji

### Zero regressions confirmed — elementy do sprawdzenia przed zamknięciem

- Dashboard Quick Search, Recent Students i All Students otwierają Prep.
- Onboarding deep links nadal otwierają właściwy obszar Modelu i właściwy spotlight.
- Add Student intake zachowuje `intake`, `focus` i `_`.
- Powiadomienie Welcome Test i e-mail otwierają właściwy wynik testu.
- Flashcard modal otwiera właściwy zestaw.
- Timeline actions prowadzą do działających narzędzi, a nie do tej samej filtrowanej listy bez efektu.
- Generate / Change topic / Reuse zachowują dokładnie obecny sessionStorage i `writeAutoGenerateIntent()`.
- Snapshot, edit, meeting link, Hub settings i type-to-confirm delete pozostają bez zmian.
- Demo mode nie wykonuje zapytań z demo ID jako UUID.
- Dark Mode działa wyłącznie w teacher shell jak dotychczas.
- Back/Forward i reload nie rozjeżdżają URL z aktywną zakładką.
- Pierwszy Prep nie montuje Timeline/Library/Model ani narzędzi kompatybilności.
- Wszystkie zakładki mają widoczne etykiety, fokus i brak overflow na 360 px.

### Ryzyka i kontrola

| Ryzyko | Kontrola |
|---|---|
| Pętla normalizacji URL | `resolveWorkspaceParams` jest idempotentny; zapis tylko przy `changed === true`, zawsze `replace` |
| Utrata głębokiego kontekstu | whitelist parametrów rozszerzona o `editSuggestion`; test każdego producenta |
| Lazy komponent nie pobiera się przez named export | jawne adaptery `{ default: module.NamedExport }` i typecheck |
| Nieaktywny moduł nadal odpytuje dane | conditional mount przed `Suspense`, kontrola Network |
| Back nie odtwarza filtra/sekcji | filter i section są wyliczane z URL, nie z lokalnego state |
| Duplikacja Homework | ten sam komponent, wzajemnie wykluczające warunki montażu |
| Migotanie starej zakładki przed rewrite | aktywny panel jest od pierwszego renderu wyliczony z resolvera; efekt zmienia tylko pasek adresu |
| Model nadpisuje canonical URL aliasem | wszystkie wewnętrzne zapisy DSLM przechodzą na `tab=model` |
| Test link zatrzymuje się na liście | `initialSelectedTestId` + synchronizacja z URL |

---

## 10. Pełna weryfikacja końcowa M7

### Automatyczna

```text
bunx vitest run src/lib/students
bunx tsgo --noEmit -p tsconfig.app.json
```

Oczekiwane: wszystkie istniejące i nowe testy PASS; zero błędów TypeScript.

### Playwright `/demo`

- wejście przez `/demo`, potem do przykładowego studenta;
- cztery zakładki widoczne;
- domyślny Prep;
- przejścia i adresy canonical;
- aliasy możliwe do wykonania na demo;
- Back/Forward;
- screenshot desktop 1280×1800;
- screenshot mobile 360×800;
- brak overflow;
- czysta konsola;
- brak requestów do nieaktywnych lazy obszarów.

### Ręczna weryfikacja na prawdziwym koncie

- `tests&testId` otwiera konkretny wynik;
- Flashcards `set` otwiera konkretny zestaw;
- Homework review działa z Timeline;
- Calendar action działa z Lessons;
- Generate worksheet i Reuse zachowują dotychczasowy payload;
- onboarding `focus=add-goal-modal`, `pick-idea`, `send-welcome-test`, `learning-roadmap` nadal trafia w cel.

### Kryterium PASS

M7 jest zakończone wyłącznie, gdy:

- wszystkie cztery zakładki działają jako jedyna główna nawigacja,
- każdy wpis z macierzy aliasów trafia do właściwego widoku,
- istniejące działania Tests/Homework/Calendar/Flashcards pozostają dostępne,
- lazy-loading jest potwierdzony w Network,
- testy i typecheck przechodzą,
- demo nie ma nowych błędów,
- dokumentacja M7 jest zgodna z implementacją.

---

## 11. Scope lock

### W zakresie

- cztery główne zakładki;
- permanentne aliasy i kanoniczne URL-e;
- URL jako źródło prawdy dla tab/filter/section/view;
- lazy-loading paneli;
- zachowanie pełnych działań starych zakładek jako narzędzi kontekstowych;
- testy, Playwright i dokumentacja M7.

### Poza zakresem — odnotowane, bez naprawy

- usuwanie nieużywanych plików i importów poza tymi koniecznymi do kompilacji — M8;
- RAG i pamięć projektu — M8;
- przebudowa wnętrza DSLM;
- refaktor `StudentHomeworkTab`, `StudentTestsTab`, `StudentCalendarTab` lub `FlashcardSetsSection`;
- zmiana Worksheet Generation Engine;
- backend, RLS, migracje, Edge Functions;
- nowe trasy dla narzędzi;
- przebudowa secondary controls `TimelineFilters` i `LibrarySegments` do pełnego APG keyboard model — osobny audyt dostępności, jeśli zostanie zlecony;
- naprawa znanego zatrzymania demo na skeletonie poza zakresem routingu M7.

---

## 12. Change report oczekiwany po implementacji

Końcowy raport M7 będzie zawierał:

- podsumowanie wdrożonych 4 zakładek i zachowanej kompatybilności;
- listę zmodyfikowanych plików;
- `Documentation updated: YES` dla spec i roadmapy;
- `RAG updated: NO — scheduled for M8`;
- odnotowane problemy poza zakresem;
- wynik testów, typecheck, Playwright i ręcznych ograniczeń;
- `Verification result: PASS/FAIL` bez deklarowania PASS dla scenariusza, którego nie można było uruchomić.
