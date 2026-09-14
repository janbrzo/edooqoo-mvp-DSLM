# Faza M4 — PrepTab (małe klocki)

Wersja: v6.9.111 · zakres: `/student/:id`, zakładka „Prep"
Zasada nadrzędna: **nic nie usuwamy, nic nie przełączamy** — M4 dodaje nową zakładkę obok siedmiu istniejących. Przełączenie na 4 zakładki i aliasy URL to M7.

---

## 1. Co dziś jest źle na pierwszym ekranie

Zakładka Overview to trzy równorzędne karty w siatce 3 kolumn: „Student Details" (8 pól, dziś już bez Edit/Delete — te przeniosły się do menu w nagłówku w M3), „Recent Worksheets" (Generate Another + View All + 5 wierszy z przyciskiem usuwania + sekcja pracy domowej pod każdym wierszem) i „Recent Notes" (Add Note + View All + 3 karty wpisów). Nad nimi jeszcze `WelcomeTestSuggestion`, `OneMinutePrepCard` i baner o Student Hub.

Efekt: ~35 elementów interaktywnych, trzy przyciski w wariancie podstawowym, żadnej odpowiedzi na jedyne pytanie, z którym nauczyciel wchodzi na tę stronę: **czego uczyć na najbliższej lekcji i czym to wygenerować**.

Dodatkowo dane potrzebne do tej odpowiedzi już istnieją, ale leżą w trzech różnych miejscach: proponowane tematy w DSLM (`useFutureTimeline` → `nextSteps`/`phaseSteps`), sygnały do pracy w `OneMinutePrepCard`, ostatni arkusz w „Recent Worksheets". Nauczyciel składa to ręcznie.

Root cause: Overview pokazuje **stan obiektu „student"**, a nie **następny krok rytuału**.

---

## 2. Docelowy widok Prep (M4)

```text
┌───────────────────────────────────────────── kolumna główna ─────────────┐
│ [WelcomeTestSuggestion]          (bez zmian, tylko gdy warunek spełniony)│
│ [Student Hub banner]             (bez zmian, tylko gdy jest e-mail)      │
├──────────────────────────────────────────────────────────────────────────┤
│ NEXT LESSON                                     Tue 18:00                │
│ Past simple w opowiadaniu o projekcie                                    │
│ Dlaczego: 3 błędy w czasach przeszłych w ostatnich 2 arkuszach           │
│ [Generate worksheet]   [Change topic ▾]                     (…)          │
│ ── Focus: past simple · phrasal verbs · fluency ──                       │
├──────────────────────────────────────────────────────────────────────────┤
│ LAST LESSON                                                              │
│ 📄 Job interview small talk        4 dni temu    [Open] [Reuse]     (…)  │
├──────────────────────────────────────────────────────────────────────────┤
│ QUICK NOTE                                                               │
│ [ Co zauważyłeś? …………………………………………………………… ] [Save]   │
│ · „Myli past perfect w narracji"                       2 dni temu        │
│ · „Wraca z Lizbony 12 maja — zapytać"                  5 dni temu        │
│ · „Chce ćwiczyć telefonowanie"                         1 tyg. temu       │
│                                       Wszystkie notatki → Learning model │
└──────────────────────────────────────────────────────────────────────────┘
```

Reguły UI (zgodne z sekcją 8 i 9 specyfikacji):

- **Jeden przycisk `variant="default"` na całej stronie**: „Generate worksheet" w `NextLessonCard`. „Save" w notatce dostaje `variant="secondary"`, „Open"/„Reuse" → `variant="outline"` w rozmiarze `sm`.
- Wszystko, co nie jest akcją główną sekcji, ląduje za `…` (`aria-label="More actions"`). Zero widocznych ikon kosza.
- Każdy wiersz to `EntityRow` z M2 — ten sam rytm co Timeline (M5) i Library (M6).
- Kolejność pionowa jest kolejnością rytuału: *co dalej → co było → co zapamiętać*. Nic nie stoi obok siebie w kolumnach; wzrok idzie jedną ścieżką.
- Tokeny semantyczne. Zakaz `text-white`, `bg-white`, `text-gray-*`, `text-green-*`, `bg-[#…]`. Bursztyn tylko przez klasę `action` z `resolveRowClasses`.

---

## 3. Nowe pliki

