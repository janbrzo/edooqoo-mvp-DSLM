# v6.9.111 — Faza M0: fundament dokumentacyjny Student Workspace (małe klocki)

M0 nie zmienia ani jednego piksela aplikacji. To faza, w której zamrażamy decyzje, żeby fazy M1–M8 były już tylko przepisywaniem ustaleń na kod. Efektem M0 są trzy pliki: pełna specyfikacja `docs/ux/student-workspace-spec.md`, wpis w `roadmap.md` oraz zarchiwizowany plan średnich klocków. Nic więcej — żadnego `src/`, żadnych zapytań, żadnych migracji.

Dlaczego ta faza w ogóle istnieje: przy dashboardzie sprawdziło się, że najpierw powstaje jeden dokument-źródło prawdy (`dashboard-today-spec.md`), a potem każda faza implementacji tylko się do niego odwołuje. Bez tego przy ósmym commicie zaczynają się pytania „a jak miało być z filtrem w URL", i decyzje podejmowane są w biegu, niespójnie. M0 usuwa te pytania z góry.

---

## 1. Co dokładnie powstaje

| Plik | Akcja | Rola |
|---|---|---|
| `docs/ux/student-workspace-spec.md` | nowy | Źródło prawdy dla M1–M8: układ, kontrakty propsów, mapa URL, tokeny, kryteria akceptacji |
| `roadmap.md` | edycja sekcji „UX North Star" | Lista faz M0–M8 z checkboxami |
| `.lovable/plan/` | archiwum planu średnich klocków | Zapis układu, do którego wracamy przy sporach |

Rzeczy, których M0 **nie** robi: nie tworzy komponentów, nie rusza `StudentPage.tsx`, nie aktualizuje `docs/llm-context.md` ani `public/llms.txt` (to należy do M8, żeby RAG nie opisywał czegoś, czego jeszcze nie ma), nie zakłada plików pamięci projektu.

---

## 2. Struktura specyfikacji — dwanaście sekcji

Dokument pisany po angielsku, w konwencji `dashboard-today-spec.md`: nagłówek ze statusem i rodzicem, potem sekcje numerowane, diagramy w blokach ```text, tabele dla mapowań.

**Nagłówek.**

```text
# Student Workspace — Specification (v6.9.111)

