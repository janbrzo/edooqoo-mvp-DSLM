# Plan v6.9.45 — naprawa dwóch regresji produkcyjnych

## Problem 1 — `Generate worksheet ↗` przechodzi na generator, ale nie startuje generowania

### Dependency scan
Affected surface:
- `src/components/dslm/NextStepBanner.tsx` i `src/components/dslm/CompactSuggestionCard.tsx` — źródłowe przyciski `Generate worksheet ↗` / auto-start.
- `src/components/dslm/PathwayView.tsx` — przekazuje sugestię jako `autoGenerate=true`.
- `src/pages/StudentPage.tsx` — zapisuje `prefillWorksheet`, `prefillExercises`, `prefillExerciseFocusMap`, `prefillMediaTypes`, `prefillSuggestionId`, `autoGenerateWorksheet`, `autoGenerateWorksheetRequest`, `forceNewWorksheet`, potem robi `navigate('/')`.
- `src/pages/Index.tsx` — odbiera pre-selected student, obsługuje token gating i wywołuje `generateWorksheetHandler`.
- `src/components/worksheet/FormView.tsx` — przekazuje `preSelectedStudent` i `onSubmit` do formularza.
- `src/components/WorksheetForm/index.tsx` — synchronizuje prefill, odpala `submitForm()`, czyści flagi auto-generate.
- `src/hooks/useWorksheetGeneration.tsx` — faktycznie uruchamia streaming `generateWorksheet` i obecnie używa `studentId` z hooka/parenta zamiast zawsze preferować `data.studentId`.
- `src/services/worksheetStreamService.ts` — bez zmian; działa dopiero po wywołaniu generatora.
- `src/hooks/useWorksheetFormPersistence.ts` — bez zmian; już nie nadpisuje DSLM prefill.
- `src/hooks/useTokenSystem.tsx` — bez zmian; problem polega na tym, że jego `tokensLoading` może być jeszcze `true`, gdy auto-submit już raz wystrzeli.

### Root cause
Root cause: auto-submit jest jednorazowy i odpala z poziomu `WorksheetForm`, zanim parent `Index.tsx` ma zakończony token/profile readiness albo zanim parentowy `selectedStudentId` zdąży się zsynchronizować; `Index.tsx` potrafi wtedy po 2 krótkich retry po cichu porzucić request, a `useWorksheetGeneration` nie preferuje `data.studentId` z samego formularza.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Dodać większy `setTimeout` w `WorksheetForm` przed `submitForm()` | Szybkie, ale dalej zależne od czasu ładowania tokenów i auth; znowu wróci przy wolniejszej sesji | Medium |
| B | Oznaczyć request jako auto-generate, a w `Index.tsx` retry’ować auto-submit aż `tokensLoading=false`; w `useWorksheetGeneration` preferować `data.studentId` nad parentowym `studentId` | Rozwiązuje strukturalnie gotowość parenta i race ze studentem bez zmiany Worksheet Generation Engine | Low |
| C | Przenieść całą logikę auto-submit z `WorksheetForm` do `Index.tsx` | Najczystsze architektonicznie, ale większy refactor i większy surface regresji w publicznym generatorze | Medium/High |

### Selected solution + why
Wybieram opcję B, bo naprawia warunek, który realnie powoduje ciszę: parent dropuje request zanim jest gotowy. Nie ruszamy promptu ani pipeline’u worksheet generation; dokładamy tylko niezawodne przekazanie intencji auto-generate i deterministyczne oczekiwanie na token readiness.

### Impact analysis
Zmiana dotyka wyłącznie ścieżki `Generate worksheet ↗` z 1-Minute Prep oraz defensywnie poprawia użycie `studentId` przy każdym generowaniu.