| Plik | Rola |
|---|---|
| `src/lib/students/prepPlan.ts` | Czyste reguły: wybór propozycji tematu, budowa etykiety „dlaczego", formatowanie wieku wpisu. Zero Reacta, zero Supabase. |
| `src/lib/students/__tests__/prepPlan.test.ts` | Testy jednostkowe powyższego. |
| `src/components/student/prep/NextLessonCard.tsx` | Propozycja tematu + uzasadnienie + Generate + Change topic. |
| `src/components/student/prep/LastLessonStrip.tsx` | Ostatni arkusz: Open / Reuse / menu. |
| `src/components/student/prep/QuickNoteBox.tsx` | Jedno pole notatki + trzy ostatnie wpisy. |
| `src/components/student/prep/PrepTab.tsx` | Kompozycja trzech powyższych + banery. |

Żaden z tych plików nie wykonuje zapytania do Supabase. Dane przychodzą propsami z `StudentPage.tsx`, dokładnie tak jak w M3.

---

## 4. `src/lib/students/prepPlan.ts` — reguły (gotowe do przepisania)

```ts
import type { WorksheetSuggestion } from '@/types/studentProgress';
import type { StudentKnowledgeEntry } from '@/types/studentKnowledge';

export interface PrepSuggestion {
  id: string | null;
  topic: string;
  goal: string;
  additionalInfo: string;
  grammarFocus: string;
  exercises: string[];
  exerciseFocusMap: Record<string, 'vocabulary' | 'grammar'>;
  rationale: string | null;
  source: 'phase_step' | 'next_step' | 'fallback';
}

export const RATIONALE_MAX_LEN = 160;

export function selectPrepSuggestion(
  phaseSteps: WorksheetSuggestion[],
  nextSteps: WorksheetSuggestion[],
  fallback: { mainGoal: string | null; focusAreas: string[] },
): PrepSuggestion;

export function buildRationale(
  suggestion: PrepSuggestion,
  focusAreas: string[],
): string;

export function formatRelativeAge(iso: string | null, now?: Date): string;
```

Reguły szczegółowe (żadnych decyzji na etapie implementacji):

1. `selectPrepSuggestion`
   - pomija wpisy z `is_used === true` i `deleted_at !== null`;
   - najpierw `phaseSteps` posortowane rosnąco po `sequence_number`, potem `id` (stabilność); jeśli pusto — `nextSteps` w tym samym porządku;
   - `topic` = `suggested_topic.trim()`; jeśli po trimie puste → wpis pomijany;
   - `goal` = `suggested_goal ?? ''`, `additionalInfo` = `suggested_additional_info ?? ''`, `grammarFocus` = `suggested_grammar_focus ?? ''`;
   - `exercises` = `suggested_exercises ?? []`; `exerciseFocusMap` = `suggested_exercise_focus_map` przefiltrowana do wartości `'vocabulary' | 'grammar'` (inne klucze odrzucone);
   - brak kandydata → fallback: `{ id: null, source: 'fallback', topic: pierwszy focus area lub sformatowany main goal lub 'General practice', goal: mainGoal ?? '', reszta pusta, rationale: null }`.
2. `buildRationale`
   - jeśli `suggestion.rationale` niepuste → przycięte do 160 znaków ze znakiem `…` (cięcie na granicy słowa);
   - w przeciwnym razie, jeśli są `focusAreas` → `Based on recent focus: a, b, c` (maks. 3, już ograniczone przez `selectFocusAreas`);
   - w przeciwnym razie → `No signals yet — this is a general practice suggestion.`
3. `formatRelativeAge` — `Today`, `Yesterday`, `N days ago` do 6 dni, `N weeks ago` do 4 tygodni, dalej `MMM d, yyyy`; `null` → `''`. Brak zależności od lokalizacji przeglądarki poza `date-fns/format`.

Testy (min. 18 przypadków): pierwszeństwo phase → next, pomijanie `is_used`, sort po `sequence_number`, pusty `suggested_topic`, filtr `exerciseFocusMap`, trzy gałęzie `buildRationale`, cięcie na 160 znaków, wszystkie progi `formatRelativeAge` plus przełom miesiąca.

---

## 5. Kontrakty komponentów

