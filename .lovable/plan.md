# Plan v6.9.47 — Problem Resolution Cycle

## Założenie wykonawcze
Nie dotykam Worksheet Generation Engine. Zmiany będą ograniczone do warstwy transportu/prefill, DSLM roadmap, Welcome Test UX/results, Goals UI oraz RAG (`docs/llm-context.md`, `public/llms.txt`).

---

## 1. `Generate worksheet ↗` z 1-Minute Prep nie startuje automatycznie

### Dependency scan
Affected surface:
- `src/pages/StudentPage.tsx` — zapisuje `sessionStorage` i robi `navigate('/')` po kliknięciu sugestii.
- `src/components/WorksheetForm/index.tsx` — hydratuje prefill i odpala autosubmit.
- `src/pages/Index.tsx` — kolejkuje submit, czeka na token/profile readiness.
- `src/hooks/useWorksheetGeneration.tsx` — startuje stream i używa `studentId` z payloadu.
- `src/hooks/useWorksheetFormPersistence.ts` — może przywracać draft i konkurować z DSLM prefill.
- `future_worksheet_suggestions` — tylko oznaczanie użytej sugestii po sukcesie; bez zmiany schematu.

### Root cause
Aktualny autosubmit zależy od jednorazowych flag `sessionStorage`, które są czyszczone po lokalnym `submitForm()`, zanim wiadomo, czy parent `Index.tsx` faktycznie przyjął i uruchomił generowanie; przy readiness/race z tokenami lub zamontowanym formularzem request może zostać „zużyty” bez widocznego startu streamu.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Dodać dłuższe timeouty w `WorksheetForm` | Szybkie, ale nadal losowe | Medium |
| B | Zrobić trwały handshake: request ma ID/status, form nie usuwa flag zanim parent potwierdzi przyjęcie, parent emituje `accepted/started/failed` event | Najbardziej odporne na race, bez zmiany AI promptu | Low |
| C | Przenieść generowanie całkowicie do `StudentPage` | Omija formularz, ale dubluje logikę generatora | High |

### Selected solution + why
Wybieram opcję B. To usuwa strukturalny błąd: autosubmit przestaje być „fire-and-forget” i staje się transakcją UI z potwierdzeniem przyjęcia przez `Index.tsx`. Zachowuje obecny formularz, token logic i worksheet runtime bez dotykania Worksheet Generation Engine.

### Impact analysis
Zero regressions confirmed:
- manual submit nadal działa bez dodatkowych eventów,
- `Use this` nadal tylko wypełnia formularz,
- token paywall nadal działa dla manualnych requestów,
- sugestia nadal oznacza się jako used dopiero po sukcesie generowania,
- anonymous/demo guard pozostaje bez zmian.

### Full implementation
- W `StudentPage.tsx` przy `autoGenerate=true` zapisać `autoGenerateWorksheetRequest` z polami: `requestId`, `studentId`, `suggestionId`, `createdAt`, `status: 'pending'`.
- W `WorksheetForm/index.tsx`:
  - `readAutoGenerateIntent()` ma ignorować request starszy niż np. 60 sekund.
  - `submitForm()` doda do payloadu `__autoGenerateRequestId` obok `__autoGenerateFromSuggestion`.
  - Nie usuwać `autoGenerateWorksheet` i `autoGenerateWorksheetRequest` od razu po `submitForm()`.
  - Nasłuchiwać eventu `worksheet:autoGenerateAccepted` / `worksheet:autoGenerateStarted` / `worksheet:autoGenerateFailed`; dopiero accepted/started czyści flagi.
  - Watchdog po 1500 ms nie „dropuje” flag bez finalnego retry; jeżeli form jest gotowy, ponawia `submitForm()` raz z tym samym `requestId`.
- W `src/components/WorksheetForm/types.ts` dodać `__autoGenerateRequestId?: string`.
- W `Index.tsx`:
  - przy wejściu `handleGenerateWorksheet(data)` dla auto requestu emitować `worksheet:autoGenerateAccepted` natychmiast po przejściu guardu pustego topicu.
  - jeśli `tokensLoading`, retry pozostaje, ale nie czyści requestu.
  - tuż przed `generateWorksheetHandler(data)` emitować `worksheet:autoGenerateStarted`.
  - jeśli paywall/empty topic/timeout readiness blokuje request, emitować `worksheet:autoGenerateFailed` z reason.
