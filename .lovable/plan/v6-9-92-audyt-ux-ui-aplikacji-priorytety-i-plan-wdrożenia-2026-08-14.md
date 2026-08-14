# v6.9.92 — Audyt UX/UI aplikacji: priorytety i plan wdrożenia

Audyt przeprowadzony na żywej aplikacji (tryb `/demo`, viewport 1280 i 390 px) plus analiza statyczna 493 plików `.tsx`. Problemy uszeregowane od najważniejszych, z uzasadnieniem i gotową decyzją implementacyjną. Silnik generowania worksheetów pozostaje nietknięty.

---

## P1. Poziome przewijanie na mobile w Dashboardzie (KRYTYCZNE)

**Dowód:** przy viewport 390 px `document.documentElement.scrollWidth = 402`. Winowajca: `src/components/dashboard/StudentCard.tsx:91` — `<div className="flex space-x-2">` z dwoma przyciskami („View Profile" + „Recent") o łącznej szerokości 240 px w wierszu, który zawiera już licznik worksheetów.

**Dlaczego ważne:** dashboard to ekran startowy nauczyciela. Poziomy scroll na telefonie to najsilniejszy sygnał „niedokończonej" aplikacji i psuje celność kliknięć.

**Rozwiązanie:** w `StudentCard.tsx` wiersz akcji: `flex items-center justify-between` → `flex flex-wrap items-center justify-between gap-2`; kontener przycisków → `flex flex-wrap gap-2 min-w-0`; przyciski → `px-2 sm:px-3`; `CardContent` → dodane `min-w-0`.

**Wpływ:** znika poziomy scroll; desktop bez zmian (przy >640 px nic się nie zawija).

---

## P2. Strona ucznia pokazuje gołe „Loading…" na całym ekranie

**Dowód:** `src/pages/StudentPage.tsx:352` — `return <div className="min-h-screen flex items-center justify-center">Loading...</div>;`. Zrzut `/student/demo-student-1` potwierdza pusty biały ekran z jednym słowem. Ten sam wzorzec: `Profile.tsx:528`, `FlashcardsLearning.tsx:102`, `AdminDashboardPage.tsx:218`.

**Dlaczego ważne:** StudentPage to serce 1-Minute Prep. Pusty ekran bez nawigacji wygląda jak awaria. Martha Test: nauczyciel nie wie, czy aplikacja żyje.

**Rozwiązanie:** nowy `src/components/ui/PageLoadingState.tsx` (skeleton nagłówka + 3 karty, oparty o shadcn `Skeleton`, `role="status"`, `aria-live="polite"`, tekst `sr-only` z propa `label`). Podmiana w 4 wymienionych miejscach.

**Wpływ:** krótszy postrzegany czas ładowania, brak przeskoku layoutu. Zero zmian w pobieraniu danych.

---

## P3. Przyciski ikonowe bez nazwy dostępnej + zbyt małe cele dotykowe

**Dowód:** 75 wystąpień `size="icon"` w 31 plikach; ~20 plików bez ani jednego `aria-label`. Najgorsze: `WorksheetDisplay.tsx` (11 przycisków, 0 etykiet), `student-progress/GoalCard.tsx` (8/0), `dslm/LearningTimeline.tsx` (6/0), `pages/Dashboard.tsx:386,421,428` (3/0). Na karcie worksheetu w dashboardzie widać rząd 6 nieopisanych ikon (edycja, przypisanie, audio, kopiuj, udostępnij, usuń). Cele `h-6 w-6`/`h-7 w-7` (66 wystąpień) są poniżej progu 44 px.

