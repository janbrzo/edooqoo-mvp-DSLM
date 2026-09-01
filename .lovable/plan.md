# v6.9.108 — Docelowy widok dla zalogowanych (`/dashboard` + `/student/:id`)

Poziom: duże klocki. Bez szczegółów technicznych, bez kroków pośrednich. Cel: ustalić jeden docelowy obraz interfejsu nauczyciela, do którego będą się odnosić kolejne sprinty. Punkt ciężkości tej wersji: **strona ucznia**.

---

## 1. Co realnie jest dziś na ekranie

### `/dashboard` (531 linii)
`FreeWeekBanner` → `StickyNav` (z własnym CTA generowania) → `CompactStatsBar` (6 kafli: tokens, this month, all time, students, active homework, upcoming lessons + CTA Student Hub) → `NextPrepStrip` (do 3 kart uczniów) → dwie równorzędne kolumny: lista uczniów z wyszukiwarką i przełącznikiem sortowania oraz lista worksheetów, gdzie każda karta ma rząd ikon (rename, assign, copy, share, delete) plus zwijaną listę homework.

Ocena: **to jest stan „w miarę OK”**. Problemem nie jest liczba bloków, tylko że `CompactStatsBar` i `NextPrepStrip` mówią częściowo to samo co listy poniżej, a żaden element nie jest wyraźnie ważniejszy od innych.

### `/student/:id` (1256 linii) — tu jest właściwy problem
- **7 widocznych zakładek** w jednym pasku (`grid-cols-7`): Overview, 1 MINUTE, Worksheets, Homework, Flashcards, Calendar, Tests. Poniżej `lg` zamieniają się w **7 nieopisanych ikon obok siebie**.
- W kodzie żyją jeszcze 4 dodatkowe `TabsContent`: progress, skills, knowledge, events — dostępne, ale bez wejścia w pasku. Nauczyciel nie wie, że istnieją.
- Sama zakładka **Overview** to już pełny ekran: banner welcome testu, `OneMinutePrepCard`, banner Student Hub, siatka 3 kolumn z kartami (Student Details z edycją i type-to-confirm delete, Worksheets, kolejne panele).
- **DSLM** (zakładka „1 MINUTE”) to 452 linie i ~30 komponentów podrzędnych: Goals, Pathway, Skills, Profile, Timeline, Macro Timeline, Next Steps, Pacing, Event Log, Behavioral Stats, Attention Dots, własna zawsze widoczna podnawigacja.
- Nazewnictwo jest niespójne: zakładka nazywa się „1 MINUTE”, funkcja nazywa się DSLM, obietnica produktu nazywa się „1-Minute Prep”, a karta na Overview to `OneMinutePrepCard`. To trzy różne nazwy tej samej rzeczy w jednym widoku.

**Root cause (jedno zdanie):** strona ucznia jest zorganizowana jako **spis modułów systemu** (po jednej zakładce na tabelę w bazie), a nie jako **przebieg pracy nauczyciela** (przygotuj → prowadź → domknij), więc nauczyciel musi sam zbudować sobie proces z siedmiu równorzędnych szuflad — i przy pierwszym kontakcie nie wie, którą otworzyć.

Wniosek dodatkowy: „1 MINUTE” jako druga zakładka jest najgłośniejszym elementem obietnicy produktowej, a prowadzi do najbardziej złożonego widoku w całej aplikacji. To dokładna odwrotność tego, co powinno się stać.

---

## 2. Zasady docelowe (przyjęte, nie do renegocjacji w implementacji)

1. **Jedno zadanie na ekran.** Ekran odpowiada jednym zdaniem na „co ja tu robię”.
2. **Rytuał, nie moduły.** Nawigacja odwzorowuje cykl tygodniowy nauczyciela, nie strukturę danych.
3. **Progressive disclosure zamiast usuwania.** Nic nie kasujemy — rzeczy zaawansowane schodzą o jeden poziom niżej, zawsze osiągalne w jednym kliknięciu.
4. **Jedna akcja primary na ekran.**
5. **Jedna nazwa na jedną rzecz.** „1-Minute Prep” to nazwa rytuału. „Learning model” to nazwa DSLM. „1 MINUTE” jako etykieta zakładki znika.
6. **Nowy widzi mniej niż doświadczony.** Odsłanianie z użyciem, nie z instrukcji.
7. **Liczba pojawia się tylko wtedy, gdy prowadzi do decyzji.**

