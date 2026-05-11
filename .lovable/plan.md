# Plan v6.9.6 — Dashboard symmetry, mobile Hero, DEMO lockdown, demo worksheets content

## Analiza problemu (krótko)

1. **Dashboard `CompactStatsBar`** — obecnie HubInfo + 6 kafli leży w jednej linii. Wizualnie nie jest "symetryczne" do gridu poniżej (lewa kolumna = Students, prawa = Recent Worksheets). Trzeba HubInfo nad lewą kolumną, a kafle statystyk nad prawą kolumną — w jednym wierszu, ale wyrównane do tych samych szerokości co poniżej.
2. **Theme mobile** — `useTheme()` honoruje `prefers-color-scheme: system`. Telefon użytkownika jest w trybie ciemnym → strona renderuje się w dark. W preview (Chrome desktop) jest light. Landing publiczny powinien być **wymuszony light** (do tej pory tak działało dla wielu marketingowych stron).
3. **Hero CTA mobile** — `h-14 px-8 text-lg` + długi tekst "Generate Your First Worksheet — Free" przekracza 100% szerokości viewportu na 360–390 px. Trzeba zmniejszyć tylko < `sm`.
4. **DEMO** — wiele ścieżek nie ma guard wcześniejszego niż dolna warstwa (modal otwiera się i fail dopiero przy submit; albo przekierowuje do settings; albo brakuje danych). Trzeba twardo gardować na poziomie handlerów (akcje), warstwę widoku zostawić podgląd-only.
5. **`/worksheets` (AllWorksheetsPage) w DEMO** — używa `useDeletedWorksheets` (bez guarda demo) → `if (!user) return;` zostaje wiecznie w `loading=true` (bo ustawia `setLoading(false)` tylko w `finally`, a wcześniej `return` przed try). Stąd biały spinner. Plus `useAuthFlow` w demo zwraca syntetycznego usera, więc nawigacja przechodzi, ale `useDeletedWorksheets` korzysta z `useAuthUser` (Supabase) — nie ma usera → wisi.
6. **Worksheety demo puste** — `ai_response` zawiera tylko 2–3 itemy bez pełnej struktury renderowanej przez `WorksheetDisplay`. Brakuje tytułów, instrukcji, większej liczby ćwiczeń. Przeniesiemy faktyczną treść z 10 produkcyjnych worksheetów wskazanych przez użytkownika (preview env).

---

## 1. Dashboard — symetryczny układ HubInfo / Stats

**Plik:** `src/components/dashboard/CompactStatsBar.tsx`

Zmiana: wewnątrz `CompactStatsBar` zamiast jednego flex‑rowa zwracamy **CSS grid 2-kolumnowy** o tych samych breakpointach co siatka pod spodem w `Dashboard.tsx` (`lg:grid-cols-2`).

Konkretnie:

- Mobile (<lg): zachowujemy obecny layout (HubInfo full + grid 3-kol).
- Desktop (≥lg):
  ```text
  <div class="hidden lg:grid grid-cols-2 gap-6 mb-4 items-stretch">
     [HubInfo — pełna szerokość lewej kolumny]
     [Pasek 6 statystyk — pełna szerokość prawej kolumny, z divide-x]
  </div>
  ```
- HubInfo (problem 1): **rozszerzony tekst**:
  > **Student Hub:** students log in with just their email at **edooqoo.com/my** — no login needed. They access their worksheets, homework, flashcards & lessons.

  Dla mobile pokazujemy skróconą wersję (jak teraz: `login at edooqoo.com/my`), a długą — tylko `lg+` (renderujemy oba spany z `hidden lg:inline` / `lg:hidden`).
- StatPills bez zmian (6 ikon).

Brak zmian w `Dashboard.tsx` (dalej renderuje `<CompactStatsBar … />` jako pierwsze dziecko gridu). Brak migracji DB.

---

## 2. Landing — wymuszony light theme + Hero CTA mobile

**Plik:** `src/pages/Index.tsx` (root landing) — dodanie efektu, który **na mount** ściąga klasę `dark` z `<html>` i przywraca przy unmount poprzedni stan (zachowując jednak `localStorage` użytkownika; teacherzy w aplikacji dalej mają dark mode po zalogowaniu).

