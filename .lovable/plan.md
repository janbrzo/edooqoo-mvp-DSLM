# v6.9.108 — Docelowy widok dla zalogowanych: „One Job Per Screen”

Poziom: duże klocki. Bez szczegółów technicznych, bez kroków pośrednich. Celem jest ustalenie docelowego obrazu interfejsu nauczyciela, żeby kolejne sprinty miały jeden punkt odniesienia.

---

## 1. Diagnoza: dlaczego nauczyciel się gubi

Sprawdziłem realną strukturę aplikacji po zalogowaniu:

- `/dashboard` renderuje jednocześnie: pasek 6 statystyk (`CompactStatsBar`), pasek „Next Prep” (`NextPrepStrip`), dwie równorzędne kolumny (lista uczniów z wyszukiwarką i sortowaniem + lista worksheetów z 6 ikonami akcji na kartę), listy homework rozwijane pod worksheetami, banery (`FreeWeekBanner`), `StickyNav` z osobnym generatorem.
- `/student/:id` ma 7 widocznych zakładek (Overview, DSLM, Worksheets, Homework, Flashcards, Calendar, Tests) plus 4 dalsze sekcje w kodzie (progress, skills, knowledge, events). DSLM ma jeszcze własną, zawsze widoczną podnawigację.
- Do tego osobne trasy najwyższego poziomu: `/worksheets`, `/calendar`, `/calendar/settings`, `/profile`, `/one-minute-prep`.

**Root cause (jedno zdanie):** interfejs jest zorganizowany wokół *obiektów systemu* (uczniowie, worksheety, homework, flashcards, kalendarz, DSLM), a nie wokół *jednego powtarzalnego rytuału nauczyciela* — „przygotuj następną lekcję dla tego ucznia w minutę” — więc każdy ekran wymaga od użytkownika samodzielnego złożenia tych obiektów w proces.

To nie jest problem nadmiaru funkcji. To problem braku hierarchii: wszystko na ekranie ma tę samą wagę wizualną i tę samą głośność.

---

## 2. Zasady docelowe (przyjęte, nie do dyskusji w implementacji)

1. **One Job Per Screen.** Każdy ekran ma jedno zdanie odpowiedzi na pytanie „co tu robię”. Reszta jest podporządkowana wizualnie.
2. **Student jest jednostką pracy, nie obiektem w tabeli.** Nauczyciel nigdy nie myśli „worksheety”; myśli „Anna, wtorek 18:00”. Nawigacja globalna ma być studentocentryczna.
3. **Progressive disclosure zamiast usuwania.** Nic nie kasujemy. Zaawansowane elementy (DSLM, mastery, Tests, statystyki) schodzą o jeden poziom głębiej, dostępne w jednym kliknięciu, ale nie krzyczą na starcie.
4. **Maksymalnie jedna akcja primary na ekran.** Dziś na dashboardzie konkuruje ich co najmniej pięć.
5. **Nowy nauczyciel widzi mniej niż doświadczony.** Interfejs odsłania się z użyciem, a nie z instrukcji.
6. **Liczby tylko wtedy, gdy prowadzą do decyzji.** „Students: 3” obok nagłówka „Students (3)” to szum, nie dashboard.

---

## 3. Docelowa architektura informacji — trzy poziomy

```text
POZIOM 1  TODAY            "co robię teraz"        -> /dashboard
POZIOM 2  STUDENT WORKSPACE "wszystko o tej osobie" -> /student/:id
POZIOM 3  LIBRARY & SETUP   "archiwum i ustawienia" -> /worksheets, /calendar, /profile
```

Cała reszta (homework, flashcards, tests, DSLM, progress, knowledge) przestaje być bytem nawigacyjnym najwyższego rzędu i staje się warstwą wewnątrz Poziomu 2.

---

### Poziom 1 — „Today” (nowy dashboard)

Jedno zadanie: **wskazać nauczycielowi następny ruch.**

Struktura pionowa, jedna kolumna, maksymalnie trzy bloki:

1. **Next up** — 1–3 karty uczniów posortowane po najbliższej lekcji (fallback: ostatnia aktywność). Na karcie: imię, kiedy lekcja, jedno zdanie „co ostatnio było trudne”, jeden przycisk **Prepare next lesson**. To jest jedyny primary CTA na ekranie.
2. **Needs your attention** — lista zdarzeń wymagających reakcji: oddana praca domowa do sprawdzenia, ukończony welcome test, nieodebrana rezerwacja. Maksymalnie 5 pozycji, każda z jedną akcją. Puste = blok znika.
3. **Everything else** — jeden zwinięty pas: „All students · All worksheets · Calendar”. Bez liczników poza jednym „X students”.

Znika z pierwszego ekranu: pasek 6 statystyk (przenosimy do `/profile` jako „Usage”), dwukolumnowy layout, wyszukiwarka i sortowanie uczniów, rząd 6 ikon na karcie worksheetu (zostaje „Open” + menu `…`).

Stan pusty (0 uczniów) to jeden ekran z jedną akcją: „Add your first student” + drugorzędne „Try a sample student”.

