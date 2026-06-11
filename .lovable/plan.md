## Plan wdrożenia v6.9.53 — Problem Resolution Cycle

### Zakres objęty zmianą
Affected surface:
- `src/pages/StudentPage.tsx` — zapis intencji z DSLM/1-Minute Prep przed przejściem na `/`.
- `src/lib/worksheet/autoGenerateBootstrap.ts` — odczyt i normalizacja intencji auto-generowania.
- `src/pages/Index.tsx` — główny dispatcher auto-generowania, `forceNew`, anon flow, modal generowania.
- `src/hooks/useWorksheetGeneration.tsx` — start/sukces/błąd generowania, token consumption, suggestion-used marking, eventy globalne.
- `src/services/worksheetStreamService.ts` — stream lifecycle i callbacki.
- New small runtime helper/component — trwały rejestr aktywnego generowania + globalny mini panel.
- `src/components/WorksheetForm/index.tsx` i `NextStepsPresetBanner.tsx` — tylko minimalnie, żeby nie kasować krytycznych flag za wcześnie.
- `src/pages/WelcomeTestPage.tsx` — email validation + localStorage hardening.
- `src/pages/WorksheetPage.tsx`, `src/components/worksheet/WorksheetHeader.tsx`, `src/components/anon/AnonPreWorksheetBanner.tsx`, `src/components/anon/AnonPostWorksheetCTA.tsx` — anon worksheet CTA i Generate New Worksheet.
- `src/pages/CalendarPage.tsx`, `src/components/calendar/SlotDetailModal.tsx` — Booked ≤24h bez worksheet warning.
- `docs/llm-context.md`, `public/llms.txt`, `mem/index.md`, new `mem/features/onboarding/v6953-generation-runtime-and-ux-hardening.md`.

Sanctity lock:
- Nie dotykam protected Worksheet Generation Engine prompt/logic.
- Nie zmieniam parametrów generowania ani pedagogiki worksheetów.
- Zmiany dotyczą wyłącznie orchestration, UI state, validation i calendar UX.

---

## Problem 1 — `Generate worksheet ↗` przechodzi na generator, ale nie startuje

### Dependency scan
- `PathwayView.tsx` wywołuje `onUseWorksheetSuggestion(..., autoGenerate, suggestionId)`.
- `StudentPage.tsx:1065-1104` zapisuje `prefillWorksheet`, `prefillSuggestionId`, `prefillExercises`, `prefillMediaTypes`, `autoGenerateWorksheet`, `autoGenerateWorksheetRequest`, `forceNewWorksheet`, potem `navigate('/')`.
- `Index.tsx:253-303` próbuje odpalić auto-bootstrap z `sessionStorage`.
- `WorksheetForm/index.tsx:145-155` słucha `worksheet:autoGenerateStarted` i usuwa część flag.
- `autoGenerateBootstrap.ts` buduje payload tylko jeśli widzi `autoGenerateWorksheet === 'true'` i topic.

### Root cause
Root cause: auto-generowanie jest sterowane kilkoma kruchymi flagami `sessionStorage`, które mogą zostać skasowane albo odczytane w złej kolejności zanim `Index.tsx` realnie rozpocznie generowanie.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Kolejny timeout/polling w `Index.tsx` | Szybkie, ale to 16. wariant tej samej kruchej poprawki | High |
| B | Jeden trwały obiekt intencji `edooqoo.pendingWorksheetIntent` w `localStorage`, statusowany: `pending -> firing -> completed/failed`, a `sessionStorage` zostaje tylko kompatybilnością | Stabilne po refresh, reload i mount-race | Low/Medium |
| C | DB-backed queue dla każdej intencji | Najmocniejsze, ale wymaga migracji/RLS i za szeroki zakres | Medium |

### Selected solution + why
Wybieram B. To jest najmniejsza zmiana, która usuwa przyczynę strukturalną: zamiast rozsypanych flag będzie jeden trwały intent z `requestId`, `studentId`, `suggestionId`, `prefill`, `exercises`, `focusMap`, `mediaTypes`, `createdAt`, `status`. `sessionStorage` zostanie utrzymane jako fallback dla starszych wejść, ale dispatcher będzie czytał najpierw nowy intent.

