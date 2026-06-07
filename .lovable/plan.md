# Plan v6.9.42 — Cztery punktowe naprawy (1-Minute Prep, Welcome Test retake, Roadmap Regenerate, Homework Modal)

Wszystkie zmiany utrzymują Sanctity Worksheet Generation Engine — nic z `generateWorksheet` / promptu worksheetowego nie zostaje ruszone. Ruszamy tylko UI/UX i Edge Function `generate-curriculum-phases` (która NIE jest częścią worksheet engine).

---

## PROBLEM 1 — „Generate worksheet ↗" w 1-Minute Prep nie startuje generowania

### Dependency scan

- `src/components/dslm/NextStepBanner.tsx` (przycisk → `onUseAndGenerate`)
- `src/components/dslm/NextStepsSection.tsx`, `PathwayView.tsx` (propagacja callbacku)
- `src/pages/StudentPage.tsx` (pisze sessionStorage `autoGenerateWorksheet*`, `prefill*`, robi `navigate('/')`)
- `src/pages/Index.tsx` (mountuje `FormView` → `WorksheetForm`)
- `src/components/WorksheetForm/index.tsx` (lazy init prefill + readiness gate + watchdog 1500 ms)

### Root cause

`autoSubmit` używa `formRef.current?.requestSubmit()`. `requestSubmit()` wykonuje natywną walidację HTML formularza. Pola `<input>` w `FormField` mają (zależnie od trybu) atrybut `required`, a pole `lessonTopic` w momencie wywołania bywa zhydratowane do state ale jeszcze nie do DOM (React batch), a kontrolowany `<select>` „Student" oraz inne polami z `required` mogą blokować submit cicho — przeglądarka anuluje submit bez wywołania `onSubmit`. Dodatkowo `handleSubmit` jest defensywnie chroniony przez `preventDefault` + własne walidacje, ale nigdy nie zostaje odpalony, bo natywna walidacja przerwała submit.

W skrócie: **lazy init prefill jest OK; jedyny brakujący element to fakt, że `requestSubmit()` może być cicho ublokowane przez HTML5 validation, a watchdog robi to samo co gate (też `requestSubmit()`)**, więc oba „ciche" submitki dają zero efektu.

### Solution options


| #   | Podejście                                                                                                                     | Trade-off                                                     | Regression risk                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| A   | Dodać `noValidate` do `<form>` + nadal `requestSubmit()`                                                                      | Wyłącza HTML5 validation globalnie                            | medium (zmienia zachowanie ręcznego submitu) |
| B   | Wywołać programowo `handleSubmit({ preventDefault: () => {} } as any)` z auto-submit gate i watchdogu, bypass `requestSubmit` | Omija walidator, zachowuje istniejące guardy w `handleSubmit` | low                                          |
| C   | Wywołać bezpośrednio `submitForm(effectiveTopic)` z guardami z `handleSubmit` zinlinowanymi w gate                            | Najmniejsza powierzchnia, zero zależności od FormEvent        | low                                          |


### Selected solution: **C**

Najprostsze, zero ryzyka regresji ręcznego flow (user clik Generate dalej idzie przez `<button type="submit">` → `handleSubmit`).

### Impact analysis

- Nie zmienia zachowania ręcznego submitu (przycisk dalej wywołuje `handleSubmit`).
- Auto-submit dostaje **deterministyczną** ścieżkę bez walidatora HTML.
- Zero regresji w persistence (`useWorksheetFormPersistence` nadal zapisuje draft po stronie efektu) — nie dotykamy hooka.

### Implementation (pełne)

W `src/components/WorksheetForm/index.tsx`:

1. Wyciągnąć z `handleSubmit` walidację topicu do helpera `attemptAutoSubmit()`:

```ts
const attemptAutoSubmit = (sourceTag: string) => {
  // Recover topic from state, lazy storage, or DOM in that order.
  let effectiveTopic = lessonTopic?.trim() || '';
  if (!effectiveTopic) {
    const fromStorage = readPrefillTopic().trim();
    if (fromStorage) effectiveTopic = fromStorage;
  }
  if (!effectiveTopic && formRef.current) {
    const inputEl = formRef.current.querySelector<HTMLInputElement | HTMLTextAreaElement>('[name="lessonTopic"]');
    effectiveTopic = inputEl?.value?.trim() || '';
  }
  if (!effectiveTopic) {
    devWarn(`[autoSubmit:${sourceTag}] giving up — no topic available`);
    return false;
  }
  if (!effectiveTopic !== !lessonTopic) setLessonTopic(effectiveTopic);
  devLog(`🚀 [WorksheetForm v6.9.42] auto-submit via ${sourceTag}`);
  submitForm(effectiveTopic);
  return true;
};
```

2. Zamienić w gate (linie ~338-358) `formRef.current?.requestSubmit()` na `attemptAutoSubmit('gate')`:

```ts
useEffect(() => {
  if (autoSubmitFiredRef.current) return;
  if (!initialAutoIntentRef.current) return;
  if (!lessonTopic?.trim()) return;
  if (!selectedExercises || selectedExercises.length === 0) return;
  if (!formRef.current) return;
  autoSubmitFiredRef.current = true;
  // Defer to next frame so React has flushed state into DOM.
  requestAnimationFrame(() => {
    const ok = attemptAutoSubmit('gate');
    if (!ok) {
      autoSubmitFiredRef.current = false; // allow watchdog retry
      return;
    }
    sessionStorage.removeItem('autoGenerateWorksheet');
    sessionStorage.removeItem('autoGenerateWorksheetRequest');
  });
}, [lessonTopic, selectedExercises]);
```

3. Zamienić w watchdogu (linie ~363-395) `formRef.current?.requestSubmit()` na `attemptAutoSubmit('watchdog')` i zostawić fallback drop flagi w identycznym kształcie.
4. Dodać do `<form ref={formRef} noValidate ...>` atrybut `noValidate` (linia w pobliżu `<form ref={formRef} onSubmit={handleSubmit}>` — należy znaleźć i dodać). Powód: druga linia obrony — gdyby ktoś jednak wywołał `requestSubmit()` w przyszłości.

### Verification

- Klik „Generate worksheet ↗" w 1-Minute Prep → nawigacja do `/` → po ≤2 s start generowania (loader/`GeneratingModal`).
- `devLog('🚀 [WorksheetForm v6.9.42] auto-submit via gate')` w konsoli.
- Ręczne kliknięcie „Generate" w formularzu dalej działa identycznie.
- Po sukcesie sessionStorage nie ma `autoGenerateWorksheet*`/`prefill*`.

---

## PROBLEM 2 — Retake Welcome Test (email + 4 layouty)

### 2A — Email retake bez oznaczenia, że to retake

#### Root cause

`sendWelcomeTestEmail` przekazuje `testTitle = 'Welcome Test - {name}'` bez numeru attempt. Edge Function `send-test-email` używa `testTitle` w temacie/treści, więc student dostaje dokładnie taki sam tytuł jak przy pierwszym mailingu.

#### Solution

Rozszerzyć `SendWelcomeTestEmailArgs` o opcjonalne `attemptNumber?: number` i `isRetake?: boolean`. Gdy `isRetake`, ustawić `testTitle = 'Welcome Test (Retake N) - {name}'`. Dodatkowo przekazać do funkcji nowe pole `retakeNumber` używane w body emaila po stronie Edge Function.

#### Implementation

- `src/lib/welcomeTest/ensureWelcomeTest.ts` — dodać pola w `SendWelcomeTestEmailArgs`, przekazać do body:

```ts
export interface SendWelcomeTestEmailArgs {
  token: string; recipientEmail: string; studentName: string; teacherId: string;
  reminder?: boolean; attemptNumber?: number;
}
// ...
const attemptN = attemptNumber ?? 1;
const isRetake = attemptN > 1;
const retakeIndex = isRetake ? attemptN - 1 : 0;
const titleSuffix = isRetake ? ` (Retake ${retakeIndex})` : '';
const { error } = await supabase.functions.invoke('send-test-email', {
  body: {
    shareToken: token, recipientEmail,
    testTitle: `Welcome Test${titleSuffix} - ${studentName}`,
    teacherName, testType: 'welcome', reminder, retakeNumber: retakeIndex,
  },
});
```

- `supabase/functions/send-test-email/index.ts`:
  - Odczytać `retakeNumber` z body.
  - W subject: jeśli `retakeNumber > 0` i `!reminder`, użyć `${teacherName} sent you a retake (Retake ${retakeNumber}) of the Welcome Test`.
  - W body (`emailBody`) — dodać górną sekcję info:
    ```html
    ${retakeNumber > 0 ? `<p style="background:#f3e8ff;padding:10px 14px;border-radius:6px;margin:0 0 12px;color:#5b21b6"><strong>This is Retake ${retakeNumber}.</strong> Your teacher would like to re-measure your progress since the last attempt.</p>` : ''}
    ```
- Call sites — dorzucić `attemptNumber`:
  - `src/components/student-tests/StudentTestsTab.tsx` linia ~235: `attemptNumber: nextAttempt`.
  - `src/components/dashboard/WelcomeTestSuggestion.tsx` (auto-mail po retake utworzonym z bannera) — analogicznie.
  - `src/components/student-tests/TestDetailsView.tsx` — gdy odpala `sendWelcomeTestEmail` po retake, przekazać attempt z nowego testu.

#### Verification

- Po utworzeniu retake 1, student dostaje email z tematem `... sent you a retake (Retake 1) of the Welcome Test` i fioletowym info-box w body.
- Pierwszy (initial) email nie ma sufixu „Retake".

---

### 2B + 2C + 2D — Layouty banerów rozjeżdżają się

#### Root cause

- `WelcomeTestSuggestion` używa `grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto]` z badge'm „Waiting for student" w pierwszej kolumnie + długim URL w `<p>` z `line-clamp-1 break-all` (overflow przy retake suffix powoduje że badge wskakuje w nowy wiersz, a URL zjada szerokość).
- `StudentTestsTab` karta retake: `grid-cols-1 lg:grid-cols-[1fr_auto]` z prawą kolumną zawierającą 7 kontrolek (statys, Copy, Refresh, Preview, View, Re-send, Retake) — przy długim tytule wszystko obok siebie się rozjeżdża.

#### Solution

Stack-pierwszy layout z deterministycznym podziałem na 2 wiersze: (1) ikona + tekst + status; (2) URL truncate na pełną szerokość; (3) action panel wyrównany do prawej, z `flex-wrap`. Pełna szerokość zawsze, prawa-kolumna tylko od `xl`, nigdy `lg`.

#### Implementation

##### `src/components/dashboard/WelcomeTestSuggestion.tsx` (gałąź `!no_test`, linie 566–690)

Zastąpić cały zewnętrzny `<div className="grid grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto] ...">` strukturą:

```tsx
<div className="flex flex-col gap-3">
  {/* Row 1: icon + status text */}
  <div className="flex items-start gap-3 min-w-0">
    <Sparkles className="h-8 w-8 text-primary flex-shrink-0" />
    <div className="min-w-0 flex-1">
      {status === 'pending' && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium break-words">
            {retakeLabel ? `Welcome Test ${retakeLabel} sent` : 'Welcome (placement) Test sent'}
          </p>
          <Badge variant="secondary" className="shrink-0">Waiting for student</Badge>
        </div>
      )}
      {/* in_progress / completed branches preserved unchanged */}

      {/* URL: only when pending, full width, single-line truncate */}
      {status === 'pending' && shareUrl && (
        <p className="text-xs text-muted-foreground truncate mt-1" title={shareUrl}>{shareUrl}</p>
      )}

      {/* Sent X ago + reminder — preserved, but wrap to next line */}
      {status === 'pending' && sentAt && (/* same JSX, no layout changes */)}
    </div>
  </div>

  {/* Row 2: action panel, right-aligned on >=sm, wraps on mobile */}
  <div className="flex justify-start sm:justify-end">
    <WelcomeTestActionsPanel {...same props} compact className="flex-wrap justify-start sm:justify-end" />
  </div>
</div>
```