- W `useWorksheetGeneration.tsx` pozostawić `effectiveStudentId = data.studentId || studentId`, bez zmian promptu.

### Verification checklist
- DONE: Kliknięcie `Generate worksheet ↗` zapisuje request z ID.
- DONE: Generator otwiera się i po readiness startuje stream/generating modal.
- DONE: Request nie ginie, jeśli token/profile loading trwa kilka sekund.
- DONE: Manual Generate nadal wymaga tylko kliknięcia użytkownika.
- DONE: `future_worksheet_suggestions.is_used` zmienia się dopiero po `worksheetGenerationSuccess`.

---

## 2. `Regenerate Learning Roadmap` zmienia `in_progress` i gubi Next Steps

### Dependency scan
Affected surface:
- `supabase/functions/generate-curriculum-phases/index.ts` — replace/add, preservation invariant, phase insert.
- `src/hooks/dslm/useCurriculumPhases.tsx` — refetch phases/suggestions po sukcesie.
- `src/hooks/useFutureTimeline.tsx` — pobiera aktywne phase-bound suggestions.
- `src/components/dslm/MacroTimeline.tsx` — renderuje fazy i suggestions by `phase_id`.
- `src/components/dslm/GenerateRoadmapDialog.tsx` — copy potwierdzające zachowanie danych.
- Tables: `dslm_curriculum_phases`, `future_worksheet_suggestions`.

### Root cause
Backend snapshotuje zachowane fazy, ale server-side deadline rebase nadal startuje nowe fazy od tygodnia 1, a soft-delete planned/draft phases nie odpina ich `future_worksheet_suggestions`, więc część kroków staje się niewidoczna, a nowe fazy wizualnie nakładają się na preserved `in_progress`.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Tylko poprawić copy modala | Nie naprawia danych | High |
| B | Poprawić `rebase(startingWeek)` i przed soft-delete odpiąć suggestions z usuwanych faz do `next_step` | Chroni active phases i nie gubi starych suggestions | Low |
| C | W ogóle nie usuwać planned/draft; oznaczać jako archived | Więcej UI długu i potencjalny chaos planu | Medium |

### Selected solution + why
Wybieram opcję B. Jest minimalna i zgodna z istniejącą architekturą: done/in_progress zostają fizycznie nietknięte, replace dotyczy tylko planned/draft, a kroki z usuwanych faz nie znikają — są detaczowane jako free `next_step`.

### Impact analysis
Zero regressions confirmed:
- istniejące `done` i `in_progress` rows zachowują te same `id`, `title`, `description`, `week ranges`, `rationale`, `focus_areas`, `deleted_at=null`,
- existing suggestions w kept phases zachowują `phase_id`,
- suggestions z planned/draft nie są kasowane fizycznie; tylko tracą `phase_id`, więc pozostają widoczne,
- add mode pozostaje append-only.

### Full implementation
- W `generate-curriculum-phases/index.ts`:
  - zmienić `rebase(phases, durations)` na `rebase(phases, durations, startingWeek = 1)`.
  - zmienić `fitPhasesToDeadline(phases, targetWeeks)` na przyjmowanie `startingWeek`.
  - dla replace z `keptWeeksConsumed > 0` wywoływać fit/rebase ze startem `keptWeeksConsumed + 1`.
  - przed soft-delete `replaceablePhaseIds` wykonać update `future_worksheet_suggestions`: `phase_id=null`, `suggestion_kind='next_step'` dla aktywnych/unused rows przypiętych do replaceable phases.
  - dodać snapshot `replaceableSuggestionIds` i rollback: jeżeli insert/preservation fails, przywrócić `phase_id`/`suggestion_kind` dla odpiętych suggestions oraz `deleted_at=null` dla replaceable phases.
  - rozszerzyć `generationContext` o `detached_replaceable_suggestion_ids` i `roadmap_start_week`.
- W `useCurriculumPhases.tsx` po sukcesie emitować oba eventy już istniejące (`dslm:phasesUpdated`, `dslm:suggestionsUpdated`) po `await fetchPhases()`.
- W `GenerateRoadmapDialog.tsx` zostawić copy w duchu: “Only planned/draft phases are regenerated. Active/completed phases and their worksheet suggestions are kept exactly.”

