
# Plan v6.9.5 — Kompaktowy Dashboard Stats Bar + Audyt SEO

## Część 1 — Audyt SEO (raport, bez zmian w kodzie)

Przeprowadziłem weryfikację techniczną Twojego wdrożenia. **Status: SUKCES.**

### Co zweryfikowałem:

1. **Folder `public/` w repo** — obecne są wszystkie 17 prerenderowanych snapshotów:
   - `public/about/index.html`, `public/how-it-works/`, `public/pricing/`, `public/cookie-policy/`, `public/privacy-policy/`, `public/glossary/`, `public/exercise-types/`, `public/resources/`, `public/blog/`, `public/prompts/`
   - `public/features/` → `placement-test/`, `homework/`, `calendar/`, `live-sessions/`, `flashcards/`, `student-hub/`, `dslm/`

2. **Tagi canonical w snapshotach** — każdy plik ma poprawny self-canonical:
   - `public/about/index.html` → `<link rel="canonical" href="https://edooqoo.com/about">` ✅
   - `public/features/placement-test/index.html` → `https://edooqoo.com/features/placement-test` ✅

3. **Produkcja (`curl https://edooqoo.com/about`)** — Lovable hosting **serwuje statyczne pliki z pierwszeństwem** nad SPA fallback. Googlebot dostaje pełny HTML z właściwym canonical, NIE pustą powłokę React.

4. **Strona główna `/`** — nadal serwuje SPA `index.html` (canonical = `https://edooqoo.com/`). To jest **poprawne** — `/` to faktyczny SPA root.

### Wnioski dla GSC:
- Walidacja "Strona wykryta — obecnie niezindeksowana" powinna **przejść** w 7-21 dni (Google musi ponownie scrawlować i renderować).
- Błędy "tag kanoniczny" zostały **fundamentalnie usunięte** — fizycznie nie ma już duplikatów wskazujących na `/`.
- **Brak akcji do podjęcia.** Czekaj na rezultat walidacji w GSC.

### Drobna obserwacja (nie blokująca):
W snapshotach `og:url` zawsze wskazuje `https://edooqoo.com` zamiast pełnego URL strony. To kosmetyczne — Google używa `canonical`, nie `og:url`. Można poprawić w przyszłej iteracji skryptu prerender (osobny ticket).

---

## Część 2 — Ultra-kompaktowy pasek statystyk na `/dashboard`

### Problem

Obecny układ na `/dashboard`:
- Kafelki statystyk (Tokens / This month / All time / Students) zajmują grid 2×4 i osobną sekcję.
- Pasek "Student Hub: students log in..." jest osobnym wierszem **poniżej**, co marnuje vertical space.
- Możemy dodać więcej wartościowych statystyk (homework, lessons), które już mamy w bazie.

### Rozwiązanie

**Jeden wiersz** poziomy zawierający:
- **Lewa strona (priorytet, większa waga wizualna):** Pasek `Student Hub → edooqoo.com/my` z ikoną i pełnym CTA.
- **Prawa strona:** **6 mikro-kafelków** w jednej linii (na desktop), zwijających się w gridy na tabletach/mobile.

### Layout (desktop ≥1024px)

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 📖 Student Hub: edooqoo.com/my   │ 🪙346 │ 📄0 │ 🎯181 │ 👥14 │ 📋12 │ 📅3   │
│         (left, prominent)         │tokens │month│ total │stud.│homew.│lesson │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- Wysokość paska: ~52px (vs obecne ~180px = oszczędność ~130px scroll).
- Hub Info: większa typografia (`text-sm`, kolor primary), klikalny link.
- Mikro-kafelki: tylko ikona + liczba + label (jeden wiersz każdy), bez kart-pudełek — separator pionowy `divide-x`.

### Layout (tablet 768-1023px)
- Hub Info pełna szerokość (góra).
- Mikro-kafelki: grid 3×2 pod spodem (kompaktowe).

### Layout (mobile <768px)
- Hub Info: pełna szerokość, zwięzła wersja ("Hub: edooqoo.com/my").
- Mikro-kafelki: grid 2×3 pod spodem.

### Nowe statystyki (dodatkowe 2 kafelki)

Wykorzystamy istniejące hooki — **bez nowych zapytań do DB tam, gdzie się da**:

