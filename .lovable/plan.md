# Plan v6.9.41 — naprawa 1‑Minute Prep, Welcome Test retake, Goals i Guided Roadmap

Przeczytane przed planem: `docs/llm-context.md`, `public/llms.txt`. Błędy z konsoli `contentscript.js`, `ObjectMultiplex`, `postMessage` i `__l5e/trackevents 403` wyglądają na rozszerzenie przeglądarki / telemetrię Lovable preview, nie na źródło awarii auto-submit. W aplikacji nie ma świeżych logów `WorksheetForm`.

## P1 — `Generate worksheet ↗` w 1‑Minute Prep nie startuje generowania

**Dependency scan:**
- `src/components/dslm/NextStepBanner.tsx` — przycisk wywołuje `onUseAndGenerate(suggestion)`.
- `src/components/dslm/PathwayView.tsx` — przekazuje `autoGenerate=true`.
- `src/pages/StudentPage.tsx` — zapisuje `prefillWorksheet`, `prefillExercises`, `prefillExerciseFocusMap`, `prefillMediaTypes`, `autoGenerateWorksheet`, `autoGenerateWorksheetRequest`, `forceNewWorksheet`, potem `navigate('/')`.
- `src/pages/Index.tsx` — `useWorksheetState` czyści storage przy `forceNewWorksheet`, montuje `FormView`.
- `src/components/WorksheetForm/index.tsx` — czyta prefill i ma readiness gate `requestSubmit()`.
- `src/hooks/useWorksheetState.tsx` — usuwa tylko worksheet state, nie usuwa prefill/autoGenerate.

**Root cause:** Formularz czyta `lessonTopic` synchronicznie, ale `selectedExercises` i część DSLM prefill nadal są hydratowane po mount; readiness gate może odpalić z domyślnym/starym stanem albo watchdog usuwa flagę zanim formularz jest w pełni gotowy.

**Opcje:**
| Opcja | Podejście | Tradeoff | Ryzyko regresji |
|---|---|---|---|
| A | Wzmocnić `WorksheetForm`: synchroniczny initial state dla topic/exercises/focus/media/student + auto-submit po kompletnej hydratacji | Najmniejsza zmiana, utrzymuje istniejący flow | Low |
| B | Zastąpić sessionStorage route state / URL state | Czystsze architektonicznie, ale dotyka wielu przepływów | Medium |
| C | Generować bezpośrednio ze StudentPage, bez przejścia przez formularz | Omija UI, ale ryzykuje tokeny, paywall i form validation | High |

**Selected solution + why:** Opcja A. Naprawia faktyczną race condition bez ruszania Worksheet Generation Engine i bez przebudowy nawigacji.

**Full implementation:**
1. W `WorksheetForm/index.tsx` dodać bezpieczne helpery `readPrefillExercises`, `readPrefillFocusMap`, `readPrefillMediaTypes` i użyć ich w lazy initial state dla `selectedExercises`, `selectedMediaTypes`, `exerciseFocusMap`, `selectionMode`.
2. Dodać `autoPrefillHydratedRef`, które zostaje ustawione po pierwszym przetworzeniu sessionStorage prefill.
3. Zmienić readiness gate tak, aby przy `initialAutoIntentRef.current` wymagał:
   - niepusty `lessonTopic`,
   - `selectedStudentId === request.studentId`,
   - `selectedExercises.length > 0`,
   - `formRef.current`,
   - brak `isGenerating` po stronie parent nie jest tu potrzebny, bo parent już blokuje duplikaty.
4. Watchdog zamiast usuwać flagę po 1500 ms ma zrobić jeden deterministyczny fallback: ponownie odczytać `prefillWorksheet` i `prefillExercises` z sessionStorage, uzupełnić stan i dopiero po kolejnych 1500 ms usunąć flagi, jeśli nadal brak minimalnych danych.
5. Po successful `requestSubmit()` usuwać tylko `autoGenerateWorksheet` i `autoGenerateWorksheetRequest`; `prefill*` zostanie usunięty przez istniejący prefill effect.

**Impact analysis:**
- Nie rusza promptu ani `generateWorksheet` Edge Function.
- Manual “Use this” dalej tylko wypełnia formularz.
- Anonymous generator i ręczne submitowanie bez zmian.
- Zero regressions confirmed: token paywall, draft persistence, preSelectedStudent, exercise normalization, markPresetUsed.

**Verification:**
- Klik `Generate worksheet ↗` → `/` → formularz uzupełniony → `GeneratingModal` otwarty bez dodatkowego kliknięcia: DONE.
- Klik `Use this` → formularz uzupełniony, ale nie generuje: DONE.
- Brak pustego topic submit: DONE.

