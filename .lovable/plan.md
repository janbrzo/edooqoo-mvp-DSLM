
# Plan v6.9.44 — Cztery problemy, jeden cykl

## P1. 1-Minute Prep → Generate worksheet ↗ nadal nie startuje generacji

### Dependency scan
- `src/components/dslm/NextStepBanner.tsx` — wywołuje `onUseAndGenerate` z `autoGenerate=true`.
- `src/components/dslm/PathwayView.tsx` `callSuggestion` → przekazuje `suggested_exercises || []` (może być puste).
- `src/pages/StudentPage.tsx` (linie 1065-1102) — zapisuje sessionStorage + `navigate('/')`.
- `src/components/WorksheetForm/index.tsx`:
  - bramka (lines 338-360) wymaga `selectedExercises.length > 0`,
  - watchdog 1500 ms (lines 365-398) też wymaga `(exercisesNow?.length ?? 0) > 0`, w przeciwnym razie **kasuje flagi i kończy bez submitu**.
  - `submitForm()` (lines 457-503) sam auto-dopełnia ćwiczenia (`maxExercises = 6/8`).

### Root cause
Sugestie z 1-Minute Prep często mają `suggested_exercises = []` (Layer D suggestion bez prefill ćwiczeń) lub `null`. Bramka i watchdog blokują submit do czasu pojawienia się ćwiczeń, których nigdy nie będzie — watchdog kasuje wtedy flagi. Formularz pozostaje wypełniony temat/cel, ale generacja nie startuje. `submitForm` natomiast i tak by sobie poradził (auto-uzupełnia ćwiczenia).

### Solution options
| Opcja | Podejście | Ryzyko regresji |
|---|---|---|
| A | Zdjąć warunek `selectedExercises.length > 0` z bramki i watchdoga. `submitForm` sam dopisze ćwiczenia. | LOW — `submitForm` już dziś dopełnia. |
| B | W `PathwayView.callSuggestion` wstrzykiwać domyślny pakiet ćwiczeń gdy pusty. | MED — wymaga wiedzy o trybie media + poziomie. |
| C | Czekać na ćwiczenia w infinite loop. | HIGH — i tak nigdy nie nadejdą. |

### Selected: A
Najprostsze, deterministyczne, korzysta z istniejącego auto-completion w `submitForm`. Bramka dalej czeka na `lessonTopic` + `formRef`, więc nie wystartuje "pusto".

### Impact analysis
- Manualny przepływ niezmieniony (nie ma wtedy `initialAutoIntentRef`).
- Auto-fill ćwiczeń jest dziś jedyną ścieżką, gdy user kliknie Generate z pustego formularza — zero regresji.

### Implementation
Plik: `src/components/WorksheetForm/index.tsx`

1. Bramka (linia ~342) — usunąć warunek na ćwiczenia:
```ts
// v6.9.44 — drop exercises gate; submitForm() auto-completes missing exercises.
if (!lessonTopic || !lessonTopic.trim()) { devLog('[autoSubmit] waiting: lessonTopic empty'); return; }
if (!formRef.current) { devLog('[autoSubmit] waiting: no formRef'); return; }
```
2. Watchdog (linie ~370-394) — uznać `ok` gdy `topic + formRef` (bez warunku ćwiczeń). Hydration ćwiczeń zostaje (best-effort), ale nie blokuje:
```ts
const ok = !!topicNow?.trim() && !!formRef.current;
```
3. Bezpiecznik: jeśli `submitForm` nie jest dostępny w czasie watchdoga (HMR), zostawić obecne `try/catch`.
4. Bump komentarzy z `v6.9.42` na `v6.9.44` w bramce + watchdog.

### Verification
- Klik Generate worksheet ↗ z 1-Minute Prep gdy sugestia ma 0 ćwiczeń → toast "Exercises auto-completed" + stream startuje.
- Klik Generate worksheet ↗ z sugestii z ćwiczeniami → ćwiczenia z sugestii honorowane.
- Wejście na `/` ręcznie → autosubmit nie odpala (brak `autoGenerateWorksheet` w sessionStorage).

---

## P2. Banner Welcome Test — retake + zwartość

