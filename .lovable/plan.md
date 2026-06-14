# Plan v6.9.57 — Refresh-Safe Worksheet Generation

Wszystkie zmiany trzymają się reguły **SANCTITY** — prompt i logika generowania (`composeSystemMessage`, modele, parametry) pozostają nietknięte. Zmieniamy wyłącznie **lifecycle stream/IIFE**, **persistencję stanu UI** i **gating side-effects (token + suggestion)**.

---

## Mapa problemów i dependency scan (wspólna)

Affected surface:
- `supabase/functions/generateWorksheet/index.ts` (linie 517–788 — branża `useStreaming`)
- `src/services/worksheetStreamService.ts`
- `src/hooks/useWorksheetGeneration.tsx`
- `src/hooks/useActiveWorksheetGenerationJob.tsx`
- `src/components/generation/ActiveGenerationMiniPanel.tsx`
- `src/components/GeneratingModal.tsx` (tylko copy + tryb "resumed")
- `src/pages/Index.tsx` (rehydratacja modala po refresh)
- `src/lib/worksheet/generationJobRegistry.ts` (nowe pole `formMeta`)
- `src/lib/worksheet/autoGenerateBootstrap.ts` — bez zmian, ale weryfikujemy że bootstrap NIE pali nowego requesta gdy job już jest `running`

---

## PROBLEM 1 — Refresh przerywa generowanie, brak zapisu w DB

### Root cause
Backendowa generacja streamuje przez `send()` do `ReadableStream`. Gdy klient zrywa fetch (refresh), SSE writer zaczyna rzucać przy każdym `send`, a IIFE (`(async () => {...})()`) NIE jest objęty `EdgeRuntime.waitUntil`. Deno Deploy uznaje fetch handler za zakończony i kasuje workera **zanim** linia 709 (`INSERT INTO worksheets`) zdąży wykonać się. W logach: progress 1→7, potem `shutdown`, brak `done`, brak rekordu w DB.

### Solution options

| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Owinąć całe ciało IIFE w `EdgeRuntime.waitUntil` + zignorować błędy `send` po disconnect; zapis do DB i `notify` lecą zawsze do końca | Minimalna ingerencja, zero zmian w prompt/logice modelu | LOW |
| B | Przepisać na asynchroniczny job pattern (osobna tabela `generation_jobs`, polling status) | Najbardziej "prawidłowe", ale ogromne, dotyka 1-Minute Prep flow, ryzyko regresji w wielu miejscach | HIGH |
| C | Podnieść SSE keepalive i polegać tylko na frontendowej rekoncyliacji | Nie rozwiązuje root cause: backend nadal umiera przy refresh | MEDIUM |

### Selected: A — `EdgeRuntime.waitUntil` na całym pipeline + tolerant `send`

**Dlaczego:** rozwiązuje root cause przy minimalnym blast radius. Reszta przepływu (rekoncyliacja po `clientGenerationId`) już istnieje od v6.9.55 i tylko czeka, aż backend rzeczywiście zapisze wiersz.

### Impact analysis
- Worksheet Generation Engine: **NIETKNIĘTY** (zero zmian w `composeSystemMessage`, modelach, parametrach, kolejności wywołań AI).
- Auth/RLS: bez zmian.
- Streaming UI w czasie pierwszej generacji (bez refresh): zachowane 1:1 — `send` nadal woła do otwartego streama; nowość polega tylko na tolerancji błędów po disconnect.
- Logi: dodajemy 2 nowe linie `console.log` (client disconnect).

### Pełna implementacja

**`supabase/functions/generateWorksheet/index.ts` — owinięcie IIFE:**

Zamienić obecny blok (linie ~532–788):

```ts
// Background: Generate with streaming
(async () => {
  // ...cała generacja, insert, send("done"), catch send("error"), close()
})();

return responsePromise;
```

na:

