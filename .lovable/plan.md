# v6.9.109 — `/dashboard` → „Today”: szczegółowy plan wdrożenia

Ten plan schodzi dwa poziomy niżej od zaakceptowanej wizji „One Job Per Screen” i dotyczy wyłącznie `/dashboard`. Strona ucznia (`/student/:id`) będzie osobnym planem. Wizja ogólna zostaje zapisana na stałe w repo jako punkt odniesienia (krok 0).

---

## Krok 0 — utrwalenie wizji (pierwsze zadanie implementacji)

1. Zapisać zaakceptowany plan wizji jako `docs/ux/target-teacher-experience.md` (po angielsku, ta sama treść: diagnoza, 7 zasad, 3 poziomy, Today, Student Workspace, Guided mode, warstwa wizualna, metryki). Każdy kolejny plan UX odwołuje się do tego pliku.
2. Dodać w `roadmap.md` sekcję „UX North Star” z trzema pozycjami: Dashboard → Today (ten plan), Student Workspace, Guided mode.

---

## 1. Co dokładnie jest nie tak na obecnym `/dashboard` (zweryfikowane w kodzie)

| Element | Stan | Problem |
|---|---|---|
| `CompactStatsBar` | 6 liczników + CTA Student Hub | 4 z 6 liczb powtarzają się niżej lub nie prowadzą do żadnej decyzji; CTA Hub to informacja, nie akcja nauczyciela |
| `NextPrepStrip` | 3 karty wg `updated_at` | Dobry kierunek, ale sortowanie po „ostatnio edytowany” ≠ „następna lekcja”; przycisk `variant="outline"` nie jest primary; brak informacji „co ostatnio było trudne” |
| Kolumna „Students” | wyszukiwarka, sortowanie A-Z/Z-A/Recent, `StudentCard` | Każdy `StudentCard` odpala **własne** `useWorksheetHistory` + `useAllWorksheetHomework` → N+1 zapytań; karta ma zielony „View Profile”, zwijane „Recent” i osobny licznik worksheetów |
| Kolumna „Recent Worksheets” | 5 kart, każda z 5 ikonami akcji + badge + `StudentSelector` + `MediaBadges` + zwijana lista homework | ~12 elementów interaktywnych na kartę; to archiwum udające miejsce pracy |
| `OnboardingChecklist` | pływająca karta 8 kroków w prawym dolnym rogu, montowana globalnie w `App.tsx` | Konkuruje z `BugReportButton` i `BackgroundPatternSwitcher` o ten sam róg; 8 kroków to instrukcja, nie prowadzenie |
| Loader | pełnoekranowy spinner „Loading dashboard...” | Niespójne z `PageLoadingState` wdrożonym w v6.9.92 |

**Root cause:** dashboard składa się z pięciu równorzędnych bloków, z których każdy był dodawany jako osobna funkcja, i nie istnieje jedna reguła, która decyduje, co jest ważniejsze od czego.

---

## 2. Docelowy układ „Today” — jedna kolumna, trzy strefy

```text
┌────────────────────────────────────────────────────────────┐
│ StickyNav (bez zmian)                                       │
├────────────────────────────────────────────────────────────┤
│ FreeWeekBanner (bez zmian, tylko gdy dotyczy)               │
├────────────────────────────────────────────────────────────┤
│ Good evening, Jan.                    [+ Add student]       │  ← nagłówek
│ 3 students · 2 lessons this week                            │
├────────────────────────────────────────────────────────────┤
│ NEXT UP                                                     │  ← strefa A
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │ Anna K.  B1  │ │ Marek W. A2  │ │ Ola N.   B2  │          │
│ │ Tue 18:00    │ │ Thu 09:30    │ │ no lesson    │          │
│ │ ↳ struggled  │ │ ↳ struggled  │ │   booked     │          │
│ │   with past  │ │   with       │ │ ↳ last: ...  │          │
│ │   simple     │ │   articles   │ │              │          │
│ │[Prepare next │ │[Prepare next │ │[Prepare next │          │
│ │  lesson  →]  │ │  lesson  →]  │ │  lesson  →]  │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
├────────────────────────────────────────────────────────────┤
│ NEEDS YOUR ATTENTION (2)                                    │  ← strefa B
│ • Marek submitted homework "Phrasal verbs"   [Review]       │
│ • Ola finished the Welcome Test              [See results]  │
├────────────────────────────────────────────────────────────┤
│ EVERYTHING ELSE                                             │  ← strefa C
│ All students (3) ›   Worksheets (24) ›   Calendar ›         │
│ ▸ Recent worksheets (5)      ← domyślnie zwinięte           │
└────────────────────────────────────────────────────────────┘
```