Status: APPROVED <data> — implementation pending
Parent: `docs/ux/target-teacher-experience.md` (Level 2)
Route: `/student/:id`
Sibling: `docs/ux/dashboard-today-spec.md` (Level 1)
```

**Sekcja 1 — Verified current state.** Tabela zweryfikowanych faktów, nie opinii. Każdy wiersz ma element, stan i problem. Wpisujemy: `StudentPage.tsx` liczy 1256 linii i zawiera 11 paneli `TabsContent`, lokalny komponent `MeetingLinkField`, cztery modale i dwa niezależne stronicowania; zakładka Overview renderuje jednocześnie baner welcome testu, `OneMinutePrepCard`, baner Hub, kartę Student Details z ośmioma polami i dwoma przyciskami akcji, kartę Recent Worksheets i kartę notatek; poniżej `lg` siedem zakładek zwija się w siedem nieopisanych ikon; cztery panele (`progress`, `skills`, `knowledge`, `events`) są osiągalne tylko przez ręczne wpisanie `?tab=`; ta sama zdolność nazywa się na jednym ekranie „1 MINUTE", „DSLM" i „1-Minute Prep". Pod tabelą jedno zdanie root cause — identyczne co do sensu z north star: interfejs jest zorganizowany wokół obiektów systemu, a nie wokół rytuału nauczyciela.

**Sekcja 2 — Target layout.** Diagram ASCII pełnej strony: `StickyNav`, pasek nagłówka ucznia, cztery zakładki, treść zakładki i przyklejony snapshot po prawej. Pod diagramem parametry kontenera: `mx-auto max-w-6xl px-4 py-6`, siatka `lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8`, snapshot `lg:sticky lg:top-20 lg:self-start`. Zdanie o jedynym przycisku `variant="default"` na stronie: **Generate worksheet** w zakładce Prep.

**Sekcja 3 — Tab model.** Tabela czterech zakładek: wartość URL, etykieta, ikona z `lucide-react`, jedno zdanie „one job", tryb ładowania (Prep eager, reszta `React.lazy`). Etykiety zawsze widoczne, także na mobile — cztery pozycje się mieszczą, więc tryb icon-only znika z projektu.

**Sekcja 4 — URL contract.** To najważniejsza sekcja dla kompatybilności, bo w bazie i w wysłanych e-mailach żyją stare linki. Zawiera pełną tabelę aliasów:

| stary `?tab=` | nowy | dodatkowy parametr |
|---|---|---|
| `overview` | `prep` | — |
| `dslm`, `1minute` | `model` | — |
| `progress`, `skills`, `knowledge` | `model` | — |
| `worksheets` | `library` | `section=worksheets` |
| `flashcards` | `library` | `section=flashcards`, zachować `set` |
| `homework` | `timeline` | `filter=homework` |
| `tests` | `timeline` | `filter=tests` |
| `calendar` | `timeline` | `filter=lessons` |
| `events` | `timeline` | `filter=all` |
| brak / nieznane | `prep` | — |

Do tego reguły: parametry `intake` i `set` przechodzą przez przepisanie nienaruszone; przepisanie wykonuje się raz, przez `setSearchParams(next, { replace: true })`, żeby przycisk „wstecz" nie wpadł w pętlę; kanoniczne wartości to `prep | timeline | library | model`; dopuszczalne wartości `section` to `worksheets | flashcards | homework`, a `filter` to `all | lessons | worksheets | homework | notes | tests`.

**Sekcja 5 — Component inventory.** Tabela: ścieżka pliku, faza, w której powstaje, źródło (nowy / wyciągnięty z `StudentPage.tsx` / bez zmian), jedno zdanie odpowiedzialności. Obejmuje wszystkie piętnaście pozycji z planu średnich klocków plus jawną listę komponentów używanych bez modyfikacji: `DSLMTab`, `DslmExplainerBanner`, `FlashcardSetsSection`, `StudentHomeworkTab`, `StudentTestsTab`, `StudentCalendarTab`, `WelcomeTestSuggestion`, `IntakeExtractionBanner`, `StudentEditDialog`, `ShareWorksheetModal`, `RenameDialog`, `StudentKnowledgeQuickAddModal`, `MediaBadges`, `SectionSkeleton`.

**Sekcja 6 — Prop contracts.** Dla każdego nowego komponentu pełny interfejs TypeScript, gotowy do wklejenia. To eliminuje najwięcej decyzji w trakcie implementacji. Kluczowe typy:

```ts
export type WorkspaceTab = 'prep' | 'timeline' | 'library' | 'model';
export type LibrarySection = 'worksheets' | 'flashcards' | 'homework';
export type TimelineFilter = 'all' | 'lessons' | 'worksheets' | 'homework' | 'notes' | 'tests';

export type TimelineEventType =
  | 'lesson' | 'worksheet' | 'homework_sent' | 'homework_returned'
  | 'note' | 'test_result' | 'mastery_change';

export interface TimelineEvent {
  id: string;                 // `${type}:${sourceId}` — dedupe key
  type: TimelineEventType;
  at: string;                 // ISO 8601, sort key, descending
  title: string;
  subtitle?: string;
  needsAction: boolean;
  href?: string;
  actionLabel?: string;       // rendered only when needsAction
}

