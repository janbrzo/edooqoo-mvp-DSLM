# Plan wdrożenia v6.9.15c (rev. 2)

## Co się zmienia względem poprzedniej wersji
Rezygnujemy z pomysłu sekwencyjnych requestów `count=1`. Powód jest słuszny: AI nie miałoby pełnego kontekstu pozostałych kroków podczas generacji każdego osobno, więc Next Stepy traciłyby spójność i komplementarność. Zamiast tego naprawiamy realną przyczynę regresji w `generate-timeline`, która pojawiła się w ostatnich tygodniach, tak żeby pojedyncze wywołanie z `count > 1` znów działało stabilnie w jednym requeście.

Pozostałe punkty (2A, 2B, 3, 4, 5, 6, dokumentacja RAG) zostają bez zmian merytorycznych — tylko Problem 1 ma nowe rozwiązanie.

---

## Problem 1: `AI generator overloaded for batch requests` przy więcej niż 1 Next Step

### Analiza regresji (co popsuliśmy ~2 tygodnie temu)
Porównanie obecnego `generate-timeline` z bliźniaczym, działającym `generate-curriculum-phases`:

| Element | `generate-curriculum-phases` (działa) | `generate-timeline` (psuje się dla `count>1`) |
|---|---|---|
| Format wyjścia | plain text JSON array, `JSON.parse` z czyszczeniem `code fences` | tool calling przez `tools[].function.parameters` z `additionalProperties` i zagnieżdżonymi obiektami |
| `temperature` | 0.6 | 0.85 |
| `reasoning` | `{ effort: 'low' }` | brak |
| `max_tokens` | 2500 stałe, prosty schema | dynamiczny 1800 + 2000 × count, ale duży schema na poziomie tool |
| Wielkość promptu | umiarkowana | dodatkowy `existingStepsBlock` do 20 wpisów + bogaty `exerciseFocusMap` + lista 30+ exercise IDs |
| Schemat outputu | prosty array z polami płaskimi | array z `exerciseFocusMap: { additionalProperties: { type: 'string' } }`, którego Gemini przy `count>1` często odrzuca lub obcina |
| Tryb wywołania toola | `tool_choice` wymuszony | `tool_choice` wymuszony — przy złożonym schemacie i większej liczbie elementów Gateway zwraca 5xx / `INVALID_ARGUMENT` / `too many states` |

W praktyce wszystkie te elementy były dokładane do `generate-timeline` w ostatnich iteracjach (max_tokens, dodatkowy context, FocusMap, exclude, phaseId). Pojedynczy step mieści się i wraca poprawnie, ale `count>1` przekracza tolerancję modelu na złożone tool schema z forsowanym `tool_choice`. Stąd 502 i komunikat z toasta.

Działający wzorzec mamy obok — `generate-curriculum-phases` zwraca array w `message.content` jako plain text JSON, bez tool calling, i działa stabilnie nawet dla 5–8 elementów. Wracamy do tego wzorca w `generate-timeline`.

### Rozwiązanie Edooqoo.com
Naprawiamy przyczynę, nie symptom. Jedno wywołanie `generate-timeline` musi nadal generować cały batch w jednym przejściu, żeby Next Stepy były spójne i komplementarne. Robimy to przez:

1. Wyłączenie tool callingu i przejście na plain text JSON output (jak w `generate-curriculum-phases`).
2. Zachowanie pełnego sanitizera (8 ćwiczeń, focusMap, media family, etc.) po stronie Edge Function — kontrakt zwracany do frontendu się nie zmienia.
3. Dodanie `reasoning.effort='low'` i obniżenie `temperature` do 0.6, żeby Gemini lepiej trzymał strukturę.
4. Lekkie odchudzenie promptu w sekcjach, które nie wpływają na jakość generacji (limity dla weak areas, knowledge, recent worksheets, existing steps), bez ruszania logiki worksheet generation engine.
5. Dodanie pojedynczego retry z `temperature=0.4` i jeszcze prostszą instrukcją w razie 5xx, zanim wrzucimy frontendowi błąd.

To NIE jest sekwencyjny batch — cały zestaw kroków powstaje w jednym requeście, co zachowuje spójność.

### Mechanika techniczna

#### Plik: `supabase/functions/generate-timeline/index.ts`