| Kafelek | Wartość | Źródło danych | Ikona |
|---|---|---|---|
| Tokens left | `tokenLeft` | `useTokenSystem` (już używane) | `Coins` |
| This month | `thisMonthCount` | `useWorksheetStats` (już używane) | `FileText` |
| All time | `totalWorksheetsCreated` | `profile` (już używane) | `Target` |
| Students | `students.length` | `useStudents` (już używane) | `Users` |
| **Active homework** ✨NEW | count(homework gdzie `completed_at IS NULL`) | agregacja z `homeworkByWorksheet` (już pobrane!) | `ClipboardList` |
| **Upcoming lessons** ✨NEW | count(slotów w nadchodzących 7 dniach, status `confirmed`/`pending`) | nowy lekki hook `useUpcomingLessonsCount` | `Calendar` |

### Implementacja techniczna

**Nowe pliki:**

1. `src/hooks/useUpcomingLessonsCount.tsx` — minimalny hook:
   ```ts
   // SELECT id FROM calendar_slots 
   // WHERE teacher_id = user.id 
   //   AND slot_date >= today 
   //   AND slot_date <= today + 7 days
   //   AND status IN ('confirmed','pending')
   ```
   Cache w komponencie (single fetch on mount). Brak realtime.

2. `src/components/dashboard/CompactStatsBar.tsx` — nowy komponent:
   - Props: `{ tokenLeft, thisMonthCount, totalWorksheets, studentsCount, activeHomeworkCount, upcomingLessonsCount }`.
   - Tailwind: `flex items-center gap-2` na desktop, `flex-col gap-3` na mobile (via `useIsMobile`).
   - Hub Info: ~40% szerokości, lekkie tło `bg-primary/5`, border `border-primary/20`.
   - Każdy mikro-kafelek: `flex items-center gap-1.5 px-3` z `divide-x divide-border`.
   - Tooltip na każdym kafelku (full label).

**Zmiana w `src/pages/Dashboard.tsx`:**
- Usunięcie obecnego bloku `Compact Stats Strip` (linie 187-209) i `Student Hub Info` (linie 211-218).
- Wstawienie `<CompactStatsBar {...props} />` w jednej linii.
- Wyliczenie `activeHomeworkCount`:
  ```ts
  const activeHomeworkCount = Object.values(homeworkByWorksheet)
    .flat()
    .filter(h => !h.completed_at).length;
  ```

**Brak zmian w:**
- Innych komponentach dashboardu (Students card, Recent Worksheets card pozostają identyczne).
- StickyNav, AuthenticatedPageShell, hookach DB poza nowym `useUpcomingLessonsCount`.
- RLS / migracjach (tylko SELECT z istniejącej tabeli `calendar_slots`).

### Bezpieczeństwo i regresje
- **Zero zmian DB** — tylko nowe SELECT.
- **Zero zmian w worksheet engine** (Sanctity Rule respected).
- Hook `useUpcomingLessonsCount` zwraca `0` przy błędzie (graceful degradation), nie blokuje renderu dashboardu.
- Wszystkie etykiety po angielsku (UI rule).

### Alternatywy rozważone (odrzucone)
- **A) Dropdown "More stats"** — więcej kliknięć, gorszy UX dla power-userów (Martha).
- **B) Sticky pasek u góry** — koliduje z istniejącym `StickyNav`, podwójna fiksacja.
- **C) Wykres zamiast liczb** — nadmiarowe wizualnie, dane są niskoliczbowe (single integers).

Wybrane: **inline mikro-kafelki + Hub-info po lewej** = max gęstość informacji, min wysokość.

---

## Część 3 — Aktualizacja dokumentacji RAG

Zmiany w plikach:
- `docs/llm-context.md` — sekcja `## Dashboard Stats Bar` z formatem Problem → Solution → Mechanics + RAG Keywords (dashboard, stats, kafelki, KPI, homework count, upcoming lessons).
- `llms.txt` — krótki wpis w sekcji features.
- `mem/features/dashboard/compact-stats-bar.md` — nowa pamięć projektu z opisem komponentu i źródeł danych.

Wpis do indeksu pamięci (`mem://index.md`) — dodany jeden nowy wiersz w sekcji Memories.

---

## Pliki do utworzenia / edycji

**Nowe:**
- `src/hooks/useUpcomingLessonsCount.tsx`
- `src/components/dashboard/CompactStatsBar.tsx`
- `mem/features/dashboard/compact-stats-bar.md`

**Edytowane:**
- `src/pages/Dashboard.tsx` (usunięcie 2 bloków, wstawienie 1 komponentu, wyliczenie activeHomeworkCount)
- `docs/llm-context.md`
- `llms.txt`
- `mem/index.md`

## Decyzje pozostawione użytkownikowi
**Żadne** — wszystkie wybory zapadły w planie (6 kafelków, kolejność, źródła, layout responsywny, brak realtime).
