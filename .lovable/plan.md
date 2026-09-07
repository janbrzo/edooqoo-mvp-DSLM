# Plan v6.9.110 — Szybki dostęp do ucznia (Quick Student Access)

## Problem

Po przebudowie dashboardu na widok „Today” jedyna droga do konkretnego ucznia (poza 3 kartami Next up) prowadzi przez kafel *All students* → strona `/students` → wiersz ucznia. Dla nauczyciela z 20 uczniami to 3 kliknięcia i zmiana strony za każdym razem. Wcześniej lista uczniów z wyszukiwarką i sortowaniem była wprost na `/dashboard`.

Przyczyna strukturalna: dashboard zoptymalizowano pod rytuał „co teraz”, ale nie zostawiono żadnego kanału nawigacji student-centrycznej — a to najczęstsza intencja nauczyciela w ciągu dnia.

## Rozwiązanie — cztery warstwy dostępu (wszystkie wybrane)

Kolejność od najszybszej do najbardziej „przeglądowej”. Żadna nie dokłada nowej sekcji-hałasu: dwie są jednowierszowe, jedna jest w nawigacji, jedna schowana pod istniejącym kaflem.

### 1. Wyszukiwarka „Jump to student” w nagłówku dashboardu
- Jedno pole tuż pod powitaniem: placeholder `Jump to student…  /`.
- Wpisanie 2+ znaków → lista podpowiedzi (imię, poziom, cel), maks. 8 wyników, dopasowanie po imieniu, e-mailu i celu (`formatGoal`).
- Nawigacja klawiaturą (strzałki + Enter), Esc zamyka, klawisz `/` (i `Cmd/Ctrl+K`) ustawia fokus z dowolnego miejsca dashboardu — z pominięciem sytuacji, gdy fokus jest już w polu tekstowym.
- Pusty stan (brak dopasowania): „No student matching …”.
- Widoczne tylko, gdy nauczyciel ma co najmniej 1 ucznia.

### 2. Pasek „Recent” — ostatnio używani uczniowie
- Poziomy pasek pigułek z imionami, maks. 8, tuż pod wyszukiwarką.
- Kolejność: `updated_at DESC` z istniejącego `useStudents` (to samo źródło co dawne sortowanie „ostatnia akcja”), z pominięciem uczniów już pokazanych w Next up, żeby nie dublować.
- Na telefonie przewijalny poziomo, bez łamania układu (`overflow-x-auto`, brak poziomego scrolla strony).
- Każda pigułka to `<a href>` — środkowy klik / Ctrl-klik otwiera nową kartę (obowiązujący wzorzec middle-click anchor).

### 3. Globalny przełącznik uczniów w górnej nawigacji także na `/dashboard`
- Istniejący `NavStudentSwitcher` jest dziś ukrywany na `/dashboard` i `/profile`. Włączamy go na `/dashboard` (na `/profile` zostaje ukryty).
- Do popovera dokładamy pole filtrowania na górze listy (przydatne przy 20+ uczniach) — zmiana obejmuje wszystkie strony, na których switcher już działa.
- Aktualizujemy zapis w pamięci projektu, bo dotychczasowa reguła „nie na /dashboard” przestaje obowiązywać.

### 4. Kafel „All students” rozwijany w miejscu
- Kafel w sekcji *Everything else* zyskuje strzałkę rozwijania obok linku: klik w tekst → nadal przejście na `/students`, klik w strzałkę → rozwinięcie lekkiej listy w miejscu.
- Rozwinięta lista: pole wyszukiwania, sortowanie (Recently active / Name A–Z / Next lesson), płaskie wiersze (imię, poziom, cel), maks. 10 widocznych z przewijaniem i stopką „See all N students”.
- Stan rozwinięcia zapamiętany w `localStorage`, domyślnie zwinięty — dashboard w stanie spoczynku wygląda jak teraz.

### Cel kliknięcia
Wszystkie cztery ścieżki prowadzą do `/student/:id?tab=dslm` — od razu w przygotowanie lekcji, spójnie z przyciskiem *Prepare next lesson*.

## Szczegóły techniczne

Nowe pliki:
- `src/components/dashboard/StudentQuickSearch.tsx` — pole + lista podpowiedzi + obsługa klawiatury i skrótów; czysto prezentacyjne, uczniowie wstrzykiwani przez props.
- `src/components/dashboard/RecentStudentsBar.tsx` — pasek pigułek.
- `src/components/dashboard/AllStudentsInline.tsx` — rozwijana lista pod kaflem; reuse `sortStudents` wyeksportowanego z `src/pages/AllStudentsPage.tsx` oraz `formatGoal`.
- `src/lib/students/quickAccess.ts` — czyste funkcje `filterStudents(students, query)` i `pickRecentStudents(students, excludeIds, limit)` + testy jednostkowe.

Zmiany:
- `src/pages/Dashboard.tsx` — render `StudentQuickSearch` i `RecentStudentsBar` między `DashboardHeader` a `GuidedStepsBar`/`NextUpSection`; przekazanie `students` i id-ków z Next up.
- `src/components/dashboard/EverythingElseSection.tsx` — kafel All students jako `Collapsible` z `AllStudentsInline`; obecne zachowanie linku i kaflów Worksheets/Calendar bez zmian.
- `src/components/landing/StickyNav.tsx` — `showStudentSwitcher = isRegisteredUser && !isProfile`.
- `src/components/landing/NavStudentSwitcher.tsx` — pole filtrowania na górze popovera.
- `mem/features/navigation/nav-student-switcher.md`, `mem/features/dashboard/today-layout.md` — aktualizacja reguł.
- `docs/llm-context.md`, `public/llms.txt`, `roadmap.md` — wpis RAG (PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS).

Bez zmian: żadnych nowych zapytań do bazy (wszystko z istniejących `useStudents` i `useNextUpStudents`), zero ruchu w Worksheet Generation Engine, DSLM, backendzie i RLS. Demo mode działa bez dodatkowych wywołań Supabase.

## Weryfikacja
- `bunx tsgo --noEmit -p tsconfig.app.json`.
- Testy jednostkowe dla `filterStudents` / `pickRecentStudents` (dopasowanie po imieniu, e-mailu, celu; wykluczenia; limit).
- Playwright na `/demo`: wpisanie fragmentu imienia → Enter → ląduje na `/student/:id?tab=dslm`; klik pigułki Recent; rozwinięcie kafla All students i sortowanie; switcher w nawigacji widoczny na `/dashboard`; 390 px bez poziomego scrolla; zero błędów konsoli.

## Kolejność wdrożenia
1. `quickAccess.ts` + testy (bez UI).
2. `StudentQuickSearch` + `RecentStudentsBar` + montaż w `Dashboard.tsx`.
3. Rozwijany kafel `All students`.
4. `StickyNav` + filtr w `NavStudentSwitcher`.
5. Pamięć + RAG + roadmap.
