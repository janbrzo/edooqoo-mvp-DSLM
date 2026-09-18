# Faza M6 — Library Tab (v6.9.111)

Czwarty duży klocek workspace'u ucznia. Prep odpowiada „co robić teraz", Timeline „co się wydarzyło", a **Library** odpowiada na jedno pytanie: *„gdzie jest materiał, którego już użyłem, i jak go szybko użyć ponownie?"*.

Nic nie usuwamy i nic nie przełączamy. Library wchodzi jako dodatkowa zakładka obok istniejących; stare zakładki Worksheets / Flashcards / Homework zostają nietknięte do M7. Domyślna zakładka nadal `dslm`.

---

## 1. Docelowy widok Library

```text
┌──────────────────────────────────────────────────────────────┐
│ [ Worksheets 24 ] [ Flashcards 3 ] [ Homework 7 ]            │  segment
│ ─────────────────────────────────────────────────────────────│
│ [ Search material…            ]        [ Newest ▾ ] [+ New ] │  toolbar
│                                                              │
│ ▸ Present Perfect — job interview   [IMG][AUD]  Mar 12  …    │  EntityRow
│ ▸ Small talk with clients                       Mar 05  …    │
│ …                                                            │
│ ─────────────────────────────────────────────────────────────│
│ ‹ Prev        Page 1 of 3         Next ›                     │
│                                                              │
│ ▸ Deleted (4)                                       collapsed│
└──────────────────────────────────────────────────────────────┘
```

Zasady UI (zgodne z M2/M4/M5, żeby nauczyciel uczył się jednego układu):