```ts
// NextLessonCard.tsx
export interface NextLessonCardProps {
  studentName: string;
  nextLessonLabel: string | null;   // z M3: formatNextLessonLabel()
  isLessonLoading: boolean;
  suggestion: PrepSuggestion;
  rationale: string;
  focusAreas: string[];
  isSuggestionsLoading: boolean;
  onGenerate: () => void;           // auto-generate na bazie suggestion
  onChangeTopic: () => void;        // prefill bez odpalania
  onOpenModel: () => void;          // „See all suggestions" w menu …
}

// LastLessonStrip.tsx
export interface LastLessonStripProps {
  worksheet: { id: string; title: string | null; created_at: string } | null;
  isLoading: boolean;
  onReuse: (worksheetId: string) => void;
  onOpenLibrary: () => void;        // „View all worksheets" w menu …
  menu?: React.ReactNode;           // pass-through: Share / Rename / Delete
}

// QuickNoteBox.tsx
export interface QuickNoteBoxProps {
  recentNotes: StudentKnowledgeEntry[];   // już przycięte do 3 przez PrepTab
  isLoading: boolean;
  isSaving: boolean;
  onSave: (content: string) => Promise<void>;
  onExpand: () => void;             // otwiera StudentKnowledgeQuickAddModal (tagi)
  onViewAll: () => void;
}

// PrepTab.tsx
export interface PrepTabProps {
  student: Tables<'students'>;
  teacherId: string;
  worksheets: WorksheetHistoryItem[];
  worksheetsLoading: boolean;
  focusAreas: string[];
  nextLessonLabel: string | null;
  isNextLessonLoading: boolean;
  recentNotes: StudentKnowledgeEntry[];
  notesLoading: boolean;
  onAddNote: (content: string) => Promise<void>;
  onOpenNoteModal: () => void;
  onGenerateFromSuggestion: (s: PrepSuggestion, autoGenerate: boolean) => void;
  onReuseWorksheet: (worksheetId: string) => void;
  onNavigateTab: (tab: string) => void;   // 'dslm' | 'worksheets' | 'knowledge'
  banners?: React.ReactNode;              // WelcomeTestSuggestion + Hub banner
}
```

Zero `any` w nowych interfejsach. `WorksheetHistoryItem` bierzemy z typu zwracanego przez `useWorksheetHistory`; jeśli hook nie eksportuje typu, w M4 dodajemy `export type WorksheetHistoryItem = ...` w jego pliku — to jedyna dozwolona zmiana poza `src/components/student/prep/`, `src/lib/students/` i `StudentPage.tsx`.

---

## 6. Skąd biorą się dane (bez nowych zapytań)

| Element | Źródło | Kto już to pobiera |
|---|---|---|
| propozycja tematu | `useFutureTimeline({ studentId, teacherId })` → `nextSteps`, `phaseSteps`, `loading` | dziś `OneMinutePrepCard`; w M4 wołane raz w `StudentPage` i przekazane w dół |
| focus areas | `selectFocusAreas(studentKnowledge.entries)` | już jest w `StudentPage` od M3.3 |
| najbliższa lekcja | `useStudentNextLesson` + `formatNextLessonLabel` | już jest w `StudentPage` od M3.3 |
| ostatni arkusz | `worksheets[0]` z `useWorksheetHistory` | już jest |
| notatki | `studentKnowledge.entries.slice(0, 3)` | już jest |

`useFutureTimeline` jest jedynym nowym wywołaniem hooka na stronie, ale **nie jest nowym zapytaniem sieciowym netto**: `OneMinutePrepCard` woła go dziś na Overview. Po M4 obie karty istnieją równolegle (Overview zostaje do M7), więc przejściowo hook uruchamia się dwa razy. To świadoma cena kompatybilności; w M7, gdy Overview znika, zostaje jedno wywołanie. Alternatywa (podnoszenie hooka i przekazywanie go do `OneMinutePrepCard`) wymagałaby zmiany kontraktu tego komponentu — poza zakresem M4.

Tryb demo: `useFutureTimeline` filtruje po UUID i zwraca puste tablice, więc `selectPrepSuggestion` schodzi do gałęzi `fallback` i karta pokazuje sensowną treść zamiast pustki. Zapis notatki przechodzi przez `useDemoGuard`.

---

## 7. Ścieżka generowania — bez dotykania silnika

`PrepTab` **nie** zna `sessionStorage` ani `writeAutoGenerateIntent`. Obie ścieżki zostają w `StudentPage.tsx` jako jedna funkcja, kopiująca 1:1 istniejące zachowanie `onUseWorksheetSuggestion` z linii ~886:

```ts
const handlePrepGenerate = (s: PrepSuggestion, autoGenerate: boolean) => {
  sessionStorage.setItem('preSelectedStudent', JSON.stringify({ id: student.id, name: student.name }));
  if (autoGenerate) {
    writeAutoGenerateIntent({
      studentId: student.id,
      suggestionId: s.id,
      topic: s.topic,
      goal: s.goal,
      additionalInfo: s.additionalInfo,
      grammarFocus: s.grammarFocus,
      exercises: s.exercises,
      exerciseFocusMap: s.exerciseFocusMap,
      studentName: student.name || null,
      studentEmail: student.student_email || null,
    });
  } else {
    sessionStorage.setItem('prefillWorksheet', JSON.stringify({
      topic: s.topic, goal: s.goal, additionalInfo: s.additionalInfo, grammarFocus: s.grammarFocus,
    }));
    if (s.id) sessionStorage.setItem('prefillSuggestionId', s.id);
    else sessionStorage.removeItem('prefillSuggestionId');
    if (s.exercises.length) sessionStorage.setItem('prefillExercises', JSON.stringify(s.exercises));
    if (Object.keys(s.exerciseFocusMap).length) {
      sessionStorage.setItem('prefillExerciseFocusMap', JSON.stringify(s.exerciseFocusMap));
    }
    sessionStorage.setItem('forceNewWorksheet', 'true');
    navigate('/');
  }
};
```