Zero regressions confirmed:
- Ręczne kliknięcie `Generate Custom Worksheet` zachowa obecny limit 2 retry przy `tokensLoading`.
- Manualny generator bez studenta nadal działa jako unassigned.
- `prefillSuggestionId` nadal zostanie oznaczony jako used dopiero po `worksheetGenerationSuccess`.
- `forceNewWorksheet` nadal czyści poprzedni worksheet.
- Worksheet Generation Engine, prompt, `generateWorksheet` Edge Function, media generation, token consumption i RLS pozostają nietknięte.

### Full implementation
1. `src/components/WorksheetForm/types.ts`
   - Dodać wewnętrzne, opcjonalne pola do `FormData`:
     - `__autoGenerateFromSuggestion?: boolean`
     - `__tokenRetry?: number`
   - To jest tylko transport UI metadata; nie trafi do promptu.

2. `src/components/WorksheetForm/index.tsx`
   - W `submitForm()` dodać do `formData`:
     - `__autoGenerateFromSuggestion: Boolean(initialAutoIntentRef.current)`
   - Zostawić obecny direct `submitForm(topic)` i `noValidate`; nie wracać do `requestSubmit()`.
   - Zostawić auto-complete ćwiczeń bez wymogu `selectedExercises.length > 0`.

3. `src/pages/Index.tsx`
   - W `handleGenerateWorksheet(data)` rozpoznać:
     - `const isAutoGenerateFromSuggestion = (data as any).__autoGenerateFromSuggestion === true;`
   - Jeśli `isRegisteredUser && tokensLoading`:
     - dla auto-generate: retry co 300 ms do ok. 12 s (`40` prób), bez toastu i bez porzucenia po 2 próbach;
     - dla ręcznego submitu: zostawić obecne zachowanie 2 retry, żeby nie zmieniać UX ręczny.
   - Po `tokensLoading=false` kontynuować ten sam `data` bez proszenia użytkownika o drugi klik.

4. `src/hooks/useWorksheetGeneration.tsx`
   - Na początku `generateWorksheetHandler(data)` wyliczyć:
     - `const effectiveStudentId = data.studentId || studentId || null;`
   - Zastąpić użycia hookowego `studentId` w generation payload i eventach tym `effectiveStudentId`:
     - log `studentId`
     - body do `streamWorksheetGeneration({ ..., studentId: effectiveStudentId })`
     - końcowe `studentUpdated`
   - Dzięki temu nawet jeśli parent jeszcze nie zsynchronizował state, request generuje worksheet dla poprawnego studenta z prefill.

### Verification checklist
- DONE po implementacji: klik `Generate worksheet ↗` zapisuje auto metadata w `FormData`.
- DONE po implementacji: auto-submit nie jest porzucany, gdy `tokensLoading` trwa dłużej niż 750 ms.
- DONE po implementacji: generation payload używa `data.studentId` z DSLM prefill.
- DONE po implementacji: manualne generowanie ma poprzedni limit retry i nie dostaje nowej pętli 12 s.
- DONE po implementacji: brak zmian w Worksheet Generation Engine.

---

## Problem 2 — `Regenerate Learning Roadmap` nadal zmienia fazy `in_progress` i kasuje ich next steps

### Dependency scan
Affected surface:
- `src/components/dslm/MacroTimeline.tsx` — UI potwierdzenia i `GenerateRoadmapDialog` dla `replace`.
- `src/components/dslm/GenerateRoadmapDialog.tsx` — copy obiecuje zachowanie `done` i `in_progress`.
- `src/hooks/dslm/useCurriculumPhases.tsx` — wywołuje `generate-curriculum-phases`, refetchuje fazy, emituje `dslm:phasesUpdated`.
- `supabase/functions/generate-curriculum-phases/index.ts` — jedyne miejsce, które soft-delete’uje/insertuje roadmap phases w trybie `replace`.
- `src/hooks/useFutureTimeline.tsx` — pokazuje `future_worksheet_suggestions`; jeśli zachowamy dokładny `phase.id`, istniejące next steps zostają przy fazie automatycznie.
- `public.future_worksheet_suggestions` — nie wymaga migracji; sugestie mają `phase_id`, więc zachowanie phase row ID zachowuje powiązania.
- Database triggers checked: tylko `updated_at` triggers na `dslm_curriculum_phases` i `future_worksheet_suggestions`; brak triggera kasującego sugestie.

