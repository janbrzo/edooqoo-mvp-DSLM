
# Plan v6.9.14 — Naprawy DSLM Pathway, Nav, Worksheet Form

Wszystkie zmiany są **chirurgiczne** — żadna nie przebudowuje istniejących mechanizmów. Sankcyjny prompt do generowania worksheetów (`format-worksheet-prompt`) **nie jest dotykany**. Zmieniamy wyłącznie prompt do `generate-curriculum-phases` (curriculum), co jest w pełni dozwolone (potwierdzone przez Ciebie).

---

## Problem 1 — AI generuje 5×4=20 tyg. zamiast wpasować się w deadline 90 dni

### Root cause (potwierdzone w bazie)
Funkcja `generate-curriculum-phases` liczy `weeksUntilDeadline` **tylko** z `students.main_goal_target_date`. Charlotte ma `main_goal_target_date = NULL`, ale ma cel w `student_progress_goals.target_date = 2026-08-07` (≈13 tyg.). Skutek: `weeksUntilDeadline=null` → `remainingBudget=null` → safety net `fitPhasesToDeadline` jest no-opem → AI dostaje "no deadline" i generuje swobodne 5×4=20 tyg. Stąd zapis `deadline_fit_adjusted:false, target_total_weeks:nil` w `generation_context`.

### Rozwiązanie

**A. Edge function `generate-curriculum-phases` — fallback na cele**

Po obliczeniu `weeksUntilDeadline` z `main_goal_target_date`, jeśli wynik to `null`, wybierz **najwcześniejszy** `target_date` spośród niezakończonych (`is_achieved=false`, `archived_at IS NULL`) celów ucznia jako fallback.

```ts
// po istniejącym bloku liczącym weeksUntilDeadline z main_goal_target_date:
if (weeksUntilDeadline === null) {
  const goalDates = goals
    .filter((g: any) => g.target_date && !g.is_achieved)
    .map((g: any) => new Date(g.target_date).getTime())
    .filter((t: number) => Number.isFinite(t) && t > Date.now());
  if (goalDates.length > 0) {
    const earliest = Math.min(...goalDates);
    const days = Math.max(0, Math.round((earliest - Date.now()) / 86400000));
    weeksUntilDeadline = Math.max(1, Math.round(days / 7));
  }
}
```

**B. Domyślny `phaseCount` adaptuje się do krótkiego deadline'u**

Obecny wzór `min(5, max(3, round(weeksUntilDeadline/4)))` dla 13 tyg. → 3 fazy (OK), ale safety net już rebase'uje. Zostawiamy bez zmian (działa po fallbacku z punktu A).

**C. Wzmocniony prompt — eksplicytny przykład rozkładu**

W bloku `HARD CONSTRAINT — DEADLINE FIT` dopisujemy konkretny przykład:

```
EXAMPLE for budget=13 weeks, phaseCount=4:
  Phase 1: weeks 1-3 (3w)
  Phase 2: weeks 4-6 (3w)
  Phase 3: weeks 7-9 (3w)
  Phase 4: weeks 10-13 (4w)
SUM=13 ✓ (not 16, not 20)
```

**D. Telemetry — tag `deadline_source`** w `generation_context`:
- `'student.main_goal_target_date'` | `'goal.target_date'` | `'fallback_no_deadline'`

Pozwoli w przyszłości audytować skąd przyszedł budżet.

**E. Zachowanie wstecz-kompatybilne**: gdy nadal brak jakiejkolwiek daty → identyczne zachowanie jak teraz (5 faz × 4 tyg.). Nic się nie psuje.

---

## Problem 2 — `Failed to generate next steps` (500 z `generate-timeline`)

