## Plan v6.9.67 — Naprawy: Paste-Intake 502, Student-Hub flashcard modal, audyt tłumaczeń, semantyka Skip / IDK

> Wszystkie zmiany mieszczą się w 4 izolowanych obszarach. Worksheet Generation Engine NIE jest dotykany.

---

### PROBLEM 1 — `extract-student-profile` zwraca 502

**Dependency scan:** `supabase/functions/extract-student-profile/index.ts`, `supabase/functions/_shared/aiChat.ts`, `src/components/dashboard/PasteIntakeSection.tsx` (klient).

**Root cause:** Funkcja deklaruje narzędzie OpenAI-style (`tools[].function.parameters`) z polami JSON-Schema, których Gemini **odrzuca** (`additionalProperties`, `maxLength`, `maxItems`, `minimum`, `maximum`). Dodatkowo `chatCompletion` w `_shared/aiChat.ts` mapuje `tools` na `functionDeclarations`, ale **nie przekazuje `tool_choice`** → Gemini nie wymusza function-callu i odpowiada zwykłym tekstem albo `400 Invalid Schema`. Skutek: `aiResp.ok=false` → funkcja zwraca 502 `ai_error`. Stary check `LOVABLE_API_KEY` jest martwy (Gateway już nieużywany) i myli debugging.

**Selected solution:** Rozszerzyć `_shared/aiChat.ts` o (a) sanitizację schematu `functionDeclarations` (usuwanie nieobsługiwanych przez Gemini kluczy) i (b) mapowanie `tool_choice` → `toolConfig.functionCallingConfig` (mode `ANY` + `allowedFunctionNames`). Usunąć martwą bramkę `LOVABLE_API_KEY` z `extract-student-profile/index.ts` (zostaje walidacja `GEMINI_API_KEY || OPENAI_API_KEY` po stronie helpera — helper zwraca 503 jeśli żadnego nie ma). Zachować pełną kompatybilność z innymi callerami (`translate-flashcard`, `classify-knowledge-entry`, …) bo `sanitizeForGemini` jest idempotentna dla schematów bez ww. kluczy.

**Implementation:**

```ts
// supabase/functions/_shared/aiChat.ts  (dodać helper + użyć w toGeminiBody)
const GEMINI_DISALLOWED = new Set([
  "additionalProperties","maxLength","minLength","minimum","maximum",
  "maxItems","minItems","exclusiveMinimum","exclusiveMaximum","pattern",
  "patternProperties","default","examples","$schema","$id","title",
]);
function sanitizeForGemini(node: any): any {
  if (Array.isArray(node)) return node.map(sanitizeForGemini);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (GEMINI_DISALLOWED.has(k)) continue;
      out[k] = sanitizeForGemini(v);
    }
    return out;
  }
  return node;
}

// w toGeminiBody — zamiast `tools: tools.map(t => t.function)` użyć
if (tools?.length) {
  out.tools = [{ functionDeclarations: tools.map((t) => sanitizeForGemini(t.function)) }];
  const choice = (openaiBody as any).tool_choice;
  if (choice && typeof choice === "object" && choice.function?.name) {
    out.toolConfig = {
      functionCallingConfig: { mode: "ANY", allowedFunctionNames: [choice.function.name] },
    };
  } else if (choice === "required") {
    out.toolConfig = { functionCallingConfig: { mode: "ANY" } };
  } else if (choice === "auto" || choice === undefined) {
    out.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }
}
```

```ts
// supabase/functions/extract-student-profile/index.ts
// 1) usunąć linie z LOVABLE_API_KEY (deklarację i if(!LOVABLE_API_KEY)).
// 2) dodać czytelniejszy fallback gdy brak tool_calls — spróbować
//    sparsować data.choices[0].message.content jako JSON i zbudować
//    extraction (Gemini bez wymuszonego function-call wraca tekstem JSON).
```

