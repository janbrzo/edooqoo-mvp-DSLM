# Plan wdrożenia v6.9.15b

## Diagnoza główna

Poprzednia poprawka dla `generate-timeline` celowała w zbyt mały `max_tokens`, ale aktualne logi Supabase pokazują inną przyczynę błędu 502:

```text
Google AI Studio INVALID_ARGUMENT:
"The specified schema produces a constraint that has too many states for serving..."
```

To oznacza, że Gemini odrzuca zbyt złożony `tools.function.parameters` schema, szczególnie przy `count > 1`: mamy tablicę sugestii z `minItems=maxItems=count`, każda sugestia ma tablicę 8 ćwiczeń z dużym `enum`, plus `exerciseFocusMap` z enumami. Problem nie jest w UI ani w fazach — serwer odrzuca sam kontrakt schema zanim realnie wygeneruje wynik.

## Dlaczego to rozwiązanie

Najbezpieczniej nie zmieniać dydaktycznej logiki Next Steps, tylko uprościć techniczny format odpowiedzi AI i zostawić walidację po stronie naszego Edge Function. To skaluje lepiej, bo model nie musi obsługiwać ciężkiego constrained schema, a aplikacja nadal sama wymusza: poprawne exercise IDs, dokładnie 8 ćwiczeń, jeden typ mediów, focus tags i licznik sugestii.

Alternatywy rozważone:

1. **Generowanie pojedynczo w pętli `count` razy**
   - Plus: omija batch schema.
   - Minus: więcej zapytań AI, większy koszt, wolniej, trudniejsza spójność między krokami.

2. **Kolejka/background worker**
   - Plus: najlepsze dla timeoutów.
   - Minus: tu logi pokazują `INVALID_ARGUMENT`, nie timeout; kolejka dodałaby migracje i złożoność bez naprawy root cause.

3. **Wybrana ścieżka: uproszczenie AI response schema + backend sanitizer**
   - Plus: najmniejsza zmiana, bez migracji, bez naruszania worksheet engine, zachowuje obecną architekturę.
   - Minus: odpowiedź AI może być mniej rygorystyczna, więc backend sanitizer musi być źródłem prawdy.

---

# Problem 1: `generate-timeline` 502 przy generowaniu więcej niż 1 Next Step

## Edooqoo.com Solution

Zmienimy kontrakt AI w `supabase/functions/generate-timeline/index.ts`, żeby Gemini nie dostawał zbyt złożonego schema. Edge Function ma nadal zwracać ten sam kształt do frontendu: `{ suggestions, generationContext, mode, phaseId }`.

Nie dotykamy `generateWorksheet` ani promptu worksheet generation engine.

## Technical Mechanics

### Plik

- `supabase/functions/generate-timeline/index.ts`

### Konkretna zmiana

1. Zastąpić obecne `tools: [{ function.parameters: ... }]` uproszczonym kontraktem.

Obecnie problematyczne elementy:

- `suggestions.minItems = count`
- `suggestions.maxItems = count`
- `exercises.items.enum = VALID_EXERCISES`
- `exercises.minItems = 8`
- `exercises.maxItems = 8`
- `exerciseFocusMap.additionalProperties.enum = FOCUS_VALUES`

Planowana wersja:

- `suggestions` jako zwykła tablica bez `minItems/maxItems` zależnych od `count`.
- `exercises` jako `array<string>` bez enum i bez twardego `minItems/maxItems` w schema.
- `exerciseFocusMap` jako zwykły object/string map bez enum w schema.
- Twarde wymagania zostają w prompt text i w sanitizerze po odpowiedzi.

2. Dodać do promptu jasną, techniczną instrukcję output contract, ale bez rozbudowanego constrained schema:

```text
Return JSON-compatible tool arguments with suggestions array.
Target count: {count}.
Each suggestion should include 8 exercise IDs from the allowed list.
Backend will validate and normalize exercise IDs.
```

3. Zachować obecny sanitizer z linii 286-363:

- filtruje `VALID_EXERCISES`,
- uzupełnia do 8 ćwiczeń fallbackami,
- ucina powyżej 8,
- naprawia `exerciseFocusMap`,
- wymusza minimum vocabulary/grammar,
- usuwa miks picture/audio,
- filtruje puste tematy.

4. Poprawić obsługę błędów AI Gateway:

- Jeżeli Gateway zwraca 400 z tekstem `too many states`, odpowiedź Edge Function powinna zawierać diagnostykę:

```json
{
  "error": "AI schema rejected",
  "status": 400,
  "detail": "schema too complex",
  "count": 3,
  "mode": "phase_steps"
}
```

- Status HTTP może pozostać 502, ale frontend dostanie czytelny `detail`.

5. Dodać fallback parse path:

- jeśli `tool_calls[0].function.arguments` istnieje, parsować jak dziś;
- jeśli nie istnieje, parsować `message.content` jako JSON;
- jeśli AI zwróci mniej niż `count`, przyjąć partial success zamiast full failure, jeśli `suggestions.length > 0`.

6. Nie implementować kolejki w tej iteracji.

Powód: obecny błąd to schema rejection, nie timeout. Kolejka byłaby architektonicznie cięższa, wymagałaby tabeli, RLS, worker logic i UI polling, a nie rozwiązuje bezpośrednio błędu `too many states`.

## Frontend behavior

### Plik

- `src/hooks/useFutureTimeline.tsx`

### Zmiany

1. Zachować retry phase-bound -> free step tylko jako degradację dla realnych 5xx.
2. Jeżeli backend zwróci `detail` zawierające schema/AI rejection, toast powinien mówić:

```text
AI could not return this batch. Try generating fewer steps, or generate one step at a time.
```

3. Nie usuwać istniejących sugestii przed potwierdzeniem, że backend zwrócił co najmniej 1 nową sugestię.

To już jest prawie spełnione, bo soft-delete istniejących sugestii następuje dopiero po `rawSuggestions`, ale w implementacji trzeba to zostawić bez zmian.

## Regression guard

- Request `count=1` musi działać jak wcześniej.
- Request `count=2-6` nie może powodować Google schema error.
- Phase-bound generation musi zapisywać `suggestion_kind='phase_step'` i `phase_id=targetPhaseId`.
- Free generation musi zapisywać `suggestion_kind='next_step'` i `phase_id=null`.
- Sanitizer nadal musi wymuszać dokładnie 8 ćwiczeń.

---

# Problem 2: etykiety w `NextStepBanner`

## Edooqoo.com Solution

Przywrócić pełne etykiety akcji na pierwszym Next Step:

- `Use` -> `Use this Step`
- `Comment` -> `Regenerate with comment`

## Technical Mechanics

### Plik

- `src/components/dslm/NextStepBanner.tsx`

### Konkretna zmiana

1. W przycisku `onUse(suggestion)` zmienić label:

```tsx
<ClipboardCopy ... /> Use this Step
```

2. W przycisku `onRegenerateWithComment(suggestion)` zmienić label:

```tsx
<MessageSquarePlus ... /> Regenerate with comment
```

3. Zachować tooltips.
4. Żeby uniknąć powrotu problemu z zawijaniem:

- zostawić `sm:flex-nowrap` i `sm:overflow-x-auto`,
- na mobile pozwolić na `flex-wrap`,
- nie zmieniać logiki przycisków.

## Regression guard

- Przycisk `Generate worksheet ↗` dalej działa jako auto-generate.
- `Use this Step` tylko prefille formę, bez auto-generate.
- `Regenerate with comment` dalej otwiera dialog komentarza dla jednej sugestii.

---

# Problem 3: usunięta faza nadal sugerowana w modal + numeracja faz 2 -> 1 nie zawsze przeskakuje

## Root cause

W `PathwayView` i `MacroTimeline` działają dwie niezależne instancje `useCurriculumPhases`:

- `PathwayView` buduje `phaseOptions` i `recommendedTargetPhaseId` dla `GenerateStepsDialog`.
- `MacroTimeline` obsługuje usuwanie faz.

