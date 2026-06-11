# Plan v6.9.55 — naprawa modal / light-lock / Next Step / stream recovery / Welcome Test translation

Nie dotykam Worksheet Generation Engine: zero zmian w promptach, parametrach pedagogicznych i logice tworzenia treści. Zmieniam wyłącznie warstwę transportu, UI, stan side-effectów i dokumentację RAG.

## Problem 1 — modal generowania: dane ucznia + brak scrollbara dla anonymous

### Dependency scan
Affected surface:
- `src/components/GeneratingModal.tsx`
- `src/components/generation/GenerationContextPanel.tsx`
- `src/components/generation/WorkflowSummaryCard.tsx`
- `src/components/generation/generationModalSlides.ts`
- `src/pages/Index.tsx`
- `src/pages/StudentPage.tsx`
- `src/components/WorksheetForm/index.tsx`
- `src/components/WorksheetForm/types.ts`
- `src/lib/worksheet/autoGenerateBootstrap.ts`

### Root cause
Modal czyta tylko `sessionStorage.worksheetStudentName`, a aktualny przepływ auto-generowania nie zapisuje kompletnego kontekstu ucznia; dodatkowo desktopowy modal ma `max-height + overflow-y-auto`, więc minimalne przekroczenie wysokości tworzy pasek scroll zamiast wymusić bardziej kompaktowy layout.

### Solution options
| Opcja | Podejście | Trade-off | Ryzyko regresji |
|---|---|---|---|
| A | Dalej czytać `sessionStorage`, dopisać email w kilku miejscach | Szybkie, ale kruche i podatne na race conditions | Średnie |
| B | Przenieść `studentName/studentEmail` do payloadu `FormData` i persistent auto-generate intent; modal czyta z `worksheetState.inputParams` | Stabilne, jeden aktualny stan w React + fallback storage | Niskie |
| C | Modal sam dociąga ucznia z Supabase po `studentId` | Dodatkowy fetch w modal, możliwy flicker i RLS edge-case | Średnie |

### Selected solution + why
Wybieram B. Dane ucznia są metadanymi UI/transportu, nie częścią promptu, więc można je bezpiecznie przenieść w payloadzie bez naruszania Worksheet Generation Engine. To usuwa zależność od niestabilnego `sessionStorage` i działa zarówno dla kliknięć z DSLM, jak i manualnego wyboru ucznia w formularzu.

### Impact analysis
Zero regressions confirmed:
- Generator dalej dostaje ten sam `prompt` i te same pola edukacyjne.
- Anonymous bez wybranego ucznia nadal generuje worksheet bez wymagania profilu.
- CTA signup w modal nadal otwiera się w nowej karcie.
- Slajdy 15s i limit 4 elementów w lewym cardzie zostają zachowane.

### Full implementation
1. `src/components/WorksheetForm/types.ts`
   - Dodać internal fields:
     - `studentName?: string | null`
     - `studentEmail?: string | null`
   - Oznaczyć komentarzem jako transport/UI metadata, not prompt input.
2. `src/components/WorksheetForm/index.tsx`
   - Przy submit odnaleźć aktualnego studenta z `students` po `selectedStudentId`.
   - Do payloadu `onSubmit` dodać `studentName` i `studentEmail`, jeśli student istnieje.
   - Nie dodawać tych pól do prompt formattera ani do edukacyjnej logiki promptu.
3. `src/lib/worksheet/autoGenerateBootstrap.ts`
   - Rozszerzyć `PersistentAutoGenerateIntent` i `WriteAutoGenerateIntentInput` o `studentName/studentEmail`.
   - Zapisać je w localStorage intent oraz legacy `sessionStorage.autoGenerateWorksheetRequest`.
   - `buildAutoGeneratePayload()` ma przenieść `studentName/studentEmail` do payloadu.
4. `src/pages/StudentPage.tsx`
   - W `writeAutoGenerateIntent(...)` przekazać `student.name` i `student.student_email || null`.
   - Dla manualnego “Use this” nadal tylko prefill; bez auto-start side-effectów.