**Patch w `extract-student-profile`** (fragment parsowania):
```ts
const msg = data?.choices?.[0]?.message;
let extraction: any = null;
const call = msg?.tool_calls?.[0];
if (call?.function?.arguments) {
  try { extraction = JSON.parse(call.function.arguments); } catch {}
}
if (!extraction && typeof msg?.content === "string") {
  try { extraction = JSON.parse(msg.content); } catch {}
}
if (!extraction) {
  return new Response(JSON.stringify({ error: "no_tool_call" }), { status: 502, ... });
}
```

**Impact analysis:** Sanitizacja zwraca identyczny obiekt dla schematów bez zakazanych kluczy → callerzy `translate-flashcard`, `verify-open-answers`, `classify-knowledge-entry`, `extract-student-profile`, `suggest-exercises`, `generate-curriculum-phases`, `translate-flashcard`, `process-welcome-test`, `generate-timeline` zachowują obecne zachowanie. `tool_choice` mapowanie jest opcjonalne; brak zmian w gałęzi OpenAI fallback.

**Verification checklist:**
- [ ] `supabase/functions/_shared/aiChat.ts` zawiera `sanitizeForGemini` i mapowanie `tool_choice` → `toolConfig`.
- [ ] `extract-student-profile`: brak referencji do `LOVABLE_API_KEY`; dodany fallback content-parse.
- [ ] Ręczny test w UI (Add Student → toggle Paste notes → Analyze) zwraca `extraction` zamiast toast „AI extraction failed”.
- [ ] Edge logs `extract-student-profile` → status 200, model `gemini-2.5-flash`.

---

### PROBLEM 2 — Modal „Add a flashcard” na `/my` ma złe pola i brak auto-AI

**Dependency scan:** `src/components/student-hub/AddStudentFlashcardDialog.tsx`, `src/pages/StudentHubFlashcards.tsx`, `src/hooks/useStudentHubData.tsx`, `src/components/flashcards/AddFlashcardModal.tsx` (referencja UX), `supabase/functions/get-student-hub-data/index.ts`, RPC `student_add_flashcard`.

**Root cause:** `AddStudentFlashcardDialog` to osobna, uproszczona implementacja z generycznymi etykietami „Front / Back / Native translation (optional)” — nie odróżnia setów `translation` od `definition`, nie zna `native_language` studenta, nie wywołuje `translate-flashcard`. Hub data nie wystawia `nativeLanguage`.

**Selected solution:** Doprowadzić student-side modal do parytetu z `AddFlashcardModal` nauczyciela poprzez (a) wzbogacenie endpointu `get-student-hub-data` o `nativeLanguage` (+ `studentNativeLanguage` w `StudentHubData` / props) i (b) przepisanie `AddStudentFlashcardDialog` aby używał hooków `useFlashcardTranslation` / `useFlashcardDefinition` oraz dokładnie tych samych etykiet/pól co modal nauczyciela. RPC `student_add_flashcard` zachowujemy bez zmian — przekażemy `p_native = null` (back zawiera już native lub definition; pole „native_text” to redundancja, którą eliminujemy zgodnie z konwencją nauczycielską).

**Implementation:**

1. `supabase/functions/get-student-hub-data/index.ts`
   - Wiersz 255: `.select('id, name, english_level, student_email, native_language')`
   - Wiersz 516–517 (response): dodać `nativeLanguage: studentData.native_language ?? null`

2. `src/hooks/useStudentHubData.tsx` — w `StudentHubData` dodać `nativeLanguage: string | null`.

3. `src/pages/StudentHubFlashcards.tsx` — przekazać do dialogu:
```tsx
<AddStudentFlashcardDialog
  setId={set.id}
  setTitle={set.title}
  studentEmail={email}
  backType={set.back_type === 'translation' ? 'translation' : 'definition'}
  studentNativeLanguage={data?.nativeLanguage || 'English'}
  onAdded={() => refetch?.()}
/>
```

