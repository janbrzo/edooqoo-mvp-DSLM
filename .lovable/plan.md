
# Plan v6.9.48 — Pełen plan wdrożenia

Cel: rozwiązać 4 powtarzające się błędy bez naruszania Worksheet Generation Engine. Każde rozwiązanie zostało wybrane tak, by zminimalizować ryzyko regresji i zostawić możliwie najmniej decyzji do podjęcia w trakcie implementacji.

---

## P1 — Auto-generate worksheet z 1-Minute Prep nie startuje

**Dependency scan:** `src/components/dslm/PathwayView.tsx` (callSuggestion), `src/pages/StudentPage.tsx` (onUseWorksheetSuggestion → sessionStorage + navigate('/')), `src/components/worksheet/FormView.tsx`, `src/components/WorksheetForm/index.tsx` (RAF gate + watchdog), `src/pages/Index.tsx` (handleGenerateWorksheet — token retry / paywall).

**Root cause:** Po `navigate('/')` `Index.tsx` najpierw montuje `FormView`, ale gdy `tokensLoading=true` i jednocześnie auto-intent jest aktywny, ścieżka retry (`__tokenRetry`) potrafi się "zgubić", bo:
- `handleGenerateWorksheet` rekursywnie woła samego siebie z nowym `data`, ale traci pole `__autoGenerateRequestId` przy każdej iteracji tylko jeśli ktoś go nie przekaże (przekazuje `...data`, OK);
- jednak RAF gate w `WorksheetForm` po `submitForm()` od razu kasuje sessionStorage (`autoGenerateWorksheet`, `autoGenerateWorksheetRequest`), więc jeśli `handleGenerateWorksheet` aborduje (np. paywall albo wczesny `return` z tokenLoading-retry), nie ma żadnego trwałego śladu intencji i nic nie spróbuje ponownie wystartować.
- Dodatkowo, gdy `WorksheetForm` jest już zamontowany i user klika "Generate ↗", efekt mounted-auto-intent działa, ale RAF gate ma deps `[lessonTopic, selectedExercises]` — jeśli `lessonTopic` był już ustawiony wcześniej (np. user wpisał coś ręcznie), efekt nie startuje ponownie po wpisaniu nowych flag do sessionStorage.

**Solution options:**

| # | Approach | Tradeoff | Risk |
|---|----------|----------|------|
| A | Nie kasować flag sessionStorage przed potwierdzeniem że `handleGenerateWorksheet` faktycznie ruszył (event `worksheet:autoGenerateStarted`). | Wymaga handshake w `Index.tsx`. | Low |
| B | Trzymać intent w refie w `WorksheetForm` i ponawiać `submitForm` co 500ms aż `isGenerating=true` z timeoutem 15s. | Łatwe, ale wymaga przekazania `isGenerating` propsem do formu (brak dziś). | Medium |
| C | Przenieść auto-start do `Index.tsx`: jeżeli `Index` widzi sessionStorage `autoGenerateWorksheet`, sam wywoła `handleGenerateWorksheet` z danymi z sessionStorage gdy tokens/profile będą gotowe — `WorksheetForm` tylko hydratuje pola. | Najbardziej deterministyczne, omija race z mountem formu. | Low–Medium |

**Selected:** **A + C** (komplementarne). Implementacja:

1. `WorksheetForm` przestaje kasować `autoGenerateWorksheet` / `autoGenerateWorksheetRequest` z sessionStorage w RAF/watchdog. Kasuje je dopiero handler `worksheet:autoGenerateStarted` (event nadawany przez `Index.tsx` w pierwszej linii `handleGenerateWorksheet` gdy `data.__autoGenerateRequestId` jest obecny i nie został jeszcze potwierdzony).
2. `Index.tsx` dostaje nowy `useEffect` (mount‐only) który:
   - czyta `autoGenerateWorksheet` + `autoGenerateWorksheetRequest` + `prefillWorksheet` + `prefillExercises` + `prefillExerciseFocusMap` + `prefillMediaTypes` z sessionStorage,
   - jeśli intent istnieje i `isRegisteredUser`, czeka w pętli `setInterval(200ms, max 60×)` aż `tokensLoading===false`, następnie buduje payload identyczny jak `WorksheetForm.submitForm` (wykorzystując pomocnik `buildAutoGeneratePayload` w nowym pliku `src/lib/worksheet/autoGenerateBootstrap.ts`) i jednorazowo wywołuje `handleGenerateWorksheet(payload)`.
   - po wystartowaniu emituje `window.dispatchEvent(new CustomEvent('worksheet:autoGenerateStarted', { detail: { requestId }}))` → `WorksheetForm` (jeśli zamontowany) blokuje swój własny duplikat i kasuje sessionStorage.
3. `WorksheetForm` RAF gate nadal działa jako fallback dla case gdy form już był zamontowany przed navigate (ten sam event chroni przed podwójnym submitem).
4. Dodać `devLog('[Index v6.9.48] auto-bootstrap fired', payload)` do diagnostyki.

**Impact:** Zero zmian wizualnych, tylko warstwa orchestration. Manual submit niezmieniony (nie ma `__autoGenerateRequestId` → handshake skip). Zero regresji confirmed: handleGenerateWorksheet podpis bez zmian, FormData kształt bez zmian.

**Pliki:**
- `src/pages/Index.tsx` (+ mount effect, + handshake event dispatch)
- `src/components/WorksheetForm/index.tsx` (usunąć kasowanie flag, dodać listener `worksheet:autoGenerateStarted` który kasuje flagi i ustawia `autoSubmitFiredRef.current=true`)
- nowy: `src/lib/worksheet/autoGenerateBootstrap.ts` — czysta funkcja `readAutoGeneratePayload(): FormData | null`

**Verification checklist:**
- [ ] Klik "Generate worksheet ↗" w 1-Minute Prep → navigate('/') → po ≤2s generation modal startuje, bez ręcznego kliknięcia
- [ ] Ręczny submit działa identycznie (brak intencji = brak bootstrap)
- [ ] Po teardown intencji sessionStorage czyste
- [ ] Brak podwójnego startu generacji (handshake)

---

## P2 — Welcome Test nie mieści się pionowo z włączonym tłumaczeniem

**Dependency scan:** `src/pages/WelcomeTestPage.tsx`, komponenty pytań w `src/components/welcome-test/` (`RadioGroup`, opcje), header testu.

**Root cause:** Aktualny `max-w-lg` z v6.9.47 jest za wąski (treści owijają się na 3 linie zwiększając wysokość); dodatkowo padding pionowy opcji (`py-3` ~12px na każdą stronę) + duże gapy między sekcjami.

**Selected:**
- Container `max-w-2xl` (szerszy o ~33% niż `lg`, daje miejsce na tłumaczenie pod tekstem opcji).
- Skala pionowa −20% przez nadpisanie spacingów: header `space-y-2` → `space-y-1.5`, options gap `space-y-3` → `space-y-2`, padding opcji `py-3` → `py-2.5`, font opcji `text-base` → `text-[15px]`, blok tłumaczenia `text-sm` → `text-[13px]`, footer padding `py-4` → `py-3`. Tytuł `text-xl` → `text-lg` na desktopie ≥md.
- Dodatkowo: wartość kontenera `px-4 md:px-6` zamiast `px-6` aby zmniejszyć marginesy boczne na średnich szerokościach.

**Impact:** Tylko CSS / Tailwind classes w `WelcomeTestPage.tsx`. Mobile nadal `max-w-full`. Brak zmian w logice testu.

**Pliki:** `src/pages/WelcomeTestPage.tsx`

**Verification:** screenshot Welcome Testu z tłumaczeniem niemieckim — pytanie + 5 opcji + footer mieszczą się w viewport 768×900 bez scrolla.

---

## P3 — Welcome Test (3A, 3B, 3C)

### 3A. Brak "Suggested level change"