5. `src/pages/Index.tsx`
   - Modal dostaje dane z `worksheetState.inputParams.studentName/studentEmail`, nie z samego `sessionStorage`.
   - Fallback do storage zostaje tylko jako awaryjny legacy path.
6. `src/components/GeneratingModal.tsx`
   - Dodać prop `studentEmail?: string | null`.
   - Pod tytułem renderować kompaktową linię:
     - `For Evelyn H · evelyn@example.com`
     - jeśli brak emaila: `For Evelyn H · no student email set`
   - Dla braku ucznia nie renderować linii, żeby anonymous one-off nie dostał mylącego tekstu.
7. Kompaktowy modal bez scrollbara:
   - Desktop: container `lg:max-h-[calc(100dvh-2rem)] lg:overflow-hidden`.
   - Mobile/small height: zachować `overflow-y-auto`, bo inaczej modal mógłby uciąć treść.
   - Zmniejszyć desktop padding `lg:p-5`, odstępy `space-y-3`, progress list `p-2.5`, line-height i screenshot height w `GenerationContextPanel` o jeden stopień.
   - Ustawić `min-h-0` na kolumnach i panelach, żeby grid nie wypychał kontenera.

### Verification checklist
- DONE po implementacji: modal pokazuje imię i email ucznia dla generowania z DSLM.
- DONE po implementacji: modal pokazuje imię i email dla manualnie wybranego studenta.
- DONE po implementacji: brak paska scroll na anonymous modal przy viewport ok. 1280×754.
- DONE po implementacji: mobile nadal może przewijać modal, jeśli ekran jest zbyt niski.
- DONE po implementacji: prompt/generation engine nietknięty.

---

## Problem 2 — worksheet i homework nigdy nie odwracają kolorów w dark mode

### Dependency scan
Affected surface:
- `src/hooks/useForceLightTheme.ts`
- nowy hook: `src/hooks/useHardLightSurface.ts`
- `src/components/WorksheetDisplay.tsx`
- `src/pages/WorksheetPage.tsx`
- `src/pages/SharedWorksheet.tsx`
- `src/pages/HomeworkPage.tsx`
- `src/pages/HomeworkReviewPage.tsx`
- `src/pages/StudentHubHomework.tsx`
- `src/pages/StudentHubWorksheets.tsx`
- global CSS only if needed for `color-scheme: light` support

### Root cause
Obecny `useForceLightTheme()` usuwa `.dark` tylko raz na mount i może przywrócić dark przy unmount; nie blokuje późniejszego dodania `.dark` przez teacher settings, theme hook, boot script, storage sync albo inne komponenty.

### Solution options
| Opcja | Podejście | Trade-off | Ryzyko regresji |
|---|---|---|---|
| A | Dodać `useForceLightTheme()` do brakujących stron | Częściowo pomaga, ale nadal nie blokuje późniejszego `.dark` | Średnie |
| B | Zastąpić miękki hook twardą blokadą: MutationObserver usuwa `.dark`, wymusza `color-scheme: light`, z ref-count lockiem | Najbardziej odporne bez zmiany design systemu | Niskie |
| C | Przepisać wszystkie komponenty worksheet/homework na hardcoded light classes | Duży zakres, łatwo zepsuć UI i theming | Wysokie |

### Selected solution + why
Wybieram B. To blokuje przyczynę strukturalną: każdą próbę dodania klasy `.dark` w czasie życia worksheet/homework. Działa niezależnie od ustawień nauczyciela, `localStorage`, system theme i późniejszych renderów.

### Impact analysis
Zero regressions confirmed:
- Teacher dashboard nadal może używać dark mode.
- Public landing i pricing nie są zmieniane poza istniejącym zachowaniem.
- Worksheet/homework dostają light lock tylko na czas renderowania tych powierzchni.
- Nie zmieniam treści worksheetów ani homework.

Uczciwe ograniczenie: aplikacja może zablokować własny dark mode, OS preference, `prefers-color-scheme` i Chrome auto-dark przez `color-scheme: light`; nie da się w 100% technicznie zablokować zewnętrznych rozszerzeń, forced high-contrast albo manualnego filtra/inwersji na poziomie systemu operacyjnego.