- „Generate worksheet" → `handlePrepGenerate(suggestion, true)`.
- „Change topic" → `handlePrepGenerate(suggestion, false)` (prefill + `/`, nauczyciel edytuje formularz).
- „Reuse" w `LastLessonStrip` → istniejące `handleGenerateWorksheet()` rozszerzone o `prefillWorksheet` zbudowany z `worksheet.form_data` (`topic`, `goal`, `grammar`), jeśli te pola istnieją; w przeciwnym razie zachowanie identyczne z dzisiejszym „Generate Another".

Prompt i logika generowania arkuszy pozostają nietknięte.

---

## 8. Kolejność wdrożenia (5 kroków, każdy osobno weryfikowalny)

**Krok 1 — reguły.** `prepPlan.ts` + testy. Brak zmian w UI.
Weryfikacja: `bunx vitest run src/lib/students`, `bunx tsgo --noEmit -p tsconfig.app.json`.

**Krok 2 — komponenty prezentacyjne.** `NextLessonCard`, `LastLessonStrip`, `QuickNoteBox` — zbudowane, jeszcze niepodpięte.
Weryfikacja: typecheck. Ekran bez zmian.

**Krok 3 — kompozycja.** `PrepTab.tsx` składa trzy komponenty plus sloty na banery; nadal niepodpięty do `Tabs`.
Weryfikacja: typecheck.

**Krok 4 — montaż jako ósma zakładka.** W `StudentPage.tsx`: `useFutureTimeline`, `handlePrepGenerate`, `handleReuseWorksheet`, `<TabsTrigger value="prep">` na **pierwszej pozycji**, `TabsList` → `grid-cols-8`, `<TabsContent value="prep">` z `PrepTab`. Domyślna zakładka zostaje `dslm` — zmiana defaultu to M7.
Weryfikacja: Playwright na `/demo` — wejście na `?tab=prep`, zrzut ekranu, brak błędów w konsoli; ręczne przejście ścieżki „Generate worksheet" na koncie testowym.

**Krok 5 — roadmapa.** `roadmap.md`: M4 zamknięte, podkroki M4.1–M4.4. RAG (`docs/llm-context.md`, `public/llms.txt`) dopiero w M8, zgodnie ze specyfikacją.

---

## 9. Kompatybilność — co gwarantujemy

1. Siedem istniejących zakładek działa identycznie; Overview nietknięty.
2. Żaden istniejący link `?tab=` nie zmienia zachowania. `?tab=prep` to nowa, dodatkowa wartość — `resolveTab` z M1 już ją zna jako kanoniczną, więc M7 nie będzie musiał nic korygować.
3. `studentPrepPath()` nadal zwraca `?tab=dslm` — zmiana w M7.
4. Modal `StudentKnowledgeQuickAddModal` pozostaje jeden na stronę; `QuickNoteBox` otwiera go przez `onExpand`, a szybki zapis bez tagów woła `studentKnowledge.addEntry` z `category: 'Notes'`, `entry_source: 'manual'` — dokładnie ten sam kontrakt, który dziś przechodzi przez modal, więc klasyfikacja AI w tle działa bez zmian.
5. Bez migracji, bez Edge Functions, bez zmian RLS.

## 10. Ryzyka

| Ryzyko | Waga | Mitygacja |
|---|---|---|
| Podwójne wywołanie `useFutureTimeline` (Prep + Overview) do czasu M7 | niska | ten sam klucz zapytania w warstwie hooka; Overview znika w M7 |
| Pusty stan propozycji u nowego ucznia | średnia | gałąź `fallback` w `selectPrepSuggestion` + tekst „No signals yet" zamiast pustej karty |
| „Reuse" bez `form_data` w starych arkuszach | niska | fallback do dzisiejszego `handleGenerateWorksheet()` |
| Rozjazd bursztynu z Timeline/Library | niska | jedyne źródło klas to `resolveRowClasses` z M2 |

## 11. Poza zakresem M4

Timeline, Library, przełączenie na 4 zakładki, `React.lazy`, usuwanie Overview, RAG, `studentPrepPath()`, silnik generowania arkuszy, DSLM, backend.