**Dependency scan:** `supabase/functions/process-welcome-test/index.ts` (auto-fill `english_level` only when missing), `src/components/student-tests/TestDetailsView.tsx`, `src/components/dslm/PathwayView.tsx`.

**Root cause:** Edge function aktualizuje `students.english_level` tylko gdy puste. Student miał C1, test wyszedł A1 → różnica nigdy nie pokazywana w UI.

**Selected:** Stworzyć **nieinwazyjny banner** w `TestDetailsView` (oraz w skrócie w `PathwayView` "Welcome Test completed"), bez automatycznej zmiany levelu. Logika:
1. `process-welcome-test`: zawsze zapisywać `estimatedLevel` w `student_learning_profiles.estimated_level` (już robi); dodatkowo, jeśli `currentLevel !== estimatedLevel` ORAZ student level już ustawiony, zapisywać do `student_learning_profiles.raw_answers.level_change_suggestion = { current, estimated, created_at }`.
2. `TestDetailsView`: jeśli profile zawiera `level_change_suggestion` (lub `estimated_level !== student.english_level`), pokazać kartę:
   ```
   Suggested level change: C1 → A1
   Welcome Test results indicate a different CEFR level than the one set on the student profile.
   [Apply A1] [Keep C1]
   ```
   Buttony: Apply wywołuje `updateStudent({ english_level: estimated })`; Keep ustawia flag `dismissed_level_change_test_id` w sessionStorage (per-test) by ukryć banner.
3. Nie zmieniać auto-apply logiki dla brakującego levelu (zachowanie wstecz kompatybilne).

**Impact:** Dodatkowy banner widoczny tylko gdy levele się różnią. Brak nadpisywania bez zgody nauczyciela.

**Pliki:**
- `supabase/functions/process-welcome-test/index.ts` (zapis `level_change_suggestion`)
- `src/components/student-tests/TestDetailsView.tsx` (banner + akcje)
- `src/components/student-tests/WelcomeTestResults.tsx` (przekazanie estymowanego levelu jeżeli pobierane lokalnie)

### 3B. "Auto-apply did not complete" na starym teście

**Root cause:** Test ukończony przed deployem v6.9.40 P3 (kolumna `test_id` zamiast `student_test_id`) — status nigdy nie poszedł do `reviewed`, ale ratings nie zostały zaaplikowane.

**Selected:** Rozszerzyć przycisk "Apply to Progress" w `TestDetailsView.handleApplyResults` aby wywoływał **`process-welcome-test`** edge function ponownie (re-run analizy), zamiast tylko aplikować ratings z bieżącego state-u. Wariant: nowy parametr `forceReprocess: true` w funkcji, który omija dedupe i wymusza ponowny przebieg auto-apply + poziom + suggestions. Jeśli udane → przeładowanie i banner znika sam.

Aktualnie `handleApplyResults` aplikuje ratings client-side. Zostawić client-side fallback ALE dodać wcześniejszą próbę re-run edge functionu. Pseudokod:
```ts
const { data, error } = await supabase.functions.invoke('process-welcome-test', { body: { test_id: testId, force: true } });
if (!error) { /* refresh + return */ }
// fallback to existing client-side path
```

**Pliki:**
- `supabase/functions/process-welcome-test/index.ts` (akceptować `force: boolean`, omijać guard "already reviewed" gdy force=true)
- `src/components/student-tests/TestDetailsView.tsx` (handleApplyResults nowa logika)

### 3C. Zmiana imienia studenta nie odświeża tytułu testu

**Dependency scan:** `useWelcomeTestActions.ts` (tworzenie title = `Welcome Test - ${studentName}` przy ensure()), `student_tests.title` (snapshot), `useWelcomeTest.tsx` (publiczna strona testu), `TestDetailsView` (heading), `WelcomeTestPage` (header).

**Root cause:** `student_tests.title` to snapshot w momencie tworzenia. Przy renamingu studenta tytuł nie jest aktualizowany.