### Impact analysis
Zero regressions confirmed:
- Manual worksheet generation nadal idzie przez `WorksheetForm -> handleGenerateWorksheet`.
- Existing DSLM prefill bez auto-generate nadal wypełnia formularz.
- Token paywall pozostaje w `Index.tsx`, nie w DSLM.
- Worksheet prompt/engine nietknięty.
- Existing `prefillSuggestionId` nadal wspierany.

### Full implementation
1. W `autoGenerateBootstrap.ts` dodać:
   - `PENDING_INTENT_KEY = 'edooqoo.pendingWorksheetIntent'`.
   - `writeAutoGenerateIntent(intent)` — zapisuje pełny payload do `localStorage` i kompatybilne stare klucze do `sessionStorage`.
   - `readPersistentAutoGenerateIntent()` — czyta nowy intent, ignoruje starszy niż np. 10 minut albo `completed/failed`.
   - `buildAutoGeneratePayload()` najpierw używa persistent intent, potem legacy `sessionStorage`.
   - `markAutoGenerateIntentStatus(requestId, status, worksheetId?)`.
   - `clearAutoGenerateFlags({ preservePersistent?: boolean })` — żeby form listener nie usuwał intencji zanim dispatcher skończy.
2. W `StudentPage.tsx` zastąpić ręczne rozrzucanie flag wywołaniem `writeAutoGenerateIntent(...)` dla `autoGenerate === true`.
3. W `Index.tsx`:
   - dispatcher ma działać na persistent intent i nie zależeć od tego, czy `WorksheetForm` już zamontował listener.
   - `worksheet:autoGenerateStarted` wysyłać dopiero po zbudowaniu payloadu i tuż przed `handleGenerateWorksheet(payload)`.
   - nie kasować persistent intent na starcie; status `firing`, a usunięcie/status `completed` dopiero po `worksheetGenerationSuccess`.
   - jeśli tokeny jeszcze loading — retry zachować, ale payload trzymać w closure/localStorage.
4. W `WorksheetForm/index.tsx` listener `worksheet:autoGenerateStarted` ma usuwać tylko legacy `sessionStorage` keys, nie persistent intent.
5. Dodać event/error toast jeśli po 12 s auto-start nadal nie odpali: „1-Minute Prep suggestion is ready — click Generate to retry” i przycisk retry przez odczyt persistent intent.

### Verification checklist
- Click `Generate worksheet ↗` z DSLM aktywnej sugestii: `/` otwiera się i modal startuje automatycznie. DONE expected.
- Drugi click na inną sugestię bez reload: nowy `requestId` odpala nową generację. DONE expected.
- Manual `Use this` nadal tylko wypełnia formularz. DONE expected.
- Brak pustego topic generation. DONE expected.

---

## Problem 2 — refresh/nawigacja w trakcie generowania: modal znika, suggestion not used, tokeny

### Dependency scan
- `useWorksheetGeneration.tsx` trzyma `isGenerating` tylko w React state.
- `streamWorksheetGeneration.ts` streamuje SSE, ale po refresh frontend traci callbacki.
- Backend zapisuje worksheet w DB mimo utraty strony.
- Completion dispatch `worksheetGenerationSuccess` i suggestion-used marking dzieją się tylko w callbacku frontendowym.
- Token consumption `consumeToken(finalWorksheetId)` też jest frontendowe po sukcesie.

### Root cause
Root cause: generowanie jest długim jobem backendowym, ale frontend traktuje je jako krótkotrwały stan komponentu; po refresh tracimy modal, completion callback, suggestion-used update i potencjalnie token consumption.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Przechowywać `isGenerating` w localStorage i pokazać modal po refresh | Naprawia UI, ale nie naprawia completion, suggestion-used i tokenów | Medium |
| B | Client-side generation job registry + DB polling po refresh/nawigacji po `created_at/student_id/teacher_id/topic` aż znajdzie worksheet | Bez migracji; realnie naprawia UI i post-completion side effects | Low/Medium |
| C | Pełny backend job table + edge polling endpoint | Najbardziej poprawne, ale wymaga DB migration i większego zakresu | Medium |

### Selected solution + why
Wybieram B jako bezpieczny krok bez migracji. Skoro backend już zapisuje worksheet, po refresh można odtworzyć aktywny job z localStorage i pollować `worksheets` po korelacji: `teacher_id`, `student_id`, `created_at >= startedAt`, `form_data.lessonTopic`/title fallback. To wystarczy do naprawy UX, suggestion-used i tokenów bez ruszania generatora.