### Dependency scan
- `src/components/welcome-test/WelcomeTestActionsPanel.tsx` — renderuje `Create retake` zawsze, gdy `onRetake` jest przekazane.
- `src/components/dashboard/WelcomeTestSuggestion.tsx`:
  - state machine: `no_test | pending | in_progress | completed | hidden`,
  - panel mountowany w `no_test` (linia 547) i w pozostałych (linia 685) — w obu wypadkach `onRetake={handleRetake}` ⇒ zawsze widoczny.
  - Layout `pending`: title + URL + sent label + (banner widget + sent reminder) + actions w drugim wierszu — duże białe tło.
- `src/components/student-tests/StudentTestsTab.tsx`:
  - card per attempt, w środku `WelcomeTestActionsPanel` z `onRetake={handleRetake}` zawsze (linia 428).
  - layout dwuwierszowy: nagłówek + `TestDates` + action row (`flex justify-start lg:justify-end`) → ostatnia (assigned) ma duży pustakowy obszar.

### Root cause
**(2A)** `WelcomeTestActionsPanel` warunkuje "Create retake" tylko obecnością `onRetake`, ale rodzice zawsze go przekazują. Brakuje prop-flagi `canRetake` zależnej od stanu (only `completed` lub `reviewed`).
**(2B/2C)** Banner/card mają osobny pełnoszerokościowy wiersz na akcje, więc tworzy się pusta przestrzeń po prawej w wierszu tytułu. Trzeba zlikwidować osobny wiersz akcji na breakpointach ≥sm i kompaktować padding.

### Solution options (P2)
| Opcja | Podejście | Ryzyko |
|---|---|---|
| A | Wprowadzić `canRetake?: boolean` w `WelcomeTestActionsPanel`; rodzice ustalają na podstawie statusu. | LOW |
| B | Ukrywać `Create retake` wewnątrz panelu na podstawie `state !== 'completed'`. | MED — nie pokryje retake "completed last + still has open retake" przypadku, gdyż state opiera się na latest attempt. Trzeba mimo wszystko dodać flagę. |

### Selected: A (z domyślnym fallbackiem `state === 'completed'`)

### Implementation (P2A — retake gating)

Plik: `src/components/welcome-test/WelcomeTestActionsPanel.tsx`
- Dodać prop `canRetake?: boolean` (default: `state === 'completed'`).
- Warunek renderu (linia 282): `{onRetake && canRetake && (...)}`.

Plik: `src/components/dashboard/WelcomeTestSuggestion.tsx`
- W obu mountach `WelcomeTestActionsPanel` dodać `canRetake={panelState === 'completed'}`.

Plik: `src/components/student-tests/StudentTestsTab.tsx`
- W `WelcomeTestActionsPanel` (linia 419) dodać `canRetake={panelState === 'completed'}`.
- W panelu "no welcome test" (linia 340-360) `onRetake` jest niepodawany — bez zmian.

### Implementation (P2B — Overview/1 MINUTE pending banner kompakt)

Plik: `src/components/dashboard/WelcomeTestSuggestion.tsx`
- Sekcja `pending/in_progress/completed` (linie 567-701) — przejść z `flex-col` (2 wiersze) na **single-row grid** na ≥lg, fallback do stacku na <lg:

Nowy szkielet wewnątrz `<CardContent className={compact ? 'py-2 px-3' : 'py-3 px-4'}>`:

```tsx
<div className="flex flex-col lg:flex-row lg:items-center lg:gap-4 gap-2">
  {/* Title + meta — kompaktowo */}
  <div className="flex items-start gap-3 min-w-0 flex-1">
    <Sparkles className="h-7 w-7 text-primary flex-shrink-0" />
    <div className="min-w-0 flex-1">
      {status === 'pending' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium break-words text-sm">
              {retakeLabel ? `Welcome Test ${retakeLabel} sent` : 'Welcome (placement) Test sent'}
            </p>
            <Badge variant="secondary" className="shrink-0">Waiting for student</Badge>
            {sentAt && <span className="text-xs text-muted-foreground">· {humanSent(sentAt)}</span>}
          </div>
          {shareUrl && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={shareUrl}>
              {shareUrl}
            </p>
          )}
        </>
      )}
      {/* in_progress, completed analogicznie — bez Progress wystającego, tylko inline badge */}
    </div>
  </div>

  {/* Actions — bez osobnego wiersza */}
  <div className="lg:flex-shrink-0">
    <WelcomeTestActionsPanel ... canRetake={panelState === 'completed'} compact />
  </div>
</div>
```

