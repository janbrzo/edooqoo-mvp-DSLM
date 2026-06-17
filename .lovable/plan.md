
# Plan v6.9.61 — Recovery po utracie modalu + globalny multi-job switcher + deterministyczny draft + migracja Imagen→Gemini 3.1 Flash Image (Vertex)

Wszystkie cztery problemy łączy jeden mianownik: **odświeżenie strony zabija JS i SSE, ale backend (`EdgeRuntime.waitUntil`) i tak zapisuje worksheet — natomiast frontowy poller DB przestaje sprzątać side-effects (token, next step, CTA) gdy job zostanie wcześniej oznaczony `failed`**. Naprawiamy nie „utrzymanie modalu" (nie da się — refresh = nowy JS), tylko **odporne domknięcie po stronie pollera + UX bez fałszywego „network error" gdy worksheet zapisał się w tle**.

Sanctity rule: prompt i pipeline `generateWorksheet` (Gemini→OpenAI fallback, repair, validators) NIE są dotykane. Zmiany dotyczą wyłącznie: transportu SSE, rejestru jobów, pollera DB, modal/mini-panel UI, drafta formularza, migracji modelu obrazu (Vertex → Vertex inny model).

---

## Problem 1 + 1.1 — Po refresh brak konsumpcji tokenu, brak „used" w next step, czasem fałszywy „Generation failed"

### Dependency scan
- `src/services/worksheetStreamService.ts` — klient SSE, klasyfikacja transport errorów, `onStreamEndedWithoutTerminalEvent`.
- `src/hooks/useWorksheetGeneration.tsx` — callbacks `onError` / `onStreamEndedWithoutTerminalEvent`, `handleWorksheetCompletion`, `recoverWorksheetAfterStreamLoss`.
- `src/hooks/useActiveWorksheetGenerationJob.tsx` — `useActiveWorksheetGenerationJobs` (poller DB, `applyCompletionSideEffects` z `consume_token`, `is_used`, event `worksheetGenerationSuccess`).
- `src/lib/worksheet/generationJobRegistry.ts` — statusy `running|completed|failed`, `patchGenerationJob`, TTL.
- `src/pages/Index.tsx` — montaż `GeneratingModal`, `myRunningJobs` filtr po `originTabId`.
- `supabase/functions/generateWorksheet/index.ts` — `backgroundWork`, `safeSend`, zapis `worksheets` z `form_data->>clientGenerationId`.

### Root cause
Po `onError` (np. transport error / timeout fetch tuż po starcie streamu) frontend natychmiast woła `failGenerationJob(jobId)`. `useActiveWorksheetGenerationJobs` poll-uje **tylko joby `status === 'running'`** (linia 171). Gdy backend skończy zapis ~10–30 s później, nikt po stronie klienta tego nie podejmuje:
- `consume_token` RPC nie wywoływany,
- `future_worksheet_suggestions.is_used` nie flipowany,
- mini-panel nie zmienia się na CTA „ready",
- modal pokazuje „Generation failed network error" mimo że worksheet jest w bazie.

