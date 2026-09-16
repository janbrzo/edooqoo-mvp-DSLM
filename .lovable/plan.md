# Faza M5 — zakładka Timeline na /student (v6.9.111)

Cel fazy: nauczyciel wchodzi na `?tab=timeline` i w jednym strumieniu widzi **co się wydarzyło** z tym uczniem — lekcje, arkusze, wysłane i zwrócone zadania domowe, notatki, wyniki testów — posortowane od najnowszych, z pogrupowaniem po datach i z bursztynowym wskaźnikiem tam, gdzie coś czeka na jego reakcję.

Zasada nadrzędna, tak jak w M4: **nic nie usuwamy i nic nie przełączamy**. Timeline dochodzi jako kolejna zakładka obok istniejących. Przełączenie na docelowe 4 zakładki, aliasy URL i `React.lazy` to M7.

---

## 1. Docelowy widok (UI, spojrzenie eksperta)

```text
┌───────────────────────────── Timeline ─────────────────────────────┐
│ [All 42] [Lessons 12] [Worksheets 9] [Homework 8] [Notes 11] [Tests 2] │
│                                                                    │
│ TODAY                                                              │
│ ● 📘 Homework returned — "Past Simple drill"     Review  ·  09:12  │
│   🗒 Note — "asked about conditionals in meetings"        08:40    │
│ YESTERDAY                                                          │
│   📄 Worksheet — "Business small talk"                    17:05    │
│ THIS WEEK                                                          │
│   📅 Lesson — Tue 18:00 (completed)                       Tue      │
│ EARLIER                                                            │
│   ...                                                              │
│                          [ Load more ]                             │
└────────────────────────────────────────────────────────────────────┘
```

Decyzje UI (zamknięte, bez pytań na etapie implementacji):

- **Jeden strumień, nie tabela.** Każdy wiersz to `EntityRow` z M2 — ta sama anatomia co Prep i Library: ikona, tytuł, jedna linia kontekstu, data po prawej, opcjonalna bursztynowa akcja, menu `…`. Nauczyciel uczy się układu raz.
- **Filtry jako pigułki**, nie dropdown: `All / Lessons / Worksheets / Homework / Notes / Tests`, każda z licznikiem. Pigułka z zerem jest wyszarzona i wyłączona (`disabled`), nigdy nie znika — pozycje nie skaczą.
- **Grupowanie nagłówkami dat**: `Today`, `Yesterday`, `This week`, `Earlier` (nagłówek sticky w obrębie listy, `text-xs uppercase tracking-wide text-muted-foreground`).
- **Stronicowanie po stronie klienta**: pierwsze 25 zdarzeń, przycisk `Load more` dokłada kolejne 25. Zero dodatkowych zapytań.
- **Jedna akcja na wiersz.** Bursztynowy przycisk pojawia się wyłącznie przy `needsAction` (zwrócone zadanie → „Review”, test po wypełnieniu → „Review”, lekcja `needs_review` → „Mark done”). Reszta czynności chowa się pod `…`. Zero ikon kosza na osi czasu — Timeline jest tylko do czytania i reagowania.
- **Stan pusty**: ikona `Activity`, „Nothing has happened yet”, jedno zdanie po ludzku plus przycisk drugorzędny „Go to Prep”.
- **Ładowanie**: 5 skeletonów w rytmie wierszy, bez spinnera.
- Wyłącznie tokeny semantyczne, zero `text-white` / `bg-gray-*` / `bg-[#…]`. Bursztyn bierze się z `resolveRowClasses` — jedno źródło z Prep i Library.

---

## 2. Rozstrzygnięcie o danych (jedyna realna decyzja architektoniczna)

Specyfikacja M0 mówi: „`useStudentTimeline` nie wykonuje żadnego zapytania”. Weryfikacja kodu pokazuje, że strona ma dziś tylko część danych:

| Źródło | Czy strona już to ma? |
|---|---|
| arkusze (`useWorksheetHistory`) | tak |
| notatki / mastery (`useStudentKnowledge`) | tak |
| zadania domowe (`useAllWorksheetHomework`) | import jest, ale hook nie jest wołany na poziomie strony |
| lekcje (`calendar_slots`) | nie — `useStudentNextLesson` czyta jeden wiersz |
| testy (`student_tests`) | nie — `StudentTestsTab` pobiera je sam wewnątrz |

Rozwiązanie (przyjęte, bez wariantów do wyboru): **rozdzielamy warstwy**.

1. `useStudentTimeline(input)` — **czysta kompozycja w `useMemo`, zero zapytań**. Litera specyfikacji zachowana.
2. `useStudentTimelineSources(studentId, teacherId, enabled)` — jeden nowy hook z **trzema lekkimi zapytaniami** (lekcje, zadania domowe, testy), włączany dopiero gdy zakładka Timeline jest aktywna (`enabled`), na wzorcu `useStudentNextLesson`: `useQuery`, `staleTime: 60_000`, `refetchOnWindowFocus: false`, pełna gałąź demo, błąd → `devWarn` + pusta tablica.

Dzięki `enabled` pierwsze wejście na stronę nie generuje ani jednego dodatkowego zapytania — koszt płacimy dopiero, gdy nauczyciel świadomie otworzy Timeline. Specyfikację `docs/ux/student-workspace-spec.md` uzupełniamy o ten podział (sekcja 7), żeby dokument nie kłamał.

Zakresy zapytań (zamknięte):
- lekcje: `calendar_slots` → `id, slot_date, start_time, status, worksheet_id`, `eq teacher_id`, `eq student_id`, `gte slot_date` = dziś − 180 dni, `neq status 'deleted'`, sort malejąco, `limit 100`;
- zadania: `homework_assignments` → `id, title, created_at, completed_at, completed_by_teacher, share_token, source_worksheet_id`, `eq student_id`, sort `created_at` malejąco, `limit 100`;
- testy: `student_tests` → `id, title, status, created_at, completed_at, reviewed_at, score_percentage`, `eq student_id`, `eq teacher_id`, `is deleted_at null`, sort `created_at` malejąco, `limit 50`.

Demo: hook zwraca puste tablice dla lekcji spoza `demoData.calendarSlots`, a dla zadań i testów puste tablice — dokładnie tak, jak zachowuje się dziś `useAllWorksheetHomework` w demo. Timeline w demo pokazuje arkusze i notatki. Zero błędów UUID.

---

## 3. Nowe pliki

| Plik | Rola |
|---|---|
| `src/lib/students/timelineEvents.ts` | czyste reguły: budowa zdarzeń, sortowanie, liczniki, grupowanie dat (bez Reacta, bez Supabase) |
| `src/lib/students/__tests__/timelineEvents.test.ts` | testy jednostkowe reguł |
| `src/hooks/useStudentTimelineSources.ts` | trzy lekkie zapytania + demo, `enabled` |
| `src/hooks/useStudentTimeline.ts` | `useMemo` sklejający wejścia w `StudentTimelineResult` (zero zapytań) |
| `src/components/student/timeline/TimelineFilters.tsx` | pigułki filtrów z licznikami |
| `src/components/student/timeline/TimelineEventRow.tsx` | `EntityRow` związany z `TimelineEvent` |
| `src/components/student/timeline/TimelineTab.tsx` | kompozycja: filtry, grupy, „Load more”, stany puste i ładowania |

Zmieniane: `src/pages/StudentPage.tsx` (montaż zakładki), `docs/ux/student-workspace-spec.md` (sekcja 7), `roadmap.md`.

---

## 4. Kontrakty (kod po angielsku, bez `any`)