**Selected:** Renderować tytuł dynamicznie z aktualnego student name we wszystkich widokach, nie z `test.title`. Schemat:
- W komponentach (teacher side) zamiast `{test.title}` używać `Welcome Test - {student.name}{attemptSuffix}` (student name dostępne w props/contextcie). Trzymać `test.title` w DB dla legacy, ale wyświetlać computed.
- Dla strony publicznej `/welcome-test/:token` (student side bez authy), `useWelcomeTest` fetch testu rozszerzyć o join `students(name)` (RLS już pozwala via share token na odczyt testu; dodać RPC `get_welcome_test_meta(token)` zwracającą `{ title_components: { studentName, attemptNumber } }`). Najmniej inwazyjna ścieżka: rozszerzyć istniejący `loadTestByShareToken`/equivalent o dołączenie `students!inner(name)` jeśli RLS pozwala — sprawdzić tabelę. Jeśli nie pozwala (anon), użyć security-definer funkcji `public.get_test_share_meta(p_token uuid)`.

**Decision:** zrobić dedicated **security-definer RPC** `public.get_welcome_test_share_meta(p_token text)` returning `{ student_name text, attempt_number int }`. To zachowuje RLS i jest bezpieczne.

**Pliki:**
- nowa migration: funkcja RPC `get_welcome_test_share_meta` (security definer, `grant execute to anon, authenticated`)
- `src/hooks/useWelcomeTest.tsx` — po loadzie testu wołać RPC, używać `studentName` do nagłówka zamiast `test.title`
- `src/pages/WelcomeTestPage.tsx` — header czyta dynamiczne `studentName`
- `src/components/student-tests/TestDetailsView.tsx` — heading komponowany z `student.name`
- `src/components/student-tests/StudentTestsTab.tsx` — etykiety kart liczone z `student.name`

---

## P4 — "Suggested: 6 (one per week of 10-week phase)" oraz zły defaultTargetPhaseId

### 4A. Tekst „one per week of N-week phase" jest nielogiczny gdy clamp limit 6 < weeks

**Dependency scan:** `src/components/dslm/MacroTimeline.tsx` (lines 446-457, helper `recommendedStepsForPhase`), `src/components/dslm/GenerateStepsDialog.tsx` (helperText), `src/components/dslm/PathwayView.tsx`.

**Root cause:** `recommendedStepsForPhase` clampuje do max 6. Etykieta zakłada 1 step/week, więc dla fazy 10-tygodniowej mówi "6 (one per week of 10-week phase)" — niespójne.

**Selected:** Zmodyfikować helper text aby był prawdziwy:
- Gdy `weeks <= 6`: `Suggested: ${rec} (one per week of ${w}-week phase).`
- Gdy `weeks > 6`: `Suggested: 6 per batch (phase is ${w} weeks, max 6 per generation — repeat to fill).`
- Gdy brak weeks: `Suggested: 3 (set phase weeks for a smarter default).`

Identyczna logika w `GenerateStepsDialog.helperText` (już ma "Already at recommended count" — wyciągnąć weeks/phase i dodać tę samą gałąź).

**Pliki:** `src/components/dslm/MacroTimeline.tsx`, `src/components/dslm/GenerateStepsDialog.tsx`.

### 4B. „Add more 1-Minute Prep suggestions" proponuje fazę 2 mimo niedopełnionej fazy 1

**Dependency scan:** `PathwayView.recommendedTargetPhaseId` (lines 263-271). Pętla iteruje `[...inProgress, ...planned]` i bierze pierwszy z `have < need`.

**Root cause:** `recommendedStepsForPhase` zwraca max 6 (clamp). Faza 1 ma 6/6 → warunek `have < need` falszywy → leci do fazy 2. Tymczasem rzeczywista długość fazy = 10 weeks, czyli docelowo powinno być 10 stepów, nie 6 (limit per-batch).

**Selected:** Rozdzielić dwa pojęcia:
- `recommendedStepsPerBatch(phase)` — clamp 1–6 (jak dziś, używane do default count w inputie).
- nowy `targetStepsForPhase(phase)` — pełna liczba = `weeks` (bez clampu, min 1). Używane przez `recommendedTargetPhaseId` do porównania `have < target`.

