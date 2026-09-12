# M2 — `EntityRow` + `MeetingLinkField` (bez zmian wizualnych)

Faza M2 Student Workspace (v6.9.111). Dwa pliki komponentów wyciągnięte/utworzone poza `StudentPage.tsx`, plus jedna zmiana w `StudentPage.tsx`: usunięcie lokalnej definicji `MeetingLinkField` i podmiana na import. Zero zmian w wyglądzie, zachowaniu i w danych. `EntityRow` powstaje jako komponent gotowy dla M4–M6, ale w M2 **nie jest jeszcze nigdzie użyty** — dzięki temu nie ma ryzyka regresji wizualnej, a M4/M5/M6 mają gotowy, przetestowany klocek.

Zasada fazy: M2 to refaktor czysto strukturalny. Jeśli jakikolwiek piksel na `/student/:id` się zmieni, faza jest niepoprawna.

---

## 1. Dlaczego akurat te dwa klocki

`StudentPage.tsx` ma 1256 linii, z czego ~175 zajmuje lokalna funkcja `MeetingLinkField` (linie 66–240). To pełnoprawny komponent z własnym stanem, trzema zapytaniami do Supabase, wywołaniem `gcal-sync` i logiką trybów `default`/`custom`. Trzymany wewnątrz pliku strony blokuje trzy rzeczy: nie da się go wstawić do `StudentSettingsMenu` w M3, nie da się go przetestować, i sztucznie powiększa moduł, który w M7 ma iść pod `React.lazy`.

Drugi klocek to anatomia wiersza. Dziś w `StudentPage.tsx` istnieją trzy niezależne, ręcznie pisane warianty tego samego wiersza:

| Miejsce | Linie | Anatomia |
|---|---|---|
| Overview → Recent Worksheets | 677–715 | `p-3 bg-muted/30 rounded-lg hover:bg-muted/50`, ikona `FileText h-4`, tytuł `text-sm`, data pod tytułem, po prawej `DeleteWorksheetButton` |
| Worksheets tab (pełna lista) | 827–917 | `p-4`, ikona `h-5`, tytuł + przycisk Rename + `MediaBadges`, podtytuł z `form_data.grammar`, po prawej data + Share + Duplicate + StudentSelector + Delete |
| Deleted Worksheets | 973–1002 | `p-4 bg-card border border-destructive/30`, ikona `text-destructive/70`, data usunięcia, przycisk Restore |

Trzy warianty, trzy różne paddingi, trzy różne rozmiary ikon, trzy różne układy akcji. Timeline (M5) i Library (M6) dorzuciłyby kolejne dwa. `EntityRow` zamyka tę anatomię w jednym miejscu, zanim powstaną nowe zakładki — inaczej M5 i M6 powielą rozjazd.

---

## 2. Nowy plik: `src/components/student/MeetingLinkField.tsx`

Przeniesienie 1:1 linii 66–240 z `StudentPage.tsx`. Zmiany dopuszczalne wyłącznie mechaniczne:

1. Dodanie własnych importów: `useState`, `useEffect` z `react`; `supabase`; `useDemoContext`; `Input`; `Video`, `ExternalLink` z `lucide-react`; `toast` z `sonner`.
2. `function MeetingLinkField(...)` → `export function MeetingLinkField(...)`, plus `export default MeetingLinkField` na końcu (spójnie z resztą `src/components/student/`).
3. Wyniesienie propsów do nazwanego interfejsu:

```ts
export interface MeetingLinkFieldProps {
  studentId: string;
  teacherId: string;
  hasGcal?: boolean;
}
```

4. Nagłówek pliku — komentarz JSDoc opisujący: ładowanie `calendar_settings.auto_create_student_meeting_link` i `calendar_student_settings`, tryby `default`/`custom`, generowanie pokoju przez `gcal-sync` (`action: 'create_permanent_room'`), propagację linku na przyszłe sloty w `calendar_slots`.

Czego **nie** zmieniamy w M2, mimo że korci:

- `catch (_) {}` w `propagateToFutureSlots` zostaje bez zmian (cicha porażka propagacji to istniejące zachowanie),
- rzutowania `as any` na wierszach Supabase zostają — kolumny `calendar_student_settings` nie są w wygenerowanych typach,
- `handleSave(finalLink, autoLinkEnabled ? 'custom' : 'custom')` zostaje dosłownie takie, jakie jest; obie gałęzie dają `'custom'`, ale to zmiana logiki, a nie refaktor — trafia na listę „poza zakresem",
- brak guardu demo w `handleSave`/`handleModeChange` zostaje bez zmian; dziś w demo `loaded` ustawia się natychmiast, a zapis nie jest blokowany w tym komponencie — także trafia na listę „poza zakresem" (nie dorzucamy `useDemoGuard`, bo to zmiana zachowania w fazie, która ma go nie zmieniać).

## 3. Zmiana w `src/pages/StudentPage.tsx`

Dokładnie dwie edycje:

1. Usunięcie linii 66–240 (cała lokalna funkcja).
2. Dodanie `import { MeetingLinkField } from '@/components/student/MeetingLinkField';` w bloku importów (przy `IntakeExtractionBanner`, linia 19).

Użycie w linii 639 (`<MeetingLinkField studentId={student.id} teacherId={student.teacher_id} hasGcal={gcalEnabled} />`) zostaje nietknięte.

Po usunięciu części importów `StudentPage.tsx` może mieć nieużywane symbole — sprawdzamy i usuwamy wyłącznie te, które faktycznie przestały być używane. Kandydaci do weryfikacji przez `rg`: `Video`, `ExternalLink`, `Label`, `Input`. Każdy sprawdzamy osobno (`rg -n "\bVideo\b" src/pages/StudentPage.tsx`) i usuwamy tylko przy zerowym pozostałym użyciu. Żadnego innego porządkowania importów — to zadanie M8.

---

## 4. Nowy plik: `src/components/student/EntityRow.tsx`

Jeden wiersz, trzy gęstości, jeden układ. Komponent prezentacyjny: bez zapytań, bez `useEffect`, bez zależności od routingu poza `Link`.

### 4.1 Kontrakt

```ts
import type { LucideIcon } from 'lucide-react';

export type EntityRowTone = 'default' | 'destructive';

export interface EntityRowProps {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  needsAction?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  menu?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  dense?: boolean;
  tone?: EntityRowTone;
  className?: string;
  'data-testid'?: string;
}
```

Dwie świadome różnice wobec sekcji 6 specyfikacji, obie rozszerzające, nie łamiące:

- `subtitle` i `meta` to `React.ReactNode`, nie `string` — pełna lista worksheetów potrzebuje w metadanych sformatowanej daty z ikoną, a Timeline w podtytule badge'y,
- doszły `actions` (slot na istniejące przyciski `DeleteWorksheetButton`, `DuplicateWorksheetButton`, `StudentSelector`, których nie da się wtłoczyć w jedno `onAction`) oraz `tone` (dla sekcji Deleted w M6).

Aktualizujemy sekcję 6 `docs/ux/student-workspace-spec.md`, żeby kontrakt w dokumencie i w kodzie były identyczne. To jedyna dozwolona edycja dokumentacji w M2; `docs/llm-context.md` i `public/llms.txt` czekają na M8.

### 4.2 Anatomia i klasy

```text
┌─────────────────────────────────────────────────────────────┐
│ [•] [ikona]  Tytuł  [badges]            [meta] [akcje] [⋯]  │
│              Podtytuł                                        │
└─────────────────────────────────────────────────────────────┘
```

- Kontener: `group flex items-center gap-3 rounded-lg bg-muted/30 transition-colors hover:bg-muted/50`, padding `p-4`, a przy `dense` — `p-3`.
- `tone="destructive"`: `bg-card border border-destructive/30 hover:bg-card` — odwzorowanie dzisiejszego wiersza Deleted.
- Kropka uwagi: gdy `needsAction`, przed ikoną renderujemy `<AttentionDot />` (`@/components/ui/AttentionDot`), a nie własny `div` — jedna kropka uwagi w całym produkcie.
- Ikona: `h-5 w-5 text-primary shrink-0`, przy `dense` `h-4 w-4`; przy `tone="destructive"` `text-destructive/70`.
- Środek: `min-w-0 flex-1`. Tytuł `truncate font-medium` (`text-sm` przy `dense`), obok niego `badges` w `flex items-center gap-2`. Podtytuł `truncate text-xs text-muted-foreground` (`text-sm` przy normalnej gęstości).
- Prawa strona: `flex shrink-0 items-center gap-2`, kolejność `meta` → przycisk akcji → `actions` → `menu`.
- `meta`: `whitespace-nowrap text-sm text-muted-foreground`.
- Przycisk akcji (tylko gdy `needsAction && actionLabel && onAction`): `<Button size="sm" variant="outline">` z klasą `border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400`. Amber świadomie, bo to ten sam język „wymaga uwagi", którego używa `AnswerStatusBadge` przy `review`.
- Wszystkie kolory przez tokeny semantyczne z `index.css` — poza amberem, który już funkcjonuje w projekcie jako stan „review/attention".

### 4.3 Klikalność — najważniejszy szczegół techniczny

Zagnieżdżanie przycisków w `<a>` (dzisiejszy wzorzec z linii 830–868, gdzie Rename siedzi w `<Link>` i broni się `e.preventDefault()`) jest nieprawidłowe w HTML i psuje nawigację klawiaturą. `EntityRow` rozwiązuje to nakładką:

- Gdy jest `href`: cały wiersz to `<div className="relative …">`, a tytuł owijamy w `<Link to={href} className="after:absolute after:inset-0 after:content-['']">`. Nakładka `::after` łapie kliknięcie w całe tło wiersza, a pozostałe przyciski dostają `relative z-10` i pozostają nad nią. Efekt: klik w wiersz działa, środkowy przycisk i Cmd+klik otwierają nową kartę natywnie (zgodnie z `mem://features/navigation/middle-click-anchor-pattern`), a w DOM nie ma zagnieżdżonych interaktywnych elementów.
- Gdy jest tylko `onClick`: kontener dostaje `role="button"`, `tabIndex={0}`, `onKeyDown` na Enter i Spację, `cursor-pointer`.
- Gdy nie ma ani `href`, ani `onClick`: zwykły `div`, bez `hover:bg-muted/50`, bez `cursor-pointer`.
- `href` i `onClick` jednocześnie: wygrywa `href`, `onClick` służy tylko jako efekt uboczny (np. telemetria) i nie blokuje nawigacji.

### 4.4 Dostępność

- `AttentionDot` dostaje `aria-hidden`, a informację o stanie niesie `aria-label` przycisku akcji („`${actionLabel}: ${title}`") — kolor nigdy nie jest jedynym nośnikiem znaczenia.
- Focus ring z tokenów: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- Tytuł jest zwykłym `<span>`, nie nagłówkiem — wiersze w listach nie tworzą hierarchii nagłówków (dzisiejsze `<h3>` w wierszach worksheetów to błąd semantyczny, który M6 naprawi przy migracji list).
- Minimalna wysokość dotykowa akcji: `h-8 w-8` dla przycisków ikonowych.

---

## 5. Nowy plik: `src/components/student/__tests__/EntityRow.test.tsx`

Vitest + `@testing-library/react`. Zakres, ~12 przypadków:

1. Renderuje tytuł, podtytuł, meta i badges.
2. Z `href` renderuje `<a>` z poprawnym `to`; klik w tło wiersza aktywuje link (obecność klasy nakładki).
3. Bez `href`, z `onClick` — `role="button"`, wywołanie na klik, na Enter i na Spację.
4. Bez `href` i bez `onClick` — brak `role="button"`, brak klasy `cursor-pointer`.
5. `needsAction` z `actionLabel` i `onAction` — przycisk widoczny, `onAction` wywołane, kliknięcie nie wywołuje `onClick` wiersza (`stopPropagation`).
6. `needsAction` bez `actionLabel` — brak przycisku, sama kropka.
7. `dense` zmienia padding na `p-3`.
8. `tone="destructive"` dodaje klasę obramowania destructive.
9. Sloty `menu` i `actions` renderują się i mają `z-10`.
10. `data-testid` przechodzi na kontener.

Uruchomienie: `bunx vitest run src/components/student/__tests__/EntityRow.test.tsx`.

Jeżeli `@testing-library/react` nie jest jeszcze zależnością projektu, sprawdzamy to przed startem (`rg -n "testing-library" package.json`). Gdy go nie ma — nie instalujemy nowej zależności w fazie refaktoru: zamiast testów renderujących piszemy `EntityRow.props.test.ts` sprawdzający czystą funkcję pomocniczą `resolveRowClasses(props)` wyeksportowaną z modułu, która zwraca komplet klas i tryb interakcji (`'link' | 'button' | 'static'`). Cała logika decyzyjna wiersza siedzi wtedy w tej funkcji, a JSX jest już tylko szablonem. Decyzja jest podjęta z góry: brak `@testing-library` → wariant `resolveRowClasses`, bez pytania w trakcie implementacji.

---

## 6. Weryfikacja

1. `bunx tsgo --noEmit -p tsconfig.app.json` — czysto.
2. `bunx vitest run src/lib/students/ src/components/student/` — 59 istniejących testów + nowe, zielono.
3. `rg -n "MeetingLinkField" src/` — dokładnie dwa trafienia poza nowym plikiem: import i użycie w `StudentPage.tsx`.
4. `rg -n "EntityRow" src/` — tylko nowy komponent i jego test; żaden ekran jeszcze go nie używa.
5. Playwright na `/demo` → wejście na stronę ucznia, zrzut ekranu zakładki Overview: pole Meeting Link renderuje się identycznie, lista Recent Worksheets bez zmian, brak błędów w konsoli.
6. Porównanie liczby linii: `StudentPage.tsx` spada z 1256 do ~1080.

---

## 7. Poza zakresem M2

Nie dotykamy: `StudentPage.tsx` poza usunięciem `MeetingLinkField` i importem, zakładek, `studentPrepPath()`, `React.lazy`, silnika generowania worksheetów, backendu, RLS, `docs/llm-context.md`, `public/llms.txt`, pamięci.

Zauważone problemy do zaadresowania w późniejszych fazach (logowane, nie naprawiane):

- `handleSave(finalLink, autoLinkEnabled ? 'custom' : 'custom')` — obie gałęzie identyczne,
- brak guardu demo przy zapisie linku spotkania,
- `<h3>` użyte jako tytuł wiersza w listach worksheetów (semantyka nagłówków) — naprawa przy migracji list na `EntityRow` w M6,
- cicha porażka `propagateToFutureSlots`,
- trzy rozbieżne anatomie wiersza żyją dalej aż do M4–M6.

Na koniec fazy: odhaczenie M2 w `roadmap.md` i aktualizacja sekcji 6 specyfikacji o rozszerzony kontrakt `EntityRowProps`.