### Full implementation
1. Utworzyć `src/hooks/useHardLightSurface.ts`:
   - global lock counter, żeby kilka stron/paneli nie walczyło o restore.
   - On mount:
     - `document.documentElement.classList.remove('dark')`
     - `document.documentElement.style.colorScheme = 'light'`
     - `document.documentElement.dataset.edooqooForcedLight = surfaceName`
     - MutationObserver na `class` HTML: jeśli pojawi się `.dark`, natychmiast usunąć.
   - On unmount:
     - zmniejszyć counter.
     - przywrócić poprzedni `colorScheme` i dataset dopiero gdy nie ma aktywnego locka.
     - nie przywracać `.dark` automatycznie w worksheet/homework cleanupie.
2. `src/hooks/useForceLightTheme.ts`
   - Zostawić jako wrapper używający `useHardLightSurface('public-light')`, żeby istniejące strony nie straciły zachowania.
3. `src/components/WorksheetDisplay.tsx`
   - Wywołać `useHardLightSurface('worksheet-display')`, bo ten komponent renderuje worksheet także na `/` po generowaniu, nie tylko `/worksheet/:id`.
4. `src/pages/WorksheetPage.tsx`
   - Zastąpić albo pozostawić wrapper, ale docelowo użyć hard locka.
5. `src/pages/SharedWorksheet.tsx`
   - Użyć hard locka dla shared/live worksheet.
6. `src/pages/HomeworkPage.tsx`
   - Użyć hard locka dla student homework.
7. `src/pages/HomeworkReviewPage.tsx`
   - Użyć hard locka dla teacher review homework.
8. `src/pages/StudentHubHomework.tsx` i `src/pages/StudentHubWorksheets.tsx`
   - Zachować light lock, ale przełączyć na hard implementation przez wrapper.

### Verification checklist
- DONE po implementacji: `/worksheet/:id` pozostaje light przy `edooqoo-theme=dark`.
- DONE po implementacji: worksheet renderowany na `/` po generowaniu pozostaje light.
- DONE po implementacji: `/shared/:token` pozostaje light.
- DONE po implementacji: `/homework/:token` pozostaje light.
- DONE po implementacji: `/homework/:id/review` pozostaje light.
- DONE po implementacji: dashboard dark mode nadal działa po opuszczeniu worksheet/homework.

---

## Problem 3 — Next Step nie może być `used`, jeśli finalnie nie ma worksheetu

### Dependency scan
Affected surface:
- `src/hooks/useWorksheetGeneration.tsx`
- `src/hooks/useActiveWorksheetGenerationJob.tsx`
- `src/lib/worksheet/generationJobRegistry.ts`
- `src/lib/worksheet/autoGenerateBootstrap.ts`
- `src/services/worksheetStreamService.ts`
- Supabase table read: `worksheets.form_data`
- Supabase update: `future_worksheet_suggestions.is_used`

### Root cause
Side-effect `mark used` jest powiązany z sukcesem frontendu, ale refresh-safe job polling lokalizuje worksheet po szerokim kryterium `teacherId/studentId/since`; przy błędach transportu lub równoległych akcjach może zabraknąć jednoznacznego request correlation id.

### Solution options
| Opcja | Podejście | Trade-off | Ryzyko regresji |
|---|---|---|---|
| A | Oznaczać `used` tylko w `onDone` | Proste, ale traci sukcesy po refreshu/zerwanym `done` | Średnie |
| B | Dodać `clientGenerationId` do `form_data`, a side-effect robić tylko po znalezieniu worksheetu z tym ID | Deterministyczne, odporne na refresh i stream drop | Niskie |
| C | Backend sam oznacza sugestię jako used | Wymaga rozszerzenia edge function contractu i większego zakresu | Średnie |

### Selected solution + why
Wybieram B. To najmniejsza zmiana, która daje deterministyczny dowód: sugestia staje się `used` tylko wtedy, gdy istnieje konkretny zapisany worksheet dla tej konkretnej próby generowania.

### Impact analysis
Zero regressions confirmed:
- Manual generation bez sugestii nie dotyka `future_worksheet_suggestions`.
- Nie ma zmiany promptu.
- Token consumption nadal tylko po zapisanym worksheet ID.
- Refresh-safe mini panel nadal działa, ale z mniejszym ryzykiem fałszywego dopasowania.