Maksymalna szerokość treści `max-w-4xl` (dziś `container` bez limitu). Jedna kolumna na każdej szerokości. Jedyny przycisk `variant="default"` na stronie: **Prepare next lesson** (i „Add your first student” w stanie pustym).

---

## 3. Specyfikacja stref

### Nagłówek (`DashboardHeader`)
- Powitanie wg pory dnia (`Good morning / afternoon / evening, {first_name}`; fallback „Teacher”).
- Podtytuł: `{n} students · {m} lessons this week` — jedyne dwie liczby na ekranie. Gdy `m = 0`: „no lessons booked this week”.
- Po prawej: `Add student` (`variant="outline"`, `size="sm"`). Otwiera istniejący `AddStudentDialog`.
- Zachowuje obsługę `?action=add-student` z maila powitalnego (bez zmian).

### Strefa A — `NextUpSection`
Źródło: nowy hook `useNextUpStudents(students)` (sekcja 5). Zasady kolejności:
1. Uczniowie z lekcją w najbliższych 7 dniach — rosnąco po dacie/godzinie.
2. Potem pozostali — malejąco po `updated_at` (dzisiejsza logika `NextPrepStrip`).
3. Maksymalnie 3 karty. Przy 1–2 uczniach siatka ma odpowiednio 1–2 kolumny, nie puste miejsca.

Karta `NextUpCard`:
- Wiersz 1: imię (link do `/student/:id`) + `Badge` poziomu.
- Wiersz 2: termin lekcji `Tue 18:00` (z `calendar_slots`) albo `No lesson booked` w `text-muted-foreground`.
- Wiersz 3 „Focus”: ostatni wpis `student_knowledge_entries` kategorii `Skill Assessment` z `metadata.skill_subtype ∈ {weakness, mistake, practice}`; format `Struggled with: {title}` (`line-clamp-1`). Fallback: `main_goal` w formie „Goal: …”. Drugi fallback: „No signals yet — start with a worksheet”.
- Przycisk `Prepare next lesson →`, `variant="default"`, pełna szerokość, `aria-label="Prepare next lesson for {name}"`, nawigacja do `/student/:id` (docelowo zakładka Prep; do czasu przebudowy strony ucznia — `?tab=dslm`, bo tam dziś są Next Lesson Ideas).
- Brak innych akcji na karcie. Żadnych liczników worksheetów.

### Strefa B — `AttentionSection`
Źródło: nowy hook `useDashboardAttention()` (sekcja 5). Trzy typy pozycji, każda z dokładnie jedną akcją:

| Typ | Warunek | Tekst | Akcja |
|---|---|---|---|
| `homework_to_review` | `homework_assignments.completed_at IS NOT NULL AND reviewed_at IS NULL` | `{student} submitted "{title}"` | `Review` → `/homework/{id}/review` |
| `welcome_test_done` | `homework_notifications.notification_type = 'welcome_test_completed' AND is_read = false` | `{student} finished the Welcome Test` | `See results` → `/student/{student_id}?tab=tests` |
| `booking_new` | `calendar_notifications.is_resolved = false` | istniejące `message` | `Open calendar` → `/calendar` |

- Sortowanie: po `created_at` malejąco, limit 5, link „View all in notifications” otwiera istniejący `UnifiedBell` (nie budujemy drugiego inboxu — dzwonek zostaje jedynym pełnym archiwum).
- Pusta lista → sekcja **nie renderuje się** (żadnego „All caught up” — to szum).
- Lista, nie karty: `ul` z `divide-y`, ikona typu + tekst + przycisk `variant="ghost" size="sm"` po prawej.