```ts
// v6.9.57 — Refresh-safe: trzymamy worker żywym do końca generacji,
// nawet jeśli klient odłączył się (refresh / nawigacja).
let clientConnected = true;
const safeSend = (event: string, payload: unknown) => {
  if (!clientConnected) return;
  try {
    send(event, payload);
  } catch (e) {
    // Stream zamknięty po stronie klienta — przełączamy w tryb "headless"
    // i kontynuujemy generację aż do zapisu w DB.
    clientConnected = false;
    console.log("📴 SSE client disconnected, continuing in background-only mode", {
      event,
      reason: e instanceof Error ? e.message : String(e),
    });
  }
};
const safeClose = () => {
  try { close(); } catch { /* ignore */ }
};

const backgroundWork = (async () => {
  let fullContent = "";
  let lastExerciseCount = 0;
  let streamUsedModel = "";
  const expectedTotal = getExpectedCount(formData?.lessonTime);

  try {
    safeSend("start", { message: "Starting generation..." });
    // ...cała dotychczasowa logika streamingu — KAŻDE wywołanie send(...)
    // zamieniamy mechanicznie na safeSend(...)
    // ...
    // pozostałe INSERT do worksheets i safeSend("done", ...) bez zmian
  } catch (error) {
    // istniejący catch — safeSend("error", ...)
  } finally {
    safeClose();
  }
})();

// @ts-ignore - EdgeRuntime jest globalne na Deno Deploy
if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
  // @ts-ignore
  EdgeRuntime.waitUntil(backgroundWork);
}

return responsePromise;
```

Mechaniczna zamiana wszystkich `send(...)` wewnątrz tej IIFE na `safeSend(...)` (grep: w tym bloku jest ~8 wywołań: `start`, progress×N, `done`, `error`). `close()` zamieniamy na `safeClose()`.

### Verification checklist P1
- [ ] Pełne wygenerowanie (bez refresh) działa identycznie jak teraz (SSE `start`/`progress`/`done`).
- [ ] Po refresh w 30% generacji: backend dochodzi do `INSERT`, wiersz pojawia się w `worksheets` z `form_data->>clientGenerationId` = id z localStorage.
- [ ] `useActiveWorksheetGenerationJob` (już istniejący polling co 5s) odnajduje wiersz i wywołuje `completeGenerationJob`.
- [ ] Build edge functions zielony.

---

## PROBLEM 2 — Modal znika po refresh; brak komunikatu "refresh nie przerywa"

### Root cause
`GeneratingModal` jest renderowany warunkowo na `isGenerating` ze state'u React komponentu `Index.tsx`. Po refresh state jest pusty → modal znika. `ActiveGenerationMiniPanel` ukrywa się na `/` (linia 39: `if (job.status === 'running' && location.pathname === '/') return false;`) zakładając że modal jest na ekranie — ale po refresh ani jedno, ani drugie nie jest widoczne.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Rehydratować `isGenerating=true` na mount `Index.tsx` gdy `getActiveGenerationJob().status === 'running'` + dorzucić info copy "Refreshing this page won't stop generation" w `GeneratingModal` | Modal wraca w identycznym wyglądzie, copy edukuje usera | LOW |
| B | Zlikwidować modal, pokazywać tylko mini-panel wszędzie | Duża zmiana UX, regresja brandu | HIGH |
| C | Tylko poprawić mini-panel (nie wracać modala) | Słabszy UX po refresh, mini-panel jest dyskretny | MEDIUM |

### Selected: A

**Dlaczego:** zachowuje znajomy UX z modalem (user widzi te same etapy postępu), dodaje wyraźne info, że odświeżenie jest bezpieczne. Mini-panel pełni rolę back-up'u (poniżej P3).

### Pełna implementacja

**1) `src/components/GeneratingModal.tsx` — nowy prop `isResumed` + copy:**

Dodać do interfejsu:
```ts
interface GeneratingModalProps {
  // ...istniejące pola
  isResumed?: boolean; // true gdy modal wrócił po refresh
}
```

Wewnątrz komponentu, **pod paskiem postępu** (przed listą sekcji), wstawić:

```tsx
{isResumed && (
  <div className="mx-4 mt-2 mb-3 rounded-md border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
    <strong>Generation resumed.</strong> The page was refreshed but generation
    kept running in the background. Your worksheet will appear automatically
    when it's ready — no token will be charged unless it completes.
  </div>
)}
```

Pod istniejącym paskiem postępu (zarówno w trybie świeżym jak i resumed) dorzucić jednorazowy hint (poniżej tytułu, nad listą):

```tsx
{!isResumed && streamProgress && (
  <p className="text-center text-[11px] text-muted-foreground mt-1">
    Refreshing this page won't stop generation — you can come back any time.
  </p>
)}
```

**2) `src/lib/worksheet/generationJobRegistry.ts` — rozszerzenie:**

Dodać do `WorksheetGenerationJob`:
```ts
formMeta?: {
  requiresAudio?: boolean;
  requiresImage?: boolean;
  hasGrammar?: boolean;
  selectedExercises?: string[];
  studentName?: string | null;
  studentEmail?: string | null;
} | null;
```

W `startGenerationJob` przyjąć `formMeta` jako opcjonalny input i zapisać.

**3) `src/hooks/useWorksheetGeneration.tsx`:**

W wywołaniu `startGenerationJob` (linia ~165) dorzucić:
```ts
formMeta: {
  requiresAudio,
  requiresImage,
  hasGrammar,
  selectedExercises: data.selectedExercises || [],
  studentName: (data as any).studentName || null,
  studentEmail: (data as any).studentEmail || null,
},
```

**4) `src/pages/Index.tsx` — rehydracja modala po refresh:**

Bezpośrednio pod istniejącym `const { isGenerating, ... } = useWorksheetGeneration(...)` dodać:

```tsx
// v6.9.57 — Rehydrate modal after refresh if background job is still running.
const activeJob = useActiveWorksheetGenerationJob();
const isResumedGeneration =
  !!activeJob &&
  activeJob.status === 'running' &&
  !isGenerating; // tylko jeśli świeże generowanie nie jest w toku
```

W obu miejscach gdzie renderowany jest `<GeneratingModal isOpen={isGenerating} ... />` (linie 428 i 550) zamienić na:

```tsx
<GeneratingModal
  isOpen={isGenerating || isResumedGeneration}
  isResumed={isResumedGeneration}
  requiresAudio={isResumedGeneration ? activeJob?.formMeta?.requiresAudio : worksheetState.inputParams?.requiresAudio}
  requiresImage={isResumedGeneration ? activeJob?.formMeta?.requiresImage : worksheetState.inputParams?.requiresImage}
  hasGrammar={isResumedGeneration ? activeJob?.formMeta?.hasGrammar : worksheetState.inputParams?.hasGrammar}
  selectedExercises={isResumedGeneration ? activeJob?.formMeta?.selectedExercises : worksheetState.inputParams?.selectedExercises}
  streamProgress={streamProgress /* po refresh brak — pasek pokaże tryb indeterminate */}
  mediaGenerating={mediaGenerating}
  studentName={isResumedGeneration ? activeJob?.formMeta?.studentName ?? undefined : ...istniejące}
  studentEmail={isResumedGeneration ? activeJob?.formMeta?.studentEmail ?? null : ...istniejące}
  errorMessage={isResumedGeneration ? null : generationError}
  onCancel={isResumedGeneration ? undefined : cancelGeneration}
  onRetry={isResumedGeneration ? undefined : () => clearGenerationError()}
  isAnonymous={!user}
/>
```

Gdy `activeJob.status` przejdzie w `completed`, `useActiveWorksheetGenerationJob` dispatchuje `worksheetGenerationSuccess` — istniejący nasłuch nawiguje do `/worksheet/:id` i modal sam się chowa (job zostaje `completed`, `isResumedGeneration` = false bo warunek `=== 'running'`).

**5) `GeneratingModal.tsx` — tryb indeterminate dla `streamProgress === null`:**