### Root cause
Root cause: poprzednia naprawa była za słaba, bo preservation było tylko intencją/promptem i częściową filtracją, bez twardego serwerowego invariant check; jeśli `replace` wygeneruje nowe fazy od początku albo stara wersja funkcji działa w runtime, stare `in_progress` phase IDs znikają, więc sugestie przypięte do tych IDs przestają być widoczne.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Poprawić tylko prompt/copy w dialogu | Nie rozwiązuje danych; AI może nadal zwrócić nakładające się fazy | High |
| B | Serwerowo snapshotować kept phases, soft-delete’ować wyłącznie `planned/draft`, wymuszać nowe fazy jako `planned` po ostatnim kept week/sequence, a po zapisie weryfikować, że kept IDs nadal istnieją i nie są soft-deleted | Naprawa strukturalna; zachowuje IDs i `future_worksheet_suggestions.phase_id` | Low |
| C | Dodać nowy tryb `regenerate_planned_only` i zostawić `replace` bez zmian | Czytelne, ale wymaga większej zmiany klient/backend i ryzykuje stare call-site’y | Medium |

### Selected solution + why
Wybieram opcję B. Najważniejsze nie jest, żeby AI „pamiętało” fazy, tylko żeby backend fizycznie nie miał prawa usunąć ani nadpisać rekordów `done`/`in_progress`; wtedy next steps zostają, bo `phase_id` nadal wskazuje na ten sam rekord.

### Impact analysis
Zmiana dotyczy wyłącznie `mode='replace'` w `generate-curriculum-phases`. Tryb `add` ma działać jak dotąd.

Zero regressions confirmed:
- Fazy `done` i `in_progress` zachowują dokładne `id`, `title`, `description`, `rationale`, `focus_areas`, weeks, status i powiązane sugestie.
- Regenerowane są tylko fazy `planned` i `draft`.
- Nowe fazy nie dostaną statusu `in_progress`, jeżeli istnieje już kept `in_progress`; będą `planned`.
- `future_worksheet_suggestions` nie są soft-delete’owane, nie są odpinane, nie są przenoszone.
- Manualne `deletePhase()` dalej odpina sugestie tylko przy ręcznym usunięciu fazy — poza zakresem tej regeneracji.
- Brak migracji, brak RLS zmian.

### Full implementation
1. `supabase/functions/generate-curriculum-phases/index.ts`
   - Wzmocnić istniejący `KEPT_STATUSES = ['done', 'in_progress']` o jawne helpery:
     - `isKeptPhase(status)`
     - `keptPhaseIds`
     - `replaceablePhaseIds` tylko `planned/draft`.
   - Dla `mode === 'replace'`:
     - `keptPhases = existingPhases.filter(isKeptPhase)`
     - `replaceablePhases = existingPhases.filter(!isKeptPhase)`
     - `keptWeeksConsumed = max(estimated_weeks_end)` z kept phases.
     - `remainingMaxSeq = max(sequence_number)` z kept phases.
   - Soft-delete wykonać tylko na `replaceablePhaseIds` i dodatkowo scope’ować update po `student_id` oraz `teacher_id`:
     - `.eq('student_id', studentId).eq('teacher_id', teacherId).in('id', replaceablePhaseIds)`
   - Po sanitize/fit, przed insert:
     - jeśli `mode === 'replace' && keptPhases.length > 0`, wymusić `status: 'planned'` na każdej nowej fazie; nie wolno tworzyć drugiej `in_progress` fazy.
     - zachować `estimated_weeks_start` po `keptWeeksConsumed + 1` przez `fitPhasesToDeadline(phases, remainingBudget, startWeek)` albo analogiczną rebazę z offsetem.
   - Dodać post-write invariant:
     - po soft-delete + insert zrobić select `id,status,deleted_at,title,description` dla `keptPhaseIds`.
     - jeśli liczba lub `deleted_at` nie zgadza się: log error i zwrócić 500 z `preservationInvariantFailed: true`.
     - W normalnym flow zwrócić `generationContext.kept_phase_ids`, `generationContext.replaceable_phase_ids`, `generationContext.preserved_phase_count`.
   - Nie dotykać `future_worksheet_suggestions`.
   - Nie dotykać Worksheet Generation Engine.