### Strefa C — `EverythingElseSection`
- Trzy linki-kafle w jednym wierszu (`grid-cols-3`, na mobile `grid-cols-1`): `All students (n)` → `/students` (nowa trasa, sekcja 6), `Worksheets (n)` → `/worksheets`, `Calendar` → `/calendar`. Styl: `border border-border rounded-lg p-3 hover:bg-muted/50`, ikona + etykieta + chevron. Bez `variant="default"`.
- Pod spodem `Collapsible` „Recent worksheets (5)”, **domyślnie zwinięty**, stan zapamiętany w `localStorage['edooqoo.dashboard.recentOpen']`. W środku uproszczona lista `RecentWorksheetRow`: tytuł (link), badge ucznia, `MediaBadges`, po prawej jeden `DropdownMenu` `…` z pozycjami: Rename, Assign to student, Duplicate, Copy share link, Delete. Wszystkie te akcje istnieją już dziś jako osobne przyciski — przenosimy je 1:1 do menu, reużywając `RenameDialog`, `StudentSelector`, `DuplicateWorksheetButton`, `DeleteWorksheetButton` (te dwa ostatnie mają już warianty; użyć `asChild`/trigger w `DropdownMenuItem` albo wywołać ich handlery). Zwijana lista homework pod worksheetem znika z dashboardu (pozostaje na `/worksheets` i stronie ucznia).

### Stan pusty (0 uczniów)
Cały ekran pod nagłówkiem zastępuje jeden blok `EmptyDashboard`: ilustracyjna ikona `Users`, nagłówek „Add your first student”, jedno zdanie „Edooqoo builds the learner context once, then every weekly prep starts from it.”, przycisk primary `Add your first student`, pod nim link tekstowy `See a sample student` → `/demo`. Strefy B i C nie renderują się.

### Stan ładowania
Pełnoekranowy spinner zastępuje `PageLoadingState` (z v6.9.92) z etykietą „Loading your dashboard”. Logika `hasEverLoaded` zostaje.

---

## 4. Guided mode na dashboardzie (zakres tego planu — tylko dashboard)

Sygnał: istniejący `onboarding_progress` w `profiles` (żadnej nowej kolumny). `guided = !progress.completed && !progress.dismissed && !progress.steps.generate_worksheet`.

W trybie guided:
- Strefa C renderuje **tylko** kafel `All students`; „Recent worksheets” i „Worksheets” pojawiają się po pierwszym wygenerowanym worksheecie.
- Nad strefą A pasek `GuidedStepsBar`: trzy kroki `1 Add a student → 2 Prepare a lesson → 3 Send homework`, każdy z ikoną ✓/○, bieżący podświetlony `text-primary`. Mapowanie na istniejące klucze: `add_student`, `generate_worksheet`, `create_homework` (klucz istnieje w typie jako deprecated — przywracamy go do `ACTIVE_KEYS` tylko dla tego paska; 8-krokowa lista `OnboardingChecklist` pozostaje bez zmian dla tych, którzy ją mają otwartą).
- Po prawej paska link `Show everything` → ustawia `dismissed: true` przez istniejące `useOnboardingProgress`.
- Pływający `OnboardingChecklist` **nie renderuje się na `/dashboard`** (warunek na `location.pathname` w `App.tsx`), bo pasek go zastępuje. Na innych trasach bez zmian.

---

## 5. Warstwa danych (dokładne zapytania)

Wszystkie hooki: React Query, `staleTime: 60_000`, wczesny `return` w demo (`isDemoMode`) z danymi z `demoData` lub pustą tablicą — zgodnie z regułą pamięci o UUID.

### `useNextUpStudents(students: Student[])` → `NextUpStudent[]`
Dwa zapytania batchowe, zero N+1:
```ts
// 1. next lesson per student (7 days)
supabase.from('calendar_slots')
  .select('student_id, slot_date, start_time')
  .eq('teacher_id', teacherId).eq('status', 'booked')
  .in('student_id', ids)
  .gte('slot_date', today).lte('slot_date', todayPlus7)
  .order('slot_date').order('start_time');
// 2. latest weakness signal per student
supabase.from('student_knowledge_entries')
  .select('student_id, title, metadata, created_at')
  .eq('teacher_id', teacherId).in('student_id', ids)
  .eq('category', 'Skill Assessment').is('deleted_at', null).eq('is_outdated', false)
  .order('created_at', { ascending: false }).limit(ids.length * 5);
```
Grupowanie po `student_id` po stronie klienta (pierwszy pasujący `skill_subtype`). Sortowanie i `slice(0, 3)` w hooku. `queryKey: ['dashboard-next-up', teacherId, ids.join(',')]`.