4. `src/components/student-hub/AddStudentFlashcardDialog.tsx` — pełen rewrite (zero placeholderów). Logika 1:1 z `AddFlashcardModal`:
   - Pola: `English Term *`, `Example Sentence (optional)`, dynamicznie `{nativeLanguage} Translation *` LUB `English Definition *`.
   - Hooki `useFlashcardTranslation({ targetLanguage: nativeLanguage, enabled: backType==='translation' })` i `useFlashcardDefinition({ enabled: backType==='definition' })` — debounce 800 ms.
   - Auto-fill `backText` jeśli user nie edytował (`userEditedBackText` flag).
   - Loader (`Loader2`) wewnątrz inputa podczas `isTranslating`/`isLoadingDefinition`.
   - Sekcja `Preview` z `Front / Back / cefr_level badge` (identyczna jak nauczyciel).
   - Submit nadal woła `supabase.rpc('student_add_flashcard', { p_set_id, p_student_email, p_front, p_back, p_native: null })`. Obsługa błędów `contributions_disabled`, `student_not_authorized`, `empty_card` jak teraz.

**Impact analysis:** Endpoint `get-student-hub-data` dodaje tylko jedno pole — istniejący klient ignoruje. Zmiany w `StudentHubFlashcards.tsx` są przekazywaniem nowych propsów. Brak nowych RPC, brak migracji. Wpływ na inne miejsca: zero (`AddFlashcardModal` nauczyciela nietknięty, hooki `useFlashcardTranslation`/`useFlashcardDefinition` używane już w produkcji).

**Verification checklist:**
- [ ] Student z natywnym hiszpańskim na secie `translation` widzi etykietę „Spanish Translation *”, po wpisaniu terminu pojawia się auto-tłumaczenie (loader → wynik) + badge CEFR w preview.
- [ ] Student na secie `definition` widzi „English Definition *”, auto-definicja działa.
- [ ] Po zapisie karta pojawia się w secie (`created_by_student=true`), brak błędu `student_not_authorized`.
- [ ] Pole „Native translation (optional)” całkowicie usunięte z modala.

---

### PROBLEM 3 — Audyt kompletności tłumaczeń welcome-testu

**Dependency scan:** `src/data/welcomeTestTranslations.ts`, `src/data/welcomeTestQuestions.ts`, `src/pages/WelcomeTestPage.tsx`.

**Status faktyczny po audycie:**
- 25 języków, każdy ma identyczne 34 ID profilingowe → 100% pokrycia istniejącej listy.
- **5 ID profilingowych dodanych po ostatnim sync’u nie ma tłumaczeń w żadnym z 25 języków:** `wt_q39` (scenario_reaction, communication), `wt_q16s` (speaking, scenarios), `wt_q18l` (listening_comprehension, scenarios), `wt_q36s` (speaking, communication), `wt_q41s` (speaking, goals). Są to instrukcje/opisy (nie testy gramatyki), więc kwalifikują się do tłumaczenia.
- UI welcome-testu (przyciski `Skip`, `I don't know`, `InstructionScreen`) NIE jest tłumaczone — to świadoma decyzja produktu (brak globalnego i18n w aplikacji). Pozostawiamy bez zmian.

**Root cause:** Brak procesu synchronizacji `welcomeTestQuestions.ts` ↔ `welcomeTestTranslations.ts` przy dodaniu nowego pytania profilingowego.

**Selected solution:** (a) Uzupełnić brakujące 5 ID we wszystkich 25 językach. (b) Dodać samosprawdzający się skrypt walidacyjny `scripts/audit-welcome-test-translations.mjs`, który listuje ID profilingowe z `welcomeTestQuestions.ts` (typy `preference_choice`, `scenario_reaction`, `open_reflection`, `self_assessment`, `self_assessment_matrix`, `speaking_record`, `listening_comprehension` z sekcji innych niż `vocab_grammar`) i porównuje z każdym z 25 setów translacji; exit 1 gdy luka. Skrypt uruchamiamy ręcznie (nie blokujemy build’a w tym sprincie).