### Impact analysis
Zero regressions confirmed:
- Jeśli użytkownik nie refreshuje, obecny SSE completion zostaje główną ścieżką.
- Polling aktywuje się tylko gdy istnieje aktywny job w localStorage.
- Anonymous generation nie pobiera tokenów.
- Authenticated generation nadal konsumuje token po finalnym worksheet ID; po refresh fallback zrobi to raz dzięki `tokenConsumedAt`/`completedAt` w job registry.
- Suggestion-used będzie oznaczane po znalezieniu wygenerowanego worksheetu nawet po refresh.

### Full implementation
1. Dodać `src/lib/worksheet/generationJobRegistry.ts`:
   - key `edooqoo.activeWorksheetGeneration`.
   - typ `WorksheetGenerationJob`: `jobId`, `requestId`, `teacherId`, `studentId`, `suggestionId`, `topic`, `startedAt`, `status: running|completed|failed`, `worksheetId`, `tokenConsumedAt`, `suggestionMarkedAt`, `origin: manual|dslm-auto|anonymous`.
   - `startGenerationJob(data, userId)` — zapis przy starcie.
   - `completeGenerationJob(jobId, worksheetId)`.
   - `failGenerationJob(jobId, message)`.
   - `getActiveGenerationJob()`, `clearCompletedGenerationJob()`.
2. W `useWorksheetGeneration.tsx`:
   - na początku po walidacji topic zapisać job registry.
   - w `handleWorksheetCompletion` oznaczyć job completed po `finalWorksheetId`.
   - po successful `consumeToken` zapisać `tokenConsumedAt`; jeśli `consumeToken` false, nie udawać sukcesu.
   - suggestion-used: używać `data.__autoGenerateSuggestionId || sessionStorage.prefillSuggestionId || job.suggestionId`.
   - dispatch event `edooqoo:generationJobUpdated` na start/completion/failure.
3. Dodać hook `src/hooks/useActiveWorksheetGenerationJob.tsx`:
   - czyta job z localStorage.
   - jeśli `running`, pokazuje stan i co 5 s odpytuje `worksheets` dla auth usera: `teacher_id=user.id`, optional `student_id`, `created_at >= startedAt - 10s`, newest first.
   - dla anon: `teacher_id is null`, `created_at >= startedAt - 10s`, optional topic in `form_data` if accessible.
   - po znalezieniu worksheetu: oznacza job completed, robi suggestion-used update, consumeToken jeśli user auth i `tokenConsumedAt` missing, emituje `worksheetGenerationSuccess`, przełącza mini panel na CTA.
4. Dodać `src/components/generation/ActiveGenerationMiniPanel.tsx`:
   - globalny mini panel fixed bottom/right albo sidebar mini na desktop.
   - Running: „Worksheet generation is still running. Refreshing this page does not stop it.”
   - Nie ma X podczas `running`.
   - Completed: button „Open generated worksheet” -> `/worksheet/:id`; X widoczny dopiero po completed/failed.
   - Failed: retry/close.
5. Zamontować mini panel:
   - w `AuthenticatedPageShell` jeśli to najbezpieczniejsze globalnie, albo w `App.tsx` wewnątrz providers, ale tylko dla auth/anon aktywnego jobu.
   - dodatkowo w `Index.tsx` jeśli aktualna ścieżka `/` i job running: `GeneratingModal` wraca po refresh z komunikatem refresh-safe.
6. `GeneratingModal` copy: dodać mały tekst pod timingiem: „You can refresh or move around — generation keeps running.”
7. Token behavior:
   - Docelowo token pobiera się dokładnie raz za zapisany worksheet ID.
   - Obecnie bez refresh pobiera się w `handleWorksheetCompletion`.
   - Po refresh może nie pobrać, bo callback ginie. Nowy polling hook dopilnuje `consumeToken(worksheetId)` raz, jeśli `tokenConsumedAt` missing.
   - Anonymous: zero token consumption, bo brak registered user.