### `useDashboardAttention()` → `AttentionItem[]`
Trzy zapytania równolegle (`Promise.all`):
```ts
supabase.from('homework_assignments')
  .select('id, title, student_id, completed_at')
  .eq('teacher_id', teacherId).not('completed_at', 'is', null).is('reviewed_at', null)
  .order('completed_at', { ascending: false }).limit(5);
supabase.from('homework_notifications')
  .select('id, student_id, message, created_at')
  .eq('teacher_id', teacherId).eq('notification_type', 'welcome_test_completed').eq('is_read', false)
  .limit(5);
supabase.from('calendar_notifications')
  .select('id, message, student_name, created_at')
  .eq('teacher_id', teacherId).eq('is_resolved', false).limit(5);
```
Imiona uczniów mapowane z już pobranej listy `students` (bez join). Typ wspólny: `{ id, kind, text, ctaLabel, href, createdAt }`.

### `useDashboardCounts()`
Zastępuje `useWorksheetStats` + `useUpcomingLessonsCount` na dashboardzie: `students.length` (z `useStudents`), `worksheets` count (`head: true, count: 'exact'`), `lessonsThisWeek` (istniejący `useUpcomingLessonsCount` — reużyty bez zmian).

### Co znika z `Dashboard.tsx`
`useWorksheetStats`, `useAllWorksheetHomework` (dla całej listy), `useTokenSystem` zostaje tylko dla `StickyNav`, stany `studentSearch` / `sortMode` / `selectedTimeFrame`.

---

## 6. Przeniesienia (nic nie ginie)

| Co | Skąd | Dokąd |
|---|---|---|
| 6 liczników `CompactStatsBar` | dashboard | `/profile` — nowa karta „Usage” między „Token Usage Details” a „Plan & Billing”; ten sam komponent, prop `variant="profile"` (pionowa lista zamiast pastylek), bez części Hub |
| Informacja o Student Hub (`edooqoo.com/my`) | `CompactStatsBar` | `AddStudentDialog` (jedno zdanie pod polem e-mail) + `/profile` w karcie „Usage” |
| Wyszukiwarka + sortowanie uczniów + `StudentCard` | dashboard | nowa trasa `/students` (`AllStudentsPage`), lista tabelaryczna: imię, poziom, cel, ostatnia aktywność, następna lekcja; ta sama logika filtrowania; `StudentCard` upraszczamy do wiersza bez własnych hooków (dane z jednego zapytania strony) |
| Lista homework pod worksheetami | dashboard | pozostaje na `/worksheets` i na stronie ucznia |
| `OnboardingChecklist` | pływająca na dashboardzie | `GuidedStepsBar` inline (sekcja 4); na innych trasach bez zmian |

`NavStudentSwitcher` zgodnie z pamięcią **nie** trafia na `/dashboard` — strefa A i kafel „All students” pełnią tę rolę.

---

## 7. Struktura plików

```text
src/pages/Dashboard.tsx                      — przepisany do ~150 linii: hooki + 4 sekcje
src/pages/AllStudentsPage.tsx                — nowa (/students)
src/components/dashboard/DashboardHeader.tsx — nowy
src/components/dashboard/NextUpSection.tsx   — nowy (zastępuje NextPrepStrip)
src/components/dashboard/NextUpCard.tsx      — nowy
src/components/dashboard/AttentionSection.tsx— nowy
src/components/dashboard/EverythingElseSection.tsx — nowy
src/components/dashboard/RecentWorksheetRow.tsx    — nowy (menu … z 5 akcjami)
src/components/dashboard/GuidedStepsBar.tsx  — nowy
src/components/dashboard/EmptyDashboard.tsx  — nowy
src/components/dashboard/CompactStatsBar.tsx — prop variant, użycie tylko w Profile
src/hooks/useNextUpStudents.ts               — nowy
src/hooks/useDashboardAttention.ts           — nowy
src/hooks/useDashboardCounts.ts              — nowy
src/App.tsx                                  — trasa /students; OnboardingChecklist ukryty na /dashboard
src/pages/Profile.tsx                        — karta Usage
src/data/demoData.ts                         — 2 booked slots + 3 wpisy Skill Assessment + 1 homework do review, żeby /demo pokazywał pełny Today
```
Usuwane: `NextPrepStrip.tsx`, `WorksheetHomeworkList.tsx` (jeśli po zmianie nie ma innych importów — sprawdzić `rg`).