Zmiana:
- `PathwayView.phaseOptions`: `need: targetStepsForPhase(p)` (pełny target), dodatkowe pole `perBatch: recommendedStepsPerBatch(p)` w `PhaseOption`.
- `GenerateStepsDialog`: initial `count = min(6, max(1, target - have))` (już prawidłowe), helperText updated do dwóch wariantów (P4A).
- `MacroTimeline` per-phase quick-add: input default = `min(6, max(1, target - have))` zamiast `recommendedStepsForPhase`. Helper text P4A.

**Impact:** Faza nadal generuje max 6 na batch, ale rekomendacja kolejnej fazy nie przeskakuje przedwcześnie. Brak regresji w istniejących fazach z weeks ≤6 (target === recommendedStepsPerBatch).

**Pliki:**
- `src/components/dslm/MacroTimeline.tsx` (export `targetStepsForPhase`, `recommendedStepsPerBatch`; refaktor `recommendedStepsForPhase` jako alias `recommendedStepsPerBatch`)
- `src/components/dslm/PathwayView.tsx` (użyć `targetStepsForPhase` w `phaseOptions.need`)
- `src/components/dslm/GenerateStepsDialog.tsx` (helperText z nowymi gałęziami; clamp 6 nadal)
- `src/components/dslm/NextStepsSection.tsx` (typ `PhaseOption` jeśli importowany — dodać `perBatch?: number` jako optional, brak breakage)

**Verification:**
- [ ] Faza 1 (10w, have=6) → "Add more" otwiera dialog z domyślną fazą = "Phase 1" (recommended), count = 4 (10-6 capped to 6 → 4); helper "Phase has 6/10 steps. Recommended add: 4."
- [ ] Faza 1 (10w, have=10) → recommended phase = Phase 2 (planned).
- [ ] Per-phase quick-add input dla fazy 10w: default = `min(6, 10-have)`; tekst "Suggested: 6 per batch (phase is 10 weeks, max 6 per generation — repeat to fill)." gdy weeks>6.

---

## RAG injection update

Po implementacji zaktualizować:
- `docs/llm-context.md`: dodać sekcję "v6.9.48 — Auto-generate handshake bootstrap; Welcome Test compact width; level-change suggestion banner; force-reprocess auto-apply; dynamic student name in test headers; per-phase target vs per-batch steps."
- `public/llms.txt`: skondensowany odpowiednik (PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS).
- `mem/index.md` + nowy `mem/features/onboarding/v6948-auto-bootstrap-wt-compact-level-suggestion-phase-target.md`.

---

## Final change report (po implementacji)

Files modified (przewidziane):
- src/pages/Index.tsx
- src/components/WorksheetForm/index.tsx
- src/lib/worksheet/autoGenerateBootstrap.ts (new)
- src/pages/WelcomeTestPage.tsx
- src/hooks/useWelcomeTest.tsx
- src/components/student-tests/TestDetailsView.tsx
- src/components/student-tests/WelcomeTestResults.tsx
- src/components/student-tests/StudentTestsTab.tsx
- src/components/dslm/MacroTimeline.tsx
- src/components/dslm/PathwayView.tsx
- src/components/dslm/GenerateStepsDialog.tsx
- src/components/dslm/NextStepsSection.tsx (typ)
- supabase/functions/process-welcome-test/index.ts (+ `force`, + `level_change_suggestion`)
- supabase/migrations/<ts>_get_welcome_test_share_meta.sql (new RPC, security definer + grants)
- docs/llm-context.md, public/llms.txt, mem/index.md, mem/features/onboarding/v6948-*.md

Zero zmian w Worksheet Generation Engine. Zero zmian w schemacie student_tests (tylko nowy RPC, nowa kolumna w JSON `raw_answers`).

Verification: po implementacji uruchomię ręcznie scenariusze 1–4 + walidację per-file diff.