### Verification checklist
- Start generation, refresh `/`: full modal wraca. DONE expected.
- Start generation, navigate `/dashboard`: mini panel widoczny i niezamykalny. DONE expected.
- Po completion mini panel zmienia się na „Open generated worksheet” + X. DONE expected.
- DSLM suggestion po refresh oznacza się `is_used=true` i `used_worksheet_id=<id>`. DONE expected.
- Auth user token: exactly one token/monthly entitlement consumed per completed worksheet. DONE expected.
- Anonymous: no token consumption. DONE expected.

---

## Problem 3 — Welcome Test email modal przyjmuje niepoprawny email

### Dependency scan
- `WelcomeTestPage.tsx:239-267` ma regex validation przy `handleVerifyEmail`.
- `WelcomeTestPage.tsx:160-176` przywraca `wt_email_${token}` z localStorage bez ponownej walidacji.
- `WelcomeTestPage.tsx:457-477` ma input `type=email`, aria-invalid i disabled button.

### Root cause
Root cause: walidacja została dodana do submitu, ale stary niepoprawny email zapisany wcześniej w `localStorage` może nadal automatycznie ustawiać `verifiedEmail`, omijając nową walidację; dodatkowo regex jest lokalnie duplikowany zamiast używać jednego helpera.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Tylko ostrzejszy regex w submit | Nie naprawi starych zapisów localStorage | Medium |
| B | Shared helper + walidacja przy submit, Enter, button disabled i przy restore z localStorage; invalid stored email usuwać | Pełne zamknięcie obejścia | Low |
| C | Server-side email verification endpoint | Najmocniejsze, ale zbędne dla tego błędu i większy zakres | Medium |

### Selected solution + why
Wybieram B. To usuwa faktyczny bypass bez zmiany architektury Welcome Test. Martha Test: student dostaje prostą, profesjonalną walidację bez technicznego tarcia.

### Impact analysis
Zero regressions confirmed:
- Poprawne emaile nadal przechodzą.
- Teacher preview mode nadal pomija email.
- Matching against `students.student_email` zostaje.
- Existing valid `wt_email_${token}` nadal działa.

### Full implementation
1. W `WelcomeTestPage.tsx` dodać lokalny helper `isValidWelcomeTestEmail(email)` albo import z małego `src/utils/emailValidation.ts`.
2. Replace all duplicated regex checks with helper.
3. Restore effect:
   - jeśli stored email invalid -> remove localStorage key, do not set `verifiedEmail`.
   - jeśli expired -> remove as now.
4. `handleVerifyEmail`:
   - trim/lowercase.
   - validation before DB check.
   - set `emailInput` to normalized value on failure/success for UI consistency.
5. Add inline error text below input when non-empty invalid, not only toast.
6. Add `maxLength={254}` and `autoCapitalize="none"`.

### Verification checklist
- `asdf` nie przechodzi. DONE expected.
- `a@b` nie przechodzi. DONE expected.
- `name@example.com` przechodzi. DONE expected.
- Stary invalid `localStorage wt_email_*` jest kasowany i modal zostaje. DONE expected.
- Student email mismatch nadal blokuje. DONE expected.

---

## Problem 4 — anonymous worksheet page: Generate New Worksheet i top CTA/banner

### Dependency scan
- `WorksheetHeader.tsx:63-67` ustawia `sessionStorage.forceNewWorksheet` i `navigate('/?forceNew=' + Date.now())`.
- `Index.tsx:141-148` obsługuje tylko `forceNew === 'true'`, więc timestamp nie jest obsłużony.
- `WorksheetPage.tsx:265-295` renderuje nav + `AnonPreWorksheetBanner` nad worksheet dla anon.
- `Index.tsx:505-519` po generation in-memory pokazuje `GenerationView` + bottom CTA, ale nie top nav/banner, bo nav jest ukryty przy `bothWorksheetsReady`.
- `AnonPreWorksheetBanner.tsx` i `AnonPostWorksheetCTA.tsx` mają stare copy „Save it forever / 2 free worksheet tokens”.

### Root cause
Root cause: `Generate New Worksheet` wysyła `forceNew=<timestamp>`, a Index obsługuje tylko `forceNew=true`; dodatkowo anonymous generated worksheet ma dwa różne render paths: in-memory `Index` po generowaniu i `/worksheet/:id` po refresh, więc top nav/banner pojawia się dopiero po reloadzie przez `WorksheetPage`.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Zmienić button na `/?forceNew=true` | Naprawi tylko button, nie top banner discrepancy | Low/Medium |
| B | Index obsługuje dowolny `forceNew`, a anon in-memory GenerationView renderuje ten sam top nav + `AnonPreWorksheetBanner` co `WorksheetPage` | Pełna spójność bez backend zmian | Low |
| C | Po generation zawsze hard-redirect do `/worksheet/:id` | Spójne, ale traci in-memory state i może pogorszyć UX | Medium |