---

## P2 — po Add Student + automatic send Welcome Test modal Add learning goals nie otwiera się

**Dependency scan:**
- `src/components/dashboard/AddStudentDialog.tsx` — nawiguje do `?tab=dslm&view=goals&focus=add-goal-modal&_=${ts}`.
- `src/pages/StudentPage.tsx` — `activeTab` z URL, renderuje DSLM.
- `src/components/dslm/DSLMTab.tsx` — obsługuje `focus=add-goal-modal`, ustawia `pendingAddGoal`.
- `src/components/dslm/LazySection.tsx` — opóźnia mount Goals.
- `src/components/dslm/GoalsView.tsx` — `pendingAddGoal` otwiera Dialog.

**Root cause:** `DSLMTab` czyści `focus` w tym samym cyklu, w którym dopiero przewija i eager-mountuje Goals; `pendingAddGoal` może zostać skonsumowane zanim `GoalsView` jest stabilnie zamontowany.

**Opcje:**
| Opcja | Podejście | Tradeoff | Ryzyko |
|---|---|---|---|
| A | Dodać trwały event `dslm:addGoal` po scrollu i po mount, zamiast polegać tylko na prop `pendingAddGoal` | Minimalne, zgodne z istniejącym eventem | Low |
| B | Usunąć LazySection dla Goals | Proste, ale pogarsza performance | Medium |
| C | Przenieść modal Add Goal do DSLMTab | Większy refactor Goals state | Medium/High |

**Selected solution + why:** Opcja A. Wykorzystuje istniejący kontrakt `dslm:addGoal` i nie niszczy lazy loadingu.

**Full implementation:**
1. W `DSLMTab.tsx` przy `focus=add-goal-modal`:
   - natychmiast `setPendingAddGoal(true)`,
   - `handleScrollTo('goals')`,
   - po `requestAnimationFrame + setTimeout(150)` wysłać `window.dispatchEvent(new CustomEvent('dslm:addGoal', { detail: { studentId, source: 'focus-param' } }))`,
   - dopiero potem usunąć `focus` i `_` z URL.
2. W `GoalsView.tsx` dodać lokalny listener `dslm:addGoal`, który dla zgodnego `studentId` ustawia `newGoal.type='supporting'` i `showAddGoal(true)`. To będzie drugi, odporny kanał otwierania modala.
3. Zachować obecny `pendingAddGoal` jako szybki path.

**Impact analysis:**
- Nie zmienia tworzenia studenta ani wysyłki testu.
- Nie zmienia struktury Goals.
- Zero regressions confirmed: OnboardingChecklist `focus=add-goal-modal`, Roadmap “Add goal”, manual Add buttons.

**Verification:**
- Add Student z auto-send → `/student/:id?tab=dslm&view=goals...` → przewinięcie do Goals + modal `Add New Goal` otwarty: DONE.
- Roadmap “Add goal” nadal otwiera modal: DONE.

---

## P3 — Retake Test: automatyczny email + brzydki render banera i Tests card

**Dependency scan:**
- `src/components/dashboard/WelcomeTestSuggestion.tsx` — retake z banera Overview/1 MINUTE.
- `src/components/student-tests/StudentTestsTab.tsx` — retake z Tests.
- `src/components/student-tests/TestDetailsView.tsx` — trzeci retake path, dziś stary i nie wysyła maila.
- `src/components/welcome-test/WelcomeTestActionsPanel.tsx` — układ przycisków.
- `supabase/functions/send-test-email/index.ts` — email wysyłany przez istniejącą Edge Function.
- `src/hooks/useStudentTests.tsx` — `createTest`, `addQuestions`, `generateShareToken`.

**Root cause:** Retake creation kończy się na tokenie i toascie “Send the new link”; nie ma wspólnego helpera “create retake + email”, a layout kart zakłada krótkie tytuły i jednowierszowy panel akcji.

**Opcje:**
| Opcja | Podejście | Tradeoff | Ryzyko |
|---|---|---|---|
| A | W każdym retake path po tokenie wykonać email + poprawić layout flex/grid | Najmniej plików, szybkie | Low/Medium |
| B | Utworzyć helper `sendWelcomeRetakeEmail` i użyć w 3 miejscach | Mniej duplikacji, bez DB zmian | Low |
| C | Edge Function create-retake-and-send | Najbardziej spójne, ale wymaga nowego backend endpointu | Medium |

**Selected solution + why:** Opcja B. Centralizuje mail bez nowej funkcji backendowej i bez migracji.