2. `src/components/dslm/GenerateRoadmapDialog.tsx`
   - Doprecyzować opis regeneracji, żeby był zgodny z mechaniką:
     - `This regenerates only planned/draft phases. Done and in-progress phases keep their exact records and worksheet suggestions.`
   - CTA zostaje `Regenerate roadmap`.

3. `src/components/dslm/MacroTimeline.tsx`
   - Doprecyzować AlertDialog:
     - `Existing suggestions inside done/in-progress phases are kept because those phase records are not replaced.`
   - Bez zmiany layoutu.

4. `src/hooks/dslm/useCurriculumPhases.tsx`
   - Po sukcesie toast może zostać `Generated N curriculum phases`, ale jeśli `generationContext.preserved_phase_count > 0`, tekst może doprecyzować:
     - `Regenerated planned phases; kept X active/completed phase(s).`
   - To jest tylko feedback; nie zmienia logiki.

### Verification checklist
- DONE po implementacji: `replace` soft-delete’uje tylko `planned/draft`, nigdy `done/in_progress`.
- DONE po implementacji: zachowane fazy mają te same IDs po regeneracji.
- DONE po implementacji: suggestions w pierwszej fazie nie znikają, bo `future_worksheet_suggestions.phase_id` zostaje zgodny z zachowanym phase ID.
- DONE po implementacji: nowe fazy po kept phases są `planned` i zaczynają się po ostatnim kept week/sequence.
- DONE po implementacji: backend zwraca preservation metadata do audytu.
- DONE po implementacji: UI copy nie obiecuje już ogólnie „fresh phase structure” dla wszystkiego, tylko precyzyjnie „planned/draft only”.

---

## RAG injection update dla obu problemów

Po implementacji zaktualizuję:

1. `docs/llm-context.md`
   - Dodać sekcję `v6.9.45 — 1-Minute Prep auto-submit queue and hard roadmap preservation`.
   - Format wymagany przez operating system:
     - `PROBLEM:` auto-submit drop przy `tokensLoading` + roadmap replace usuwał `in_progress` IDs/suggestions.
     - `EDOOQOO SOLUTION:` auto request metadata + retry until token readiness + `data.studentId` precedence; hard backend preservation invariant for `done/in_progress` roadmap phases.
     - `TECHNICAL MECHANICS:` konkretne komponenty/hooki/funkcja.
     - `RAG KEYWORDS:` min. 15 terminów semantycznych.

2. `public/llms.txt`
   - Dodać zwięzły production-only wpis w mapie/technical facts:
     - auto-start z 1-Minute Prep jest readiness-aware;
     - roadmap regeneration preserves exact done/in-progress phase records and their attached suggestions.

3. Memory
   - Dodać memory `mem/features/onboarding/v6945-autosubmit-queue-roadmap-preservation.md`.
   - Zaktualizować `mem/index.md` o krótki wpis.

---

## Final change report — po implementacji
Raport końcowy będzie zawierał:
- Summary of what was implemented.
- Files modified.
- Documentation updated: YES/NO.
- Out of scope issues flagged.
- Verification result: PASS/FAIL.

Out of scope issues noted:
- W kodzie są stare wpisy RAG z v6.9.35–v6.9.44 opisujące poprzednie próby auto-submit; po v6.9.45 nie będę ich przepisywał masowo, tylko dopiszę aktualny, nadrzędny wpis, żeby nie robić niepotrzebnego refactoru dokumentacji.
- Nie będę zmieniał promptu ani mechaniki generowania worksheetów — problem dotyczy wyłącznie startu flow, nie jakości materiału.