- `humanSent` = inline helper liczący `just now / Xh ago / Xd ago`.
- Reminder button (48h) zostaje, ale przeniesiony do inline `<span>` przy `sentAt` (zostaje funkcjonalność).
- Padding `CardContent` zredukować z `py-4` → `py-3`. Margin `mb-6` → `mb-4`.

### Implementation (P2C — Tests tab card kompakt)

Plik: `src/components/student-tests/StudentTestsTab.tsx` (linie 380-441):
- Zmiana `CardContent className="py-4 space-y-3"` → `"py-3"`.
- Główny kontener: `flex flex-col lg:flex-row lg:items-center lg:gap-4 gap-2`:
  - lewa kolumna (`flex-1`): ikona + tytuł + badge + `TestDates` jednorzędowo (inline `·` separator zamiast osobnej linii dla daty); meta `Welcome Test • 58 questions · Attempt #N` jako jeden wiersz mniejszy.
  - prawa kolumna (`lg:flex-shrink-0`): `WelcomeTestActionsPanel` lub Button View.
- Dla `!isLatest` (View only) ⇒ kompaktowy `Button` w prawej kolumnie — koniec pustej dolnej przestrzeni.

### Verification (P2)
1. **Overview** baner gdy `no_test` → brak `Create retake`.
2. **Overview** baner `pending` (Waiting for student) → brak `Create retake`, jedna linia (≥lg).
3. **Overview** baner `in_progress` → brak `Create retake`.
4. **Overview** baner `completed/reviewed` → `Re-take Test` widoczny.
5. **Tests tab** card `Assigned` (Retake 4) → brak `Create retake`, wszystko w jednym wierszu, brak pustej przestrzeni pod tytułem.
6. **Tests tab** card `Reviewed`/`Completed` (Retake 3) → `Re-take Test` widoczny.
7. Layout na 360 px (mobile) → stack, czytelny.

---

## P3. Regenerate Learning Roadmap kasuje `in_progress` mimo deklaracji

### Dependency scan
- `src/components/dslm/GenerateRoadmapDialog.tsx` — copy "Phases marked done or in progress are kept."
- `supabase/functions/generate-curriculum-phases/index.ts`:
  - linie 493-502: `mode === 'replace'` soft-deletuje **wszystkie phases z `status !== 'done'`** ⇒ łapie `in_progress`.
  - linia 507: `remainingMaxSeq` dla replace bierze tylko `status === 'done'`.
  - linia 351: pierwszy tydzień nowych phases = `1` dla `replace` ⇒ koliduje z zachowanymi `in_progress`.
  - linie 305-326: budget `remainingBudget` dla `replace` = pełny `weeksUntilDeadline`.

### Root cause
Backend nie traktuje `in_progress` jako "kept" w trybie `replace`. UI obiecuje preservation, ale silnik kasuje wszystko poza `done`.

### Selected solution
Rozszerzyć "kept set" o `in_progress`. Spójnie poprawić: soft-delete, sequence base, week budget i first-week start.

### Implementation
Plik: `supabase/functions/generate-curriculum-phases/index.ts`