Po usunięciu fazy lokalny stan aktualizuje się w instancji `MacroTimeline`, ale instancja `PathwayView` może nadal mieć stary snapshot, bo `deletePhase`, `updatePhase` i `addPhase` nie emitują globalnego eventu `dslm:phasesUpdated`. W kodzie event jest obecnie emitowany tylko po `generatePhases`, mimo że dokumentacja już zakłada, że ma być po każdej mutacji.

## Edooqoo.com Solution

Wprowadzić konsekwentną synchronizację faz po każdej mutacji oraz deterministycznie przeliczać numerację z aktualnego stanu po refetchu.

## Technical Mechanics

### Pliki

- `src/hooks/dslm/useCurriculumPhases.tsx`
- `src/components/dslm/GenerateStepsDialog.tsx`
- `src/components/dslm/PathwayView.tsx`
- `src/components/dslm/MacroTimeline.tsx`

### Zmiana A: jeden helper do synchronizacji

W `useCurriculumPhases.tsx` dodać lokalny helper:

```ts
const emitPhasesUpdated = useCallback(() => {
  window.dispatchEvent(new CustomEvent('dslm:phasesUpdated', { detail: { studentId } }));
}, [studentId]);
```

Użyć go po sukcesie:

- `generatePhases`,
- `updatePhase`,
- `deletePhase`,
- `addPhase`.

Dodatkowo po mutacjach wywołać `await fetchPhases()` tam, gdzie dziś jest tylko lokalny `setPhases`, żeby komponent opierał się na realnym stanie DB.

### Zmiana B: renumeracja faz po delete jako operacja deterministyczna

Obecny kod przesuwa tylko fazy `sequence_number > deletedSeq`. To logicznie powinno działać, ale przy dwóch instancjach hooka UI może pokazywać stary snapshot.

Planowana stabilizacja:

1. Po soft-delete pobrać aktualne nieusunięte fazy dla `studentId + teacherId` posortowane po `sequence_number`.
2. Nadać im numery `idx + 1`.
3. Zaktualizować tylko te rekordy, których `sequence_number !== idx + 1`.
4. Dopiero potem `await fetchPhases()` i `emitPhasesUpdated()`.

Pseudokod:

```ts
await softDelete(id)
const { data: remaining } = await supabase
  .from('dslm_curriculum_phases')
  .select('id, sequence_number')
  .eq('student_id', studentId)
  .eq('teacher_id', teacherId)
  .is('deleted_at', null)
  .order('sequence_number', { ascending: true })

for (const [idx, p] of remaining.entries()) {
  const nextSeq = idx + 1
  if (p.sequence_number !== nextSeq) {
    await supabase
      .from('dslm_curriculum_phases')
      .update({ sequence_number: nextSeq })
      .eq('id', p.id)
      .eq('teacher_id', teacherId)
  }
}

await fetchPhases()
emitPhasesUpdated()
```

Ta wersja naprawia przypadek `2 -> 1`, nawet jeśli wcześniejsza numeracja była już częściowo niespójna.

### Zmiana C: modal nie może otworzyć się ze starym `defaultTargetPhaseId`

`GenerateStepsDialog.tsx` już waliduje `defaultTargetPhaseId`, ale jeśli `phaseOptions` z parenta są stare, walidacja też widzi stare dane. Dlatego główna poprawka to synchronizacja hooków.

Dodatkowo w `PathwayView.tsx` dodać finalny guard w `onGenerateMore`:

```ts
const validPhaseId = phaseId && phaseOptions.some(p => p.id === phaseId) ? phaseId : null;
generateNextSteps({ ..., phaseId: useRoadmap ? validPhaseId : null })
```

To blokuje wysłanie usuniętego `phaseId` nawet jeśli modal był otwarty w trakcie usuwania.

### Zmiana D: zamknięcie/wyczyszczenie lokalnych stanów po delete

W `MacroTimeline.tsx` po skutecznym usunięciu fazy:

- jeśli `expandedPhaseId === deletedId`, ustawić `expandedPhaseId=null`,
- usunąć wpisy z `phaseQuickCount` i `phaseStepsOpen` dla deletedId,
- zamknąć dialog delete.