### Root cause
Funkcja `generate-timeline` istnieje **tylko jako zdeployowana w Supabase**; nie ma jej w `supabase/functions/` w repo (nie możemy edytować jej bezpośrednio). Ręczny test (curl) z poprawnymi `studentId+teacherId` zwraca **200 OK** z poprawnym JSON-em. Oznacza to, że 500 jest scenariuszowy — najprawdopodobniej powstaje, gdy `excludeIds` zawiera UUID-y istniejących sugestii albo `phaseId` wskazuje na fazę.

### Rozwiązanie

**A. Frontend — defensywna kompresja payloadu** (`useFutureTimeline.tsx`, linie 119–135):

1. **Limituj `excludeIds`** do max. 25 najnowszych (UUID array zbyt duży powoduje też przekraczanie tokenów AI-Gateway).
   ```ts
   const excludeIds = (opts.excludeIds ?? []).slice(0, 25);
   ```
2. **Walidacja przed wysyłką**: jeśli `studentId`/`teacherId` puste → wczesny return + toast (chroni przed 404).

**B. Frontend — czytelniejszy fallback komunikatów**

W catchu `generateNextSteps`, dodaj rozróżnienie 500 ≠ błąd kredytów:

```ts
if (status === 500) {
  toast.error(
    'Generator timeline returned an error. Try without phase target, or reduce existing steps and retry.',
    { duration: 7000 }
  );
}
```

**C. Logowanie payloadu w konsoli**

Przed `supabase.functions.invoke('generate-timeline', …)` dodaj `logger.debug('[generate-timeline] payload', body)` żebyśmy w następnej iteracji mogli dokładnie zobaczyć co poleciało.

**D. Twardy retry przy `phaseId`**

Jeśli pierwsze wywołanie z `phaseId` zwróci błąd, spróbuj ponownie z `phaseId=null` (free step) — degradacja zamiast fail. Komunikat: "Phase-bound generation failed; created a free step instead."

> Uwaga: nie możemy edytować deployowanej `generate-timeline` (nie ma jej w repo). Jeśli mimo defensywnych zmian błąd pozostanie, w kolejnym kroku trzeba zrekonstruować jej źródło z bieżącej deploymentu (osobny task — poza tym planem).

---

## Problem 3 — Brak ikony "Remove" przy Next Step #1 + brak potwierdzenia