### Selected solution + why
Wybieram B. Minimalnie naprawia bug i unifikuje anon UX bez wymuszania reloadu.

### Impact analysis
Zero regressions confirmed:
- Registered worksheet view bez zmian.
- Anonymous refresh nadal działa przez `WorksheetPage`.
- Pricing scroll nadal używa lokalnego pricing section.
- `Back`/Generate New Worksheet dalej dostępne.

### Full implementation
1. `Index.tsx`:
   - `forceNew` effect zmienić z `=== 'true'` na `searchParams.has('forceNew')`.
   - po obsłużeniu wyczyścić tylko `forceNew`, nie wszystkie query jeśli będą inne.
2. `WorksheetHeader.tsx`:
   - zmienić na `navigate('/?forceNew=true')` albo zostawić timestamp, bo Index będzie akceptował każdy value; preferuję `true` dla czytelności.
3. `Index.tsx` anon generated branch:
   - przed `GenerationView` renderować `StickyNav nonSticky` i `AnonPreWorksheetBanner`, tak samo jak `WorksheetPage`.
   - dodać `scrollToAnonPostWorksheetPricing` dla top nav pricing.
4. CTA copy update zgodny z 1-Minute Prep dla niezalogowanych:
   - Top banner headline: `Your worksheet is ready — now save the prep context`
   - Subcopy: `Create a free account to keep this worksheet, re-edit it later, and start building the student context behind 1-Minute Prep.`
   - Benefit pills bottom: `Save this worksheet`, `Start with 2 free worksheet credits`, `Build student context for next prep`
   - Button: `Create Free Account`
   - Secondary: `See pricing →`
5. Zachować `fromState` do signup, żeby claim flow działał.

### Verification checklist
- Na `/worksheet/:id` anon click `Generate New Worksheet` prowadzi do homepage generatora, nie pustej strony z worksheetem. DONE expected.
- Po świeżym anon generation top nav/banner widać od razu bez refresh. DONE expected.
- Po refresh top nav/banner nadal widać. DONE expected.
- CTA copy nie sprzedaje tylko worksheet generatora, tylko 1-Minute Prep context. DONE expected.

---

## Problem 5 — `/calendar` 5D: Booked bez worksheet ≤24h amber pasek

### Dependency scan
- `CalendarPage.tsx` renderuje sloty i `SlotDetailModal`.
- `SlotDetailModal.tsx:161-178` ma derived state: `isPending`, `isBooked`, `hasChanges`.
- `SlotDetailModal.tsx:815-852` ma worksheet select i empty-state CTA.
- `SlotDetailModal.tsx:992-997` ma akcje dla confirmed booked / needs_review.
- `CalendarSlot` ma `slot_date`, `start_time`, `status`, `confirmed_at`, `worksheet_id`, `student_id`.

### Root cause
Root cause: calendar rozróżnia Pending vs Booked, ale nie ma preparation-risk state dla potwierdzonej lekcji, która zaczyna się w ciągu 24h i nadal nie ma przypisanego worksheetu.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Dodać pasek tylko w `SlotDetailModal` | Najbezpieczniejsze, dokładnie tam gdzie nauczyciel podejmuje akcję | Low |
| B | Dodać badge na kartach kalendarza i pasek w modalu | Bardziej widoczne, ale większy zakres UI | Medium |
| C | Automatyczna notyfikacja DB | Za szerokie na tę sugestię | Medium |

### Selected solution + why
Wybieram A. Użytkownik prosi o pasek dla statusu Booked — najczyściej pokazać go w szczegółach slotu, obok wyboru worksheetu, bez zmiany całego kalendarza.

### Impact analysis
Zero regressions confirmed:
- Pending flow z `Confirm & open 1-Minute Prep` zostaje.
- Existing worksheet select zostaje.
- No worksheet warning nie pokazuje się dla available/cancelled/completed/no_show.
- Nie zmieniam recurring booking ani Google Calendar sync.