**Full implementation:**
1. W `src/lib/welcomeTest/ensureWelcomeTest.ts` dodać helper `sendWelcomeTestEmail` już istnieje — użyć go także dla retake; bez nowego pliku.
2. W `WelcomeTestSuggestion.runRetake`:
   - po `generateShareToken` wywołać `sendWelcomeTestEmail({ token, recipientEmail: studentEmail, studentName, teacherId })`, jeśli `studentEmail` istnieje,
   - jeśli brak emaila: skopiować link i pokazać komunikat,
   - toast zmienić na `Retake X created and emailed to the student.` albo `Retake X created. No email on file — link copied.`.
3. W `StudentTestsTab.runRetake` analogicznie pobrać `student_email, name` i wysłać email automatycznie.
4. W `TestDetailsView.handleRetake` zmodernizować path: wyliczać `nextAttempt`, ustawiać `previous_attempt_id`, generować token z typem `welcome`, wysyłać email automatycznie, dispatch `student-tests:refresh`.
5. Layout banner `WelcomeTestSuggestion`:
   - zmienić wrapper pending/completed z `flex items-center` na `grid lg:grid-cols-[minmax(0,1fr)_auto] gap-3`.
   - tytuł i badge w `flex-wrap`; URL w `break-all line-clamp-1 sm:truncate`; action panel `justify-start lg:justify-end`.
   - dla długiego `Welcome Test retake 4 sent` wymusić `max-w-full min-w-0`.
6. Layout `StudentTestsTab` card:
   - zmienić `flex items-center justify-between flex-wrap` na responsive grid: content, status/score, actions.
   - action panel `className="w-full lg:w-auto justify-start lg:justify-end"`.
   - badge/status nie ma wciskać tytułu.
7. `WelcomeTestActionsPanel` dodać opcjonalną klasę responsive `className` już istnieje; użyć jej w banner/card.

**Impact analysis:**
- Nie zmienia pytań Welcome Test ani scoringu.
- Email korzysta z istniejącego `send-test-email` i `APP_BASE_URL` fallback.
- Zero regressions confirmed: Copy Link, Refresh Link, Preview, View Results, Compare attempts, old attempts read-only.

**Verification:**
- Retake z banneru → nowa próba + email automatycznie: DONE.
- Retake z Tests → nowa próba + email automatycznie: DONE.
- Retake z TestDetails → nowa próba + email automatycznie: DONE.
- Banner w Overview/1 MINUTE nie nachodzi i przyciski się zawijają profesjonalnie: DONE.
- Tests card nie rozciąga/ściska tytułu i akcji: DONE.

---

## P4 — Suggested from Welcome Test: osobne Accept / Dismiss dla każdego celu

**Dependency scan:**
- `src/components/dslm/GoalsView.tsx` — `suggestedGoals`, `acceptAllSuggested`, `dismissAllSuggested`, render listy.
- `src/hooks/useStudentProgress.ts` — `updateGoal`, `deleteGoal`.
- `student_progress_goals` — kolumny `source`, `accepted_at`, `metadata` już istnieją.

**Root cause:** Banner jest tylko zbiorczy, więc nauczyciel nie może wybrać pojedynczych sugestii bez edycji/usuwania kart niżej.

**Opcje:**
| Opcja | Podejście | Tradeoff | Ryzyko |
|---|---|---|---|
| A | Dodać inline Accept/Dismiss na każdym `li` | Minimalne | Low |
| B | Renderować pełne `GoalCard` w bannerze | Więcej informacji, ale ciężki layout | Medium |

**Selected solution + why:** Opcja A. Dokładnie spełnia request i nie duplikuje GoalCard.

**Full implementation:**
1. W `GoalsView.tsx` dodać `acceptSuggestedGoal(goalId)` i `dismissSuggestedGoal(goalId)`.
2. Lista sugerowanych celów jako responsive rows:
   - lewa część: tytuł + opis,
   - prawa część: `Accept` i `Dismiss` małe przyciski z ikonami.
3. Po Accept: `update student_progress_goals set accepted_at=now()` dla jednego `id`, dispatch `student-progress:refresh`, toast.
4. Po Dismiss: `deleteGoal(id)`, toast.
5. Zachować `Accept all` i `Dismiss all`.

**Impact analysis:**
- Nie zmienia automatycznego tworzenia sugestii.
- Zero regressions confirmed: bulk actions, normal GoalCard edit/delete/archive.