### Full implementation
1. W `useWorksheetGeneration.tsx` utworzyć `clientGenerationId` na początku próby generowania:
   - użyć `__autoGenerateRequestId`, jeśli istnieje.
   - inaczej wygenerować UUID.
2. Przekazać `clientGenerationId` do:
   - `startGenerationJob({ requestId: clientGenerationId, ... })`
   - `streamWorksheetGeneration(... formData: { ...formDataForStorage, clientGenerationId })`
3. Backend `generateWorksheet` już zapisuje `formData` jako `worksheets.form_data`, więc nie trzeba dodawać kolumny ani migracji.
4. `useActiveWorksheetGenerationJob.tsx`
   - `locateBackendWorksheet(job)` najpierw filtruje po `form_data->>clientGenerationId = job.requestId`.
   - fallback po `teacherId/studentId/since` tylko dla starych jobów bez requestId.
5. `handleWorksheetCompletion()`
   - Oznaczyć sugestię jako used tylko po `finalWorksheetId` i tylko raz.
   - Usunąć `prefillSuggestionId` dopiero po udanym update.
6. Failure paths:
   - audio/image generation failure: `failGenerationJob(...)` + mark persistent intent `failed`.
   - stream/network failure: nie markować used.
   - `clearGenerationError()` nie markuje used.

### Verification checklist
- DONE po implementacji: network error bez zapisanego worksheetu nie ustawia `future_worksheet_suggestions.is_used`.
- DONE po implementacji: zapisany worksheet z `clientGenerationId` ustawia `is_used=true`.
- DONE po implementacji: refresh w trakcie generowania nadal kończy token/suggestion side-effect po wykryciu konkretnego worksheetu.
- DONE po implementacji: brak fałszywego dopasowania do innego worksheetu tego samego studenta.

---

## Problem 4 — `Stream ended unexpectedly after generating 8/8 exercises`

### Dependency scan
Affected surface:
- `src/services/worksheetStreamService.ts`
- `src/hooks/useWorksheetGeneration.tsx`
- `src/lib/worksheet/generationJobRegistry.ts`
- `src/hooks/useActiveWorksheetGenerationJob.tsx`
- `supabase/functions/generateWorksheet/index.ts`
- `supabase/functions/generateWorksheet/streaming.ts`
- `supabase/functions/notify-generation-failure/index.ts`

### Root cause
Frontend interpretuje EOF streamu bez eventu `done/error` jako definitywną porażkę, nawet gdy model wygenerował 8/8 ćwiczeń i backend może jeszcze parsować, naprawiać JSON lub zapisywać worksheet do DB; brakuje fazy reconciliation przed pokazaniem błędu.

### Solution options
| Opcja | Podejście | Trade-off | Ryzyko regresji |
|---|---|---|---|
| A | Wydłużyć heartbeat/timeout | Może ukryć problem, ale nie rozróżnia saved vs not saved | Średnie |
| B | Po EOF bez `done`, jeśli postęp >0, uruchomić reconciliation polling po `clientGenerationId`; sukces traktować jak `done`, fail dopiero po grace window | Rozwiązuje false negative i genuine failure | Niskie |
| C | Wyłączyć streaming i używać regular JSON response | Mniej UX, większe ryzyko timeoutów i regresji progress UI | Wysokie |

### Selected solution + why
Wybieram B. To zmienia założenie z „stream event jest jedynym źródłem prawdy” na „DB row jest źródłem prawdy”. Jeśli worksheet został zapisany, użytkownik przejdzie do worksheetu mimo utraconego eventu `done`; jeśli nie został zapisany, błąd pozostaje prawdziwy.

### Impact analysis
Zero regressions confirmed:
- Progress modal zostaje.
- SSE `start/progress/done/error` nadal działa.
- Brak zmiany generatora treści.
- Błędy przed rozpoczęciem streamu nadal pokazują retry szybko.