1. Utility na górze handlera (po wczytaniu `existingPhases`):
```ts
const KEPT_STATUSES = ['done', 'in_progress'];
const keptPhases = existingPhases.filter((p: any) => KEPT_STATUSES.includes(p.status));
const keptWeeksConsumed = keptPhases.reduce((acc: number, p: any) => {
  const s = Number.isInteger(p.estimated_weeks_start) ? p.estimated_weeks_start : 0;
  const e = Number.isInteger(p.estimated_weeks_end) ? p.estimated_weeks_end : 0;
  return Math.max(acc, e || s || 0);
}, 0);
```
2. Soft-delete (linie 494-502): zmienić filtr na `!KEPT_STATUSES.includes(p.status)`:
```ts
if (mode === 'replace' && existingPhases.length > 0) {
  const idsToDelete = existingPhases
    .filter((p: any) => !KEPT_STATUSES.includes(p.status))
    .map((p: any) => p.id);
  ...
}
```
3. `remainingMaxSeq` (linia 505-507): także dla `replace` bazować na `keptPhases`:
```ts
const remainingMaxSeq = mode === 'add'
  ? existingPhases.reduce((a, p) => Math.max(a, p.sequence_number), 0)
  : keptPhases.reduce((a, p) => Math.max(a, p.sequence_number), 0);
```
4. Budget (linie 305-326): w `replace` odjąć `keptWeeksConsumed`, gdy istnieje deadline:
```ts
} else {
  // 'replace' rebuilds remaining timeline AFTER kept (done + in_progress) phases.
  remainingBudget = Math.max(phaseCount, weeksUntilDeadline - keptWeeksConsumed);
}
```
5. First-week start w prompcie (linia 351) — uogólnić:
```ts
const firstWeekStart = (mode === 'add' || keptWeeksConsumed > 0)
  ? keptWeeksConsumed + 1
  : 1;
// w stringu: `First phase starts at week ${firstWeekStart}.`
```
6. Dorzucić do `EXISTING ROADMAP PHASES` blok jasne oznakowanie KEPT vs REPLACE (w `buildExistingPhasesBlock` jeżeli prosto — opcjonalnie tylko adnotacja w prompcie):
```ts
const replaceRules = `\nCOMPLEMENTARITY RULES:
- Phases with status='done' OR 'in_progress' are KEPT (do NOT touch, do NOT duplicate).
- Replace ONLY status='planned' / 'draft' phases.
- New phases MUST start at week ${firstWeekStart} and never overlap kept weeks.\n`;
```
   (Zastąpić istniejący blok COMPLEMENTARITY RULES tym wariantem, parametryzowanym `firstWeekStart`.)
7. UI copy bez zmian — opis już zgodny.

### Verification (P3)
- Z 2 fazami `in_progress` + 3 `planned` → Regenerate → faktycznie nie znika żadna `in_progress`, sekwencje nowych faz zaczynają się od max(seq kept)+1, tygodnie nowych faz zaczynają się od `keptWeeksConsumed+1`.
- Bez `in_progress` (tylko `planned`) → zachowanie jak dotąd.
- Mode `add` niezmieniony.

---

## P4. Modal "Create Homework Assignment" — redesign od zera

### Dependency scan
- `src/components/homework/CreateHomeworkModal.tsx` (988 linii). Sekcje:
  1. Student (select),
  2. Exercises from Worksheet (lista checkbox + scroll),
  3. Generate Additional Exercises (typy + instrukcje + Generate + lista wygenerowanych),
  4. Deadline (date + time),
  5. Reminder (switch + select offset),
  6. Action buttons (Cancel + Create Homework).
- `existingHomework` alert na górze.
- Success view (po utworzeniu): URL + email do studenta + send-to-me + Done.

### Root cause
Collapsible-overlay zdublował etykiety ("Student" / "Select Student", "Exercises from Worksheet" / "Select Exercises from Worksheet" itd.). Wszystkie panele rozszerzone naraz dają długie pionowo płótno. Brak gęstości informacji.

### Selected solution
Redesign na **dwuwymiarowy layout** z czytelnymi sekcjami i jedną etykietą per sekcja, bez collapsible. Cel: cały formularz mieści się na 1080p bez scrolla w typowym przypadku (Student wybrany + 8 ćwiczeń + brak generatora).

### Nowy layout (ASCII)

```text
┌──────────────────────────────────────────────────────────────┐
│ Create Homework Assignment                              [×]  │
│ Source worksheet: "<title>"                                  │
│ [⚠ alert: existing homework] (only if applicable)            │
├──────────────────────────────────────────────────────────────┤
│ ┌── Student ───────────────┐  ┌── Deadline ────────────────┐ │
│ │ [Select student ▾]       │  │ [Pick date 📅] [HH:MM ⏰]  │ │
│ └──────────────────────────┘  └────────────────────────────┘ │
│                                                              │
│ ┌── Exercises (N/M selected) ───────────────────────────┐    │
│ │ [Select all] [Clear]                                  │    │
│ │ ☐ Ex 1: reading      ☐ Ex 2: word-order              │    │
│ │ ☐ Ex 3: categorize   ☐ Ex 4: matching                │    │
│ │ … (grid 2 kol., max-h-44, scroll)                    │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                              │
│ ┌── Reminder ──────────────────────────────────────────┐     │
│ │ [Switch] Send reminder [Select hours ▾] (inline)     │     │
│ └──────────────────────────────────────────────────────┘     │
│                                                              │
│ ┌── Generate additional exercises ▸ (toggle) ──────────┐     │
│ │ (Collapsed by default — opens inline pełna sekcja)   │     │
│ │ types grid (2 kol., max-h-32)                        │     │
│ │ Additional Instructions [textarea x2 rows]           │     │
│ │ [Generate selected] [Clear]                          │     │
│ │ generated list (max-h-32)                            │     │
│ └──────────────────────────────────────────────────────┘     │
│                                                              │
│ [Cancel]                            [Create Homework ➜]      │
└──────────────────────────────────────────────────────────────┘
```