**Verification:**
- Każda sugestia ma własne Accept/Dismiss: DONE.
- Accept pojedynczy usuwa ją z banneru i zostawia jako aktywny cel: DONE.
- Dismiss pojedynczy usuwa tylko ją: DONE.

---

## P5 — Readiness panel w 1‑Minute Prep suggestions brzydko się renderuje

**Dependency scan:**
- `src/components/dslm/NextStepBanner.tsx` — readiness block przy braku sugestii.
- `src/components/dslm/MacroTimeline.tsx` — podobny blok w Learning Roadmap.
- Design tokens Tailwind/shadcn.

**Root cause:** Readiness panel w `NextStepBanner` jest wąski, tekst i linki są w jednej linii `justify-between`, przez co łamią się nieestetycznie.

**Opcje:**
| Opcja | Podejście | Tradeoff | Ryzyko |
|---|---|---|---|
| A | Ujednolicić z Roadmap: bordered amber card, rows z ikoną i buttonem | Spełnia request | Low |
| B | Wyciągnąć shared component dla obu paneli | Czystsze, ale większa zmiana | Medium |

**Selected solution + why:** Opcja A teraz, bez refactoru. Wygląd będzie spójny z Roadmap przy minimalnym scope.

**Full implementation:**
1. W `NextStepBanner.tsx` zmienić readiness block:
   - `max-w-2xl`, `rounded-md`, `border border-amber-500/40`, `bg-amber-500/5`.
   - header z `AlertTriangle` jak w `MacroTimeline`.
   - każda rekomendacja jako `grid sm:grid-cols-[1fr_auto] gap-2`, przycisk `Button size="sm" variant="outline"`.
2. Teksty pozostają English UI.
3. `Generate 1-Minute Prep suggestions` i `Refresh` zostają pod panelem.

**Impact analysis:**
- Tylko prezentacja; brak logiki.
- Zero regressions confirmed: Add goal, Send test, Go to roadmap callbacks.

**Verification:**
- Panel nie łamie linków po prawej w wąskim kontenerze: DONE.
- Wygląd spójny z Learning Roadmap warning: DONE.

---

## P6 — `Generate Learning Roadmap` ma otwierać modal z wpływem nauczyciela

**Dependency scan:**
- `src/components/dslm/MacroTimeline.tsx` — przycisk `Generate Learning Roadmap`, `requestGeneratePhases`.
- `src/hooks/dslm/useCurriculumPhases.tsx` — już przyjmuje `count`, `teacherComment`, `weeksPerPhase`, `phaseWeekTargets`, `focusedGoalIds`, ale edge function nie używa wszystkich.
- `supabase/functions/generate-curriculum-phases/index.ts` — obecnie używa tylko `rawCount` i `teacherComment`; cele pobiera bez `id`.
- `src/hooks/useStudentProgress.ts` — źródło listy goals dla checkboxów.

**Root cause:** UI nadal wywołuje generowanie natychmiast, mimo że hook częściowo ma już parametry pod guided generation; Edge Function nie konsumuje jeszcze `weeksPerPhase`, `phaseWeekTargets`, `focusedGoalIds`.

**Opcje:**
| Opcja | Podejście | Tradeoff | Ryzyko |
|---|---|---|---|
| A | Modal w `MacroTimeline` + rozszerzenie Edge Function o istniejące opcje | Pełne spełnienie requestu, bez DB | Low/Medium |
| B | Tylko modal frontend, zapis komentarza do `teacherComment` | Szybkie, ale opcje A-C byłyby pozorne | Medium |
| C | Nowa tabela preferencji roadmap | Nadmiarowe dla jednorazowego generowania | Medium |

**Selected solution + why:** Opcja A. Pełna funkcjonalność bez placeholderów, ale bez migracji.

**Full implementation:**
1. Utworzyć `src/components/dslm/GenerateRoadmapDialog.tsx`.
2. Modal fields:
   - **Phase count**: switch `Auto-fit phase count` domyślnie ON; gdy OFF: number input 1–8; helper `Suggested: 3–5 phases; AI auto-fits from deadline and goal complexity.`
   - **Weeks per phase**: switch `Auto-fit weeks` domyślnie ON; gdy OFF: number input 1–12; jeśli phase count OFF, pokazać checkbox/secondary button `Customize per phase`; po włączeniu pola `Phase 1 weeks`, `Phase 2 weeks`, itd.
   - **Focused goals**: switch `Auto-select goals` domyślnie ON; gdy OFF: checkboxy aktywnych goals z title/type/deadline.
   - **Additional guidance**: textarea, puste domyślnie.
   - CTA `Generate roadmap` / `Regenerate roadmap` zależnie od mode.