export interface EntityRowProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  meta?: string;              // right-aligned, usually a date
  href?: string;              // renders as <a> to keep middle-click working
  onClick?: () => void;
  needsAction?: boolean;      // amber dot + amber action button
  actionLabel?: string;
  onAction?: () => void;
  menu?: React.ReactNode;     // DropdownMenu content, always the `…` trigger
  badges?: React.ReactNode;   // MediaBadges and similar
}
```

Oprócz tego interfejsy `StudentHeaderBarProps`, `StudentSnapshotPanelProps`, `StudentSettingsMenuProps`, `PrepTabProps`, `TimelineTabProps`, `LibraryTabProps` — każdy z jawnie wypisanymi polami, bez `any`.

**Sekcja 7 — Data sources.** Tabela: typ zdarzenia Timeline → hook źródłowy → pole daty → warunek `needsAction`. Na przykład `homework_returned` pochodzi z `useAllWorksheetHomework`, datą jest moment zwrotu, a `needsAction` jest prawdą, gdy zwrot nie ma jeszcze przeglądu. Pod tabelą zapisujemy twardą regułę architektoniczną: `useStudentTimeline` nie wykonuje żadnego zapytania do Supabase; jest czystą kompozycją `useMemo` nad danymi, które strona już posiada. Ta reguła chroni nas przed N+1, który wcześniej pojawił się na dashboardzie przez `StudentCard`.

**Sekcja 8 — Interaction patterns.** Trzy wzorce spinające całość, opisane raz i obowiązujące we wszystkich zakładkach: jedna anatomia wiersza (`EntityRow`), jedno menu `…` na wszystkie akcje poza główną, jeden sygnał uwagi (bursztynowa kropka plus przycisk akcji) współdzielony z dashboardem. Dodatkowo reguła nawigacji: wszystko, co prowadzi pod inny adres, renderuje się jako `<a>` z obsługą modyfikatorów, zgodnie z istniejącym wzorcem middle-click.

**Sekcja 9 — Accessibility and styling contract.** Zakładki jako `role="tablist"` z `aria-controls`; snapshot jako `<aside aria-label="Student snapshot">`; filtry Timeline jako `role="group"` z `aria-pressed`; każde menu `…` z `aria-label="More actions"`; kolejność fokusu: nagłówek → zakładki → treść → snapshot. Wyłącznie tokeny semantyczne; jawna lista zakazanych klas: `text-white`, `bg-white`, `text-gray-*`, `text-green-*`, `bg-black`, dowolne `bg-[#...]`.

**Sekcja 10 — Migration and compatibility rules.** Pięć reguł: nic nie jest usuwane, dopóki nowe miejsce nie działa (usuwanie martwego kodu wyłącznie w M8); każda faza kończy się aplikacją w stanie działającym; stare URL-e działają bezterminowo, mapa aliasów nie jest tymczasowa; tryb demo blokuje każdą mutację przez `useDemoGuard`, a hooki wracają wcześnie przy `edooqoo_demo_mode`; silnik generowania worksheetów pozostaje nietknięty — Prep wywołuje dokładnie te same funkcje co dziś (`writeAutoGenerateIntent` albo prefill w `sessionStorage`, a potem `navigate('/')`).

**Sekcja 11 — Phase plan M0–M8.** Tabela z zakresem, plikami i weryfikacją dla każdej fazy. Ta sama treść co w planie średnich klocków, przeniesiona do dokumentu, żeby implementacja nie musiała sięgać do archiwum planów.

**Sekcja 12 — Acceptance criteria.** Mierzalne, sprawdzalne po M7: cztery widoczne zakładki na każdej szerokości ekranu; poniżej dwunastu elementów interaktywnych na pierwszym ekranie zakładki Prep; wszystkie jedenaście starych wartości `?tab=` prowadzi do właściwego miejsca; jeden przycisk `variant="default"` na stronie; zero widocznych ikon kosza poza menu `…`; pierwsze wejście na stronę nie montuje paneli Timeline, Library ani Model.

---

## 3. Wpis w `roadmap.md`

W sekcji „UX North Star" wiersz `Student Workspace` zamienia się w pozycję z rozwinięciem, dokładnie w konwencji użytej dla v6.9.109 i v6.9.110:

```markdown
- [ ] Student Workspace (v6.9.111) — 4 tabs (Prep / Timeline / Library / Model) + snapshot panel
      spec: `docs/ux/student-workspace-spec.md`
  - [ ] M0 — spec document + roadmap entry
  - [ ] M1 — `src/lib/students/workspaceTabs.ts` + alias tests (no UI)
  - [ ] M2 — `EntityRow` + `MeetingLinkField` extracted from `StudentPage`
  - [ ] M3 — `StudentHeaderBar` + `StudentSnapshotPanel` + `StudentSettingsMenu`
  - [ ] M4 — `PrepTab` (NextLessonCard, LastLessonStrip, QuickNoteBox)
  - [ ] M5 — `useStudentTimeline` + tests, then `TimelineTab`
  - [ ] M6 — `LibraryTab` (segmented sections + collapsed Deleted)
  - [ ] M7 — switch to 4 tabs, `resolveTab` routing, `studentPrepPath()` → `?tab=prep`, `React.lazy`
  - [ ] M8 — dead code removal + RAG (`docs/llm-context.md`, `public/llms.txt`, memory)
```

Wiersz „Guided mode beyond the dashboard" zostaje niezmieniony poniżej. Sekcja „Deferred" nietknięta.

---

## 4. Kolejność wykonania M0 (kroki atomowe)

1. Utworzenie `docs/ux/student-workspace-spec.md` z sekcjami 1–12 w opisanej kolejności.
2. Weryfikacja sekcji 1 przez ponowne odczytanie `StudentPage.tsx` — każdy fakt w tabeli musi mieć pokrycie w kodzie, żaden nie może być domysłem.
3. Weryfikacja sekcji 4 przez `rg -n "tab=" src/ supabase/functions/` — mapa aliasów musi pokryć każdą wartość `?tab=` faktycznie generowaną gdziekolwiek w projekcie, łącznie z linkami w Edge Functions. Jeśli znajdzie się wartość spoza listy, dopisujemy ją do tabeli.
4. Weryfikacja sekcji 7 przez odczytanie sygnatur `useAllWorksheetHomework`, `useCalendarSlots`, `useStudentTests`, `useStudentKnowledge` — nazwy pól dat muszą być prawdziwe, nie wymyślone.
5. Aktualizacja `roadmap.md`.
6. Kontrola spójności z north star: żadne zdanie specyfikacji nie może przeczyć `target-teacher-experience.md`. Jedyna świadoma różnica to DSLM jako czwarta zakładka zamiast osobnej trasy `/student/:id/model` — ta różnica musi być w specyfikacji nazwana wprost, wraz z uzasadnieniem, żeby nie wyglądała na przeoczenie.

---

## 5. Weryfikacja zakończenia M0

Faza jest zamknięta, gdy: dokument istnieje i zawiera wszystkie dwanaście sekcji; każdy fakt w sekcji 1 ma pokrycie w kodzie; tabela aliasów pokrywa wynik `rg -n "tab=" src/ supabase/functions/`; wszystkie interfejsy z sekcji 6 są kompletne i wolne od `any`; `roadmap.md` zawiera dziewięć pozycji M0–M8; w `src/` nie zmieniono ani jednego pliku (`git status` pokazuje wyłącznie dwa pliki dokumentacji).

Ponieważ M0 nie dotyka kodu, typecheck i testy nie są wymagane — ale i tak uruchamiamy `bunx tsgo --noEmit -p tsconfig.app.json` jako dowód, że stan wyjściowy dla M1 jest czysty.

---

## 6. Ryzyka fazy M0

Największym ryzykiem jest specyfikacja opisująca kod, którego nie sprawdzono — dlatego kroki 2, 3 i 4 są obowiązkowe i polegają na czytaniu kodu, nie na pamięci. Drugie ryzyko to dokument, który rozjedzie się z north star; adresuje je krok 6. Trzecie to przesadna szczegółowość — specyfikacja opisuje kontrakty i reguły, nie gotowy JSX, bo inaczej stanie się kopią kodu, która natychmiast się zdezaktualizuje.

---

## 7. Poza zakresem M0

Jakakolwiek zmiana w `src/`, aktualizacja `docs/llm-context.md` i `public/llms.txt` (M8), pliki pamięci projektu (M8), guided mode, Worksheet Generation Engine, logika DSLM, backend, RLS, migracje, SEO, Student Hub.