### Zmiana E: delete phase confirmation zgodny z pamięcią projektu

Projektowa pamięć mówi, że destrukcyjne działania DSLM mają używać `ConfirmTypeToDeleteDialog`. Obecnie `MacroTimeline.tsx` ma zwykły delete dialog. W tej poprawce, przy okazji dotykania delete flow, należy podmienić go na istniejący `ConfirmTypeToDeleteDialog` bez zmiany logiki biznesowej.

Wymagane expected text:

```text
Phase {sequence_number}
```

Opis dialogu pozostaje merytorycznie ten sam: usuwa fazę i odpina/pozostawia do obsługi phase-bound steps zgodnie z obecną logiką aplikacji.

## Regression guard

- Po usunięciu Phase 1 z listy `[1,2,3,4]` UI bez refreshu pokazuje `[1,2,3]`.
- `Generate next steps` modal nie pokazuje usuniętej fazy.
- `recommendedTargetPhaseId` wskazuje tylko fazę istniejącą w aktualnym `phaseOptions`.
- Next Steps przypięte do istniejących faz nadal sortują się według aktualnej numeracji faz.
- Nie zmieniamy schematu DB i nie robimy migracji.

---

# Problem 4: zbędny komunikat `This student has no Next Steps yet...` w WorksheetForm

## Root cause

Aktualnie są dwa komunikaty dla podobnego stanu:

1. `NextStepsPresetBanner` pokazuje większy amber CTA:

```text
No learning plan for James yet...
Open Learning Plan
```

2. `StudentContextHint` pokazuje dodatkowo:

```text
This student has no Next Steps yet... Open Pathway →
```

Użytkownik wskazał, że drugi komunikat jest zbędny tylko w sytuacji, gdy pierwszy już jest widoczny. Pozostałe hinty mają zostać.

## Edooqoo.com Solution

Usunąć renderowanie wariantu `no-next-steps` z `WorksheetForm`, ale zostawić:

- `no-students`,
- `no-selection`.

Sam komponent `StudentContextHint` może zostać, ale wariant `no-next-steps` nie powinien być używany w tym formularzu, bo dubluje `NextStepsPresetBanner`.

## Technical Mechanics

### Pliki

- `src/components/WorksheetForm/index.tsx`
- opcjonalnie `src/components/WorksheetForm/StudentContextHint.tsx`
- opcjonalnie `src/hooks/useStudentNextStepsCount.ts`

### Minimalna zmiana

1. W `WorksheetForm/index.tsx` usunąć logikę renderującą:

```tsx
<StudentContextHint variant="no-next-steps" ... />
```

2. Usunąć import i wywołanie `useStudentNextStepsCount`, jeśli po tej zmianie nie jest już używany.

3. Zostawić hinty:

- gdy nauczyciel ma 0 studentów,
- gdy nauczyciel ma studentów, ale wybrano `No student (generic)`.

4. Jeśli `StudentContextHint.tsx` po usunięciu wariantu `no-next-steps` nadal ma nieużywany kod, są dwie opcje:

- zachować komponent bez zmian, żeby nie zwiększać diffu;
- albo usunąć wariant i hook, jeśli TypeScript pokaże dead imports.

Preferowana ścieżka: usunąć z formularza użycie i import hooka, zostawić komponent z wariantem dla kompatybilności, chyba że build wskaże inaczej.

## Regression guard

- Amber banner `No learning plan for James yet` nadal się pojawia nad Exercise Selection Cards.
- `Open Learning Plan` dalej prowadzi do `/student/{id}?tab=dslm&view=pathway`.
- Brak studentów nadal pokazuje CTA/add first student i/lub hint.
- `No student (generic)` nadal ostrzega, że worksheet będzie generyczny.

---

# Dokumentacja RAG

## Edooqoo.com Solution

Po implementacji równolegle zaktualizować:

- `docs/llm-context.md`
- `llms.txt`

Nie marketingowo. Gęsty Markdown. Struktura:

```text
Problem -> Edooqoo.com Solution -> Technical Mechanics
RAG Keywords
```