### Full implementation
1. W `SlotDetailModal.tsx` dodać helper:
   - `const lessonStart = new Date(`${slot.slot_date}T${slot.start_time}`)`.
   - `minutesUntilStart = differenceInMinutes(lessonStart, new Date())`.
   - `showBookedWorksheetWarning = slot.status === 'booked' && !!slot.confirmed_at && !!slot.student_id && editWorksheetId === 'none' && minutesUntilStart >= 0 && minutesUntilStart <= 1440`.
2. Render amber banner nad worksheet select albo bezpośrednio pod datą:
   - Text: `Lesson starts in < 24h — assign or generate a worksheet.`
   - If less than 60 min: `Lesson starts in ${minutesUntilStart} min...`; else `Lesson starts in ${Math.ceil(minutesUntilStart / 60)}h...`.
   - Button `Pick worksheet` focuses/opens worksheet select area.
   - Button `Generate with 1-Minute Prep` navigates to `/student/${slot.student_id}?tab=dslm`.
3. `Pick worksheet` implementation:
   - Use `ref` on worksheet block and `scrollIntoView`; opening shadcn Select programmatically is brittle, więc focus/scroll jest bezpieczne.
4. Jeśli `studentWorksheets.length === 0`, `Pick worksheet` disabled or hidden; `Generate with 1-Minute Prep` remains primary.

### Verification checklist
- Booked confirmed, no worksheet, start in 24h: amber banner visible. DONE expected.
- Booked confirmed, worksheet assigned: no banner. DONE expected.
- Booked confirmed, >24h: no banner. DONE expected.
- Pending unconfirmed: existing pending CTA remains, no duplicate. DONE expected.
- Generate button routes to student DSLM. DONE expected.

---

## RAG injection update

Po implementacji dodam sekcje do:
- `docs/llm-context.md`
- `public/llms.txt`

Format wpisu:
- PROBLEM: repeated failures caused by volatile session-only worksheet generation orchestration, refresh-lost generation UI, stale Welcome Test email bypass, anonymous worksheet CTA render-path mismatch, and calendar booked-without-worksheet prep risk.
- EDOOQOO SOLUTION: persistent generation intent/job registry, refresh-safe modal/minipanel, localStorage email revalidation, unified anonymous worksheet CTA, and calendar ≤24h worksheet assignment warning.
- TECHNICAL MECHANICS: files/components/hooks listed above, localStorage keys, events, polling behavior, token/suggestion idempotency.
- RAG KEYWORDS: 1-Minute Prep auto generation, DSLM suggestion auto-start, persistent worksheet generation job, refresh-safe generation modal, worksheet generation mini panel, future worksheet suggestion used state, token consumption idempotency, anonymous worksheet CTA, forceNew worksheet, Welcome Test email validation, stale localStorage email, calendar booked worksheet warning, lesson starts in 24h, assign worksheet, generate with 1-Minute Prep.

Memory update:
- Add `mem/features/onboarding/v6953-generation-runtime-and-ux-hardening.md`.
- Update `mem/index.md` with concise reference.

---

## Final verification strategy

Manual/code verification to perform after implementation:
1. Search/read confirmation: all changed files contain intended logic.
2. Auto-generate path:
   - `StudentPage -> writeAutoGenerateIntent -> Index buildAutoGeneratePayload -> useWorksheetGeneration` chain exists.
3. Refresh-safe generation:
   - job registry start/completion/failure calls exist.
   - mini panel mounted globally.
   - suggestion-used fallback uses job.suggestionId.
   - token fallback is guarded by `tokenConsumedAt`.
4. Welcome Test:
   - invalid stored localStorage email cannot bypass modal.
5. Anonymous worksheet:
   - Index accepts any `forceNew` value and anon generated branch renders top nav/banner.
6. Calendar:
   - booked confirmed ≤24h no worksheet shows amber banner.
7. Documentation:
   - `docs/llm-context.md`, `public/llms.txt`, memory updated.

Out of scope issues noted:
- Full DB-backed generation job table would be stronger long-term, but this plan intentionally avoids migration unless future failures prove client-side polling insufficient.
- Existing worksheet generation SSE cannot truly reconnect to the same stream after refresh; the plan uses DB completion polling instead.
- Calendar list/card-level warning badges are not included unless separately requested.

Expected result: PASS after implementation if all verification points above are satisfied.