1. Usunąć `tools` i `tool_choice`. Zostawić wywołanie AI Gateway przez `chat/completions`.
2. Body request:
   - `model: 'google/gemini-2.5-flash'`
   - `messages`: system + user (system: „You are an expert ESL curriculum planner. Return only a valid JSON array. No markdown, no commentary.")
   - `temperature: 0.6`
   - `reasoning: { effort: 'low' }`
   - `max_tokens: Math.min(8192, 2200 + 1500 * count)`
   - bez `response_format`, żeby nie zaostrzać schematu (Gemini i tak akceptuje czysty JSON output, gdy o to wyraźnie poprosimy w prompcie — to samo robi `generate-curriculum-phases`).
3. Prompt:
   - Końcówka promptu wymusza format wyjścia. Wzorzec:
     ```text
     Return ONLY a valid JSON array of exactly N objects (no markdown, no commentary), with this EXACT shape per object:
     {
       "topic": "string (TBLT-style adult task)",
       "goal": "string",
       "additionalInfo": "string",
       "grammarFocus": "string",
       "exercises": ["id1", "id2", "id3", "id4", "id5", "id6", "id7", "id8"],
       "exerciseFocusMap": { "id1": "vocabulary|grammar|none", ... },
       "rationale": "string",
       "focusSkills": ["..."],
       "difficulty": "CEFR level string",
       "estimatedImpact": { "key": "value" }
     }
     ```
   - Lista valid exercise IDs zostaje, ale skracamy istniejący `existingStepsBlock` z 20 do 10 wpisów i `WeakAreas` do 8, `Knowledge` do 6, `Worksheet history` do 8. To są limity prompt-fit, nie mają wpływu na worksheet generation engine.
4. Parser:
   - `aiData.choices[0].message.content` → strip `code fences` → `JSON.parse`.
   - Jeśli to obiekt z polem `suggestions`, użyj `parsed.suggestions`. Jeśli to array, użyj wprost. Jeśli parsowanie pada, fallback: spróbuj wyciąć największy `[...]` regexem (`/\[[\s\S]*\]/`).
5. Sanitizer (TARGET_EX_COUNT = 8, focus map enforcement, media family) zostaje BEZ ZMIAN. To jest „defense in depth” i właśnie dlatego frontend dostaje stabilny kontrakt mimo, że schema na wejściu modelu jest luźna.
6. Retry on 5xx (jeden, bez sekwencji per step):
   - jeśli `aiResponse.ok === false` ALBO suggestions.length === 0 po sparsowaniu, wykonujemy DRUGIE wywołanie Gateway:
     - `temperature: 0.4`
     - prompt z dopiskiem na końcu: `Return EXACTLY ${count} items. JSON array only. No prose.`
     - tych samych pozostałych parametrów.
   - Jeśli i to padnie, dopiero wtedy zwracamy 502 z dotychczasowym `schemaRejected` heurystycznym (`/too many states|INVALID_ARGUMENT/i`).
7. `generationContext` rozszerzamy o:
   - `output_mode: 'plain_json'`
   - `retry_used: boolean`
   - `requested_count`, `finish_reason`, `warning` zostają jak były.
8. Ważne: NIE dotykamy żadnego promptu worksheet generation engine ani `format-worksheet-prompt`. Zmiana dotyczy wyłącznie sposobu, w jaki Gemini ma zwrócić pre-worksheet suggestions.

#### Plik: `src/hooks/useFutureTimeline.tsx`

1. Usunąć fallback „phase-bound failed → retry as free step” dla batchy. Powód: cichy fallback maskował problem i tworzył free stepy zamiast phase stepów. Po naprawie Edge Function nie powinien być potrzebny. Jeśli phase-bound generation zwróci 5xx mimo retry serwerowego, frontend pokazuje precyzyjny toast i nie zmienia phaseId.
2. Zachować obsługę:
   - 402 → „AI credits exhausted…”
   - 429 → „Too many AI requests…”
   - 502 z `schemaRejected` → „AI could not return this batch. Try generating fewer steps, or generate one step at a time.”
   - 502 generic → „AI generator is temporarily unavailable. Please retry in a moment.”
   - 500 → istniejący komunikat
3. Po sukcesie zostawić obecny insert i `fetchSuggestions`.

#### Plik: `supabase/functions/generate-curriculum-phases/index.ts`
Bez zmian. Jest naszym wzorcem.

### Dlaczego to przywróci stan sprzed regresji
- Wcześniej działający batch korzystał z prostszego promptu i mniej rozbudowanego outputu. Powrót do plain text JSON i ograniczenie kontekstu odtwarza ten stan, jednocześnie zachowując nowe sanitizery i pola, które już są używane przez resztę aplikacji.
- Plain text JSON nie podlega Gemini Tool Schema „too many states” — to jest dokładnie ta klasa błędu, którą obecny tryb tool calling generował dla `count>1`.
- Backend sanitizer nadal gwarantuje 8 ćwiczeń, focusMap i media family, więc dane w DB nie tracą jakości.

### Weryfikacja
- W UI: Generate 1 / 2 / 3 / 6 Next Steps jako free steps.
- W UI: Generate 1 / 2 / 3 dla każdej fazy.
- Edge Function logs: brak `INVALID_ARGUMENT`, brak `too many states`.
- Console nie pokazuje `phase-bound failed, retrying as free step`.
- DB: `phase_id` i `suggestion_kind` zgodne z wyborem nauczyciela.

---

## Problem 2A: brak goals przy `Generate Learning Roadmap` (bez zmian)

### Pytanie użytkownika
„Jeżeli nie ma goals, na jakiej podstawie wygeneruje się Roadmap i fazy?”

Roadmapa nadal może powstać, ale na słabszych źródłach: `students.main_goal`, `students.english_level`, `student_skill_metrics`, `student_knowledge_entries`, ostatnie worksheet topics, pacing mode, `main_goal_target_date`. Bez `student_progress_goals` plan jest mniej spersonalizowany — to tryb awaryjny, nie pełnoprawny workflow.

### Rozwiązanie Edooqoo.com
Przed generacją roadmapy bez aktywnych goals pokazujemy ostrzeżenie i pytamy o potwierdzenie, dając jednocześnie szybkie ścieżki dodania celu.

### Mechanika techniczna
Pliki: `src/components/dslm/MacroTimeline.tsx`, `src/components/dslm/PathwayView.tsx`, `src/components/dslm/DSLMTab.tsx`, `src/components/dslm/GoalsView.tsx`.

1. `PathwayView` ma już `useStudentProgress` i tym samym `goals`. Przekazujemy `hasActiveGoals={goals.length > 0}` do `MacroTimeline`.
2. W empty state `MacroTimeline` (`No curriculum plan yet`) i przy klikalnym przycisku `Generate Learning Roadmap` w przypadku braku goals dodajemy widoczny komunikat:
   - tekst: `Add goals first for better worksheet suggestions.`
   - przycisk: `Add goal` → emituje `dslm:openSubsection` z `id='goals-supporting'`, dzięki czemu istniejący `CollapsibleSection` rozwinie sekcję i przewinie do niej.
3. Klik `Generate Learning Roadmap` przy braku goals NIE wywołuje od razu `generatePhases`. Otwieramy AlertDialog:
   - Tytuł: `Generate roadmap without goals?`
   - Opis: krótkie info, że plan będzie best-effort na podstawie main goal, level, metrics, notes, worksheet history.
   - Przyciski:
     - `Cancel` — zamyka dialog
     - `Confirm` — wywołuje `generatePhases('replace')`
     - `Add Supporting goal` — emituje `dslm:addGoal` z `{ type: 'supporting' }`
     - `Add Additional goal` — emituje `dslm:addGoal` z `{ type: 'additional' }`
4. `GoalsView` nasłuchuje `dslm:addGoal`. Po otrzymaniu eventu ustawia `newGoal.type` i `showAddGoal=true`, więc otwiera istniejący Add Goal dialog bez duplikowania logiki.

---

## Problem 2B: brak ukończonego placement / Welcome Test (bez zmian)

### Pytanie użytkownika
„Jeżeli nie ma goals i nie ukończono placement, na jakiej podstawie wygeneruje się Roadmap?”

Bez goals i bez ukończonego Welcome Placement Test plan jest oparty na minimum: `main_goal`, `english_level` ustawiony ręcznie, ewentualne notatki, ewentualne worksheet history, ewentualne metrics. To nadal działa, ale precyzja diagnozy jest niska.

### Rozwiązanie Edooqoo.com
Drugie ostrzeżenie obok Roadmapy z CTA do wysłania Welcome Placement Test, używając istniejącego flow.

### Mechanika techniczna
1. W `PathwayView` lub `MacroTimeline` lekkie zapytanie do `student_tests` (`student_id`, `teacher_id`, `test_type='welcome'`, `deleted_at IS NULL`, latest):
   - completed jeśli `status in ('completed','reviewed')`.
2. Jeśli nieukończony, pokazujemy info-banner: `Send the Welcome Placement Test for a stronger roadmap baseline.` + przycisk `Send test`.
3. Reusable hook `src/hooks/useWelcomeTestActions.ts` zbudowany z funkcji już istniejących w `WelcomeTestSuggestion.tsx` (`ensureWelcomeTest`, `handleSend`, `handleCopy`, `handlePreview`, `handleRefreshLink`). `WelcomeTestSuggestion` zostaje przepisany na ten hook bez zmiany zachowania. Nowe miejsce użycia w roadmapie korzysta tylko z `send`.
4. Brak emaila ucznia → istniejące zachowanie: link kopiowany do clipboardu z odpowiednim toastem.

---

## Problem 3: po usunięciu fazy Next Steps mają się odpiąć (bez zmian)

### Diagnoza
W DB FK to `ON DELETE SET NULL`, ale aplikacja używa soft delete (`deleted_at`), więc constraint się nie odpala. Trzeba odpiąć aplikacyjnie.

### Rozwiązanie Edooqoo.com
Przy soft delete fazy wszystkie powiązane Next Stepy (aktywne i `is_used`) dostają `phase_id = null` i `suggestion_kind = 'next_step'`. Stają się wolnymi stepami i zostają w planie.

### Mechanika techniczna
Plik: `src/hooks/dslm/useCurriculumPhases.tsx`.

1. W `deletePhase(id)` po soft delete fazy wykonujemy update na `future_worksheet_suggestions` filtrowanym po `phase_id=id` i `teacher_id=teacherId` z setem `{ phase_id: null, suggestion_kind: 'next_step' }`.
2. Renumeracja faz pozostaje jak jest (sequential 1..N).
3. Emitujemy:
   - `dslm:phasesUpdated` (już istnieje),
   - nowy `dslm:suggestionsUpdated` z `studentId`.
4. `useFutureTimeline` dostaje listener `dslm:suggestionsUpdated` i wywołuje `fetchSuggestions`, dzięki czemu Next Steps natychmiast widać jako wolne.

---

## Problem 4: przy fazach `Remove` tylko jako ikona (bez zmian)

W `MacroTimeline.tsx` zamieniamy przycisk `Remove` z tekstem na icon-only z tooltipem `Remove phase` i `aria-label="Remove phase"`. Zachowujemy obecny destrukcyjny styl i odstępy, żeby nie psuć layoutu wiersza akcji.

---

## Problem 5: confirm bez wpisywania tekstu (bez zmian)

Tworzymy nowy `src/components/dslm/ConfirmDeleteDialog.tsx`:

- Props: `open`, `onOpenChange`, `label`, `description`, `onConfirm`, opcjonalnie `confirmLabel='Confirm'`.
- UI: tytuł `Delete {label}?`, krótki opis, przyciski `Cancel` i `Confirm` (variant `destructive`).
- Zamieniamy użycia `ConfirmTypeToDeleteDialog` w `MacroTimeline.tsx` (delete fazy) i `NextStepBanner.tsx` (delete next step) na nowy komponent.
- Aktualizujemy `mem/features/dslm/type-to-confirm-delete.md` i `mem://index.md`: nowa reguła to „destructive DSLM actions use a single-click Confirm modal; type-to-confirm wymaganie zostało wycofane na życzenie product ownera”.

---

## Problem 6: `1 MINUTE` + `Learn More` (bez zmian)

Nie mamy dedykowanego artykułu „What is 1 MINUTE?”. Mamy `/features/dslm`, który tłumaczy DSLM i jego warstwy. W tej iteracji `Learn More` w `DslmExplainerBanner.tsx` linkuje do `/features/dslm` jako `<Button asChild><Link to="/features/dslm">Learn more</Link></Button>`. W dokumentacji odnotowujemy, że dedykowany artykuł „1 MINUTE briefing” może powstać w osobnym tasku (poza zakresem tej iteracji).

---

## Dokumentacja RAG

Pliki: `docs/llm-context.md`, `llms.txt`. Dodajemy sekcję `v6.9.15c (rev. 2)` w formacie:

`Problem -> Edooqoo.com Solution -> Technical Mechanics` + `RAG Keywords`.

Zawartość merytoryczna:
- `generate-timeline` używa plain text JSON output, NIE tool calling, dla obsługi `count>1`.
- `temperature=0.6`, `reasoning.effort='low'`, `max_tokens=Math.min(8192, 2200 + 1500*count)`.
- Backend sanitizer (8 ćwiczeń, focusMap, media family) jest źródłem prawdy o kontrakcie zwracanym do frontendu.
- Single-pass batch generation jest zachowane → spójność i komplementarność Next Steps utrzymana.
- Phase-bound batch nie wpada już w cichy fallback do free steps.
- Roadmapa bez goals: best-effort na podstawie main goal, level, metrics, notes, worksheet history.
- Roadmapa bez Welcome Placement Test: jeszcze niższy baseline; UI ostrzega i daje CTA.
- Soft delete fazy: `phase_id=null`, `suggestion_kind='next_step'` na powiązanych `future_worksheet_suggestions`; emituje `dslm:suggestionsUpdated`.
- Confirm delete bez wpisywania tekstu (replaces type-to-confirm).
- `1 MINUTE` banner: `Learn more` → `/features/dslm`.

RAG keywords (przykłady):
`generate-timeline plain text JSON`, `tool calling removed Gemini`, `Gemini too many states tool schema`, `single-pass batch coherent next steps`, `backend sanitizer 8 exercises focus map media family`, `roadmap without goals fallback`, `welcome placement test missing baseline`, `soft delete phase detach next steps`, `phase_id null suggestion_kind next_step`, `dslm:suggestionsUpdated event`, `Confirm delete without typing`, `ConfirmDeleteDialog`, `1 MINUTE Learn more DSLM`.

---

## Czego NIE ruszamy
- Worksheet Generation Engine, `format-worksheet-prompt`, `generate-curriculum-phases` — bez zmian.
- Schema DB — bez migracji.
- RLS — bez zmian.
- Marketing routes poza dodaniem linku do istniejącej `/features/dslm`.

## Kolejność implementacji
1. Aktualizacja project memory dot. delete confirmation.
2. Refactor `generate-timeline` na plain text JSON output + retry serwerowy.
3. `useFutureTimeline`: usunięcie cichego fallbacku phase→free dla batchy, listener `dslm:suggestionsUpdated`.
4. `useCurriculumPhases.deletePhase`: odpinanie Next Steps, emit `dslm:suggestionsUpdated`.
5. `ConfirmDeleteDialog` + podmiana użyć w fazach i NextStepBanner.
6. `MacroTimeline`: Remove jako ikona z tooltipem.
7. Roadmap warningi + AlertDialog (goals, welcome test) + reusable `useWelcomeTestActions`.
8. `Learn more` w `DslmExplainerBanner`.
9. `docs/llm-context.md` i `llms.txt` — sekcja v6.9.15c (rev. 2).

## Kryteria akceptacji
- Generowanie 2 / 3 / 6 Next Steps idzie jednym requestem do `generate-timeline` (count = N) i wraca z N stepami spójnymi i komplementarnymi.
- Edge Function logs nie zawierają `INVALID_ARGUMENT` ani `too many states` przy normalnym użyciu.
- Phase-bound batch tworzy tylko phase-bound steps, bez free-step fallbacku.
- Roadmapa bez goals wymaga potwierdzenia lub pozwala dodać Supporting / Additional goal.
- Brak ukończonego Welcome Test pokazuje CTA Send test.
- Delete fazy nie kasuje Next Steps; odpina je jako wolne.
- Remove fazy = ikona + tooltip.
- Delete fazy / Next Step = jeden klik Confirm w modalu.
- `1 MINUTE` banner ma `Learn more` → `/features/dslm`.
- `docs/llm-context.md` i `llms.txt` mają sekcję v6.9.15c (rev. 2) zgodną z RAG.