W istniejącym `Progress` value komponentu obsłużyć przypadek braku progresu po refresh:
```tsx
const indeterminate = isResumed && !streamProgress;
// jeżeli indeterminate → render <Progress className="animate-pulse" value={undefined as any} />
// lub zachować obecny progress bar z dopiskiem "Resumed in background…"
```

### Verification checklist P2
- [ ] Świeże generowanie: modal pokazuje się dokładnie jak teraz (zero zmian widocznych).
- [ ] Refresh w trakcie generowania: modal wraca z banerem "Generation resumed".
- [ ] Po zapisie worksheet w DB: modal zamyka się, użytkownik trafia na `/worksheet/:id`.
- [ ] Nowy hint "Refreshing this page won't stop generation" jest widoczny w świeżym modalu.
- [ ] Pass Martha Test: copy jest profesjonalny, brak żargonu, jasna intencja.

---

## PROMBLEM 3 — Mini-panel nie pokazuje się na `/`

### Root cause
`ActiveGenerationMiniPanel` linia 39 zwraca `false` dla `running` na `/` zakładając, że na `/` jest modal. Po refresh to założenie jest fałszywe **dopóki** Index nie zdąży zhydratować — ale teraz, gdy modal też wraca (P2), faktycznie powstaje duplikat. Trzeba zsynchronizować obie ścieżki.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Pozwolić mini-panelowi pokazać się na `/` **tylko** gdy modal NIE jest zamontowany (np. global event `generation-modal-mounted`) | Najlepsza ergonomia, brak duplikatu | LOW |
| B | Mini-panel zawsze widoczny na `/` (też z modalem) | Wizualny szum, duplikacja | MEDIUM |
| C | Mini-panel nigdy na `/`, ale dodać natywny komponent przy header | Inkonsystencja UX | MEDIUM |

### Selected: A — event-based gating

### Pełna implementacja

**1) `src/components/GeneratingModal.tsx`:** w `useEffect` na mount/unmount:
```tsx
useEffect(() => {
  if (!isOpen) return;
  window.dispatchEvent(new CustomEvent('generation-modal:mount'));
  return () => {
    window.dispatchEvent(new CustomEvent('generation-modal:unmount'));
  };
}, [isOpen]);
```

**2) `src/components/generation/ActiveGenerationMiniPanel.tsx`:** zastąpić linię 39 nasłuchem:
```tsx
const [modalMounted, setModalMounted] = useState(false);
useEffect(() => {
  const onMount = () => setModalMounted(true);
  const onUnmount = () => setModalMounted(false);
  window.addEventListener('generation-modal:mount', onMount);
  window.addEventListener('generation-modal:unmount', onUnmount);
  return () => {
    window.removeEventListener('generation-modal:mount', onMount);
    window.removeEventListener('generation-modal:unmount', onUnmount);
  };
}, []);

const visible = useMemo(() => {
  if (!job) return false;
  // Hide tylko gdy faktyczny modal jest na ekranie (nie zgaduj po pathname)
  if (job.status === 'running' && modalMounted) return false;
  if (
    job.status === 'completed' &&
    job.worksheetId &&
    location.pathname === `/worksheet/${job.worksheetId}`
  ) return false;
  return true;
}, [job, location.pathname, modalMounted]);
```

### Impact analysis
- Strony bez modala (np. `/one-minute-prep`, `/dashboard`) — mini-panel pokazuje się natychmiast (poprawka).
- `/` z modalem — mini-panel ukryty (bez duplikatu).
- `/` po refresh bez modala — przez ~jedną klatkę renderu mini-panel jest widoczny, potem chowany kiedy modal się zamontuje. Akceptowalne.

### Verification checklist P3
- [ ] Strony inne niż `/`: mini-panel widoczny natychmiast po starcie generowania (nie trzeba otwierać nowej karty).
- [ ] `/` ze świeżym modalem: brak mini-panela.
- [ ] `/` po refresh z resumed modalem: brak mini-panela (modal go zasłania).
- [ ] `/worksheet/:id` dla wygenerowanego: brak mini-panela.

---

## PROBLEM 4 — Next Step `is_used` zaliczany mimo "Generation failed"