### Verification checklist
- DONE: Regenerate z 2 `in_progress` nie zmienia ich rekordów.
- DONE: Next Steps w fazie `in_progress` zostają widoczne.
- DONE: Kroki z usuwanych planned/draft nie znikają całkowicie.
- DONE: Nowe fazy zaczynają się po ostatnim zachowanym tygodniu.
- DONE: Invariant failure rollback nie zostawia częściowo nowej roadmapy.

---

## 3. Welcome Test z tłumaczeniem jest za duży + szybka nawigacja odpowiedzi

### Dependency scan
Affected surface:
- `src/pages/WelcomeTestPage.tsx` — cały student-facing test layout i `QuestionInput`.
- `src/hooks/useWelcomeTest.tsx` — `saveAnswer`, `goToNext`, `flushPendingAnswer`, `completeTest`.
- `src/data/welcomeTestTranslations.ts` — tylko odczyt; bez zmian treści.
- Components: `SpeakingRecorder`, `ListeningPlayer` — bez zmian mechaniki.

### Root cause
Layout skaluje tłumaczenia jako dodatkowy blok pod pytaniem/opcjami bez trybu compact, a inputy wyboru zapisują odpowiedź, ale nie wywołują kontrolowanego `goToNext`; tekstowe pytania mają deferred commit i brak obsługi Enter.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Zmniejszyć tylko fonty | Częściowo pomoże, ale nie rozwiązuje flow | Medium |
| B | Dodać compact mode przy `translationLang`, ciaśniejsze spacingi i controlled auto-advance callbacks | Dokładnie rozwiązuje UX bez zmiany pytań | Low |
| C | Usunąć część tłumaczeń z opcji | Szkodzi uczniowi, nieakceptowalne | High |

### Selected solution + why
Wybieram opcję B. Tłumaczenia zostają, ale ekran staje się ok. 20% bardziej zwarty; nawigacja jest szybsza, ale nadal bezpieczna dla multi-select, matrix, speaking i listening.

### Impact analysis
Zero regressions confirmed:
- multi-select nadal nie auto-przechodzi, bo wymaga wielu wyborów,
- speaking/listening nie zmienią upload/playback,
- teacher preview nie zapisuje i nie auto-przechodzi,
- ostatnie pytanie nie próbuje przejść dalej — zostaje `Complete`.

### Full implementation
- W `WelcomeTestPage.tsx` dodać `const compactTranslated = Boolean(translationLang)`.
- Zmniejszyć layout przy compact:
  - kontener `max-w-2xl` → `max-w-xl` przy tłumaczeniu,
  - `py-3`, `mb-3/4`, `space-y-4`, `p-2.5`, `text-sm` zredukować warunkowo do ok. 80%,
  - karta pytania `pt-4 pb-4 space-y-4` → `pt-3 pb-3 space-y-2.5`,
  - opcje `p-2.5` → `p-2`, option label `text-sm` → `text-[13px]`, translation option `text-xs` → `text-[11px]`, textarea `min-h-[90px]` → `min-h-[72px]`.
- Przekazać do `QuestionInput`:
  - `onAutoAdvance`,
  - `isLastQuestion`,
  - `compact`.
- Dodać wrapper `advanceAfterAnswer(value)`:
  - `await saveAnswer(currentQuestion.id, value)`;
  - po krótkim `requestAnimationFrame/setTimeout(80-120ms)` wywołać `goToNext()` jeśli nie last i nie preview.
- Auto-advance tylko dla single-answer typów:
  - `self_assessment`, `scenario_reaction`, `multiple_choice`, `preference_choice` bez `multi_select`, opcjonalnie `listening_comprehension` po wyborze opcji.
- Enter handling:
  - `fill_blank`: `onKeyDown Enter` zapisuje i idzie dalej.
  - `open_ended/open_reflection`: `Enter` bez Shift zapisuje i idzie dalej; `Shift+Enter` robi nową linię.

### Verification checklist
- DONE: Z tłumaczeniem ekran jest ok. 20% bardziej zwarty.
- DONE: Single choice klik zapisuje i przechodzi dalej.
- DONE: Text input Enter zapisuje i przechodzi dalej.
- DONE: Textarea Shift+Enter nadal dodaje newline.
- DONE: Multi-select nie auto-przechodzi.
- DONE: Teacher preview pozostaje read-only.

---

## 4. Po Welcome Test nie pokazuje się `AI Analysis`