```ts
// src/lib/students/timelineEvents.ts
export type TimelineEventType =
  | 'lesson' | 'worksheet' | 'homework_sent' | 'homework_returned'
  | 'note' | 'test_result' | 'mastery_change';

export type TimelineFilter =
  | 'all' | 'lessons' | 'worksheets' | 'homework' | 'notes' | 'tests';

export interface TimelineEvent {
  id: string;            // `${type}:${sourceId}` — klucz deduplikacji
  type: TimelineEventType;
  at: string;            // ISO 8601, klucz sortowania malejącego
  title: string;
  subtitle?: string;
  needsAction: boolean;
  href?: string;
  actionLabel?: string;  // renderowany tylko gdy needsAction
}

export type TimelineGroupKey = 'today' | 'yesterday' | 'week' | 'earlier';

export const TIMELINE_PAGE_SIZE = 25;
export const FILTER_TYPES: Record<TimelineFilter, readonly TimelineEventType[]>;

export function buildTimelineEvents(input: TimelineSourceData): TimelineEvent[];
export function countByFilter(events: readonly TimelineEvent[]): Record<TimelineFilter, number>;
export function filterEvents(events: readonly TimelineEvent[], f: TimelineFilter): TimelineEvent[];
export function groupEventsByDate(
  events: readonly TimelineEvent[],
  now?: Date,
): { key: TimelineGroupKey; label: string; events: TimelineEvent[] }[];
export function formatEventTime(iso: string, group: TimelineGroupKey): string;
```

Reguły w `buildTimelineEvents` (zamknięte):

| Typ | Źródło | Data | Tytuł | Podtytuł | `needsAction` | `href` / `actionLabel` |
|---|---|---|---|---|---|---|
| `lesson` | slot | `slot_date` + `start_time` → ISO lokalne | `Lesson` | status po ludzku (`Completed`, `Booked`, `Cancelled`, `No show`, `Needs review`) | `status === 'needs_review'` | `?tab=calendar` / `Mark done` |
| `worksheet` | arkusz | `created_at` | tytuł lub `Untitled worksheet` | `Worksheet` | nigdy | `/worksheet/{id}` |
| `homework_sent` | zadanie | `created_at` | `Homework sent — {title}` | `Sent to student` | nigdy | `?tab=homework` |
| `homework_returned` | zadanie | `completed_at` | `Homework returned — {title}` | `Waiting for your review` lub `Reviewed` | `completed_at != null && completed_by_teacher !== true` | `?tab=homework` / `Review` |
| `note` | wpis wiedzy (`category !== 'Skill Assessment'`) | `created_at` | pierwsza linia `content`, przycięta do 80 znaków | `Note` | nigdy | `?tab=knowledge` |
| `mastery_change` | wpis `Skill Assessment` z `metadata.mastery` | `updated_at` | `{nano_skill ?? 'Skill'} — mastery {n}%` | `Learning model` | nigdy | `?tab=dslm` |
| `test_result` | test | `completed_at ?? created_at` | `{title}` | `Score {n}%` lub status | `completed_at != null && reviewed_at == null` | `?tab=tests` / `Review` |

Dodatkowe reguły: pomijamy wpisy z `deleted_at`, `is_outdated`, `archived_at`; pomijamy zdarzenia bez daty; sort malejący po `at`, remis rozstrzyga `id` (stabilność); deduplikacja po `id`; zadanie zwrócone daje **dwa** zdarzenia (`homework_sent` i `homework_returned`).

```ts
// src/hooks/useStudentTimeline.ts
export interface StudentTimelineResult {
  events: TimelineEvent[];
  counts: Record<TimelineFilter, number>;
  isLoading: boolean;
}
export function useStudentTimeline(input: StudentTimelineInput): StudentTimelineResult;
```

`StudentTimelineInput` to gotowe tablice: `worksheets`, `knowledgeEntries`, `lessons`, `homework`, `tests`, plus `isLoading: boolean`. Hook nie importuje `supabase`.