### Root cause
Analiza kodu (`useWorksheetGeneration.handleWorksheetCompletion` linia 619–646 i `useActiveWorksheetGenerationJob.applyCompletionSideEffects` linia 77–94) pokazuje, że `is_used` jest flipowany **tylko** po sukcesie. **ALE** w `autoGenerateBootstrap` istnieje ścieżka, gdzie `prefillSuggestionId` zostaje zapisany w sessionStorage zanim generowanie ruszy — jeżeli to ID przeżyje sesję między próbami, kolejna **nieudana** próba może go zinterpretować. Trzeba zagwarantować, że flip `is_used` jest gated dokładnie po `clientGenerationId` tej konkretnej próby.

### Solution
**Polityka:** `is_used = true` **tylko** wtedy, gdy istnieje wiersz `worksheets.form_data->>clientGenerationId = THIS_REQUEST.clientGenerationId`. Inne ścieżki muszą być zablokowane.

### Pełna implementacja

**1) `src/hooks/useWorksheetGeneration.tsx` — `handleWorksheetCompletion`:**

Zmienić blok flip `is_used` (linia ~620): przed UPDATE walidować że `worksheetResult.id` istnieje (już jest) ORAZ usunąć fallback do `sessionStorage.getItem('prefillSuggestionId')` — używać wyłącznie `(data as any).__autoGenerateSuggestionId`. Powód: sessionStorage może być stale po nieudanych próbach.

```ts
const sourceSuggestionId = (data as any).__autoGenerateSuggestionId || null;
// USUWAMY: || sessionStorage.getItem('prefillSuggestionId');
if (sourceSuggestionId && finalWorksheetId) {
  // ...UPDATE bez zmian
  sessionStorage.removeItem('prefillSuggestionId'); // czyść defensywnie
}
```

**2) `src/hooks/useActiveWorksheetGenerationJob.tsx` — `applyCompletionSideEffects`:**

Linia 77–94 jest poprawna (flip tylko gdy `job.suggestionId && wsId odnaleziony`). ALE dodać twardy guard: jeżeli `locateBackendWorksheet` zwrócił `null` w pollu, **NIGDY** nie wywołuj `applyCompletionSideEffects`. Aktualnie tak jest (linia 144 `if (!wsId) return`). OK.

**3) Wyciszenie ścieżki ze stream EOF:**

W `useWorksheetGeneration.onStreamEndedWithoutTerminalEvent` (linia 307–351) wywoływane `failGenerationJob` + `markPersistentAutoGenerateIntentStatus('failed')` — to **nie** dotyka `is_used`. Dobrze.

**4) Najważniejsze: na `failGenerationJob`, MUSIMY wyczyścić `prefillSuggestionId` z sessionStorage**, żeby przy ręcznym retry nie zmarkować innego worksheetu:

W `onError` (linia ~353) i `onStreamEndedWithoutTerminalEvent` (linia ~327) dodać:
```ts
try { sessionStorage.removeItem('prefillSuggestionId'); } catch {}
```

### Verification checklist P4
- [ ] Network error podczas generowania (np. zerwany internet) → suggestion w DB pozostaje `is_used = false`, dostępna w UI Next Steps.
- [ ] Refresh w trakcie generowania → jeżeli backend zapisał worksheet (P1 fix), `is_used` flipuje się POPRAWNIE z `applyCompletionSideEffects` używając `job.suggestionId`.
- [ ] Refresh + backend nie zdążył zapisać (timeout) → po wygaśnięciu jobu (15 min TTL w registry) `is_used` pozostaje `false`.
- [ ] Brak fallbacku do `sessionStorage.getItem('prefillSuggestionId')` — żadna inna ścieżka nie może go używać.

---

## PROBLEM 5 — Tokeny przy nieudanej generacji