- **Jeden wiersz = `EntityRow`** w trybie `dense`: ikona, tytuł, jedna linia kontekstu, data po prawej, `…` menu. Żadnych ikon kosza i żadnych pasków 5 przycisków w wierszu — dziś w `StudentPage.tsx` wiersz arkusza ma Rename, Share, Duplicate, Transfer, Delete jako osobne ikony; wszystko ląduje w `…`.
- **Segment zamiast kolejnych zakładek**: trzy sekcje (Worksheets, Flashcards, Homework) z licznikami. Segment nieaktywny z zerem pozostaje widoczny, wyszarzony, ale klikalny (inaczej niż filtry Timeline, bo tu pusta sekcja ma sens edukacyjny i przycisk „utwórz").
- **Toolbar**: pole szukania (filtr klientowy po tytule, tylko sekcja Worksheets), sort `Newest / Oldest / Title A–Z` (klientowy, w obrębie bieżącej strony), przycisk akcji `Generate worksheet`.
- **Deleted**: jedna zwinięta sekcja na dole, otwierana kliknięciem, z liczbą. Znika całkowicie, gdy zero usuniętych. Wiersz w `tone="destructive"` z akcją `Restore`.
- **Ładowanie**: 5 wierszy szkieletowych (jak Timeline), nigdy spinner.
- **Pusty stan**: ikona sekcji, jedno zdanie, jeden przycisk akcji.
- **Tokeny semantyczne**: żadnych `text-red-700` / `bg-red-50`; `destructive` z `EntityRow`, zielony stan udostępnienia jako `Badge variant="outline"` z tokenem `--success` już obecnym w `index.css`.

---

## 2. Podział na pliki

| Plik | Rola |
|---|---|
| `src/lib/students/libraryItems.ts` | czyste reguły: typy, `buildWorksheetItems`, `filterBySearch`, `sortItems`, `LIBRARY_SECTIONS`, `LIBRARY_PAGE_SIZE = 10` |
| `src/lib/students/__tests__/libraryItems.test.ts` | testy reguł |
| `src/components/student/library/LibrarySegments.tsx` | segment sekcji z licznikami |
| `src/components/student/library/LibraryToolbar.tsx` | szukajka + sort + przycisk akcji |
| `src/components/student/library/WorksheetLibraryRow.tsx` | `EntityRow` + menu `…` dla arkusza |
| `src/components/student/library/DeletedWorksheetsSection.tsx` | zwijana sekcja usuniętych |
| `src/components/student/library/LibraryTab.tsx` | kompozycja: segment → sekcja → paginacja → Deleted |

Bez nowych zapytań: `useWorksheetHistory` i `useDeletedWorksheets` są już wywołane w `StudentPage.tsx`. `FlashcardSetsSection` i `StudentHomeworkTab` montujemy bez zmian, ale **tylko gdy dana sekcja jest aktywna** (montaż warunkowy = zero dodatkowych zapytań dla sekcji nieoglądanych).

---

## 3. Kontrakty (English, zero `any` w nowych interfejsach)

```ts
// src/lib/students/libraryItems.ts
export type LibrarySection = 'worksheets' | 'flashcards' | 'homework';
export type LibrarySort = 'newest' | 'oldest' | 'title';
export const LIBRARY_PAGE_SIZE = 10;

export interface LibraryWorksheetItem {
  id: string;
  title: string;            // '' → 'Untitled worksheet'
  createdAt: string;        // ISO
  grammar: string | null;   // from form_data.grammar
  hasImage: boolean;
  hasAudio: boolean;
  isShared: boolean;        // share_token present
  shareToken: string | null;
  studentId: string | null;
}

export interface LibraryWorksheetSource { /* narrow shape read from useWorksheetHistory */ }

export function buildWorksheetItems(rows: LibraryWorksheetSource[]): LibraryWorksheetItem[];
export function filterBySearch(items: LibraryWorksheetItem[], query: string): LibraryWorksheetItem[];
export function sortItems(items: LibraryWorksheetItem[], sort: LibrarySort): LibraryWorksheetItem[];
export function formatLibraryDate(iso: string): string; // 'MMM dd, yyyy HH:mm'
```

Reguły rozstrzygnięte z góry:
- `title` pusty/whitespace → `'Untitled worksheet'`; sortowanie po tytule używa `localeCompare` z `sensitivity: 'base'`.
- `filterBySearch` — trim, lowercase, dopasowanie podciągu w tytule **i** w `grammar`; pusty query zwraca wejście bez kopiowania.
- `sortItems` zwraca nową tablicę (nigdy nie mutuje), remis rozstrzyga `id`.
- `hasImage` / `hasAudio` liczone przez istniejące helpery `hasImage`/`hasAudio` używane dziś w `StudentPage.tsx` — `buildWorksheetItems` przyjmuje je jako gotowe pola wejściowe, żeby moduł reguł został czysty i testowalny.
- Wiersze z `deleted_at` nie trafiają do `buildWorksheetItems`.

```ts
// LibraryTab.tsx
export interface LibraryTabProps {
  section: LibrarySection;
  onSectionChange: (next: LibrarySection) => void;
  counts: Record<LibrarySection, number>;

  worksheets: LibraryWorksheetItem[];
  isLoadingWorksheets: boolean;
  page: number; totalCount: number; onPageChange: (page: number) => void;

  search: string; onSearchChange: (v: string) => void;
  sort: LibrarySort; onSortChange: (v: LibrarySort) => void;

  onGenerate: () => void;
  onRename: (id: string, currentTitle: string) => void;
  onShare: (item: LibraryWorksheetItem) => void;
  onReuse: (id: string) => void;
  worksheetActions: (item: LibraryWorksheetItem) => React.ReactNode; // Duplicate/Transfer/Delete

  deleted: LibraryDeletedItem[];
  isLoadingDeleted: boolean;
  deletedPage: number; deletedTotalCount: number;
  onDeletedPageChange: (page: number) => void;
  onRestore: (id: string) => void;

  flashcardsSlot: React.ReactNode;
  homeworkSlot: React.ReactNode;
}
```

`LibraryTab` jest czysto prezentacyjny: żadnych zapytań, żadnych efektów. Sekcje Flashcards i Homework wchodzą jako sloty — `StudentPage.tsx` przekazuje je tylko wtedy, gdy dana sekcja jest aktywna, więc nie montują się w tle.

Menu `…` wiersza arkusza (kolejność stała): **Open**, **Reuse in new worksheet**, **Rename**, **Share**, separator, `worksheetActions` (istniejące `DuplicateWorksheetButton`, `StudentSelector`, `DeleteWorksheetButton` — komponenty bez zmian, renderowane jako pozycje menu w kontenerze `DropdownMenuItem asChild` nie jest bezpieczne, więc trafiają do stopki menu jako pasek ikon o rozmiarze `sm`). Reuse korzysta z istniejącego `handleReuseWorksheet`.

---

## 4. Kolejność wdrożenia (5 kroków, każdy osobno weryfikowalny)

**Krok 1 — reguły.** `libraryItems.ts` + testy. Zero UI.
Testy pokrywają: mapowanie wiersza arkusza, fallback pustego tytułu, pomijanie usuniętych, wykrywanie `isShared`, szukanie po tytule i po gramatyce (case-insensitive, trim), trzy tryby sortowania, stabilność remisów, brak mutacji wejścia, formatowanie daty.
Weryfikacja: `bunx vitest run src/lib/students`, `bunx tsgo --noEmit -p tsconfig.app.json`.

**Krok 2 — komponenty prezentacyjne.** `LibrarySegments.tsx`, `LibraryToolbar.tsx`, `WorksheetLibraryRow.tsx`, `DeletedWorksheetsSection.tsx`. Niepodpięte.
Weryfikacja: typecheck; ekran bez zmian.

**Krok 3 — kompozycja.** `LibraryTab.tsx` (segment, skeleton 5 wierszy, pusty stan, paginacja serwerowa z `useWorksheetHistory`, sloty Flashcards/Homework, sekcja Deleted). Niepodpięta.
Weryfikacja: typecheck.

**Krok 4 — montaż w `StudentPage.tsx`.**
- stan: `librarySection` (`'worksheets'`), `librarySearch`, `librarySort` (`'newest'`);
- `libraryItems = useMemo(...)` na bazie `worksheets` → `buildWorksheetItems` → `filterBySearch` → `sortItems`;
- `counts`: worksheets = `totalCount`, flashcards i homework = `undefined` do czasu montażu sekcji (segment pokazuje liczbę tylko dla Worksheets — bez dodatkowych zapytań);
- `TabsList` → `grid-cols-10`, `TabsTrigger value="library"` na trzeciej pozycji (ikona `Library` z lucide), `TabsContent value="library"`;
- zmiana sekcji resetuje `librarySearch` i `currentPage` do 1;
- stare zakładki Worksheets / Flashcards / Homework bez zmian.
Weryfikacja: typecheck; Playwright na `/demo` — wejście na `?tab=library`, zrzut ekranu, czysta konsola.

**Krok 5 — dokumentacja.** `docs/ux/student-workspace-spec.md` sekcja 5/6 (rzeczywisty kontrakt `LibraryTabProps` zamiast szkicu z M0) + nowa sekcja 8 „Library data sources"; `roadmap.md` M6.1–M6.5. RAG (`docs/llm-context.md`, `public/llms.txt`) dopiero w M8.

---

## 5. Kompatybilność i ryzyka

- **Zero regresji po stronie danych**: brak nowych zapytań, `useWorksheetHistory` / `useDeletedWorksheets` już działają z tą samą paginacją (`pageSize = 10`).
- **Demo mode**: `useDeletedWorksheets` zwraca pustą listę w demo → sekcja Deleted znika; szukajka i sort działają lokalnie.
- **Worksheet Generation Engine, DSLM, RLS, Edge Functions**: nietknięte.
- **Znany problem**: podgląd `/demo` zatrzymuje się na szkielecie ładowania dla wszystkich zakładek ucznia — to stan sprzed M4, nie blokuje weryfikacji typów i testów.
- **Poza zakresem (log, nie naprawiamy)**: `WorksheetHomeworkSection` pod każdym wierszem arkusza generuje zapytanie na wiersz — w Library nie renderujemy go wcale, ale stara zakładka Worksheets nadal go ma do czasu M7.