**Implementation (pełne treści tłumaczeń — 5 ID × 25 języków = 125 wpisów):**
Wzór jednego wpisu (Polish, q16s):
```ts
'wt_q16s': {
  question: 'Opisz problem z pokojem hotelowym — zadanie głosowe.',
  description: 'Wyobraź sobie, że jesteś w recepcji. Wybierz jeden problem (zepsuta klimatyzacja, brudna łazienka, hałaśliwi sąsiedzi, brakujące ręczniki) i nagraj się, jak go wyjaśniasz i prosisz o pomoc. Nagraj do 60 sekund. Mów naturalnie — płynność i wymowa są ważniejsze niż perfekcyjna gramatyka.',
},
```
Treści dla pozostałych 4 ID (q18l, q36s, q39, q41s) w identycznej strukturze. Implementacja w build mode wygeneruje pełne 125 wpisów (po jednym bloku `'wt_qXX': {...}` doklejonym na końcu każdego z 25 obiektów `*: TranslationSet`).

**Impact analysis:** Tylko dane stałe. Funkcja `getTranslation` już obsługuje fallback `null` → angielski oryginał, więc nic się nie psuje przy ewentualnej literówce. Skrypt audytowy jest opt-in (poza pipeline).

**Verification checklist:**
- [ ] `node scripts/audit-welcome-test-translations.mjs` kończy się exit 0.
- [ ] W teście welcome ze studentem-PL pytania q16s / q18l / q36s / q39 / q41s pokazują polskie tłumaczenie pod oryginalnym tekstem.

---

### PROBLEM 4 — Semantyka „Skip” i „I don't know” w welcome teście

**Dependency scan:** `src/hooks/useWelcomeTest.tsx` (`saveIdontKnow`, `skipQuestion`, `commitAnswer`), `src/pages/WelcomeTestPage.tsx` (przyciski), `supabase/functions/process-welcome-test/index.ts` (interpretacja `__IDK__`), tabela `student_events`.

**Stan obecny:**
- **I don't know:** zapisuje wartość `'__IDK__'` w `state.answers`, woła `commitAnswer` → wpis do `student_test_questions` + event `test_answer_submitted` z `is_correct=false` (lub `null` gdy brak `nano_skill`), `nano_skill_ratings.mastery=0`, brak `detected_traits`. `process-welcome-test` traktuje to jako pomyłkę umiejętności (`idkCountSkill` osobno zliczany), ale w `student_events` nie ma flagi odróżniającej „uczciwe nie wiem” od „błędna odpowiedź”.
- **Skip:** tylko nawigacja w przód — **żaden ślad w DB**. Nauczyciel nie widzi, że pytanie zostało pominięte (a w sekcjach profilujących to ważny sygnał, np. „nie chcę odpowiadać”).

**Root cause:** Brak rozróżnienia trzech intencji ucznia: (1) udzielił odpowiedzi, (2) świadomie zaznaczył „nie wiem”, (3) pominął. Wszystko trafia albo do `is_correct=false`, albo donikąd.

**Selected solution:** Zachować obecny model danych (single source of truth = `student_test_questions` + `student_events`), dorzucić dwie flagi do `event_payload`:
- `is_idk: true` przy commit po `saveIdontKnow`.
- `is_skipped: true` z dedykowanym `event_type='test_answer_skipped'` przy każdym kliknięciu Skip (przy pominięciu zapisuje też `student_test_questions.answered_at = now` z `answer = null` — żeby panel postępu UI mógł odróżnić „odwiedzone i pominięte” od „w ogóle nie widziane”).
Brak migracji — `event_payload` jest jsonb; `event_type='test_answer_skipped'` jest dozwolone (kolumna jest swobodnym text). Process-welcome-test pozostaje bez zmian (ignoruje nowy event_type, nie obniża skill score).

**Implementation:**

1. `src/hooks/useWelcomeTest.tsx`:

```ts
// commitAnswer: rozszerz parametry o opcjonalne meta
const commitAnswer = useCallback(async (
  questionId: string,
  answer: unknown,
  opts: { isIdk?: boolean } = {},
) => {
  // ... istniejący kod ...
  p_event_payload: {
    answer_id: canonicalId,
    legacy_answer_id: questionId,
    exercise_type: questionDef.question_type,
    exercise_index: questionIndex,
    is_correct: isCorrect,
    is_idk: opts.isIdk === true ? true : undefined,
    nano_skill_ratings: nanoSkillRatings,
    detected_traits: detectedTraitData,
    time_spent_seconds: timeSpent,
  },
  // ...
}, [...]);

// saveIdontKnow: przekaż flagę
const saveIdontKnow = useCallback((questionId: string) => {
  setState(prev => ({ ...prev, answers: { ...prev.answers, [questionId]: '__IDK__' } }));
  commitAnswer(questionId, '__IDK__', { isIdk: true });
}, [commitAnswer]);

// skipQuestion: zaloguj event_type='test_answer_skipped' + answer=null w student_test_questions
const skipQuestion = useCallback(async () => {
  await flushSpeakingIfNeeded();
  await flushPendingAnswer();
  const section = sections[state.currentSectionIndex];
  const questionDef = section?.questions[state.currentQuestionIndex];
  if (state.testId && questionDef && state.studentId && state.teacherId) {
    const questionIndex = computeFlatQuestionIndex(sections, state.currentSectionIndex, state.currentQuestionIndex);
    await supabase
      .from('student_test_questions')
      .update({ answered_at: new Date().toISOString(), answer_data: null })
      .eq('test_id', state.testId)
      .eq('question_index', questionIndex);
    await supabase.rpc('add_student_event', {
      p_student_id: state.studentId,
      p_teacher_id: state.teacherId,
      p_event_type: 'test_answer_skipped',
      p_event_source: 'welcome_test',
      p_source_id: state.testId,
      p_element_type: questionDef.element_type || questionDef.question_type || null,
      p_event_payload: {
        answer_id: toCanonicalId(questionDef.id),
        legacy_answer_id: questionDef.id,
        exercise_type: questionDef.question_type,
        exercise_index: questionIndex,
        is_skipped: true,
      } as unknown as Json,
      p_skill_ids: questionDef.nano_skill ? [questionDef.nano_skill] : [],
    });
  }
  await goToNext();
}, [...]);
```

2. `supabase/functions/process-welcome-test/index.ts` — bez zmian (już ignoruje nieznane event_type w pętli skill aggregation).

**Impact analysis:** Zero zmian schematu DB. `student_events.event_type` jest tekstowe, więc nowa wartość `test_answer_skipped` zostanie zapisana bez błędu. Istniejące zapytania filtrują po konkretnych typach, więc nowy typ nie zaśmieci agregatów (np. `idkCountSkill` w process-welcome-test). RAG dla nauczyciela zyskuje sygnał „student avoids X”.

**Verification checklist:**
- [ ] Klik „I don't know” → w `student_events` event `test_answer_submitted` z `event_payload->>is_idk = 'true'`.
- [ ] Klik „Skip” → event `test_answer_skipped`, `student_test_questions.answered_at` ustawione, `answer_data IS NULL`.
- [ ] `process-welcome-test` nadal zwraca poprawny `estimatedLevel` (skipped questions nie wpływają na skill score — bo nie ma `is_correct`).
- [ ] UI welcome-testu działa identycznie (przyciski w tym samym miejscu, zachowanie nawigacji bez zmian).

---

## RAG INJECTION

Aktualizacje do `docs/llm-context.md` i `public/llms.txt`:

```
PROBLEM: extract-student-profile zwracało 502 po migracji na bezpośredni endpoint Gemini.
EDOOQOO SOLUTION: chatCompletion helper sanitizuje schematy narzędzi pod ograniczenia Gemini i mapuje tool_choice → toolConfig.
TECHNICAL MECHANICS: supabase/functions/_shared/aiChat.ts (sanitizeForGemini + toolConfig.functionCallingConfig); usunięto martwy LOVABLE_API_KEY guard w extract-student-profile; fallback parser content-as-JSON dodany.
RAG KEYWORDS: gemini function calling, tool_choice, function declarations, additionalProperties, JSON schema sanitization, paste intake, student profile extraction, 502 bad gateway, edge function debugging, Lovable Gateway migration, OpenAI fallback, AI hot path, aiChat helper, structured output, generateContent
```