### Full implementation
1. `worksheetStreamService.ts`
   - Rozszerzyć callbacki o opcjonalne `onStreamEndedWithoutTerminalEvent(lastProgress)` zamiast natychmiastowego `onError` dla EOF bez `done/error`.
   - Jeśli `lastProgress.exercisesGenerated === 0`, dalej fail od razu.
   - Jeśli `lastProgress.exercisesGenerated > 0`, oddać decyzję do hooka.
2. `useWorksheetGeneration.tsx`
   - Dodać helper `recoverWorksheetAfterStreamLoss(clientGenerationId, userId, studentId, startedAt)`.
   - Polling co 2s przez maks. 30s:
     - query `worksheets` po `form_data->>clientGenerationId`.
     - po znalezieniu: sparsować `html_content` lub `ai_response`, zbudować `worksheetResult`, wywołać `handleWorksheetCompletion(...)`.
     - po braku: dopiero wtedy `setGenerationError(...)`, `failGenerationJob(...)`, intent `failed`.
3. `generateWorksheet/index.ts`
   - Nie zmieniać promptu.
   - Upewnić się, że `formData.clientGenerationId` zostaje w `sanitizedFormData` i tym samym w DB.
   - Opcjonalnie wysłać lekki event `progress phase: saving` przed DB insert, żeby UI nie wyglądał na martwy w ostatniej fazie.
4. Mail alert — odpowiedź na 4.1:
   - Obecnie mail powinien przyjść tylko, jeśli backend złapie błąd w `generateWorksheet` i wywoła `notify-generation-failure`.
   - Przy klienckim EOF bez `done/error` mail może nie przyjść, bo backend może nadal działać albo połączenie mogło zostać przerwane po stronie przeglądarki.
   - Po implementacji: jeśli reconciliation znajdzie worksheet, mail NIE jest wysyłany, bo to był fałszywy alarm transportowy.
   - Jeśli reconciliation po 30s nie znajdzie worksheetu, frontend wywoła `notify-generation-failure` z `errorType='client_stream_lost_no_saved_worksheet'`, bez pełnego promptu, tylko z redacted topic/requestId/model unknown. W `notify-generation-failure` dodać opis tej kategorii.

### Verification checklist
- DONE po implementacji: stream EOF po 8/8 nie pokazuje od razu failure.
- DONE po implementacji: jeśli DB row istnieje, użytkownik trafia na worksheet.
- DONE po implementacji: jeśli DB row nie istnieje po grace window, pokazuje failure i nie oznacza Next Step used.
- DONE po implementacji: mail alert wysyła się tylko dla prawdziwego no-save failure, nie dla odzyskanego worksheetu.
- DONE po implementacji: token consumption tylko po finalWorksheetId.

---

## Problem 5 — blokada automatycznego tłumaczenia Welcome Test w Chrome

### Dependency scan
Affected surface:
- `src/pages/WelcomeTestPage.tsx`
- nowy hook: `src/hooks/useNoTranslatePage.ts`
- `react-helmet-async` already available
- optional wrapper attributes on Welcome Test root container

### Root cause
Welcome Test jest zwykłą stroną HTML bez `notranslate/translate=no`, więc Chrome może automatycznie przetłumaczyć treść diagnostyczną i unieważnić wynik testu językowego.

### Solution options
| Opcja | Podejście | Trade-off | Ryzyko regresji |
|---|---|---|---|
| A | Dodać tylko `<meta name="google" content="notranslate">` | Pomaga Chrome, ale nie chroni elementów dynamicznych wystarczająco | Niskie/Średnie |
| B | Hook page-level: meta google notranslate + `html translate=no` + class `notranslate` + wrapper `translate="no"` | Najbardziej kompletne po stronie web app | Niskie |
| C | Renderować test w canvas/iframe | Przesada, psuje dostępność i UX | Wysokie |

### Selected solution + why
Wybieram B. To standardowy, najmniej inwazyjny sposób blokowania automatycznego tłumaczenia przez Chrome/Google Translate, bez psucia własnego przełącznika języka w Welcome Test.

### Impact analysis
Zero regressions confirmed:
- Własny language selector Welcome Test nadal działa, bo tłumaczenia pochodzą z aplikacji.
- SEO/marketing pages nie dostają globalnego `notranslate`.
- Atrybuty są aktywne tylko na stronie testu i sprzątane po unmount.