Usunąć ostatni grid-cell `<div className="col-span-2 lg:col-span-1 ...">` — zastąpiony Row 2.

##### `src/components/student-tests/StudentTestsTab.tsx` (linie 378–430 — karta attempt)

Zastąpić `grid-cols-1 lg:grid-cols-[1fr_auto]` przez `flex flex-col gap-3`. Layout:

```tsx
<Card key={attempt.id} className={`border-primary/30 ${isLatest ? '' : 'opacity-90'}`}>
  <CardContent className="py-4 space-y-3">
    {/* Row 1: full-width title block, clickable */}
    <div className="flex items-start gap-3 min-w-0 cursor-pointer" onClick={() => setSelectedTestId(attempt.id)}>
      <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold break-words">{cardTitle}</h3>
          {isLatest && welcomeAttempts.length > 1 && (
            <Badge variant="outline" className="text-[10px]">Latest</Badge>
          )}
          <Badge className={`${statusClass} shrink-0`}>{statusLabel}</Badge>
          {attempt.score_percentage !== null && (
            <span className="text-xs text-muted-foreground">· {answered}/{total} answered</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome Test • {total} questions
          {attemptNumber > 1 && <span className="ml-2 text-primary">· Attempt #{attemptNumber}</span>}
        </p>
        <TestDates ... className="mt-1" />
      </div>
    </div>

    {/* Row 2: action panel — full width, wraps */}
    <div className="flex justify-start lg:justify-end">
      {isLatest ? (
        <WelcomeTestActionsPanel {...same props} compact className="flex-wrap justify-start lg:justify-end" />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setSelectedTestId(attempt.id)}>
          <Eye className="h-4 w-4 mr-1" /> View
        </Button>
      )}
    </div>
  </CardContent>
</Card>
```

Usuwa to „pływające 47/58 answered" — przeniesione obok statusu w Row 1.

##### `WelcomeTestActionsPanel` — przyjąć `className?: string`

Jeśli jeszcze nie przyjmuje, dodać i rozszerzyć root `<div>` o `cn('flex flex-wrap items-center gap-2', className)`. To zapewnia, że obie powyższe karty mogą wymusić `flex-wrap`.

#### Verification

- „Welcome Test retake 4 sent" w 1 MINUTE: ikona + tytuł + badge w jednym wierszu (zawijają się jeśli za wąsko), URL truncate w drugiej linii, akcje w trzecim wierszu wyrównane do prawej (≥sm).
- Zwykły „Welcome (placement) Test sent" (image-283): brak rozjazdu lewej kolumny, badge nie wskakuje pod ikonę.
- Karta retake w Tests: tytuł nie obcina się 2-3 wierszami; wszystkie 5 buttonów zmieszczone w drugiej linii.
- Mobile (<640): wszystkie akcje wrappują w jednej kolumnie pod tekstem.

---

## PROBLEM 3 — Generate Learning Roadmap (regenerate)

### Dependency scan

- `src/components/dslm/MacroTimeline.tsx` (toolbar + empty state, **2× zamontowany** `GenerateRoadmapDialog`)
- `src/components/dslm/GenerateRoadmapDialog.tsx` (UI dialogu)
- `src/hooks/dslm/useCurriculumPhases.tsx` (`generatePhases('replace', opts)`)
- `supabase/functions/generate-curriculum-phases/index.ts` (Edge Function — soft-delete + AI call)

### NIE WPROWADZAJ ROZWIĄZANIA DLA 3A Root cause (3A — fazy się nie zmieniają) NIE WPROWADZAJ ROZWIĄZANIA DLA 3A