### Stan obecny (po audycie kodu)
- `consumeToken` wywoływany jest tylko w `handleWorksheetCompletion` linia 504–514 (po pomyślnej walidacji wygenerowanego JSON-a) ORAZ w `applyCompletionSideEffects` linia 97–110 (gdy refresh-safe polling odnajdzie wiersz).
- Backend NIE konsumuje tokenu samodzielnie — robi to wyłącznie frontend.
- W `onError`, `onStreamEndedWithoutTerminalEvent` (gdy `recover` zwrócił `null`) → **brak** wywołania `consumeToken`. ✅
- Pre-generation media failure (audio/image throw) → return przed `consumeToken`. ✅

### Stwierdzenie: aktualna polityka jest poprawna ("only pay if it landed")

**ALE** są dwa edge-case'y do utwardzenia:

#### Edge case A: Backend zapisał worksheet, ale klient zerwał połączenie ZANIM `handleWorksheetCompletion` zdąży konsumować token
Po P1 fix: backend zawsze zapisze. `useActiveWorksheetGenerationJob` w polling robi `consume_token` RPC (linia 99). RPC `consume_token` ma idempotentność po stronie SQL? Trzeba zweryfikować — **akcja**: dodać guard po stronie frontu (`job.tokenConsumedAt` flag, już istnieje). Ale jeszcze nie pokrywa scenariusza: świeży klient + równolegle polling z innej karty.

**Decyzja:** dodać do `consume_token` RPC param `p_worksheet_id` jako idempotency key — jeżeli ta funkcja już dziś rejestruje konsumpcję per worksheet (np. w `token_consumption_log` z unique constraint na worksheet_id), nic nie zmieniamy. **Akcja weryfikacyjna w trakcie implementacji** (nie blokuje planu): odczytać definicję `public.consume_token` przed mergem; jeżeli brak unique, dodać migrację z `unique (worksheet_id)`.

#### Edge case B: Token "zabookowany" przed generacją?
Audit: token NIE jest rezerwowany przed generacją (rozsądnie — generacja może rozbić się przy media). Zostawiamy ten model: **konsumpcja = wyłącznie po pomyślnym wygenerowaniu i odnalezieniu wiersza w DB**.

### Pełna implementacja

**1) Dokumentacja zachowania** — dodać komentarz nad `consumeToken` w `handleWorksheetCompletion`:
```ts
// v6.9.57 — Token consumption policy:
// - Consumed ONLY after a worksheet row exists in DB AND was validated client-side.
// - Idempotent via consume_token RPC keyed on worksheet_id.
// - Refresh-safe path uses the same RPC from useActiveWorksheetGenerationJob.
// - Failures before DB insert: ZERO tokens consumed.
```

**2) Weryfikacyjna migracja (warunkowa, tylko jeśli brak unique constraint):**

Sprawdzić w trakcie implementacji:
```sql
-- W psql:
\df+ public.consume_token
SELECT conname, contype FROM pg_constraint
WHERE conrelid = 'public.token_consumption_log'::regclass; -- albo nazwa tabeli
```

Jeżeli brak unique → migracja:
```sql
ALTER TABLE public.<tabela_log> ADD CONSTRAINT <nazwa>_unique_worksheet UNIQUE (worksheet_id);
```

(Decyzja wykonawcza w trakcie implementacji — bez nowej migracji, jeżeli funkcja jest już idempotentna.)

### Verification checklist P5
- [ ] Network error w trakcie generowania → `tokens_left` w `useTokenSystem` BEZ zmiany.
- [ ] Refresh w trakcie generowania + backend zapisał worksheet → `tokens_left` zmniejszone DOKŁADNIE o 1 (przez polling refresh-safe).
- [ ] Dwie karty z tym samym `clientGenerationId` (mało prawdopodobne, ale) → idempotencja `consume_token` na `worksheet_id` nie pozwala na podwójne ściągnięcie.
- [ ] Anonimowy user: `consume_token` w ogóle nie wołany (guard `if (userId && !isDemo)`).

---

## Scope lock

Out of scope (NIE ruszamy w tej iteracji):
- Worksheet Generation Engine (prompt, modele, parametry) — SANCTITY.
- Migracja na pełny async-job pattern z osobną tabelą `generation_jobs`.
- Realtime subscription (Supabase Channels) zamiast polling — wystarczy 5s polling.
- Refactor `useWorksheetState` sessionStorage.