---

## 3. Docelowa architektura informacji

```text
POZIOM 1  TODAY              "co robię teraz"           /dashboard
POZIOM 2  STUDENT WORKSPACE  "wszystko o tej osobie"    /student/:id
POZIOM 3  DEEP VIEWS         "dowód i archiwum"         /student/:id/model, /worksheets, /calendar, /profile
```

Homework, flashcards, tests, progress, knowledge, events przestają być bytami nawigacyjnymi. Stają się warstwami wewnątrz Poziomu 2.

---

## 4. `/dashboard` → „Today”

Jedno zadanie: **wskazać następny ruch.** Jedna kolumna, trzy bloki:

1. **Next up** — 1–3 karty uczniów sortowane po najbliższej lekcji (fallback: ostatnia aktywność). Karta: imię, kiedy lekcja, jedno zdanie „co ostatnio było trudne”, jeden przycisk **Prepare next lesson**. Jedyny primary CTA na ekranie.
2. **Needs your attention** — maks. 5 pozycji wymagających reakcji (oddane homework, ukończony welcome test, nowa rezerwacja). Każda z jedną akcją. Puste = blok znika.
3. **Everything else** — jeden spokojny pas: „All students · All worksheets · Calendar”.

Zmiany względem dziś: `CompactStatsBar` przenosi się do `/profile` jako sekcja „Usage” (tokeny zostają w nawigacji, bo są ograniczeniem, nie statystyką). Dwie kolumny stają się jedną. Rząd ikon na karcie worksheetu redukuje się do „Open” + menu `…`. Wyszukiwarka i sortowanie uczniów przenoszą się na `/students` (pełna lista), bo na ekranie startowym z trzema uczniami są szumem.

Stan pusty: jeden ekran, jedna akcja — „Add your first student”, obok drugorzędne „Try a sample student”.

---

## 5. `/student/:id` → „Student Workspace” (sedno zmiany)

Jedno zadanie: **przygotować następną lekcję i domknąć poprzednią.**

Zamiast 7 zakładek (+4 ukrytych) — **3 zakładki + stały panel kontekstowy**:

```text
┌──────────────────────────────────────────────┬────────────────────┐
│  Anna Kowalska · B1 · next lesson Tue 18:00  │  STUDENT SNAPSHOT  │
│  [ Prep ]   [ Timeline ]   [ Library ]       │                    │
├──────────────────────────────────────────────┤  Level  B1         │
│                                              │  Goal   job intervw│
│   ← treść aktywnej zakładki →                │  Deadline  12 Nov  │
│                                              │  Focus areas       │
│                                              │   · past simple    │
│                                              │   · phrasal verbs  │
│                                              │   · fluency        │
│                                              │                    │
│                                              │  [Full learning    │
│                                              │   model →]         │
└──────────────────────────────────────────────┴────────────────────┘
```

### Zakładka 1 — **Prep** (domyślna, tu nauczyciel spędza 90% czasu)
Jedyne miejsce, w którym powstaje lekcja. Zawiera w jednym pionowym ciągu:
- proponowany temat następnej lekcji (dzisiejszy `OneMinutePrepCard` + Next Lesson Ideas z DSLM, złączone w jedną kartę),
- jeden przycisk primary **Generate worksheet**,
- ostatni worksheet z tym uczniem z akcją „Reuse / Continue”,
- szybkie „Add note” (dzisiejszy Quick Capture),
- ewentualny banner welcome testu, jeśli profil jest pusty.

Wszystko inne z dzisiejszego Overview (Student Details, edycja, usuwanie, Student Hub info, meeting link, ustawienia maili) przenosi się do **snapshotu i jego menu `…`**. To są ustawienia, nie praca.

### Zakładka 2 — **Timeline**
Jeden chronologiczny strumień zdarzeń ucznia: lekcje, wygenerowane worksheety, wysłane i oddane homework, notatki nauczyciela, wyniki testów, zmiany mastery. Zastępuje dzisiejsze zakładki Homework, Tests, Calendar (część uczniowska) i Events. Filtr typu zdarzenia jako pigułki nad strumieniem, nie osobne zakładki.

To jest największa pojedyncza redukcja złożoności: pięć list zamienia się w jedną narrację „co się dzieje z tym uczniem”.