```ts
// TimelineTab.tsx
export interface TimelineTabProps {
  events: TimelineEvent[];
  counts: Record<TimelineFilter, number>;
  isLoading: boolean;
  filter: TimelineFilter;
  onFilterChange: (next: TimelineFilter) => void;
  onNavigate: (href: string) => void;
  onAction: (event: TimelineEvent) => void;
  onGoToPrep: () => void;
}
```

`TimelineTab` jest czysto prezentacyjny — stan filtra i „ile pokazać” trzyma lokalnie tylko licznik strony; filtr przychodzi ze strony, bo w M7 wejdzie do URL jako `?filter=`.

---

## 5. Kolejność wdrożenia (5 kroków, każdy osobno weryfikowalny)

**Krok 1 — reguły.** `timelineEvents.ts` + testy. Zero UI.
Testy pokrywają: mapowanie każdego z 7 typów, pomijanie usuniętych i bez daty, podwójne zdarzenie dla zwróconego zadania, sort i remisy, deduplikację, liczniki dla wszystkich 6 filtrów, grupowanie na przełomie doby i tygodnia, formatowanie godziny vs daty.
Weryfikacja: `bunx vitest run src/lib/students`, `bunx tsgo --noEmit -p tsconfig.app.json`.

**Krok 2 — dane.** `useStudentTimelineSources.ts` (trzy zapytania + demo + `enabled`) oraz `useStudentTimeline.ts` (czysty `useMemo`). Niepodpięte.
Weryfikacja: typecheck; ekran bez zmian.

**Krok 3 — komponenty prezentacyjne.** `TimelineFilters.tsx`, `TimelineEventRow.tsx`. Zbudowane, jeszcze niepodpięte.
Weryfikacja: typecheck.

**Krok 4 — kompozycja i montaż.** `TimelineTab.tsx`; w `StudentPage.tsx`: `timelineFilter` w stanie, wywołanie `useStudentTimelineSources(id, teacher_id, activeTab === 'timeline')`, `useStudentTimeline(...)`, `<TabsTrigger value="timeline">` na drugiej pozycji (ikona `Activity`), `TabsList` → `grid-cols-9`, `<TabsContent value="timeline">`. Domyślna zakładka nadal `dslm`.
`onNavigate` obsługuje dwie formy: ścieżkę zewnętrzną (`/worksheet/...` → `navigate`) i wewnętrzny alias (`?tab=...` → `handleTabChange`).
Weryfikacja: typecheck; Playwright na `/demo` — wejście na `?tab=timeline`, zrzut ekranu, czysta konsola.

**Krok 5 — dokumentacja.** `docs/ux/student-workspace-spec.md` sekcja 7 (podział pure/sources), `roadmap.md` M5.1–M5.5. RAG dopiero w M8.

---

## 6. Kompatybilność

- Osiem istniejących zakładek działa identycznie; Overview, DSLM, Worksheets, Homework, Flashcards, Calendar, Tests nietknięte.
- Żaden istniejący link `?tab=` nie zmienia zachowania — `resolveTab` z M1 zna już `timeline` jako kanoniczną nazwę.
- Silnik generowania arkuszy, DSLM, RLS i Edge Functions — bez dotknięcia.
- Brak migracji bazy; wszystkie trzy zapytania to odczyty na tabelach, które strona już czyta w innych zakładkach (te same polityki RLS).

Ryzyka i mitigacje:
- *Timeline pokazuje zbyt dużo szumu u aktywnego ucznia* → limit 25 + filtry + grupowanie.
- *`mastery_change` dubluje wpisy Skill Assessment* → rozłączny podział: `Skill Assessment` z `metadata.mastery` → `mastery_change`, reszta → `note`.
- *Podwójny koszt zapytań przy szybkim przełączaniu zakładek* → `staleTime: 60_000` i brak refetchu na focus.
- *Demo pokazuje pustą oś* → arkusze i notatki są w `demoData`, więc oś nie jest pusta.

Poza zakresem M5: Library (M6), przełączenie na 4 zakładki, `?filter=` w URL, `React.lazy`, usunięcie Overview, RAG.