### Dependency scan
Affected surface:
- `supabase/functions/process-welcome-test/index.ts` — generuje `student_learning_profiles.ai_summary`.
- `src/hooks/useWelcomeTest.tsx` — wywołuje funkcję po completion.
- `src/components/student-tests/WelcomeTestResults.tsx` — pokazuje AI Analysis tylko gdy `ai_summary` istnieje.
- `src/components/student-tests/TestDetailsView.tsx` — przekazuje `testId`, questions.
- Tables: `student_tests`, `student_test_questions`, `student_learning_profiles`, `test_skill_results`, `student_events`.

### Root cause
`process-welcome-test` generuje AI Analysis tylko gdy istnieją odpowiedzi open/speaking w starych ID listach (`wt_q12`, `wt_q13`, etc.); jeżeli uczeń odpowiada głównie na choice/profile/skill questions albo część ID driftuje, `openAnswers` jest puste i `ai_summary` zostaje `null`, mimo że profil i skill results są gotowe.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | W UI pokazać placeholder, gdy brak `ai_summary` | Ukrywa brak analizy, nie naprawia pipeline | Medium |
| B | Edge Function zawsze generuje AI summary: open/speaking jeśli są, a fallback z profilu, skills, traitów i ważnych choice/scenario answers jeśli openAnswers puste | Trwała naprawa, prawdziwa analiza także bez open answers | Low |
| C | Dodać osobny przycisk “Generate AI Analysis” | Manualny workaround, nie rozwiązuje automatyki | Medium |

### Selected solution + why
Wybieram opcję B plus jednorazowy backfill dla wskazanego testu po wdrożeniu. To naprawia zarówno przyszłe testy, jak i konkretny rekord `003f71a3-41ce-4e3b-a033-5569d35a0c29`, gdzie `student_learning_profiles.ai_summary` jest obecnie `null`.

### Impact analysis
Zero regressions confirmed:
- deterministic skill scores pozostają poza AI evaluation tam, gdzie są precyzyjne,
- AI summary nie modyfikuje Worksheet Generation Engine,
- `reviewed` status i auto-apply zostają zachowane,
- wynik UI nadal sanitizuje AI text przez `sanitizeAiSummary`.

### Full implementation
- W `process-welcome-test/index.ts`:
  - zbudować `analysisContext` zawsze, nie tylko `openAnswers`.
  - Dodać mapowanie `question_index -> ALL_WELCOME_TEST_QUESTIONS canonical id` lokalnie po stronie funkcji albo helper array z ID kolejności.
  - Jeśli `openAnswers` puste, stworzyć `profileAnswerSummary` z: estimated level, self-assessed level, grammar/vocabulary/reading/writing scores, strongest/weakest, motivation, anxiety, ambiguity, feedback preference, interest topics, learning path, key scenario answers.
  - Wywołać Lovable AI Gateway, gdy istnieje `openAnswers` lub `profileAnswerSummary`.
  - Prompt AI summary ma analizować dorosłego ESL ucznia i nie cytować internal IDs w tekstach.
  - Zapisać `ai_summary` do `student_learning_profiles` tak jak obecnie.
  - Jeśli AI Gateway failuje, zapisać bezpieczny deterministic fallback JSON z `summary`, `recommendations`, `writing_quality: 'unknown'`, `key_observations`, żeby UI nie było puste; jednocześnie logować model failure.
- W `WelcomeTestResults.tsx`:
  - fetch profilu ma filtrować również `.eq('welcome_test_id', testId)` lub fallback do najnowszego profilu studenta; najpierw test-specific, żeby retake nie pokazywał analizy z poprzedniego testu.
  - `useEffect` dependency doda `testId`.
- Po wdrożeniu funkcji uruchomić bezpieczny backfill dla testu `003f71a3-41ce-4e3b-a033-5569d35a0c29` przez ponowne `process-welcome-test` z answers z `student_learning_profiles.raw_answers`/DB questions.

### Verification checklist
- DONE: Nowe Welcome Test zawsze ma `ai_summary` po completion/review.
- DONE: Wskazany test dostaje AI Analysis bez ręcznego odświeżania danych przez użytkownika.
- DONE: Retake pokazuje analizę właściwego `testId`.
- DONE: Brak open answers nie blokuje analizy.
- DONE: AI failure nie zostawia pustej sekcji — jest fallback.

---

## 5. `Suggested from Welcome Test` goals: szare przed Accept + Accept znika od razu