**Dlaczego ważne:** bariera dostępności (czytnik czyta „button") i realny problem UX — nauczyciel klika obok kosza.

**Rozwiązanie (zakres: 4 najważniejsze powierzchnie nauczyciela):**

1. Rząd ikon karty worksheetu w `Dashboard.tsx` — `aria-label` + shadcn `Tooltip` z tą samą treścią.
2. `WorksheetDisplay.tsx` — 11 przycisków: `aria-label` + tooltip.
3. `student-progress/GoalCard.tsx` i `dslm/LearningTimeline.tsx` — `aria-label` + tooltip.
4. Dotknięte przyciski: `min-h-11 min-w-11 sm:min-h-9 sm:min-w-9`.

Gotowe etykiety: „Rename worksheet", „Assign to student", „Play audio version", „Duplicate worksheet", „Share worksheet", „Delete worksheet", „Edit goal", „Delete goal", „Expand timeline entry".

**Wpływ:** ikony stają się samoopisujące, audyt a11y przestaje zgłaszać `button-name`, lepsza klikalność na telefonie.

---

## P4. Dwa równoległe systemy powiadomień

**Dowód:** `src/App.tsx:123-124` montuje jednocześnie `<Toaster />` (shadcn) i `<Sonner />` (sonner, domyślnie prawy dolny róg). 52 pliki używają `useToast()`, 20+ importuje `toast` z `sonner` (m.in. `Dashboard.tsx`, `StudentPage.tsx`, `Index.tsx`).

**Dlaczego ważne:** ten sam typ zdarzenia raz pojawia się u góry, raz u dołu, z inną typografią i czasem życia. Nauczyciel nie uczy się, gdzie patrzeć po akcji.

**Rozwiązanie (bez masowego refaktoru 241 wywołań):** `src/components/ui/sonner.tsx` → `position="top-right"`, `duration={4000}`, klasy dopasowane do shadcn (`bg-background text-foreground border-border`, błąd: `border-destructive/40`). `toaster.tsx` zostaje z tym samym czasem życia. Reguła „nowe komponenty używają `useToast()`" trafia do `docs/llm-context.md`.

**Wpływ:** jedna wizualna konwencja natychmiast, zero ryzyka zerwania istniejących wywołań.

---

## P5. Dashboard nie prowadzi do następnej akcji

**Dowód (zrzut `/demo`):** pasek statystyk powtarza dane widoczne niżej (Students: 3 vs. nagłówek „Students (3)"), brak modułu „co teraz", a pod listą ~700 px pustego tła.

**Dlaczego ważne:** obietnicą produktu jest prep w minutę, a ekran startowy oferuje wyłącznie listy i ogólny generator — wybór ucznia zostaje na nauczycielu.

**Rozwiązanie (tylko prezentacja, bez nowej logiki):** `src/components/dashboard/NextPrepStrip.tsx` nad dwiema kolumnami. Maks. 3 kafle uczniów posortowane po `updated_at` z już pobranej listy (żadnego nowego zapytania), każdy z przyciskiem „Start 1-Minute Prep" prowadzącym do `/student/:id`. Przy 0 uczniów kafel zamienia się w istniejące CTA „Add your first student".

**Wpływ:** ścieżka do kluczowej akcji z 3 kliknięć do 1, bez zmian w danych i uprawnieniach.

---

## P6. Twarde kolory zamiast tokenów w kluczowych widokach

**Dowód:** 99 plików używa `text-white`/`bg-white`/`text-black`, 60 kolejnych `text-gray-*`. Wprost w karcie ucznia: `StudentCard.tsx:96` — `border-green-500 text-green-600 hover:bg-green-50`.

**Dlaczego ważne:** dark mode nauczyciela rozjeżdża się na tych elementach, a zielony „View Profile" łamie hierarchię (wygląda na akcję potwierdzającą, nie nawigację).

**Rozwiązanie (zakres: 6 plików dashboardu i StudentPage, nie cała aplikacja):** „View Profile" → czyste `variant="outline"`; pozostałe twarde kolory w tych plikach → `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`.

**Wpływ:** spójna hierarchia i poprawny dark mode na dwóch najczęściej odwiedzanych ekranach.

---

## P7. Szum w konsoli i pliki-śmieci

**Dowód:** przy każdym renderze dashboardu leci `Warning: Invalid prop data-lov-id supplied to React.Fragment` z `StudentCard.tsx:123`. W repo leży `src/pages/WelcomeTestPage.tsx.bak`.

**Rozwiązanie:** `React.Fragment` → `<div key={...} className="contents">` (identyczny układ, brak ostrzeżenia); usunięcie pliku `.bak`.

**Wpływ:** czysta konsola ułatwia diagnozę realnych błędów.

---

## Kolejność wdrożenia

- w pierwszysm strincie zrób **Faza 1 (krytyczna, niskie ryzyko):** P1, P2, P7. 
- **Faza 2 (jakość interakcji):** P3, P4, P6.
- **Faza 3 (wartość produktowa):** P5.

## Weryfikacja

1. Playwright na `/demo` przy 390 px: `scrollWidth === innerWidth`.
2. Zrzut `/student/demo-student-1` pokazuje skeleton zamiast napisu „Loading…".
3. Liczba `size="icon"` bez `aria-label` w czterech objętych plikach = 0.
4. Zrzut dashboardu: toasty wyłącznie w prawym górnym rogu.
5. Konsola na `/demo`: brak ostrzeżenia o `React.Fragment`.
6. Typecheck bez błędów.

## RAG

Po każdej fazie: wpis w `docs/llm-context.md` (PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS) i aktualizacja indeksu w `public/llms.txt` bez zmiany struktury.

## Poza zakresem

Silnik generowania worksheetów, migracje bazy, RLS, logika DSLM, treści SEO, refaktor pozostałych plików z twardymi kolorami.