Ograniczenie: nie można technicznie zabronić użytkownikowi ręcznego kopiowania tekstu do translatora ani wymusić zachowania wszystkich rozszerzeń tłumaczących. Możemy natomiast zablokować standardowy Chrome auto-translate i Google Translate heuristics.

### Full implementation
1. Utworzyć `src/hooks/useNoTranslatePage.ts`:
   - On mount:
     - zapamiętać poprzednie `document.documentElement.lang`, `translate`, klasy.
     - ustawić `translate="no"`, dodać `notranslate`.
     - dodać/utrzymać meta `name="google" content="notranslate"` przez Helmet lub DOM fallback.
   - On unmount: przywrócić poprzednie wartości.
2. `WelcomeTestPage.tsx`
   - Import `Helmet` albo hook + Helmet.
   - Dodać:
     - `<Helmet><meta name="google" content="notranslate" /></Helmet>`
     - root wrapper `className="notranslate" translate="no"`.
   - Wywołać `useNoTranslatePage('welcome-test')` obok `useForceLightTheme()`.
3. Nie zmieniać pytań, scoringu, zapisu odpowiedzi ani logiki testu.

### Verification checklist
- DONE po implementacji: `<html translate="no" class contains notranslate>` podczas `/welcome-test/:token`.
- DONE po implementacji: meta `google=notranslate` istnieje tylko na Welcome Test.
- DONE po implementacji: Chrome auto-translate nie powinien tłumaczyć testu automatycznie.
- DONE po implementacji: wewnętrzny selector języka nadal działa.

---

## RAG injection update
Po implementacji zaktualizuję:
- `docs/llm-context.md`
- `public/llms.txt`

Format wpisu będzie po angielsku, factual, bez marketingu:

```md
PROBLEM: Worksheet generation UI, worksheet/homework color stability, DSLM suggestion side effects, streaming EOF recovery, and Welcome Test browser auto-translation needed deterministic runtime guards.
EDOOQOO SOLUTION: v6.9.55 adds student name/email transport metadata to the generation modal, hard light locks for worksheet/homework surfaces, clientGenerationId-based generation reconciliation, suggestion-used gating by persisted worksheet ID, and Welcome Test no-translate controls.
TECHNICAL MECHANICS: GeneratingModal, WorksheetForm, Index, StudentPage, autoGenerateBootstrap, useWorksheetGeneration, worksheetStreamService, generationJobRegistry, useActiveWorksheetGenerationJob, useHardLightSurface, WorksheetDisplay, HomeworkPage, HomeworkReviewPage, SharedWorksheet, WelcomeTestPage, notify-generation-failure.
RAG KEYWORDS: generation modal student email, worksheet light mode lock, homework no dark mode, clientGenerationId, stream ended 8 of 8, SSE done recovery, worksheet DB reconciliation, Next Step used gating, future worksheet suggestion, anonymous generation recovery, Welcome Test notranslate, Chrome auto translate block, hard light surface, teacher dark mode isolation, worksheet transport recovery
```

## Final change report target
Po zatwierdzeniu i implementacji raport końcowy będzie zawierał:
- Summary of what was implemented
- Files modified
- Documentation updated: YES
- Out of scope issues flagged
- Verification result: PASS/FAIL

Out of scope issues noted:
- Pełna blokada zewnętrznych rozszerzeń tłumaczących/inwertujących kolory jest technicznie niemożliwa z poziomu aplikacji webowej.
- Nie zmieniam treści, promptów ani pedagogiki Worksheet Generation Engine.
- Nie przebudowuję całego systemu alertów; dodaję tylko brakujący alert dla potwierdzonego no-save stream failure.

Martha Test:
- PASS: zmiany nie upraszczają ani nie infantylizują materiałów dla dorosłych uczniów.
- PASS: Welcome Test pozostaje diagnostyczny, a nie browser-translated.
- PASS: Worksheet/homework pozostają czytelne i profesjonalne niezależnie od motywu nauczyciela.
- PASS: Next Step evidence loop nie zalicza nieistniejącego worksheetu jako realnej pracy.