```
PROBLEM: Studenci nie mogli dodać dobrze sformatowanej fiszki ze swojej strony /my (złe etykiety, brak AI autosuggest).
EDOOQOO SOLUTION: AddStudentFlashcardDialog osiąga parytet UX z teacher AddFlashcardModal; get-student-hub-data wystawia native_language.
TECHNICAL MECHANICS: useFlashcardTranslation + useFlashcardDefinition w student dialogu; backType prop z back_type setu; RPC student_add_flashcard bez zmian (p_native=null); StudentHubData.nativeLanguage; get-student-hub-data SELECT native_language.
RAG KEYWORDS: student hub flashcards, student-add-flashcard RPC, native_language, translation auto-suggest, definition auto-suggest, CEFR badge, AddFlashcardModal parity, back_type translation definition, allow_student_contributions, student authorization, hub_token, flashcard set, learner contributions
```

```
PROBLEM: Audyt tłumaczeń welcome-testu wskazał 5 nowo dodanych pytań profilingowych bez tłumaczeń w 25 językach.
EDOOQOO SOLUTION: Uzupełnione pełne tłumaczenia dla wt_q16s, wt_q18l, wt_q36s, wt_q39, wt_q41s; dodany skrypt walidacyjny.
TECHNICAL MECHANICS: src/data/welcomeTestTranslations.ts (+125 wpisów); scripts/audit-welcome-test-translations.mjs (diff IDs vs translations); fallback getTranslation→null pozostaje bezpieczny.
RAG KEYWORDS: welcome test translations, profiling questions, scenario_reaction, speaking_record, listening_comprehension, translation parity, 25 languages, getTranslation fallback, audit script, completeness check
```

```
PROBLEM: Skip i I-don't-know w welcome-teście traktowane były nierozróżnialnie od błędnej odpowiedzi lub w ogóle nie były zapisywane.
EDOOQOO SOLUTION: event_payload.is_idk + dedykowany event_type test_answer_skipped + answered_at na student_test_questions.
TECHNICAL MECHANICS: useWelcomeTest.commitAnswer akceptuje opts.isIdk; skipQuestion loguje add_student_event(test_answer_skipped) + UPDATE student_test_questions answer_data=null; process-welcome-test bez zmian.
RAG KEYWORDS: welcome test skip, I don't know, IDK, student_events, test_answer_submitted, test_answer_skipped, calibration honesty, skill score aggregation, profiling avoidance signal, andragogy
```

---

## CHANGE REPORT (po implementacji)

- Files to modify:
  - `supabase/functions/_shared/aiChat.ts`
  - `supabase/functions/extract-student-profile/index.ts`
  - `supabase/functions/get-student-hub-data/index.ts`
  - `src/components/student-hub/AddStudentFlashcardDialog.tsx` (rewrite)
  - `src/pages/StudentHubFlashcards.tsx`
  - `src/hooks/useStudentHubData.tsx`
  - `src/hooks/useWelcomeTest.tsx`
  - `src/data/welcomeTestTranslations.ts` (+125 wpisów)
- Files to create:
  - `scripts/audit-welcome-test-translations.mjs`
  - `mem/features/welcome-test/skip-idk-semantics.md`
- Docs:
  - `docs/llm-context.md` + `public/llms.txt` (cztery bloki PROBLEM/SOLUTION/MECHANICS/KEYWORDS)
  - aktualizacja `mem/index.md`
- Sanctity: Worksheet Generation Engine nietknięty.
- Out-of-scope flags: brak globalnego i18n dla UI welcome-testu (świadomie pominięte — wymaga osobnego planu).

Zatwierdź plan, a w kolejnym kroku wdrożę całość w jednej iteracji.