---

### Poziom 2 — „Student Workspace” (przebudowa `/student/:id`)

Jedno zadanie: **przygotować i domknąć lekcję z tą osobą.**

Zamiast 7 równorzędnych zakładek — **3 zakładki + panel kontekstowy**:

```text
[ Prep ]   [ Timeline ]   [ Library ]        + prawy panel: Student snapshot
```

- **Prep** (domyślna) — jedyne miejsce, w którym powstaje lekcja: propozycja tematu z Next Lesson Ideas, przycisk generowania, ostatni worksheet, szybkie „Add note”. To jest ekran, na którym nauczyciel spędza 90% czasu.
- **Timeline** — chronologia zdarzeń ucznia: lekcje, worksheety, homework, notatki, testy. Zastępuje osobne zakładki Homework, Tests, Events i część DSLM. Jeden strumień zamiast pięciu list.
- **Library** — materiały ucznia: worksheety, flashcards, przypisane homework. Archiwum, nie miejsce pracy.
- **Student snapshot** (panel boczny, zawsze widoczny na desktopie, zwijany na mobile) — poziom, cel, deadline, 3 najsłabsze obszary, link „Full learning model” otwierający pełny DSLM jako **osobny widok**, nie zakładkę.

DSLM nie znika — przestaje być czymś, co nowy nauczyciel musi zrozumieć w pierwszym tygodniu. Staje się „dowodem pod maską”, do którego wchodzi się świadomie.

---

### Poziom 3 — „Library & Setup”

Bez zmian koncepcyjnych: `/worksheets` (globalne archiwum z filtrami), `/calendar`, `/profile` (subskrypcja, tokeny, statystyki użycia, integracje). To są miejsca, do których wchodzi się rzadko i celowo.

---

## 4. Warstwa dla nowych — „Guided mode”

Nowe konto startuje w trybie uproszczonym, sterowanym jednym flagiem na profilu:

- Widoczne tylko: Next up, Add student, Prepare next lesson.
- Trzy kroki w nagłówku: **1. Add a student → 2. Prepare a lesson → 3. Send homework**. Pasek znika po domknięciu trzeciego kroku i nie wraca.
- Po pierwszej wygenerowanej lekcji odsłaniają się Timeline i Library. Po pierwszym homework — Needs your attention.
- W dowolnym momencie „Show everything” wyłącza tryb na stałe.

To rozwiązuje wprost zgłoszenie nauczycieli: problemem nie jest liczba funkcji, tylko to, że wszystkie pojawiają się w minucie zerowej.

---

## 5. Warstwa wizualna

- **Jedna gęstość informacji na ekran.** Dziś dashboard miesza karty, tabele, badge'e, ikony i collapsible. Docelowo: karta = jednostka pracy, lista = archiwum, i nic pomiędzy.
- **Kolor tylko dla znaczenia.** Primary wyłącznie dla „Prepare next lesson”. Amber = wymaga uwagi. Reszta neutralna (tokeny `muted-foreground`, `border-border`). Koniec z zielonymi outline'ami przy nawigacji.
- **Typografia zamiast ramek.** Sekcje oddzielane nagłówkiem i odstępem, nie kolejnym `Card`. Zredukuje to postrzeganą złożoność bez usuwania treści.
- **Ikony zawsze z etykietą** na poziomie 1 i 2. Same ikony dopuszczalne wyłącznie w archiwum (Poziom 3).
- **Puste stany są treścią**, nie komunikatem błędu: każdy pusty blok mówi, co zrobić, żeby się wypełnił.

---

## 6. Jak wygląda sukces (mierzalnie)

| Metryka | Dziś (szacunek ze struktury) | Cel |
|---|---|---|
| Elementy interaktywne na pierwszym ekranie po zalogowaniu | ~40+ | poniżej 12 |
| Kliknięcia od logowania do wygenerowanej lekcji | 3–5 | 1–2 |
| Zakładki na stronie ucznia | 7 widocznych (11 w kodzie) | 3 + panel |
| Akcje primary na dashboardzie | ~5 | 1 |

Test Marthy dla tego kierunku: nauczyciel z 10-letnim stażem, który nigdy nie widział edooqoo, ma po zalogowaniu wiedzieć bez czytania czegokolwiek, co kliknąć, żeby przygotować jutrzejszą lekcję.

---

## 7. Kolejność późniejszego wdrażania (tylko orientacyjnie)

1. Poziom 1 — przebudowa dashboardu do „Today”, przeniesienie statystyk do profilu.
2. Guided mode dla nowych kont.
3. Poziom 2 — konsolidacja 7 zakładek do 3 + snapshot, DSLM jako osobny widok.
4. Przejście wizualne (kolor, typografia, puste stany) jako warstwa na wszystkim powyżej.

Szczegóły techniczne, mapowanie komponentów i migracja stanu — dopiero po akceptacji tego kierunku.

## Poza zakresem

Silnik generowania worksheetów, logika DSLM, backend, RLS, migracje, SEO, Student Hub (`/my`).