```tsx
useEffect(() => {
  const html = document.documentElement;
  const wasDark = html.classList.contains('dark');
  html.classList.remove('dark');
  return () => { if (wasDark) html.classList.add('dark'); };
}, []);
```

Uzasadnienie: nie modyfikujemy `useTheme` (teacher dark mode chroniony zgodnie z core-rule). Wymuszamy light **tylko** na publicznej Index, gdzie `prefers-color-scheme: dark` z telefonu psuł kontrast. Pozostałe public pages (About, Pricing itd.) — ten sam prosty wrapper (do zrobienia w opcjonalnym kroku 2b: dodanie hooka `useForceLightTheme()` w `src/hooks/useForceLightTheme.ts` i wpięcie w 1 Indeks teraz, kolejne strony — w razie potrzeby).

**Hero CTA mobile** — `src/components/landing/HeroHeadline.tsx`:

```tsx
className="h-12 sm:h-14 px-4 sm:px-8 text-base sm:text-lg max-w-full whitespace-normal sm:whitespace-nowrap font-semibold rounded-full ..."
```
Plus skrócony tekst < `sm`:
```tsx
<span className="sm:hidden">Generate Free Worksheet</span>
<span className="hidden sm:inline">Generate Your First Worksheet — Free</span>
```

---

## 3. DEMO lockdown — szczegóły

Wszystkie miejsca poniżej korzystają z istniejącego `useDemoContext()` / `useDemoGuard()`. Brak zmian DB i edge functions. Brak zmian w core flow worksheet generation.

### 3A. Calendar — `+ Add` slot

**Plik:** `src/components/calendar/UnifiedSlotModal.tsx`

W `handleSubmit` na samym początku:
```ts
if (isDemoMode) {
  showDemoBlockedToast('Adding calendar slots');
  return;
}
```
+ wcześniej (dla wizualnego komfortu) gdy `isDemoMode`, w nagłówku modala dodać żółty pasek `<div className="rounded bg-amber-50 ...">Demo mode — changes won't be saved</div>` i ukryć błąd "Conflicts detected" gdy `isDemoMode`.

Alternatywa (preferowana, bardziej czysta): w `CalendarPage.tsx` w `handleAddSlot` (i pozostałych handlerach otwierających modal: edit/block) — guardować otwarcie modala:
```ts
if (isDemoMode) { showDemoBlockedToast('Adding lessons'); return; }
```
Dzięki temu modal nawet się nie otwiera. **Wybieramy ten wariant** (mniej ingerencji w UnifiedSlotModal, brak ryzyka popsucia produkcji).

Lista handlerów w `CalendarPage.tsx` do guardowania (na początku każdego):
- `handleAddSlot`
- `handleSlotClick` (edycja istniejącego slotu — dopuszczamy podgląd, ale guardujemy `onSave` w child modalu; w praktyce: dodać `readOnly` prop do modala, gdy `isDemoMode`)
- `handleBulkDelete`, `handleBulkBlock`, `handleBulkPaid`, `handleMarkPaid`, `handleNotificationClick` (jeśli mutuje)

W `useCalendarSlots` mutacje są już no-op w demo — to second line of defense, zostawiamy.

### 3B. Calendar — Share

**Plik:** `src/pages/CalendarPage.tsx`, funkcja `handleShare`:
```ts
const handleShare = () => {
  if (isDemoMode) { showDemoBlockedToast('Sharing public calendar'); return; }
  if (settings?.public_calendar_token) { /* ... */ }
  else { toast.info('Enable public calendar in settings first.'); }
};
```

### 3C. Calendar Settings — read-only render

**Plik:** `src/pages/CalendarSettingsPage.tsx`

Obecnie: `if (authLoading || loading || !settings) return null;` — w demo `loading` zostaje `false` (early return w hooku) i `settings === null` → strona pusta.