Kluczowe decyzje:
- **Dialog**: `max-w-3xl max-h-[88vh] overflow-y-auto p-5`.
- **Sekcja = `<section>`** z `border rounded-lg p-3 space-y-2`, jednym `<h3 className="text-sm font-semibold">` w nagłówku + opcjonalny meta-chip po prawej (selected counter). Bez collapsible, BEZ duplicate label.
- **Student + Deadline** w `grid grid-cols-1 md:grid-cols-2 gap-3`.
- **Exercises list**: `grid grid-cols-2 gap-x-3 gap-y-1.5 max-h-44 overflow-y-auto`. Header sekcji ma `Select all / Clear` po prawej.
- **Reminder**: jedna linia `flex items-center gap-3`. Select widoczny tylko gdy switch ON.
- **Generate additional exercises**: collapsed-by-default (tylko ta jedna sekcja używa `Collapsible`, nagłówek `Sparkles + "Generate additional exercises" + ChevronDown`). Wewnątrz brak duplicate label `Generate Additional Exercises`.
- **Action bar**: sticky bottom (`sticky bottom-0 bg-background pt-3 -mx-5 px-5 border-t`).

### Zachowane funkcjonalności (must-keep checklist)
- Existing homework warning (alert).
- Student select (id, name, level).
- Exercise selection (checkbox + scroll + counter).
- Generated additional exercises: types multi-select max 6, additional instructions, generate, clear, select per generated.
- Deadline date + time picker.
- Send reminder switch + offset select z istniejącymi disabled rules.
- Validation: disable Create Homework gdy brak studenta lub `selectedExercises.size + getSelectedGeneratedExercises().length === 0`.
- Success view: shareable link copy/open + send-email + sendToTeacher + Done.

### Implementation (P4)
Plik: `src/components/homework/CreateHomeworkModal.tsx`
1. Usunąć `HomeworkSection` helper (zostawić tylko dla "Generate additional exercises" sekcji z `Collapsible` inline, BEZ duplicate label).
2. Zmienić `DialogContent` className na `max-w-3xl max-h-[88vh] overflow-y-auto p-5`.
3. Zastąpić obecny `<div className="space-y-3 py-4">` nowym strukturą sekcji opisaną wyżej:
   - `<div className="space-y-3 py-2">`
   - `<div className="grid md:grid-cols-2 gap-3">` (Student + Deadline)
   - `<section>` Exercises (+ Select all / Clear buttony).
   - `<section>` Reminder.
   - `<Collapsible>` Generate additional exercises (collapsed default).
4. Dla Exercises: dodać 2 lokalne handlery `selectAllExercises()` / `clearExercises()` (operują na `setSelectedExercises(new Set(...))`).
5. Action bar opakować w `<div className="sticky bottom-0 -mx-5 px-5 pt-3 border-t bg-background flex gap-3">`.
6. Success view bez zmian funkcjonalnych, ale `space-y-4 py-4` zamiast `py-6` aby było bardziej zwarte.
7. Wszystkie miejsca, gdzie zostały duplicate `<Label>` dublujące tytuł sekcji — **usunąć** (np. linia 574 "Select Student", 598 "Select Exercises from Worksheet", 632 "Generate Additional Exercises", 838 "Deadline (Optional)").

### Impact analysis (P4)
- Brak zmian w stanie/akcjach (`generateHomework`, `generateSimilarExercises`, etc.) — tylko JSX layout + 2 nowe lokalne fn.
- Wszystkie testy/handler propsy zachowane.
- Modal o szerokości `max-w-3xl` mieści się na 1080p i 1366×768 (≥768 px).