Gdy teacher zostawia wszystkie Auto-fit włączone i nie wpisuje komentarza, Edge Function otrzymuje identyczny payload (`mode='replace'`, brak `count`/`weeksPerPhase`/`teacherComment`). Prompt jest deterministyczny, model `gemini-2.5-flash` z bardzo niską „kreatywnością" dla tego samego inputu zwraca prawie identyczny output. Soft-delete starych faz + insert nowych jest poprawny — problem jest w **identyczności wygenerowanej treści**.

### Root cause (3B/3C)

- Brak ekranu potwierdzenia przed Regenerate.
- Tytuł dialogu zawsze „Generate Learning Roadmap", przycisk „Generate roadmap" — nie różnicuje regen vs first-time.
- `GenerateRoadmapDialog` zamontowany dwukrotnie w `MacroTimeline.tsx` (linie 292 + 713) z tym samym `open={guidedDialog?.mode === 'replace'}` → React mountuje dwa identyczne portale i `onConfirm` wywołuje się dwa razy (drugi confirm idzie po `onOpenChange(false)`, więc cicho re-otwiera/zamyka).

### Solution options dla 3A NIE WPROWADZAJ ROZWIĄZANIA DLA 3A


| #   | Podejście                                                                  | Trade-off                       | Risk   |
| --- | -------------------------------------------------------------------------- | ------------------------------- | ------ |
| A   | Wymusić wpisanie komentarza w regen                                        | UX overhead                     | low    |
| B   | Dodać `regenerationAttempt` nonce do promptu + bump temperature przy regen | Zmienia tylko curriculum prompt | low    |
| C   | Detekcja „same output as before" po stronie funkcji i retry                | Skomplikowane, nieprzewidywalne | medium |


### Selected: **B** NIE WPROWADZAJ ROZWIĄZANIA DLA 3A

Bezinwazyjne, lokalne do `generate-curriculum-phases`, daje user-facing różnicę bez wymuszania input UI.

### Impact analysis

- Worksheet Generation Engine NIE jest dotknięty (curriculum-phases to osobna funkcja).
- Nie zmienia kontraktu DB.
- Pacing/deadline logic bez zmian.

### Implementation NIE WPROWADZAJ ROZWIĄZANIA DLA 3A

#### 3A — variability w `supabase/functions/generate-curriculum-phases/index.ts`

1. W bloku gdzie liczone są `existingPhases` (po `mode === 'add'/'replace'`), policzyć ile było wcześniej regen-cykli:

```ts
const { count: priorActiveOrDeleted } = await supabase
  .from('dslm_curriculum_phases')
  .select('id', { count: 'exact', head: true })
  .eq('student_id', studentId)
  .eq('teacher_id', teacherId);
const regenerationAttempt = mode === 'replace' ? (priorActiveOrDeleted || 0) : 0;
```

2. Wstrzyknąć do promptu (w sekcji `OUTPUT POLICY`):

```ts
const variabilityHint = regenerationAttempt > 0 ? `
REGENERATION CONTEXT — this is regeneration attempt #${regenerationAttempt}.
- Produce a MEANINGFULLY DIFFERENT phase structure from any previous attempt.
- Vary phase boundaries, focus areas, and sequencing of skills.
- If previous attempts emphasized vocabulary first, lead with grammar/discourse this time (and vice versa).
- Do NOT just rename phases — re-think the macro arc.
` : '';
```

i dokleić tuż przed `Return JSON`.
3. Bump temperature na regen w obu modelach (`google/gemini-2.5-flash` + fallback): `temperature: regenerationAttempt > 0 ? 0.85 : 0.45` (lub odpowiednio do API gateway — sprawdzić obecne wartości i zwiększyć o ~0.3).
4. Zapisać `regeneration_attempt: regenerationAttempt` w `generation_context` każdej nowej fazy (audit).  
  
NIE WPROWADZAJ ROZWIĄZANIA DLA 3A

#### 3B — Pre-confirm AlertDialog

W `MacroTimeline.tsx`:

1. Dodać state `const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);`.
2. Zmienić `openGuidedDialog('replace')` w toolbarze i empty-state na:

```ts
const openRegenFlow = () => {
  if (phases.length > 0) setConfirmRegenOpen(true);
  else setGuidedDialog({ mode: 'replace' });
};
```

3. Wstawić `AlertDialog`:

```tsx
<AlertDialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Regenerate Learning Roadmap?</AlertDialogTitle>
      <AlertDialogDescription>
        This replaces all <strong>planned</strong> phases with a freshly generated roadmap.
        Phases marked <strong>done</strong> or <strong>in progress</strong> are kept.
        Existing planned phases and their AI rationale will be archived (soft-deleted).
        You can steer the new roadmap with phase count, weeks, focused goals, and a teacher comment.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => { setConfirmRegenOpen(false); setGuidedDialog({ mode: 'replace' }); }}>
        Continue
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

#### 3C — Tryb regenerate w `GenerateRoadmapDialog`

Dodać prop `isRegeneration?: boolean`:

```ts
export interface GenerateRoadmapDialogProps {
  // existing ...
  isRegeneration?: boolean;
}
```

- Title: `isRegeneration ? 'Regenerate Learning Roadmap' : (mode === 'replace' ? 'Generate Learning Roadmap' : 'Add roadmap phases')`.
- Description: dla `isRegeneration` doklejić: `This will produce a NEW phase structure with deliberately different sequencing. Previous planned phases will be archived.`.
- Submit button label: `isRegeneration ? 'Regenerate roadmap' : (mode==='replace' ? 'Generate roadmap' : 'Add phases')`.

W `MacroTimeline.tsx` przekazać `isRegeneration={phases.length > 0}` w obu instancjach.

#### Fix duplikatu mount

W `MacroTimeline.tsx` jest `<GenerateRoadmapDialog ...>` w dwóch miejscach (linia 292 i 713). Zostawić tylko **jeden** instans na końcu komponentu (po `</>` wszystkich gałęzi), kontrolowany przez `guidedDialog` — usunąć ten z empty state (linia 292–301). To naprawia double-fire `onConfirm`.

### Verification

- Z istniejącą roadmapą: klik „Regenerate roadmap…" → najpierw AlertDialog ostrzegawczy → klik Continue → dialog z tytułem „Regenerate Learning Roadmap" i przyciskiem „Regenerate roadmap" → wynik: fazy faktycznie inne (inne tytuły / inne tygodnie / inne focus_areas).
- Bez fazy (empty state): klik „Generate phases" → od razu dialog z tytułem „Generate Learning Roadmap", bez AlertDialogu.
- `generation_context.regeneration_attempt` rośnie z każdą próbą.
- Tylko jedna instancja dialogu mountowana — sprawdzić w devtools że nie ma 2× DialogContent.

---

## PROBLEM 4 — `CreateHomeworkModal` zbyt duży

### Dependency scan

- `src/components/homework/CreateHomeworkModal.tsx` (jedna sekcja per `<div className="space-y-...">`)
- `src/components/ui/collapsible.tsx` (Radix Collapsible — już w projekcie)

### Root cause

Wszystkie sekcje (Student / Exercises from Worksheet / Generate Additional / Deadline / Reminder / Email) renderują się rozwinięte. Łączna wysokość przekracza viewport.

### Solution

Owinąć każdą sekcję w `<Collapsible>` z headerem (trigger), z domyślnym stanem otwartym dla pierwszej („Select Student") i resztą zamkniętą. Zachowuje ZERO zmian w logice — tylko opakowanie wizualne.

### Implementation

1. Dodać import:

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
```

2. Stworzyć lokalny helper:

```tsx
const Section: React.FC<{ id: string; title: string; defaultOpen?: boolean; summary?: string; children: React.ReactNode }> =
  ({ title, defaultOpen, summary, children }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-md">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="font-medium text-sm">{title}{summary && <span className="ml-2 text-xs text-muted-foreground">{summary}</span>}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
};
```