Plan:
1. W `useCalendarSettings.tsx` dodać blok demo (analogiczny do `useStudents`):
   ```ts
   if (isDemoMode) {
     setSettings(DEMO_CALENDAR_SETTINGS);
     setLoading(false);
     return;
   }
   ```
   `DEMO_CALENDAR_SETTINGS` (do dodania w `src/data/demoData.ts`): obiekt z pełnym kompletem rozsądnych defaults (`default_lesson_duration_minutes: 60`, `public_calendar_enabled: true`, `public_calendar_token: 'demo-public-token'`, `public_calendar_slug: 'martha-demo'`, `gcal_integration_enabled: false`, `payment_tracking_enabled: true`, `working_hours_*`, etc.).
2. W `updateSettings`/`generatePublicToken` — już są no-op w demo (linia 134). Dodać `showDemoBlockedToast` dla feedbacku.
3. W `CalendarSettingsPage.tsx` — gdy `isDemoMode`, na górze sekcji content wstawić sticky banner:
   ```tsx
   {isDemoMode && (
     <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
       👁 Demo view — settings are visible but cannot be modified.
     </div>
   )}
   ```
4. Każdy `<Switch onCheckedChange>`, `<Input onChange>`, `<Button onClick>` z mutacją otoczyć `disabled={isDemoMode}` (proste, masowe). Wyjątek: navigation/scroll (np. scrollToSection) bez `disabled`.

### 3D. `/worksheets` nie ładuje się

Root cause: `useDeletedWorksheets` używa `useAuthUser` zamiast respektować demo, a w `if (!user) return;` nie ustawia `loading=false`.

**Plik:** `src/hooks/useDeletedWorksheets.tsx`
- Dodać `const { isDemoMode, demoData } = useDemoContext();`
- Na górze `useEffect`: jeśli `isDemoMode` → `setDeletedWorksheets([]); setTotalCount(0); setLoading(false); return;` (w demo nie pokazujemy "deleted").
- W `fetchDeletedWorksheets`: `if (!user) { setLoading(false); return; }` (poprawka regression-safe).

To wystarczy, by `AllWorksheetsPage` przestało wisieć (bo `loading` już się rozwiąże dzięki `useWorksheetHistory` które jest demo-aware).

Dodatkowo w `AllWorksheetsPage.tsx` w warunku spinera:
```ts
if (authLoading || (loading && !isDemoMode)) { ... }
```
Pobranie `isDemoMode` z `useDemoContext`. Naprawia warunek edge.

### 3E. Worksheet actions: Transfer / Delete / Share / AddStudent

Najczystszy fix punktowy w UI (zachowuje cały istniejący kod akcji dla produkcji):

**Plik:** `src/pages/AllWorksheetsPage.tsx` oraz komponenty akcji per-worksheet (`DeleteWorksheetButton`, `DuplicateWorksheetButton`, `ShareWorksheetModal`, `StudentSelector` w wierszu).

Strategia: gardujemy w handlerach na poziomie wywołania (top-of-handler):
- `onDelete = (id) => guardAction('Deleting worksheets', () => deleteWorksheet(id))`
- `onTransfer = (id, sid) => guardAction('Transferring worksheets', () => updateStudent(...))`
- `onShare`, `onDuplicate`, `onAddStudent` — analogicznie.

Lista konkretnych miejsc do podpięcia `useDemoGuard` (jednolity wzorzec):
- `src/pages/AllWorksheetsPage.tsx` — `handleBulkDelete`, `handleDelete` (linia ~552), inline `await deleteWorksheet(id)` (~352).
- `src/components/DeleteWorksheetButton.tsx` — handler usunięcia.
- `src/components/DuplicateWorksheetButton.tsx` + `DuplicateWorksheetModal.tsx` — handler submit.
- `src/components/ShareWorksheetModal.tsx` — handler `generateShareLink`.
- `src/components/dashboard/AddStudentButton.tsx` + `AddStudentDialog.tsx` — handler create.
- Transfer-to-Student dropdown wewnątrz item kafla worksheetu (znaleźć w `AllWorksheetsPage.tsx` koło 540 — `StudentSelector` z onChange).