---

## 8. Warstwa wizualna (konkretne klasy)

- Kontener: `max-w-4xl mx-auto px-4 py-6 space-y-8`.
- Nagłówki stref: `text-xs font-semibold uppercase tracking-wider text-muted-foreground` + opcjonalny licznik w nawiasie. Bez ikon w nagłówkach stref.
- Strefy oddzielane `space-y-8`, nie `Card`. Jedyne `Card` na stronie to `NextUpCard` (`border-border`, `hover:border-primary/40`).
- Kolor: primary tylko na `Prepare next lesson`; amber (`text-amber-600 dark:text-amber-400`) tylko na ikonach strefy B; destructive tylko wewnątrz menu `…`.
- Dark mode: wyłącznie tokeny (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`). Zero `text-white`, `bg-white`, `text-gray-*`, `text-green-*`.
- Touch targets: wszystkie przyciski ≥ `min-h-11` na mobile (`sm:min-h-9`).
- Każdy przycisk ikonowy (`…`) ma `aria-label`; sekcje mają `aria-labelledby` wskazujący nagłówek.

---

## 9. Ryzyka i decyzje podjęte z góry

| Ryzyko | Decyzja |
|---|---|
| Nauczyciele przyzwyczajeni do dwóch kolumn | Zachowujemy wszystkie akcje (menu `…`, `/students`, `/worksheets`); przez 30 dni w strefie C dyskretny link „Looking for the old layout? Everything moved here” |
| `calendar_slots` ma 2 polityki RLS — batch `.in()` musi działać dla nauczyciela | Sprawdzić przed implementacją zapytaniem read-only; jeśli polityka ogranicza, fallback do sortowania po `updated_at` (dzisiejsze zachowanie) |
| Demo (`/demo`) używa fałszywych UUID | Wszystkie trzy nowe hooki mają `if (isDemoMode) return demoDerived` na początku `queryFn`; brak zapytań do Supabase w demo |
| `create_homework` jest deprecated w `useOnboardingProgress` | Wracamy z nim wyłącznie do `GuidedStepsBar`; `ACTIVE_KEYS` w `OnboardingChecklist` bez zmian, żeby nie zmieniać procentu ukończenia u istniejących kont |
| Usunięcie homework list z dashboardu | Zero utraty funkcji — te same dane na `/worksheets`, stronie ucznia i w strefie B jako „to review” |

Silnik generowania worksheetów, DSLM, backend, RLS i migracje — nietknięte. Ten plan nie wymaga żadnej migracji.

---

## 10. Weryfikacja (Playwright na `/demo`, 1280 i 390 px)

1. Liczba elementów `button, a, input` w `main` na `/dashboard` ≤ 14 przy 3 uczniach i zwiniętych „Recent worksheets”.
2. Dokładnie jeden przycisk z klasą wariantu `default` na karcie „Next up” × liczba kart; żaden inny `default` poza stanem pustym.
3. Karty „Next up” posortowane po dacie lekcji (demo: 2 z lekcją, 1 bez).
4. Strefa B pokazuje wpis homework do review z działającym linkiem `/homework/:id/review`.
5. Strefa B nie renderuje się, gdy hooki zwrócą puste tablice (test z pustym `demoData`).
6. `/students` renderuje listę z wyszukiwarką; `/profile` pokazuje kartę „Usage” z 6 liczbami.
7. 390 px: `scrollWidth === innerWidth`; brak pływającej karty onboardingu na `/dashboard`.
8. Konsola: brak ostrzeżeń React; `bunx tsgo --noEmit -p tsconfig.app.json` = 0 błędów.
9. Guided mode: konto z `onboarding_progress.steps.generate_worksheet=false` widzi `GuidedStepsBar` i tylko kafel „All students”.

## 11. RAG

`docs/llm-context.md`: wpis v6.9.109 (PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS) obejmujący Today layout, trzy nowe hooki, `/students`, Guided mode na dashboardzie. `public/llms.txt`: aktualizacja opisu dashboardu w sekcji produktu bez zmiany struktury pliku. Nowy plik `docs/ux/target-teacher-experience.md` (krok 0).

## Poza zakresem

Strona ucznia (`/student/:id`), pełny Guided mode poza dashboardem, zmiany `StickyNav`, `UnifiedBell`, `CalendarPage`, silnik worksheetów.