3. Owinąć w gałęzi „Creation form" (linia ~532) każdy istniejący block:
  - `Section id="student" title="Student" summary={selectedStudentName} defaultOpen`
  - `Section id="exercises" title="Exercises from Worksheet" summary={`${selectedExercises.size} selected`}`
  - `Section id="generate-more" title="Generate Additional Exercises" summary={`${selectedGeneratedTypes.length} types`}` (gated by `worksheetFormData`)
  - `Section id="deadline" title="Deadline" summary={deadline ? format(deadline, 'PP') : 'No deadline'}`
  - `Section id="reminder" title="Reminder" summary={sendReminder ?` ${reminderHours}h before `: 'Off'}`
  - `Section id="email" title="Email Settings" summary={includeEmail ? 'Will send' : 'Won\'t send'}` (zakładając że jest sekcja email — sprawdzić linie 895–927)
4. `DialogContent` ma już `max-h-[90vh] overflow-y-auto` — zweryfikować i dorzucić jeśli brak. (Sprawdzenie wymagane przy implementacji.)
5. Footer (przycisk „Create Homework") **pozostaje na zewnątrz** Section — zawsze widoczny.

### Verification

- Modal mieści się w viewporcie 1080p — wszystkie nagłówki sekcji + footer widoczne bez scrollu po otwarciu.
- Klik nagłówka rozwija/zwija sekcję z animacją.
- Wszystkie istniejące walidacje (max 6 typów, deadline disabled dates, reminder hours filtering) działają identycznie po rozwinięciu.
- Wybranie ucznia/ćwiczeń zaktualizowane w sumarum nagłówka.

---

## RAG INJECTION (po implementacji)

### `docs/llm-context.md` — dopisać sekcję `v6.9.42`:

```
v6.9.42 — Auto-submit hardening, retake email, roadmap regen, homework modal collapse
- WorksheetForm auto-submit now calls submitForm() directly (not requestSubmit()) to bypass HTML5 validation that silently blocked auto-generation from 1-Minute Prep.
- sendWelcomeTestEmail accepts attemptNumber; send-test-email subject + body explicitly mark retakes.
- Banner layouts (WelcomeTestSuggestion, StudentTestsTab card) refactored to stack-first: title row → URL/dates row → actions row with flex-wrap.
- generate-curriculum-phases injects regenerationAttempt counter + variability hint + bumped temperature on regen so phases differ meaningfully across replays.
- MacroTimeline: regen flow gated by AlertDialog; GenerateRoadmapDialog title/CTA adapt via isRegeneration prop; deduplicated double-mounted dialog instance.
- CreateHomeworkModal sections wrapped in Collapsible so the dialog fits 1080p viewport.
```

### `public/llms.txt` — analogiczny krótszy bullet.

### Memory file: `mem/features/onboarding/v6942-autosubmit-and-regen.md` — utworzyć z powyższymi punktami + RAG keywords.

---

## Final change report (po implementacji)

- Modified: `src/components/WorksheetForm/index.tsx`, `src/lib/welcomeTest/ensureWelcomeTest.ts`, `supabase/functions/send-test-email/index.ts`, `src/components/dashboard/WelcomeTestSuggestion.tsx`, `src/components/student-tests/StudentTestsTab.tsx`, `src/components/welcome-test/WelcomeTestActionsPanel.tsx`, `src/components/student-tests/TestDetailsView.tsx`, `src/components/dslm/MacroTimeline.tsx`, `src/components/dslm/GenerateRoadmapDialog.tsx`, `supabase/functions/generate-curriculum-phases/index.ts`, `src/components/homework/CreateHomeworkModal.tsx`, `docs/llm-context.md`, `public/llms.txt`, `mem/index.md`.
- Created: `mem/features/onboarding/v6942-autosubmit-and-regen.md`.
- Out of scope confirmed: Worksheet Generation Engine untouched; DB schema untouched; pacing logic untouched; auth untouched.