### Root cause
`NextStepBanner` nie ma żadnego `onDelete` — można tylko `Mark used`/`Edit`/`Regenerate`. `CompactSuggestionCard` (kroki #2..N) ma delete.

### Rozwiązanie

**A. Dodaj `onDelete` do `NextStepBanner`**

Plik: `src/components/dslm/NextStepBanner.tsx`
- Dodaj prop `onDelete: (id: string) => void`.
- W toolbarze (obok `onMarkUsed`) dodaj przycisk `Trash2` z wariantem `ghost` na białym overlayu (banner ma kolorowe tło).

**B. Modal potwierdzenia — wpisanie nazwy**

Stwórz `src/components/dslm/ConfirmTypeToDeleteDialog.tsx` (reużywalny):
- Props: `open, onOpenChange, label /* "Next Step #1" lub "Phase 1: …" */, expectedText /* "Phase 1" lub "Next Step #1" */, onConfirm`.
- Tekst wymaga **dokładnego dopasowania** (case-sensitive); przycisk `Delete` disabled dopóki input ≠ expectedText.
- Reużycie z `NextStepBanner` **i** z `CompactSuggestionCard` (też dla phase'ów — patrz dalej).

**C. Faza w `MacroTimeline` — dodaj ten sam confirm**

Aktualny `deletePhase` z `useCurriculumPhases` wykonuje hard delete bez potwierdzenia. Owinąć w `ConfirmTypeToDeleteDialog` z `expectedText = "Phase {sequence}"`.

---

## Problem 4 — `GenerateStepsDialog` ma stare dane po zamknięciu/otwarciu

### Root causes (3 podproblemy)

**4a. Po pierwszym wygenerowaniu faz, klik "Generate next steps" zanim hook `useCurriculumPhases` zrefetchuje fazy** → `phaseOptions=[]` → modal nie wie o fazach → `defaultTargetPhaseId=null` → `count=3` (default).

**4b. Reopen modalu nie auto-resetuje `count` do `(need - have)`**: `useEffect` (linia 68) ma deps `[phaseValue, selectedPhase, ...]` — gdy `phaseValue` po reopen jest taka sama, efekt się nie odpala mimo, że `countTouched` resetuje się.

**4c. SelectItem "🎯 Recommended:" pokazuje sam tytuł frazy — bez "Phase 1:" + ucięty po prawej** w `SelectTrigger` z powodu `w-[23%]` szerokości.

### Rozwiązanie

**A. (4a)** W `useFutureTimeline.tsx` po `generatePhases` w `useCurriculumPhases.tsx` już jest `await fetchPhases()`. Problem: `PathwayView` używa `useCurriculumPhases` osobno od `MacroTimeline`. Dwie instancje hooka = dwa stany. Po wygenerowaniu w `MacroTimeline`, instancja w `PathwayView` nie wie.

**Fix**: emit globalny event `dslm:phasesUpdated` z `useCurriculumPhases.generatePhases` po `fetchPhases`; subskrybuj w drugiej instancji hooka i wywołaj `fetchPhases`. Minimalna inwazja:
```ts
// useCurriculumPhases.tsx — po fetchPhases() w generatePhases:
window.dispatchEvent(new CustomEvent('dslm:phasesUpdated', { detail: { studentId } }));

// useEffect w hooku:
useEffect(() => {
  const h = (e: Event) => {
    if ((e as CustomEvent).detail?.studentId === studentId) fetchPhases();
  };
  window.addEventListener('dslm:phasesUpdated', h);
  return () => window.removeEventListener('dslm:phasesUpdated', h);
}, [studentId, fetchPhases]);
```

**B. (4b)** W `GenerateStepsDialog.tsx` przeniesione ustawienie `count` z `useEffect[phaseValue,...]` do **bloku resetu na open**:

```ts
useEffect(() => {
  if (!open) return;
  const initialPhaseId = defaultTargetPhaseId ?? FREE_VALUE;
  setPhaseValue(initialPhaseId);
  setCountTouched(false);
  // Compute initial count based on recommended phase
  const recPhase = phaseOptions.find(p => p.id === defaultTargetPhaseId);
  const initialCount = recPhase
    ? Math.min(6, Math.max(1, recPhase.need - recPhase.have))
    : defaultCount;
  setCount(initialCount);
}, [open, defaultCount, defaultTargetPhaseId, phaseOptions]);
```
Dotychczasowy efekt auto-preset na zmianę `phaseValue` zostawiamy jak jest (działa przy ręcznej zmianie).

**C. (4c)**

W `GenerateStepsDialog.tsx`:
- Etykieta Recommended: zawsze prefiksuj `Phase {sequence}`:
  ```ts
  const recPhase = phaseOptions.find(p => p.id === recommendedId);
  const phaseRecommendedLabel = recPhase
    ? `Phase ${recPhase.sequence}: ${recPhase.label}`
    : 'Free step';
  ```
- Tekst itema: `🎯 Recommended — {phaseRecommendedLabel}` zamiast `🎯 Recommended: {phaseRecommendedLabel}` (czytelniejsze).

**Wcięcie po lewej w trigger**: shadcn `SelectItem` ma `pl-8` na slot ikony check. Trigger renderuje `SelectValue` który nie dziedziczy `pl-8`, ale **zawartość SelectItem-a** (cały JSX) jest renderowana. Naprawa: użyj `<SelectValue placeholder="…" />` z explicit override w komponencie:
- W `SelectItem` Recommended owiń label w `<span className="block text-left">…</span>`.
- W `SelectTrigger` dodaj `min-w-0` i klasę pozwalającą na truncate: `<SelectValue className="truncate text-left" />`.
- Zwiększ szerokość trigger w PathwayView modalu z domyślnej do `min-w-[280px]` (modal ma `DialogContent` ~`max-w-lg` = 512px — jest miejsce).

---

## Problem 4-bis — Sub-sekcje w `DSLMTab` widoczne tylko dla aktywnej sekcji

### Rozwiązanie

W `src/components/dslm/DSLMTab.tsx` linia 337:

```tsx
{activeSection === view.id && subs.length > 0 && (
```

zmień na **bezwarunkowe renderowanie**, ale **wizualnie wyróżnij** aktywną grupę:

```tsx
{subs.length > 0 && (
  <div className={cn(
    "ml-6 mt-1 mb-1 space-y-0.5 border-l pl-2",
    activeSection === view.id ? "border-primary" : "border-border opacity-70"
  )}>
    {subs.map(s => ( /* … bez zmian … */ ))}
  </div>
)}
```

Tylko dla desktopa (mobile nie ma sidebar — bez zmian).

---

## Problem 5 — `NavStudentSwitcher`: poziom pod nazwą + pokazuje się też na `/student/:id`

### Rozwiązanie

**A. Hide na stronie studenta**
`src/components/landing/StickyNav.tsx`, linia 40:
```ts
const isStudentPage = /^\/student\//.test(location.pathname);
const showStudentSwitcher = isRegisteredUser && !isDashboard && !isProfile && !isStudentPage;
```

**B. Inline level + nazwa**
`src/components/landing/NavStudentSwitcher.tsx`, sekcja `<a>`:
```tsx
<a … className="flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted">
  <span className="font-medium truncate">{s.name}</span>
  <Badge variant="outline" className="text-[10px] shrink-0">{s.english_level}</Badge>
</a>
```
(Usuwamy `<div className="text-[11px] …">` z drugą linią).

---

## Problem 6 — Duplikat przycisku "Calendar" na środku nav

### Rozwiązanie

**A. Usuń duplikat z `StickyNav.tsx`** (linie 91–98 mobile + 159–166 desktop — dwa bloki `{!isCalendar && (<Button asChild ...)}`).

**B. Dodaj middle-click → new tab do istniejącego `GCalStatusButton`**

Plik: `src/components/calendar/GCalStatusButton.tsx`

Zamień `<Button onClick={() => navigate('/calendar')}>` na **anchor wrapper z modyfikatorami**, identyczny pattern jak `handleAnchorNav`:
```tsx
const handleClick = (e: React.MouseEvent) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // browser handles new tab
  e.preventDefault();
  navigate('/calendar');
};
return (
  <Button asChild variant="outline" size="sm" className="text-xs h-8 relative">
    <a href="/calendar" onClick={handleClick} onAuxClick={handleClick}>
      🗓️ Calendar
      {unreadCount > 0 && (<Badge … />)}
    </a>
  </Button>
);
```

Zachowuje: badge unreadCount, styl, tooltip dla anonimowych.

**Mobile**: `GCalStatusButton` jest tylko w Sheet menu — wystarczy. Brak duplikatu na top barze (po usunięciu).

---

## Problem 7 — Generate Worksheet z `/student` nie auto-wybiera studenta + label "Generic worksheet" ucięty

### Root cause #1 (auto-select)
W `StickyNav.tsx` (linie 173–180), gdy nie-dashboard, przycisk "Generate Worksheet" jest `<Button asChild><a href="/" onClick={handleAnchorNav('/')}/>`. **`handleAnchorNav` nawiguje do `/` ignorując callback `onGenerateWorksheet`** — a to właśnie ten callback (z `StudentPage.handleGenerateWorksheet`) ustawia `sessionStorage.preSelectedStudent`. Skutek: nawigacja do `/`, ale sessionStorage puste → form bez auto-selectu.

### Rozwiązanie #1

W `StickyNav.tsx` linie 173–180 (i analogicznie mobile 105–112):
```tsx
{onGenerateWorksheet && !isDashboard && (
  <Button asChild size="sm">
    <a
      href="/"
      onClick={(e) => {
        // Modyfikatory → otwórz w nowej karcie (bez callbacku — sessionStorage by nie zadziałało między tabami)
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        onGenerateWorksheet(); // ← wywołaj callback który ustawia sessionStorage + nawiguje
      }}
      onAuxClick={(e) => {
        if (e.button === 1) return; // browser handles
      }}
    >
      <Plus className="h-4 w-4 mr-2" /> Generate Worksheet
    </a>
  </Button>
)}
```

Skutek: zwykły click → callback (z preSelectedStudent), modyfikator → nowa karta bez preselekcji (intencja użytkownika to nowa karta — preselekcja przez sessionStorage między tabami nie zadziałałaby tak czy inaczej).

### Root cause #2 (label ucięty)
SelectTrigger ma `w-full` w kontenerze `w-[23%]` (~285px). Tekst "Generic worksheet (no student)" + chevron + padding nie mieszczą się.

### Rozwiązanie #2

W `src/components/WorksheetForm/index.tsx`:
- Linia 666: zmień label na **krótszy**: `<SelectItem value="no-student">No student (generic)</SelectItem>`
- Doda `truncate` w `SelectValue` jak w 4c.

Krótsza fraza + truncate = tekst widoczny w pełni przy 23% szerokości.

---

## Problem 8 — "Add students first" ma być spójny z "No student (generic)" + klikalny → modal Add Student

### Root cause
Linie 678–696 w `WorksheetForm/index.tsx`: gdy nauczyciel ma 0 studentów, renderuje się statyczny `Lock` div z tooltipem. Brak akcji.

### Rozwiązanie

**A. Sprawdź dostępny modal Add Student**

`src/components/StudentEditDialog.tsx` istnieje. Otwiera się przez prop `open`. Można go reużyć dla create-mode (jeśli wspiera `student=null`/`isNew`).

> Decyzja do potwierdzenia w trakcie implementacji: jeśli `StudentEditDialog` nie wspiera trybu "create", użyć `Dashboard`'owego flow przez `navigate('/dashboard?action=add-student')` (Dashboard już parsuje `?action=add-student` zgodnie z mem `welcome-email-cta-add-student`). To pewniejsze i mniej inwazyjne — **wybieramy ten wariant** w planie.

**B. Render gdy `userId && students.length === 0`**:

Zamiast `Lock` divu:
```tsx
<div className={`${isMobile ? 'w-full' : 'w-[23%]'} flex flex-col justify-center`}>
  <button
    type="button"
    onClick={() => navigate('/dashboard?action=add-student')}
    className="w-full h-full flex items-center gap-2 px-3 py-2 border-2 border-amber-400 ring-1 ring-amber-300 bg-amber-50/40 dark:bg-amber-900/10 rounded-md text-left hover:bg-amber-50 transition-colors"
  >
    <Plus className="h-4 w-4 text-amber-700 shrink-0" />
    <span className="text-sm text-amber-900 dark:text-amber-300 truncate">Add your first student</span>
  </button>
  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 leading-tight">
    Click to add a student and unlock personalized worksheets.
  </p>
</div>
```

Anonimowy (`!userId`) — bez zmian (Lock + tooltip).

---

## Dokumentacja (RAG injection)

### `docs/llm-context.md` + `llms.txt` — nowy rozdział `## v6.9.14 — Pathway/Nav Fixes`

Format Problem → Edooqoo Solution → Technical Mechanics dla każdego z 8 punktów. Dodaj `RAG Keywords:` na końcu każdego z synonimami: "deadline cap", "phase budget", "next steps modal", "student switcher", "calendar nav button", "preselected student", "add student CTA", "delete next step confirmation", "type to confirm", "DSLM sub-nav always visible".

### Memory updates

Aktualizuj/utwórz pliki:
- `mem/features/curriculum-phases/deadline-fit-enforcement.md` — dopisz źródło deadline'u: `goal.target_date` jako fallback.
- `mem/features/dslm-subnav/always-visible-subsections.md` (nowy) — sub-sekcje zawsze widoczne, aktywna podświetlona.
- `mem/features/navigation/calendar-button-single-instance.md` (nowy) — Calendar tylko przez `GCalStatusButton`, anchor pattern.
- `mem/features/navigation/nav-student-switcher.md` — dopisz: hide na `/student/:id`, level inline jako badge.
- `mem/features/worksheet-form/student-selector-states.md` (nowy) — 3 stany: anon (Lock), 0 students (CTA), N students (Select). Krótka etykieta "No student (generic)".
- `mem/features/dslm/type-to-confirm-delete.md` (nowy) — wzorzec ConfirmTypeToDeleteDialog.
- Aktualizacja `mem/index.md` z odnośnikami do nowych plików (zachowując całą dotychczasową treść).

---

## Kolejność implementacji (8 atomowych kroków)

1. **Edge function `generate-curriculum-phases`** — fallback na goal target_date + przykład w prompcie + telemetry `deadline_source`. (Problem 1)
2. **`useFutureTimeline.tsx`** — defensywne limity excludeIds, lepsze komunikaty 500, fallback bez phaseId. (Problem 2)
3. **`ConfirmTypeToDeleteDialog.tsx`** (nowy) + zastosowanie w `NextStepBanner` (delete) + `MacroTimeline` (phase delete). (Problem 3)
4. **`GenerateStepsDialog.tsx`** — reset count na open uwzględnia `recPhase.need - recPhase.have`, label `Phase X: …`, truncate. (Problem 4abc)
5. **`useCurriculumPhases.tsx`** — emit/listen `dslm:phasesUpdated`. (Problem 4a)
6. **`DSLMTab.tsx`** — sub-sekcje zawsze widoczne, aktywna z `border-primary`. (Problem 4-bis)
7. **`StickyNav.tsx` + `NavStudentSwitcher.tsx` + `GCalStatusButton.tsx`** — usunięcie duplikatu Calendar, anchor w GCal, hide switcher na `/student/:id`, level inline. (Problemy 5+6)
8. **`StickyNav.tsx` (Generate btn) + `WorksheetForm/index.tsx`** — fix callbacku Generate, krótka etykieta, klikalny CTA Add student. (Problemy 7+8)
9. **Dokumentacja** — `docs/llm-context.md`, `llms.txt`, mem files + index.

---

## Co NIE zostanie zmienione (sanctity)

- Prompt `format-worksheet-prompt` — nietknięty.
- Schemat bazy — bez migracji (`generation_context` to JSONB, dodajemy nowy klucz bez zmian struktury).
- API `generate-timeline` (deployed) — bez modyfikacji (brak źródła w repo).
- DSLM Skill Assessment, AI evaluations, deterministic tasks — bez zmian.
- Demo mode lockdown — bez zmian (wszystkie nowe akcje już chronione w istniejących handlerach).

---

## Ryzyka i ich mitigacja

| Ryzyko | Mitigacja |
|---|---|
| Fallback na goal.target_date pogorszy plany dla studentów z odległym celem | Filtr `target_date > now()` + `min(...)` — bierzemy najbliższy realny |
| Type-to-confirm dla phase'a może denerwować | Dotyczy tylko Remove (nie zmiany statusu); zgodne z prośbą użytkownika |
| Anchor onClick dla GCalStatusButton przerwie istniejący navigate | Test: zwykły click → SPA nav, modyfikator → new tab |
| Sub-sekcje zawsze widoczne mogą wydłużyć sidebar | Wszystkie 4 grupy razem ≈18 pozycji × 22px ≈ 400px, mieści się w sticky |
| Defensywny limit excludeIds=25 może powtarzać kroki | Akceptowalne — przy >25 użytkownik ma już dużo opcji, AI ma kontekst |