### Zakładka 3 — **Library**
Materiały tego ucznia: worksheety, flashcards, przypisane homework. Archiwum i ponowne użycie, nie miejsce pracy. Gęstość listy, nie kart.

### Panel — **Student snapshot** (zawsze widoczny na desktopie, zwijany na mobile)
Poziom, cel, deadline, 3 obszary do pracy, link **Full learning model →**. Panel jest jedynym miejscem, gdzie dziś rozproszone dane profilowe żyją razem.

### DSLM → osobny widok „Learning model”
Cały dzisiejszy `DSLMTab` (Goals, Pathway, Skills, Profile, Timeline, Pacing, Event Log, Behavioral Stats) przenosi się na **osobny, pełnoekranowy widok** wchodzony świadomie z panelu snapshot. Nic nie znika, nic nie traci funkcji. Przestaje być drugą zakładką, którą nowy nauczyciel otwiera z ciekawości i odbija się od ściany.

Nazwa „1 MINUTE” w pasku zakładek znika. Obietnica „1-Minute Prep” zostaje wyrażona **działaniem** (zakładka Prep i jeden przycisk), a nie etykietą.

---

## 6. Warstwa dla nowych — „Guided mode”

Nowe konto startuje w trybie uproszczonym, sterowanym jedną flagą na profilu:

- Dashboard pokazuje tylko: Next up + Add student.
- Strona ucznia startuje z **jedną** zakładką Prep; Timeline i Library odsłaniają się po pierwszym wygenerowanym worksheecie.
- Panel snapshot pokazuje wyłącznie poziom i cel; „Full learning model” pojawia się po pierwszym tygodniu danych — wcześniej i tak jest pusty.
- Trzy kroki w nagłówku: **1. Add a student → 2. Prepare a lesson → 3. Send homework**. Znikają po domknięciu i nie wracają.
- „Show everything” wyłącza tryb na stałe, w każdej chwili.

To odpowiada wprost na feedback nauczycieli: problemem nie jest liczba funkcji, tylko to, że wszystkie pojawiają się w minucie zerowej.

---

## 7. Warstwa wizualna

- **Karta = jednostka pracy. Lista = archiwum.** Nic pomiędzy. Dziś Overview miesza oba.
- **Kolor tylko dla znaczenia.** Primary wyłącznie dla „Prepare / Generate”. Amber = wymaga uwagi. Destructive tylko w menu `…`, nigdy jako widoczna ikona kosza obok tytułu.
- **Typografia zamiast ramek.** Sekcja to nagłówek plus odstęp, nie kolejny `Card` w `Card`.
- **Ikony zawsze z etykietą** na Poziomie 1 i 2. Pasek 7 nieopisanych ikon poniżej `lg` znika razem z siedmioma zakładkami.
- **Puste stany są treścią**: mówią, co zrobić, żeby się wypełniły.

---

## 8. Miara sukcesu

| Metryka | Dziś | Cel |
|---|---|---|
| Zakładki na stronie ucznia | 7 widocznych (11 w kodzie) | 3 + panel |
| Elementy interaktywne na pierwszym ekranie ucznia | ~35 | poniżej 12 |
| Kliknięcia od logowania do wygenerowanej lekcji | 3–5 | 1–2 |
| Akcje primary na dashboardzie | ~5 | 1 |
| Nazwy tej samej funkcji w UI | 3 („1 MINUTE”, DSLM, 1-Minute Prep) | 2 (1-Minute Prep, Learning model) |

Test Marthy: nauczycielka z 10-letnim stażem, która nigdy nie widziała edooqoo, po wejściu na stronę ucznia wie bez czytania czegokolwiek, co kliknąć, żeby przygotować jutrzejszą lekcję.

---

## 9. Orientacyjna kolejność (bez szczegółów, do rozpisania po akceptacji)

1. Strona ucznia: 7 zakładek → 3 + snapshot, DSLM jako osobny widok. Największy zwrot.
2. Dashboard → „Today”, statystyki do `/profile`.
3. Guided mode dla nowych kont.
4. Przejście wizualne jako warstwa na wszystkim powyżej.

## Poza zakresem

Silnik generowania worksheetów, logika DSLM (zmieniamy tylko miejsce wejścia, nie działanie), backend, RLS, migracje, SEO, Student Hub (`/my`).