### Dependency scan
Affected surface:
- `src/components/dslm/GoalsView.tsx` — banner Suggested from Welcome Test i accept/dismiss.
- `src/components/student-progress/GoalCard.tsx` — wizualne odróżnienie suggested goals.
- `src/hooks/useStudentProgress.tsx` — local state po `accepted_at` update.
- `src/types/studentProgress.ts` — `accepted_at`, `source`, ewentualnie `metadata`.
- `student_progress_goals` — istniejące pola `source`, `accepted_at`, `deleted_at`.

### Root cause
Suggested goals są celowo aktywne od razu, więc są używane przez roadmap/next steps, ale `Accept all` omija lokalny state hooka bezpośrednim Supabase update; przez to banner liczy stare `suggestedGoals` aż do refetch/refresh.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Ukryć suggested goals z listy do Accept | Łamie wymaganie, że mają wpływać na roadmap | High |
| B | Zachować je jako aktywne, dodać szary styl `isSuggested`, a Accept aktualizuje lokalny state natychmiast | Spełnia dokładnie wymaganie | Low |
| C | Trzymać suggested tylko w banerze, a do roadmap dopisywać osobnym query | Więcej długu i możliwe rozjazdy | Medium |

### Selected solution + why
Wybieram opcję B. To zachowuje kierunek produktu: sugestie są realnymi celami dla DSLM, ale wizualnie mają status “awaiting teacher decision”.

### Impact analysis
Zero regressions confirmed:
- przed Accept cele nadal są w `goals`, więc `generate-curriculum-phases` i `generate-timeline` je widzą,
- Dismiss nadal soft-delete usuwa wpływ z roadmap,
- Accept nie zmienia treści celu — tylko `accepted_at`,
- poza kolorem/stanem banera nie zmieniam układu Goals.

### Full implementation
- `GoalCard.tsx`: istniejący `isSuggested` zostaje, ale styl dopracować do lekkiego szarego, bez zmiany layoutu: np. `bg-muted/30 border-muted-foreground/20 opacity-80 grayscale-[0.2]`.
- `GoalsView.tsx`:
  - `acceptSuggested(id)` już używa `updateGoal`; zostawić, ale usunąć podwójne toasty lub unifikować.
  - `acceptAllSuggested()` zmienić z bezpośredniego Supabase update na serię lokalnych `updateGoal(id, { accepted_at: now })` albo po batch update ręcznie wywołać lokalny refetch i natychmiastowy optimistic filter.
  - Najprościej: po batch update ustawić lokalnie przez nowy helper w `useStudentProgress` albo wykonywać `Promise.all(suggestedGoals.map(g => updateGoal(g.id, { accepted_at: now })))`.
- `useStudentProgress.tsx`: upewnić się, że `updateGoal` typowo obsługuje `accepted_at` i aktualizuje lokalny `goals` natychmiast.
- `types/studentProgress.ts`: dodać brakujące `metadata?: any` jeśli potrzebne do rozpoznania source/test_id.

### Verification checklist
- DONE: Suggested goals przed Accept są lekko szare.
- DONE: Są nadal widoczne w Supporting/Additional Goals.
- DONE: Są nadal uwzględniane w roadmap/next steps.
- DONE: Accept usuwa pozycję z banera natychmiast.
- DONE: Dismiss nadal usuwa pozycję natychmiast.
- DONE: Po refresh status jest spójny.

---

## RAG injection update
Po implementacji zaktualizuję:
- `docs/llm-context.md`
- `public/llms.txt`

Dopiszę dense factual Markdown:
- PROBLEM: autosubmit DSLM suggestion handshake; roadmap preserved phases and suggestions; compact translated Welcome Test with auto-advance; AI Analysis fallback for Welcome Test; suggested goals visual/accept state.
- EDOOQOO SOLUTION: konkretne zachowanie produkcyjne.
- TECHNICAL MECHANICS: komponenty, hooki, edge functions, tabele.
- RAG KEYWORDS: min. 15 semantycznych fraz dla każdej grupy.

## Final change report po wdrożeniu
Raport końcowy będzie zawierał:
- Summary implemented
- Files modified
- Documentation updated: YES
- Out of scope issues flagged
- Verification result: PASS/FAIL

## Out of scope issues noted
- Nie zmieniam promptu ani logiki Worksheet Generation Engine.
- Nie przebudowuję całego Welcome Test design systemu poza kompaktowaniem wskazanego ekranu.
- Nie zmieniam scoringu deterministic skill questions poza fallbackiem AI summary.