3. W `MacroTimeline.tsx`:
   - `Generate Learning Roadmap` otwiera modal, nie generuje od razu.
   - Alert “Generate without goals?” zostaje tylko gdy teacher potwierdza generowanie bez goals; modal pokaże ostrzeżenie i nadal pozwoli `Add goal first`.
   - Dropdown/toolbar dla istniejących faz też będzie mógł używać dialogu dla `replace`; `add` może pozostać jak jest, jeśli istniejące menu dotyczy innych akcji.
4. W `useCurriculumPhases.tsx` dodać `roadmapGuidance?: string` albo użyć `teacherComment` jako jednego pola z komentarza. Nie dodawać nowych DB.
5. W `generate-curriculum-phases/index.ts`:
   - destructure `weeksPerPhase`, `phaseWeekTargets`, `focusedGoalIds`.
   - pobrać goals z `id, title, description, goal_type, is_achieved, target_date`.
   - jeśli `focusedGoalIds` niepuste: dodać `FOCUSED GOALS SELECTED BY TEACHER` i instrukcję priorytetu, bez ignorowania pozostałych goal deadlines.
   - jeśli `phaseWeekTargets` podane: `phaseCount = phaseWeekTargets.length`, `totalWeeks = sum(phaseWeekTargets)`, dodać hard instruction exact per-phase durations; po AI sanitize wymusić `rebase(phases, phaseWeekTargets)`.
   - jeśli `weeksPerPhase` podane i brak per-phase targets: `totalWeeks = phaseCount * weeksPerPhase`, prompt wymaga approx/exact weeks per phase; safety net rebazuje równo.
   - `teacherComment` trafia do promptu jako `TEACHER GUIDANCE`.
6. Martha Test: modal copy będzie dla adult 1:1 tutor workflow, nie szkolny textbook; nazwy faz pozostają task-based adult outcomes.

**Impact analysis:**
- Dotyka Edge Function roadmap, nie Worksheet Generation Engine.
- Brak migracji i brak RLS zmian.
- Existing default behavior preserved: Auto-fit ON + pusty komentarz generuje tak jak teraz.
- Zero regressions confirmed: hard deadline fit, add/replace phases, done phases protection, dslm:phasesUpdated sync.

**Verification:**
- Klik `Generate Learning Roadmap` → modal, nie natychmiastowe generowanie: DONE.
- Auto-fit ON → zachowanie jak dotychczas: DONE.
- Manual phase count → Edge Function generuje dokładnie tyle faz: DONE.
- Manual weeks per phase → week ranges odpowiadają ustawieniom: DONE.
- Focused goals checkboxy → prompt i generation_context uwzględniają IDs/count: DONE.
- Additional guidance → widoczna w prompt constraints i wpływa na roadmapę: DONE.

---

## RAG injection update

Po implementacji zaktualizuję:
- `docs/llm-context.md`
- `public/llms.txt`
- oraz pamięć projektu `mem/features/onboarding/v6941-one-minute-prep-retake-roadmap.md` + `mem/index.md`

Nowy wpis RAG będzie miał wymagany format:
- `PROBLEM`: race condition auto-submit, unreliable Add Goal modal focus, retake email gap, crowded WT cards, per-goal WT suggestions, roadmap generation without teacher steering.
- `EDOOQOO SOLUTION`: deterministic auto-submit hydration, dual event Add Goal opening, retake auto-email, responsive WT layouts, per-suggestion Accept/Dismiss, guided roadmap modal.
- `TECHNICAL MECHANICS`: wymienione komponenty, hooki, Edge Function i sessionStorage keys.
- `RAG KEYWORDS`: 15+ fraz: 1-Minute Prep auto-generate, DSLM prefill, autoGenerateWorksheet, Welcome Test retake email, guided roadmap, phase count, weeks per phase, focused goals, adult ESL roadmap, Add learning goals modal, suggested goals accept dismiss, etc.

## Scope lock

Nie będę ruszać:
- Worksheet Generation Engine prompt/logic.
- Welcome Test question bank/scoring.
- Token/subscription logic.
- Public SEO landing copy poza wymaganym RAG.
- DB schema/RLS, bo obecne problemy nie wymagają migracji.

## Final change report po implementacji

Po zatwierdzeniu i wdrożeniu raport będzie zawierał:
- Summary of what was implemented.
- Files modified.
- Documentation updated: YES.
- Out of scope issues flagged.
- Verification result: PASS/FAIL.

Przewidywany wynik: sześć problemów rozwiązanych bez zmian w chronionym Worksheet Generation Engine i bez migracji DB.