Dla każdego handlera: `if (isDemoMode) { showDemoBlockedToast('<Action name>'); return; }` zamiast aktualnego błędu UUID.

Toast copy (jednolite):
- "Deleting worksheets is disabled in demo mode. Sign up free to unlock."
- "Transferring worksheets is disabled in demo mode."
- "Sharing worksheets is disabled in demo mode."
- "Adding students is disabled in demo mode."

### 3F. Worksheet content (10 produkcyjnych)

**Krok wykonania (w fazie implementacji):**

1. Skrypt jednorazowy w `code--exec` użyje `psql` do `SELECT id, title, ai_response, html_content, form_data, generation_time_seconds FROM worksheets WHERE id IN (…10 UUID-ów…)` z preview env (env vars już są w sandbox dla głównego projektu; jeśli to inny projekt, użytkownik zostanie zapytany o dump w przeciwnym razie zaciągniemy publicznie po `share_token` jeśli istnieje — preferencja: bezpośredni dump z DB).
2. Wynik mapujemy 1:1 na 10 obecnych demo-worksheetów (po `id` `demo-ws-1..10`). Zachowujemy istniejące `id`, `student_id`, `created_at` (relative dates), `share_token`. Podmieniamy: `title`, `form_data`, `ai_response`, `html_content`, `generation_time_seconds`.
3. Dane lokalne hard-codujemy w `src/data/demoData.ts` (zwiększy rozmiar bundla o ~50–150 KB — akceptowalne, demo to onboarding).
4. Sanity check: `WorksheetPage` renderuje `worksheet.ai_response` przez `WorksheetDisplay` — zachowujemy ten sam JSON shape. `html_content` jest fallbackiem; produkcyjne wartości to gotowe HTML — bezpiecznie pasuje.
5. Mapowanie tematyczne — zachowujemy spójność poziomu studenta:
   - student-1 (B2 Business): worksheet IDs `4df96ff7…`, `13e92a57…`, `575dd5a8…`, `e95ee859…`, `ed6514ba…`
   - student-2 (A2): `87768bb0…`, `be7b86b6…`, `c12d2180…`
   - student-3 (C1): `2588083c…`, `f3a4667d…`

   (Dokładne przypisanie potwierdzimy podczas dump'u na podstawie poziomu w `form_data`).

### 3G. WorksheetPage `/student/demo-student-1` loading screenshot

Problem: route `/student/:id` (StudentPage) — sprawdzić czy jest demo-aware. Plan: dodać do `StudentPage.tsx` demo branch który ładuje studenta z `demoData.students.find(s => s.id === id)` zamiast czekać na Supabase. Jednolinijkowy fix: w hooku `useStudent.tsx` dodać branch demo (analogicznie do `useStudents`).

---

## 4. Dokumentacja RAG (obowiązkowo)

Edycje w `docs/llm-context.md` i `llms.txt` w jednym push'u, format `Problem → Solution → Mechanics → RAG Keywords`:

### Sekcja: "Demo Mode — Hard Lockdown (v6.9.6)"

- **Problem:** Akcje mutujące w demo wywoływały błędy UUID/PG zamiast czytelnego komunikatu. `/worksheets` wisiało (useDeletedWorksheets bez guard demo). `/calendar/settings` było puste. Share przekierowywał do settings.
- **Solution:** Każdy handler mutujący po stronie UI gardowany przez `useDemoGuard().guardAction(label, fn)`. Hooki Supabase wcześnie zwracają w `isDemoMode`. `useCalendarSettings` w demo dostarcza `DEMO_CALENDAR_SETTINGS`. Modale (Add slot/Share) blokowane na poziomie otwarcia.
- **Mechanics:** Pliki: `useDemoGuard`, `DemoContext`, `useDeletedWorksheets`, `useCalendarSettings`, `useStudent`, `CalendarPage.handleShare/handleAddSlot`, `CalendarSettingsPage` (banner + `disabled`), wszystkie komponenty akcji per-worksheet.
- **RAG Keywords:** demo mode, lockdown, read-only, demo guard, mutation block, demo settings, demo calendar, fake user, sandbox preview, edooqoo demo.

### Sekcja: "Dashboard Symmetry & Hub Info"

- **Problem:** HubInfo i kafle statystyk nie wyrównane z gridem Students/Recent Worksheets.
- **Solution:** `CompactStatsBar` używa `lg:grid-cols-2` zgodnie z gridem poniżej. Pełny opis Student Hub na desktop, skrócony na mobile.
- **Mechanics:** `CompactStatsBar.tsx` — dwa warianty: mobile (stack) i desktop (2-col grid).
- **RAG Keywords:** dashboard layout, student hub banner, stats bar, compact stats, two column grid, edooqoo.com/my.

### Sekcja: "Forced Light Theme on Public Landing"

- **Problem:** Mobile w trybie ciemnym renderował landing w dark.
- **Solution:** `Index.tsx` na mount usuwa klasę `dark`, na unmount przywraca.
- **Mechanics:** `useEffect` w `src/pages/Index.tsx`. Brak zmian w `useTheme` (chronione dark mode dla nauczycieli pozostaje).
- **RAG Keywords:** prefers-color-scheme, dark mode mobile, landing page light, public theme override.

### Sekcja: "Hero CTA Mobile Sizing"

- **Problem:** "Generate Your First Worksheet — Free" wychodził poza viewport.
- **Solution:** Dwa warianty tekstu (`sm:hidden` vs `hidden sm:inline`), przycisk `h-12 sm:h-14`, `px-4 sm:px-8`.
- **Mechanics:** `HeroHeadline.tsx`.
- **RAG Keywords:** hero CTA mobile, button overflow, responsive hero, landing CTA size.

### Sekcja: "Demo Worksheets — Production Content"

- **Problem:** Demo worksheety renderowały puste UI (skrócony stub `ai_response`).
- **Solution:** 10 worksheetów demo zasilonych pełną treścią z 10 produkcyjnych UUID-ów (preview env).
- **Mechanics:** `src/data/demoData.ts` — pola `title/form_data/ai_response/html_content/generation_time_seconds` podmienione, struktura JSON zachowana (kompatybilność z `WorksheetDisplay`).
- **RAG Keywords:** demo data, fake worksheets, sample content, preview env import, demoData seed.

---

## 5. Pamięć projektu (mem://)

Aktualizacja:
- `mem/features/dashboard/compact-stats-bar.md` → wzmianka o dwukolumnowym wyrównaniu z gridem poniżej.
- Nowy: `mem/features/public-demo-mode-lockdown.md` — lista wszystkich punktów guard, wzór `useDemoGuard`, oraz reguła "każdy nowy handler mutujący MUST przejść przez guardAction lub wcześnie return na isDemoMode".
- `mem://index.md` — dodać linka do nowego pliku.

---

## 6. Kolejność wdrożenia (atomowa)

1. CompactStatsBar layout + tekst HubInfo.
2. Index.tsx force-light.
3. HeroHeadline mobile button.
4. useDeletedWorksheets demo branch + AllWorksheetsPage warunek loading.
5. useCalendarSettings demo branch + DEMO_CALENDAR_SETTINGS w demoData.ts.
6. CalendarSettingsPage banner + `disabled` na inputach.
7. CalendarPage handleAddSlot/handleShare/handleBulk* guards.
8. useStudent demo branch (StudentPage loading fix).
9. Guardy w komponentach akcji worksheetów (Delete/Duplicate/Share/AddStudent/Transfer).
10. Dump 10 produkcyjnych worksheetów → podmiana w demoData.ts.
11. Update `docs/llm-context.md`, `llms.txt`, mem.

---

## 7. Bezpieczeństwo / brak regresji

- Wszystkie nowe ścieżki wzdłuż istniejącego wzorca `isDemoMode` (już używane w 30+ miejscach).
- Brak zmian DB, RLS, edge functions.
- Brak zmian w `Worksheet Generation Engine` (sanctity rule).
- Light theme override izolowany w `Index.tsx` — nie dotyka teacher app.
- Konsolidacja w `useDemoGuard` zapewnia, że produkcyjna ścieżka pozostaje 1:1.