### Verification (P4)
- Otwarcie modalu: brak duplicate label per sekcja.
- 1080p: wszystkie sekcje (bez generatora) widoczne bez scrolla, action bar przyklejony na dole.
- "Select all" / "Clear" działają na liście ćwiczeń.
- Generator: rozwijany; po użyciu lista wygenerowanych i counter.
- Validation Create Homework działa.
- Success view: copy / open / send email / sendToTeacher bez regresji.

---

## RAG INJECTION

### `docs/llm-context.md` (append v6.9.44 sekcja)
```
### v6.9.44 — auto-submit hardening, WT retake gating, regen preserves in_progress, homework modal redesign

PROBLEM 1: 1-Minute Prep suggestions with empty suggested_exercises blocked WorksheetForm auto-submit because gate + watchdog required >0 exercises; watchdog dropped flags.
EDOOQOO SOLUTION: gate + watchdog now only require lessonTopic + formRef; submitForm() already auto-completes to 6/8 exercises.
TECHNICAL: src/components/WorksheetForm/index.tsx auto-submit gate (useEffect on lessonTopic/selectedExercises), watchdog useEffect (1500 ms), submitForm() media-aware auto-fill.

PROBLEM 2: WelcomeTestActionsPanel rendered "Create retake" regardless of state, and pending/in_progress banners wasted vertical space.
EDOOQOO SOLUTION: panel accepts canRetake?: boolean (default state==='completed'); banners + tests cards collapse to single-row layout on lg with inline meta.
TECHNICAL: src/components/welcome-test/WelcomeTestActionsPanel.tsx, src/components/dashboard/WelcomeTestSuggestion.tsx, src/components/student-tests/StudentTestsTab.tsx.

PROBLEM 3: generate-curriculum-phases in replace mode soft-deleted in_progress phases despite UI promising preservation.
EDOOQOO SOLUTION: KEPT_STATUSES = ['done','in_progress']; soft-delete filter, remainingMaxSeq base, remainingBudget (weeksUntilDeadline − keptWeeksConsumed), and prompt firstWeekStart all consume KEPT set.
TECHNICAL: supabase/functions/generate-curriculum-phases/index.ts replace branch (lines 305-510).

PROBLEM 4: Create Homework modal had collapsible-overlay duplicating labels and consuming vertical space.
EDOOQOO SOLUTION: full layout rewrite — grid sections, single section header, Generate-additional collapsed by default only, sticky action bar.
TECHNICAL: src/components/homework/CreateHomeworkModal.tsx DialogContent max-w-3xl, removed HomeworkSection wrapper for primary sections.

RAG KEYWORDS: worksheet form auto-submit gate, watchdog exercises optional, suggestion empty exercises, WelcomeTestActionsPanel canRetake prop, retake gating completed only, welcome test banner single row, student tests card compact, generate-curriculum-phases preserve in_progress, KEPT_STATUSES roadmap regenerate, keptWeeksConsumed week budget, firstWeekStart prompt, CreateHomeworkModal redesign, sticky action bar, select all clear exercises, homework collapsible generator.
```

### `public/llms.txt` / `public/llms-answers.txt`
Brak zmian wymaganych — brak nowej publicznej powierzchni; v6.9.44 to wyłącznie wewnętrzne UX/backend.

---

## Final change report (anticipated)

Files to modify:
- `src/components/WorksheetForm/index.tsx` (P1)
- `src/components/welcome-test/WelcomeTestActionsPanel.tsx` (P2A)
- `src/components/dashboard/WelcomeTestSuggestion.tsx` (P2A + P2B)
- `src/components/student-tests/StudentTestsTab.tsx` (P2A + P2C)
- `supabase/functions/generate-curriculum-phases/index.ts` (P3)
- `src/components/homework/CreateHomeworkModal.tsx` (P4)
- `docs/llm-context.md` (RAG v6.9.44)
- `mem/index.md` + `mem/features/onboarding/v6944-...md` (memory)

Out of scope (logged, not fixed):
- Regenerate Roadmap variability between runs (already declined by user in v6.9.43).
- Welcome Test banner reminder button placement on `in_progress` state — keep current.
- Existing 197 security linter findings — pre-existing.

Sanctity: zero touch on worksheet generation engine, no DB schema/RLS changes, no Stripe.