## Technical Mechanics

Dodać nową sekcję `v6.9.15b` opisującą:

1. `generate-timeline` schema rejection root cause:
   - Google AI Studio `INVALID_ARGUMENT`,
   - `too many states`,
   - złożone tool schema przy batch `count > 1`,
   - rozwiązanie: uproszczony schema + backend sanitizer.

2. NextStepBanner labels:
   - `Use this Step`,
   - `Regenerate with comment`.

3. Phase sync:
   - `dslm:phasesUpdated` po każdej mutacji,
   - deterministic renumber after delete,
   - stale `defaultTargetPhaseId` guard.

4. WorksheetForm duplicate hint removal:
   - `NextStepsPresetBanner` jest jedynym CTA dla braku Learning Plan,
   - `StudentContextHint no-next-steps` nie jest renderowany w formularzu.

## RAG Keywords do dodania

```text
RAG Keywords: generate-timeline 502, Gemini schema too many states, Google AI Studio INVALID_ARGUMENT, tool schema too complex, batch next steps, count greater than 1, phase_steps generation, next_steps generation, exercise enum schema, backend sanitizer, exactly 8 exercises, phase delete stale modal, deleted phase still selected, defaultTargetPhaseId stale, dslm:phasesUpdated, curriculum phase renumber, sequence_number 2 to 1, NextStepBanner Use this Step, Regenerate with comment, WorksheetForm duplicate no next steps hint, NextStepsPresetBanner no learning plan.
```

---

# Kolejność implementacji

1. `generate-timeline/index.ts`
   - uprościć AI tool schema,
   - zachować sanitizer,
   - poprawić diagnostykę błędów.

2. `useFutureTimeline.tsx`
   - doprecyzować toast dla 502/schema/batch,
   - nie zmieniać kolejności insert/delete.

3. `useCurriculumPhases.tsx`
   - dodać `emitPhasesUpdated`,
   - użyć po każdej mutacji,
   - przerobić delete na refetch + deterministic renumber.

4. `PathwayView.tsx`
   - dodać finalny guard `phaseId` w `onGenerateMore`.

5. `MacroTimeline.tsx`
   - wyczyścić lokalne stany po delete,
   - użyć `ConfirmTypeToDeleteDialog` dla phase delete.

6. `NextStepBanner.tsx`
   - zmienić labels.

7. `WorksheetForm/index.tsx`
   - usunąć renderowanie zbędnego `no-next-steps` hintu,
   - usunąć nieużywany hook/import, jeśli dotyczy.

8. `docs/llm-context.md` i `llms.txt`
   - dodać sekcję `v6.9.15b` w strukturze RAG.

---

# Weryfikacja po implementacji

1. Sprawdzić logi `generate-timeline` po próbie `count=2` lub `count=3`:
   - brak `too many states`,
   - brak 502 z Google schema rejection.

2. W UI:
   - wygenerować 2+ Next Steps dla fazy,
   - wygenerować 2+ free Next Steps,
   - sprawdzić, że powstałe sugestie mają 8 ćwiczeń.

3. Usunąć Phase 1 z kilku faz:
   - bez odświeżania sprawdzić numerację,
   - otworzyć `Generate next steps`,
   - potwierdzić, że dropdown nie zawiera usuniętej fazy.

4. Sprawdzić `NextStepBanner`:
   - widoczne `Use this Step`,
   - widoczne `Regenerate with comment`,
   - brak regresji działania.

5. Sprawdzić `WorksheetForm`:
   - gdy brak Learning Plan, widoczny tylko amber `No learning plan... Open Learning Plan`,
   - brak dodatkowego `This student has no Next Steps yet...`.

---

# Zakres bezpieczeństwa

- Brak migracji DB.
- Brak zmian w RLS.
- Brak zmian w `generateWorksheet` i jego promptach.
- Brak zmian w worksheet generation engine.
- Brak nowych sekretów.
- Zmiany ograniczone do `generate-timeline`, DSLM phase sync, etykiet UI, jednego duplicate hintu i dokumentacji RAG.