---

## RAG injection

**`docs/llm-context.md`** — dopisać sekcję:

```
## v6.9.57 — Refresh-Safe Worksheet Generation

PROBLEM: A page refresh during worksheet generation killed the Deno
edge function before the worksheets row was inserted, leaving the user
with a "Generation failed / network error" toast and no saved worksheet.
The mini panel did not appear on `/`, and the modal did not return.

EDOOQOO SOLUTION:
- Backend: wrap the streaming IIFE in EdgeRuntime.waitUntil and replace
  every send/close with safeSend/safeClose so SSE write errors after
  client disconnect do not abort the in-flight DB insert.
- Frontend: rehydrate the generation modal on Index.tsx mount when
  getActiveGenerationJob().status === 'running' (with an isResumed banner).
- Mini panel: gate visibility on an event-based modal-mounted signal
  instead of a pathname heuristic, so the panel appears on every route
  including `/` when no modal is mounted.
- Token + Next Step is_used: flip strictly after a worksheet row with
  matching clientGenerationId is found; remove sessionStorage fallback
  in handleWorksheetCompletion; clear prefillSuggestionId on every
  failure path.

TECHNICAL MECHANICS:
- supabase/functions/generateWorksheet/index.ts: safeSend/safeClose,
  EdgeRuntime.waitUntil(backgroundWork)
- src/services/worksheetStreamService.ts: no changes (already tolerant)
- src/lib/worksheet/generationJobRegistry.ts: +formMeta field
- src/hooks/useWorksheetGeneration.tsx: persist formMeta, drop
  sessionStorage suggestion fallback, clear prefillSuggestionId on
  failure paths
- src/hooks/useActiveWorksheetGenerationJob.tsx: unchanged (already
  consume_token idempotent via job flags)
- src/components/GeneratingModal.tsx: +isResumed prop + banner +
  generation-modal:mount/unmount events
- src/pages/Index.tsx: isResumedGeneration via activeJob
- src/components/generation/ActiveGenerationMiniPanel.tsx: event-based
  modal-mounted gate

RAG KEYWORDS: refresh-safe generation, edge function persistence,
EdgeRuntime.waitUntil, SSE disconnect, background-only mode,
worksheet job registry, resumed modal, client generation id,
idempotent token consumption, suggestion is_used gating, mini panel
visibility, generation modal mount event, refresh during streaming,
worksheet rehydration, deno deploy worker lifecycle
```

**`public/llms.txt`** — dorzucić skrót (2–3 zdania) w sekcji "Recent changes".

---

## Final change report (po implementacji wypełni implementator)

- Files modified: 7 (lista wyżej)
- New SQL migrations: 0 lub 1 (warunkowa — patrz P5)
- Documentation updated: YES (`llm-context.md` + `llms.txt` + `mem/features/onboarding/v6957-refresh-safe-generation.md`)
- Out of scope flagged: real-time subscription, full async-job pattern
- Worksheet Generation Engine touched: NO (sanctity respected)
- Verification: pełny pass wymaga 5 manualnych scenariuszy z checklist powyżej

---

## Pytania kontrolne przed implementacją

Jeżeli któraś odpowiedź to "NIE / NIE WIEM", odpowiedz przed startem:

1. **Czy zatwierdzasz polegać dalej na 5-sekundowym pollingu po refresh** (zamiast Supabase Realtime)? — domyślnie tak (mniejszy blast radius).
2. **Czy banner "Generation resumed" w modalu może być po angielsku** (zgodnie z regułą language: app UI = English)? — tak, jeżeli nic nie napiszesz inaczej.
3. **Czy w sytuacji P1 (refresh) dopuszczasz, że worksheet po prostu pojawia się "magicznie" w `/worksheet/:id` po max ~5–30s polling**, bez explicite toasta "Saved while you were away"? — domyślnie tak; jeżeli chcesz toast, dorzucę go w `applyCompletionSideEffects`.