Symetrycznie: gdy backend faktycznie umarł (deploy crash, OOM), job zostaje w `running` na zawsze (TTL `running` = 15 min, ale TTL nie czyści zanim user zobaczy „kręcące się generowanie"). Brak twardego timeoutu z czytelnym komunikatem.

### Solution options
| # | Opis | Tradeoff | Regression risk |
|---|------|----------|-----------------|
| A | Polling DB obejmuje też joby `failed` przez okno 60 s (`recoveryDeadlineAt`); po znalezieniu wiersza promuje job z powrotem na `completed` i odpala `applyCompletionSideEffects`. | Naprawia 1.1B i scenariusz „error → backend i tak zapisał". | Niskie. |
| B | Usunąć `failGenerationJob` z `onError` i polegać tylko na DB poll + timeout. | Czysty model, ale zmienia UX dla prawdziwych failów (brak tokenu, walidacja, pusty topic). | Średnie. |
| C | Trzymać job zawsze `running` po SSE EOF + twardy backend-timeout 4 min, dopiero potem `failed` z czytelnym komunikatem. | Pokrywa 1.1A („kręci się wiecznie"). | Niskie–średnie. |

### Selected solution + why
**A + C łącznie.** A rozwiązuje raportowane gubienie tokenu/next-step. C eliminuje wieczny spinner gdy backend faktycznie umarł. B odrzucone — zmiana semantyki failu uderza w istniejące błyskawiczne ścieżki błędów (np. brak tokenu, walidacja).

### Impact analysis
- Worksheet engine — niezmieniony.
- `consume_token` jest idempotentny (v6.9.59 advisory lock + `reference_id` check), więc nawet jeśli rezerwowy poll i „normalna" ścieżka pobiegną równolegle, drugi call no-opem zwraca sukces.
- `markSuggestionUsed` flip robiony tylko gdy `suggestionId && !suggestionMarkedAt` — bez dubli.
- Zero zmian w schemacie DB.
- Zero regresji dla prawdziwych failów (DB nie ma wiersza → poll nic nie znajdzie → po 60 s zostaje `failed`).

### Full implementation

1. **`src/lib/worksheet/generationJobRegistry.ts`**
   - Dodać pole `recoveryDeadlineAt?: number | null` w `WorksheetGenerationJob` (epoch ms; ustawiane przy `failGenerationJob` → `Date.now() + 60_000`).
   - W `failGenerationJob` ustawić `recoveryDeadlineAt: Date.now() + 60_000`.
   - Wprowadzić rozróżnienie TTL: `RUNNING_TTL_MS = 4 * 60 * 1000` (4 min — twardy backend timeout); `COMPLETED_TTL_MS` zostaje 24 h.
   - Dodać helper `expireStaleRunningJobs(): WorksheetGenerationJob[]` — iteruje mapę, każdy `running` starszy niż `RUNNING_TTL_MS` flipuje przez `failGenerationJob(id, 'Backend did not respond within 4 minutes. No tokens were consumed.')`. Wywoływany wewnątrz `readMap()` przed pruningiem.
   - Dodać `recoverJobToCompleted(jobId: string, worksheetId: string): WorksheetGenerationJob | null` — atomowy patch: `status='completed'`, `worksheetId`, `errorMessage=null`, `recoveryDeadlineAt=null`, `updatedAt=Date.now()`.
   - Dodać helper `getPollableJobs(): WorksheetGenerationJob[]` zwracający joby gdzie `status==='running'` lub (`status==='failed' && recoveryDeadlineAt && Date.now() < recoveryDeadlineAt`).

2. **`src/hooks/useActiveWorksheetGenerationJob.tsx`**
   - W `useActiveWorksheetGenerationJobs`:
     - Zmienić `runningIds = jobs.filter(j => j.status === 'running')` na `pollableIds = jobs.filter(j => j.status === 'running' || (j.status === 'failed' && j.recoveryDeadlineAt && Date.now() < j.recoveryDeadlineAt))`.
     - W ticku: po `locateBackendWorksheet(job)` zwracającym `wsId`, jeśli `job.status === 'failed'` → `recoverJobToCompleted(jobId, wsId)`, w przeciwnym razie `completeGenerationJob(jobId, wsId)`. Następnie `applyCompletionSideEffects(next, wsId, userId)`.
     - Dodać log `devLog('[v6.9.61] recovered failed job via DB poll', { jobId, wsId })`.
   - W obu hookach (`useActiveWorksheetGenerationJob`, `useActiveWorksheetGenerationJobs`) dodać `setInterval(() => { try { expireStaleRunningJobs(); } catch {} }, 30_000)` z cleanupem, żeby joby przeterminowane były flipowane na `failed` nawet bez interakcji z mini-panelem.

3. **`src/hooks/useWorksheetGeneration.tsx`**
   - W callbacku `onError` (linia 395) zamiast natychmiast wołać `failGenerationJob`, najpierw odpalić jednokrotną próbę `recoverWorksheetAfterStreamLoss({ clientGenerationId, teacherId: userId, studentId: effectiveStudentId, startedAt })`. Jeśli zwróci worksheet → `handleWorksheetCompletion(recovered, data, startTime)` i return. Jeśli null → wtedy `failGenerationJob(activeJobIdRef.current, error.message)` (które ustawi `recoveryDeadlineAt` na 60 s — globalny poller dokończy później jeśli backend zdąży zapisać).
   - `onStreamEndedWithoutTerminalEvent` bez zmian — job zostaje `running`, globalny poller go pilnuje.
   - `cancelGeneration` (linia 752) — dodać `failGenerationJob(activeJobIdRef.current, 'Cancelled by user')` i ustawić `recoveryDeadlineAt = null` (poll nie ma sensu po anulowaniu); zrobić to przez nowy `patchGenerationJob(id, { status: 'failed', errorMessage: 'Cancelled by user', recoveryDeadlineAt: null })`.

4. **`src/components/GeneratingModal.tsx`**
   - Nowy prop `recovering?: boolean`.
   - W brachu `errorMessage`: jeśli `recovering === true`, zamiast „Generation failed" pokazać sekcję „Checking server… your worksheet might still be saving. No tokens were consumed yet." z spinerem, bez przycisku retry. Po `recoverJobToCompleted` modal i tak zamyka się przez normalny flow `worksheetGenerationSuccess`.

5. **`src/pages/Index.tsx`**
   - `myRunningJobs` zmienić na `myPollableJobs` (uwzględnia okno recovery), żeby modal nie znikał gdy job tymczasowo przeszedł w `failed` z recovery deadline.
   - Wystawić do `<GeneratingModal>` prop `recovering={!!activeJob?.recoveryDeadlineAt && Date.now() < activeJob.recoveryDeadlineAt && activeJob.status === 'failed'}`.

### Verification checklist
- [ ] Start 2 generowań → refresh w trakcie → oba kończą się w tle → token pobrany **1×** per worksheet (sprawdzić `token_transactions`), oba w `?tab=worksheets`, oba next stepy `is_used=true`, mini-panel pokazuje CTA „Open worksheet".
- [ ] Wymuszony backend crash (mock 502 z funkcji) → po 4 min job flipowany na `failed` z komunikatem timeout; modal/mini-panel pokazuje fail.
- [ ] Prawdziwy fail (brak tokenu, pusty topic, walidacja) → token NIE pobrany, next step NIE oznaczony, modal pokazuje błąd po 60 s recovery window.
- [ ] `consume_token` w DB → max 1 wpis per `worksheet_id`.
- [ ] `cancelGeneration` → job od razu `failed`, brak okna recovery, mini-panel znika z toastem.

---

## Problem 2 — Multi-job switcher na każdej stronie startującej generowanie

### Dependency scan
- `src/components/GeneratingModal.tsx` — już renderuje rząd kart przez prop `jobs[]` gdy `jobsCount > 1` (v6.9.60).
- `src/pages/Index.tsx` — montuje `<GeneratingModal>` (w obu gałęziach: auth i anon).
- `src/pages/StudentPage.tsx` — start generowania ze suggestion, nawiguje do `/`, nie montuje modalu.
- `src/components/generation/ActiveGenerationMiniPanel.tsx` — już globalny stack pływających kart.

### Root cause
`GeneratingModal` montowany **tylko w `Index.tsx`**. Po starcie #2 generowania z `StudentPage` (bez powrotu na `/`) widać tylko mini-panel — nie ma kart-switchera. User chce: wszędzie tam, gdzie modal się otwiera (czyli na każdej stronie w aktualnym tabie, w którym lecą joby), powinny być widoczne karty wszystkich aktywnych jobów tego taba — analogicznie do `ActiveGenerationMiniPanel`.

### Solution options
| # | Opis | Tradeoff | Risk |
|---|------|----------|------|
| A | Wyciągnąć montaż `GeneratingModal` z `Index` do globalnego komponentu `GlobalGeneratingModal`, mountowanego w `App.tsx` obok `ActiveGenerationMiniPanel`. Joby czytane z rejestru, filtrowane po `originTabId === tabId`. | Najprostsze, jedno źródło prawdy, zero duplikacji. | Niskie — `GeneratingModal` już używa `createPortal`. |
| B | Powielić mount w `StudentPage`, `DashboardPage` itd. | Duplikacja, trudne do utrzymania. | Średnie. |
| C | Mini-panel jako trigger — klik otwiera lokalny modal. | Wymaga przepisania propsów, traci automatyczne otwarcie po starcie generowania. | Wysokie. |

### Selected solution + why
**A** — jedno miejsce montażu, brak rozjazdu stanu między stronami. `GlobalGeneratingModal` czyta wszystko z `generationJobRegistry` (status, progress, formMeta, errorMessage, recoveryDeadlineAt) — to wystarczy, nie potrzeba kontekstu z lokalnego `useWorksheetGeneration`.

### Impact analysis
- `Index.tsx` przestaje renderować `GeneratingModal` (oba mounty znikają).
- `useWorksheetGeneration.streamProgress` / `mediaGenerating` / `generationError` przestają być źródłem propsów modalu — wszystko bierzemy z `WorksheetGenerationJob` (które `useWorksheetGeneration` już patchuje przez `patchGenerationJob` — `progress`, `errorMessage`).
- `mediaGenerating` musi być widoczne globalnie → rozszerzamy `WorksheetGenerationJob.progress` o opcjonalne `phase: 'media' | 'streaming' | 'repairing'` i ustawiamy `phase='media'` w `useWorksheetGeneration` przed startem streamu, gdy `setMediaGenerating(true)` (już istnieje).
- Worksheet engine — niezmieniony.

### Full implementation
1. **`src/components/generation/GlobalGeneratingModal.tsx` (nowy)**
   - Hooki: `useActiveWorksheetGenerationJobs()`, `useTabId()`, `useAuthFlow()`, `useLocation()`, `useNavigate()`.
   - Stan: `const [activeJobIdx, setActiveJobIdx] = useState(0)`.
   - `myPollableJobs = jobs.filter(j => (j.originTabId ?? null) === tabId && (j.status === 'running' || (j.status === 'failed' && j.recoveryDeadlineAt && Date.now() < j.recoveryDeadlineAt))).sort((a,b)=>a.startedAt-b.startedAt)`.
   - `useEffect`: gdy `myPollableJobs.length` rośnie, `setActiveJobIdx(myPollableJobs.length - 1)`.
   - `safeIdx = Math.min(activeJobIdx, Math.max(0, myPollableJobs.length - 1))`.
   - `activeJob = myPollableJobs[safeIdx] ?? null`.
   - `modalJobsMeta = myPollableJobs.map(j => ({ jobId: j.jobId, studentName: j.formMeta?.studentName ?? null, topic: j.topic, progress: j.progress ? { exercisesGenerated: j.progress.exercisesGenerated, expectedTotal: j.progress.expectedTotal } : null }))`.
   - Render `<GeneratingModal isOpen={!!activeJob} isResumed={true} jobId={activeJob?.jobId ?? null} jobsCount={myPollableJobs.length} currentIndex={safeIdx} onSelectIndex={setActiveJobIdx} jobs={modalJobsMeta} studentId={activeJob?.studentId ?? null} requiresAudio={!!activeJob?.formMeta?.requiresAudio} requiresImage={!!activeJob?.formMeta?.requiresImage} hasGrammar={!!activeJob?.formMeta?.hasGrammar} streamProgress={activeJob?.progress ? { exercisesGenerated: activeJob.progress.exercisesGenerated, expectedTotal: activeJob.progress.expectedTotal } : null} mediaGenerating={activeJob?.progress?.phase === 'media'} selectedExercises={activeJob?.formMeta?.selectedExercises} errorMessage={activeJob?.status === 'failed' && !activeJob?.recoveryDeadlineAt ? activeJob.errorMessage : null} recovering={!!activeJob?.recoveryDeadlineAt && Date.now() < activeJob.recoveryDeadlineAt} onRetry={undefined} isAnonymous={!user} studentName={activeJob?.formMeta?.studentName ?? undefined} studentEmail={activeJob?.formMeta?.studentEmail ?? null} startedAt={activeJob?.startedAt} />`.
   - `isResumed={true}` — bo nie posiadamy lokalnego streamingu w tym komponencie; wszystkie dane z rejestru. Modal nadal pokazuje progress poprawnie.

2. **`src/App.tsx`**
   - Pod istniejącym `<ActiveGenerationMiniPanel />` dodać `<GlobalGeneratingModal />`.

3. **`src/pages/Index.tsx`**
   - Usunąć oba `<GeneratingModal>` (gałąź auth + anon). Usunąć importy/stan związane wyłącznie z propsami modalu (jeśli nieużywane gdzie indziej): `myRunningJobs`, `activeJobIdx`, `safeIdx`, `activeJob`, `isResumedGeneration`, `jobsCount`, `modalJobsMeta`. **UWAGA:** `setActiveJobIdx` może być nadal używany przez user UX (klik karty), ale skoro przeniesiony do `GlobalGeneratingModal`, w Index znika.
   - `isGenerating` z `useWorksheetGeneration` nadal wpływa na rejestr przez `startGenerationJob` — `GlobalGeneratingModal` to widzi.

4. **`src/hooks/useWorksheetGeneration.tsx`**
   - W ścieżce `requiresAudio` / `requiresImage` (przed startem stream): `if (activeJobId) patchGenerationJob(activeJobId, { progress: { exercisesGenerated: 0, expectedTotal: getExpectedExerciseCount(data.lessonTime), phase: 'media' } })`. Po pre-generacji mediów ustawić `phase: 'streaming'`.
   - W `onError` po `recoverWorksheetAfterStreamLoss` zwracającym null → `failGenerationJob(activeJobId, err.message)` (już opisane w Problem 1).

5. **`src/components/GeneratingModal.tsx`**
   - Wizualne wyróżnienie aktywnej karty: dodać `aria-selected` + `border-primary bg-primary/5` gdy `i === currentIndex`.
   - Zostaje wszystko inne bez zmian (kontrakty propsów, portal, sekcje, timer).

### Verification checklist
- [ ] Start gen #1 na `/` → modal z 1 jobem, mini-panel ukryty (foreground modal mount event).
- [ ] Bez zamykania modalu navigate do `/student/<id>` → modal nadal widoczny dzięki globalnemu mountowi.
- [ ] Start gen #2 na StudentPage → modal pokazuje 2 karty, switcher działa, każda karta osobny timer/topic/student/X/Y.
- [ ] Otwarcie tej samej domeny w drugim tabie → tam żaden job nie ma `originTabId === tabId`, modal NIE otwiera się, mini-panel widoczny (joby z innych tabów).
- [ ] Po zakończeniu gen #1 modal automatycznie przełącza switcher na gen #2 (lub zamyka się jeśli #2 też skończony).

---

## Problem 3 — Po błędzie generowania `selectedExercises` mają niezgodny zestaw (word-order [G] → Gap Text (Cloze) [V])

### Dependency scan
- `src/components/WorksheetForm/index.tsx` — `submitForm` (auto-complete losowy linia 511–534), `applyPreset`, hydratacja z drafta linia 200–240.
- `src/hooks/useWorksheetFormPersistence.ts` — debounced auto-save 600 ms, hydratacja.
- `src/lib/dslm/normalizeSuggestionPrefill.ts` — `VALID_IDS` zawiera `word-order`.
- `src/lib/worksheet/autoGenerateBootstrap.ts` — `buildAutoGeneratePayload` z sessionStorage prefill.
- `src/components/WorksheetForm/NextStepsPresetBanner.tsx` — wywołuje `applyPreset` na klik chipa.

### Root cause
Draft 24 h auto-saved z debounce 600 ms. W ścieżce auto-bootstrap (Next Step → klik „Generate worksheet ↗" → Index nawiguje na `/` i wywołuje `handleGenerateWorksheet(payload)`) **formularz nie zdąża zapisać submittowanego `formData`** zanim wystartuje generowanie. Po faili formularz remountuje się i hydratuje **stary** draft (poprzednia sesja, inny zestaw — np. losowy zestaw z domyślnych po `submitForm` autocomplete). Dodatkowo `submitForm` auto-uzupełnia exercises losowo (`shuffledUnused.slice(0, remainingSlots)`), więc stan nie jest deterministycznie odtwarzalny.

### Solution options
| # | Opis | Tradeoff | Risk |
|---|------|----------|------|
| A | W `submitForm` synchronicznie zapisać draft z DOKŁADNIE wysłanym `formData` (override debounced auto-save) przed `onSubmit`. Dodatkowo w `applyPreset`. | Najprostszy, deterministyczny. | Niskie. |
| B | Trzymać snapshot w `sessionStorage` keyed po `clientGenerationId` i hydratować przy generationError. | Bardziej skomplikowane, dodatkowa droga danych. | Średnie. |
| C | Przechowywać submitted formData w `WorksheetGenerationJob.formMeta` i hydratować formularz z `failGenerationJob` payload. | Wymaga rozszerzenia rejestru + listener w formularzu. | Średnie. |

### Selected solution + why
**A** — zero nowych ścieżek danych, używa istniejącego `useWorksheetFormPersistence`, jeden synchroniczny `localStorage.setItem`. Klucz `${STORAGE_PREFIX}.${userId|anon}` już istnieje.

### Impact analysis
- Tylko ścieżka submitu — zero wpływu na worksheet engine.
- Sukces generowania nadal czyści draft przez event `worksheetGenerationSuccess` (`clearPersistedDraft`), brak „zalegania".
- Anonymous nie miesza się z zalogowanym (klucz per `userId|anon`).

### Full implementation
1. **`src/hooks/useWorksheetFormPersistence.ts`**
   - Eksport dodatkowej funkcji `saveDraftNow(draft: WorksheetDraft): void`:
     ```ts
     const saveDraftNow = useCallback((draft: WorksheetDraft) => {
       try {
         const payload: StoredDraft = { savedAt: Date.now(), data: draft };
         localStorage.setItem(storageKey, JSON.stringify(payload));
       } catch { /* ignore quota */ }
     }, [storageKey]);
     ```
   - Zwracać razem z `clear`: `return { clear, saveDraftNow }`.

2. **`src/components/WorksheetForm/index.tsx`**
   - Destructuring: `const { clear: clearPersistedDraft, saveDraftNow } = useWorksheetFormPersistence(...)`.
   - W `submitForm`, **po** wyliczeniu `finalExercises` i `formData`, **przed** `onSubmit(formData)`:
     ```ts
     saveDraftNow({
       lessonTime,
       lessonTopic: effectiveTopic,
       lessonGoal,
       grammarFocus,
       additionalInformation,
       englishLevel,
       languageStyle,
       selectedExercises: finalExercises,
       selectedMediaTypes,
       exerciseFocusMap,
       selectionMode,
       selectedStudentId: selectedStudentId && selectedStudentId !== 'no-student' ? selectedStudentId : undefined,
     });
     ```
   - W `applyPreset` (linia 702) — po `setSelectedExercises(norm.selectedExercises)` itd. dodać analogiczny `saveDraftNow(...)` z normalizowanym payloadem, żeby pierwszy auto-submit po kliknięciu „Generate worksheet" miał już aktualny draft (covers race gdy user refresh w pierwsze 600 ms).

### Verification checklist
- [ ] Klik „Generate worksheet ↗" w Next Step z word-order [G] → wymuszony network error → formularz pokazuje **dokładnie** ten sam zestaw (word-order [G] zachowany).
- [ ] Sukces generowania nadal czyści draft (sprawdzić `localStorage` po `worksheetGenerationSuccess`).
- [ ] Anonymous user: draft pod `anon` nie miesza się z draftem zalogowanego po loginie.
- [ ] Klik „Use this — copy to form & edit before generating" → zachowanie bez zmian, plus draft od razu zapisany.

---

## Problem 4 — Migracja modelu obrazu na `gemini-3.1-flash-image-preview` (Vertex AI), z zachowaniem dotychczasowej architektury Vertex

### Dependency scan
- `supabase/functions/generate-image/index.ts` — linia 70 (`getVertexAccessToken`), 83 (`imagen-4.0-fast-generate-001:predict`), 110 (log).
- `supabase/functions/_shared/modelFailureLogger.ts` — wspólny helper logu.
- `src/components/worksheet/MediaSection.tsx` linia 319 — link `deepmind.google/models/imagen/`.
- Sekret `GEMINI_VERTEX_API_KEY` (service account JSON) — pozostaje, ten sam projekt GCP.

### Root cause
`imagen-4.0-fast-generate-001` jest oznaczony do sunsetu na Vertex (Google deadline 30.06.2026). Najlepszy zamiennik (szybkość/jakość/cena, dostępny via Vertex bez zmiany authu) to **`gemini-3.1-flash-image-preview`** (Nano Banana 2). Endpoint i kontrakt I/O różni się od Imagen — używa `:generateContent` zamiast `:predict`, zwraca obraz w `candidates[].content.parts[].inlineData.data` (base64) zamiast `predictions[].bytesBase64Encoded`.

### Solution options
| # | Opis | Tradeoff | Risk |
|---|------|----------|------|
| A | Vertex AI `gemini-3.1-flash-image-preview` przez `generateContent` (zachowaj service account, tylko zmień endpoint + parser + parametry). | Spełnia wymóg usera (zostajemy na Vertex), najnowszy model, zachowuje obecny model failure logger. | Niskie — kontrakt response inny, ale dobrze udokumentowany. |
| B | Pozostać na `imagen-4.0-fast-generate-001` (bez migracji). | Brak roboty, ale deadline 30.06.2026 → ścieżka i tak musi powstać. | Wysokie po deadline. |
| C | Migracja na `gemini-2.5-flash-image` (stable, nie preview). | Wolniejszy, droższy, niższa jakość niż Nano Banana 2 wg user research. | Niskie. |

### Selected solution + why
**A** — user explicit `gemini-3.1-flash-image-preview` (Nano Banana 2). Zostajemy na Vertex AI (ten sam `GEMINI_VERTEX_API_KEY`, ta sama funkcja `getVertexAccessToken`, ten sam project ID parsing). Zmieniamy wyłącznie endpoint, body i parser response.

### Impact analysis
- Auth: zostaje OAuth2 access token via service account (`getVertexAccessToken`) — bez zmian.
- Region: `gemini-3.1-flash-image-preview` jest dostępny w `us-central1` (potwierdzone na Vertex Gemini API). Endpoint:
  ```
  https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-3.1-flash-image-preview:generateContent
  ```
- Body: `contents` z `parts[{ text }]` + `generationConfig` z `responseModalities: ["IMAGE"]` + `imageConfig: { aspectRatio: "16:9" }`. Brak `safetyFilterLevel` / `personGeneration` w starym formacie — zamiast tego `safetySettings` per harm category.
- Parser response: `candidates[0].content.parts.find(p => p.inlineData)?.inlineData.data` (base64) + `mimeType`.
- `selected_image` schema (data URL, upload do storage) — bez zmian, dalej `data:image/png;base64,${base64}`.
- Worksheet engine — niezmieniony.
- `mediaService.ts` — bez zmian (interfejs `generate-image` ten sam).
- `MediaSection.tsx` — kosmetyczna aktualizacja linku do dokumentacji modelu.
- `modelFailureLogger` — działa, zmieniamy tylko nazwę modelu i endpoint w `logModelFailure({...})`.

### Full implementation

1. **`supabase/functions/generate-image/index.ts`**
   - Zachować całą logikę pre-walidacji, parsowania service account, `getVertexAccessToken(GEMINI_VERTEX_API_KEY)` i parsing `projectId`.
   - Zmienić sekcję STEP 1 (linie ~66–127) na:
     ```ts
     console.log(`[GENERATE-IMAGE] Starting image generation for topic: "${topic}", level: ${englishLevel}, user: ${userId}`);
     const imagePrompt = createImagePrompt(topic, englishLevel);
     console.log(`[GENERATE-IMAGE] Image prompt: ${imagePrompt.substring(0, 150)}...`);

     const accessToken = await getVertexAccessToken(GEMINI_VERTEX_API_KEY);
     let projectId = "your-gcp-project";
     try {
       const serviceAccount = JSON.parse(GEMINI_VERTEX_API_KEY);
       projectId = serviceAccount.project_id;
       console.log(`[GENERATE-IMAGE] Using project ID: ${projectId}`);
     } catch {
       throw new Error("GEMINI_VERTEX_API_KEY must be a valid service account JSON");
     }

     const MODEL_ID = "gemini-3.1-flash-image-preview";
     const vertexEndpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${MODEL_ID}:generateContent`;

     const imageResponse = await fetch(vertexEndpoint, {
       method: "POST",
       headers: {
         Authorization: `Bearer ${accessToken}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         contents: [
           {
             role: "user",
             parts: [{ text: imagePrompt }],
           },
         ],
         generationConfig: {
           responseModalities: ["IMAGE"],
           imageConfig: { aspectRatio: "16:9" },
         },
         safetySettings: [
           { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
           { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
           { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
           { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
         ],
       }),
     });

     if (!imageResponse.ok) {
       const errorText = await imageResponse.text();
       console.error(`[GENERATE-IMAGE] Vertex AI error: ${imageResponse.status} - ${errorText}`);
       await logModelFailure({
         model: MODEL_ID,
         provider: 'google-vertex',
         status: imageResponse.status,
         endpoint: vertexEndpoint,
         error: errorText.slice(0, 500),
         functionName: 'generate-image',
       });
       throw new Error(`Image generation failed: ${imageResponse.status} - ${errorText}`);
     }

     const imageData = await imageResponse.json();
     // Gemini Image: candidates[0].content.parts → znajdź pierwszy z inlineData
     const inlinePart = imageData?.candidates?.[0]?.content?.parts?.find(
       (p: any) => p?.inlineData?.data
     );
     const base64Image: string | undefined = inlinePart?.inlineData?.data;
     const mimeType: string = inlinePart?.inlineData?.mimeType || "image/png";

     if (!base64Image) {
       console.error("[GENERATE-IMAGE] No image in Vertex AI response:", JSON.stringify(imageData).slice(0, 1000));
       throw new Error("No valid image data received from Vertex AI (gemini-3.1-flash-image-preview)");
     }

     const imageUrl = `data:${mimeType};base64,${base64Image}`;
     console.log(`[GENERATE-IMAGE] Image generated successfully (${Math.round(base64Image.length / 1024)}KB, ${mimeType})`);
     ```
   - STEP 2 (description przez Gemini z vision) — **bez zmian** (używa `gemini-2.0-flash` z `imagePart.inlineData.data = base64Image, mimeType = "image/png"` — zaktualizować mimeType jeśli różny, bezpiecznie zostawić `mimeType` z Vertex response):
     ```ts
     const imagePart = {
       inlineData: {
         data: base64Image,
         mimeType: mimeType, // dynamicznie z response zamiast hardcoded "image/png"
       },
     };
     ```
   - Reszta funkcji (upload do storage, return JSON) — bez zmian.

2. **`src/components/worksheet/MediaSection.tsx`** linia 319 — link `https://deepmind.google/models/imagen/` zaktualizować na `https://deepmind.google/models/gemini/` (lub usunąć jeśli redundantny — preferuję zaktualizować, mniej zmian).

3. **Brak zmian** w `mediaService.ts`, `generate-audio`, `useWorksheetGeneration`, schemacie DB, `selected_image` kontraktcie.

### Verification checklist
- [ ] Deploy `generate-image` przez Lovable Cloud (auto-restart funkcji).
- [ ] `supabase--curl_edge_functions` POST `{"topic":"travel","englishLevel":"B1/B2"}` → 200, `imageData.predictions === undefined`, w response widzimy obraz, `selected_image.url` zaczyna się od `data:image/png;base64,` lub po uploadzie publiczny URL.
- [ ] Pełna generacja worksheetu z `requiresImage = true` → obraz pojawia się w `MediaSection`, w bazie `worksheets.selected_image.url`.
- [ ] `rg "imagen-4" supabase/ src/` → tylko ewentualny CHANGELOG/memo.
- [ ] Komunikat błędu (np. testowo wymuszony 403 z Vertex) → toast „Image generation failed" + brak konsumpcji tokenu (early return w `useWorksheetGeneration`).
- [ ] `model_failure_log` (jeśli istnieje) → wpisy z `model='gemini-3.1-flash-image-preview'`, `provider='google-vertex'`.

---

## RAG injection (do wykonania po implementacji)
- `docs/llm-context.md` + `public/llms.txt` — sekcja **v6.9.61**:
  - **PROBLEM**: Refresh during generation dropped token consumption + next-step flip; multi-job switcher only visible on `/`; form lost word-order [G] after error; Imagen 4.0 Fast deprecated.
  - **EDOOQOO SOLUTION**: DB poller now also covers `failed` jobs within a 60 s `recoveryDeadlineAt` window and promotes them to `completed`; hard 4 min running TTL flips dead jobs to `failed`; `GlobalGeneratingModal` mounted in `App.tsx` reads everything from the job registry, so multi-job card switcher works on every page; `saveDraftNow` writes the submitted form state synchronously so retries after error keep word-order [G]; `generate-image` Edge Function migrated to `gemini-3.1-flash-image-preview` on Vertex AI (`generateContent`, `responseModalities: ["IMAGE"]`, `imageConfig.aspectRatio: "16:9"`).
  - **TECHNICAL MECHANICS**: `recoverJobToCompleted`, `expireStaleRunningJobs`, `getPollableJobs`, `recoveryDeadlineAt`, `GlobalGeneratingModal`, `useWorksheetFormPersistence.saveDraftNow`, Vertex Gemini Image endpoint, `inlineData` parser, `mimeType` propagacja, `consume_token` idempotency leverage (v6.9.59).
  - **RAG KEYWORDS**: refresh-safe worksheet generation, transport recovery window, idempotent token consumption, multi-job switcher cards, global modal mount, form draft synchronous snapshot, Vertex AI Gemini Image, gemini-3.1-flash-image-preview, Nano Banana 2 deprecation, originTabId scope, mini panel parity, EdgeRuntime.waitUntil, clientGenerationId reconciliation, failed-to-completed promotion, sanctity worksheet engine, generation phase media streaming repairing.
- Nowa pamięć: `mem/features/onboarding/v6961-recovery-global-modal-image-migration.md` + wpis w `mem/index.md`.

---

## Final change report (preview)
- **Files modified**:
  - `src/lib/worksheet/generationJobRegistry.ts`
  - `src/hooks/useActiveWorksheetGenerationJob.tsx`
  - `src/hooks/useWorksheetGeneration.tsx`
  - `src/hooks/useWorksheetFormPersistence.ts`
  - `src/components/WorksheetForm/index.tsx`
  - `src/components/GeneratingModal.tsx`
  - `src/pages/Index.tsx`
  - `src/App.tsx`
  - `supabase/functions/generate-image/index.ts`
  - `src/components/worksheet/MediaSection.tsx`
  - `docs/llm-context.md`, `public/llms.txt`, `mem/index.md`
- **Files created**:
  - `src/components/generation/GlobalGeneratingModal.tsx`
  - `mem/features/onboarding/v6961-recovery-global-modal-image-migration.md`
- **Documentation updated**: YES.
- **Out of scope flagged**: rotacja sekretu `GEMINI_VERTEX_API_KEY` (nie potrzebna — ten sam service account z dostępem do tego samego projektu GCP, model dostępny w tej samej puli IAM `aiplatform.user`); ewentualne audyty kwoty Vertex Gemini Image w `audit-llm-models.ts` (osobny ticket).
- **Verification**: per-problem checklisty powyżej.

---

**Czekam na `OK`. Po akceptacji wchodzę w build mode i wdrażam całość v6.9.61 w jednym przebiegu.**
