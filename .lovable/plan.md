
# Plan v6.9.59 — Multi-generation UX + token idempotency

Cztery odrębne problemy, jeden spójny refaktor wokół rejestru generacji.
Worksheet Generation Engine pozostaje nietknięty.

---

## P1 — Modal pokazuje tylko najnowszą generację

### Dependency scan
`src/pages/Index.tsx` (2 instancje `<GeneratingModal>`, oba liczone od
`activeJob = useActiveWorksheetGenerationJob()` — single-job hook),
`src/components/GeneratingModal.tsx`, `useActiveWorksheetGenerationJob.tsx`,
`generationJobRegistry.ts`.

### Root cause
`Index.tsx` wyświetla DOKŁADNIE jeden modal sterowany hookiem
`useActiveWorksheetGenerationJob()`, który zawsze zwraca „najnowszy
running". Starsza, wciąż trwająca generacja nigdy nie ma własnego modala.

### Selected solution
1. Index przechodzi na `useActiveWorksheetGenerationJobs()` (lista).
2. Lokalny stan `activeModalJobId` (default = najnowszy running). Gdy
   user kliknie strzałkę lub kropkę, zmienia się tylko ten stan.
3. `GeneratingModal` dostaje 3 nowe propsy:
   `jobsCount: number`, `currentIndex: number`,
   `onSelectIndex: (i:number) => void`.
   W headerze, pod tytułem, renderuje switcher (tylko gdy `jobsCount > 1`):
   `‹  Generation 1 / 3  ›` + rząd kropek-pillsów.
4. `isGenerating` z `useWorksheetGeneration` nie znika — nadal trzymane,
   ale modal jest open gdy `visibleJobsForThisTab.length > 0`
   (patrz P2).

### Implementation (Index.tsx, oba branche modala — FormView i GenerationView)
```tsx
const jobs = useActiveWorksheetGenerationJobs();
const tabId = useTabId(); // patrz P2
const myJobs = useMemo(
  () => jobs
    .filter(j => j.originTabId === tabId)
    .sort((a,b) => a.startedAt - b.startedAt),
  [jobs, tabId]
);
const runningMyJobs = myJobs.filter(j => j.status === 'running');
const [activeIdx, setActiveIdx] = useState(0);
useEffect(() => {
  // Auto-focus on the newest job whenever a new one is added
  if (runningMyJobs.length > 0) setActiveIdx(runningMyJobs.length - 1);
}, [runningMyJobs.length]);
const activeJob = runningMyJobs[activeIdx] ?? null;
const modalOpen = !!activeJob || isGenerating;
```
Wszystkie propsy modala (`startedAt`, `studentId`, `formMeta.*`, `topic`)
biorą z `activeJob` jeżeli jest, inaczej z `worksheetState.inputParams`.

### Verification
- 2 równoległe generacje w tej samej karcie → strzałki przełączają widok,
  oba progress-bary kontynuowane (każdy ma swój `startedAt`).
- 1 generacja → switcher ukryty (`jobsCount===1`).

---

## P2 — Modal pojawia się automatycznie na NOWEJ karcie tej samej domeny

### Dependency scan
`generationJobRegistry.ts` (storage), `useActiveWorksheetGenerationJob.tsx`,
`Index.tsx`.

### Root cause
`activeJob.status === 'running'` jest globalne w localStorage, więc
KAŻDA karta która zmontuje Index pokaże resumed-modal.

### Selected solution
Per-tab scoping przez `originTabId`.

1. Nowy util `src/lib/worksheet/tabId.ts`:
   ```ts
   const KEY = 'edooqoo.tabId';
   export function getTabId(): string {
     try {
       const ss = window.sessionStorage;
       let id = ss.getItem(KEY);
       if (!id) {
         id = (crypto.randomUUID?.() ?? `tab_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
         ss.setItem(KEY, id);
       }
       return id;
     } catch { return 'tab_anon'; }
   }
   export function useTabId() { return useMemo(getTabId, []); }
   ```
   `sessionStorage` jest per-karta → nowa karta = nowy `tabId`.

2. `WorksheetGenerationJob` zyskuje pole `originTabId: string | null`.
   `startGenerationJob` przyjmuje `originTabId` i zapisuje. Migracja:
   stare joby bez pola → traktowane jak nie-this-tab (czyli na każdej
   nowej karcie pokażą się tylko jako mini-panel, nigdy jako modal).

3. `useWorksheetGeneration` przy `startGenerationJob({...})` dorzuca
   `originTabId: getTabId()`.

4. `Index.tsx`: `myJobs = jobs.filter(j => j.originTabId === tabId)`.
   Modal otwiera się TYLKO dla `myJobs`. Mini-panel (App.tsx)
   widzi wszystko bez zmian → na innej karcie generacja widoczna
   jako mini-panel, nie modal.

### Verification
- Start gen na karcie A → modal A, brak modala na nowo otwartej
  karcie B (tylko mini-panel B-side po prawej).
- Start gen na karcie B (jej własny job) → modal B na karcie B,
  mini-panel A-side na karcie A.

---

## P3 — Mini-panel sidebar

### Dependency scan
`ActiveGenerationMiniPanel.tsx`, `App.tsx`, `Index.tsx` mount events.

### Root causes
- **3A**: na stronie generacji obie running-jobs są w `myJobs` i obie
  trafiają w pełnoekranowy modal/jobs (chowane przez `mountedJobIds`).
  Po P2 mini-panel pokazuje WSZYSTKIE joby z innych kart. Zostaje pokazać
  też joby tej karty, których obecnie nie pokazuje modal (`activeJob`).
  Dodatkowo gdy user jest na FormView i modal nie jest mounted — żaden
  panel się nie pokazuje, choć powinien.
- **3B**: stałe `PANEL_HEIGHT_PX = 96` jest za małe — realna wysokość
  karty ~120–160px (2 linie copy + przycisk).
- **3C**: po P2 + P1 problem znika sam (każdy job ma swój wpis i status
  z rejestru; jeśli zarówno A jak i B pokazują „ready", to dlatego, że
  oba realnie się zakończyły). Dodatkowo dla pewności bronimy się przed
  fałszywym completion (zob. niżej).

### Selected solution
1. `PANEL_HEIGHT_PX` → `144`, `PANEL_GAP_PX` → `12`. Maks. 4 widoczne
   karty (`visibleJobs.slice(-4)`), starsze chowane (rzadki edge-case).
2. Filtr widoczności:
   ```ts
   const hiddenByForegroundModal = (job: Job) =>
     job.status === 'running'
     && mountedJobIds.has(job.jobId)
     && job.originTabId === tabId;          // tylko własną kartę modal chowa
   ```
   Joby z innych kart są zawsze widoczne jako mini-panel, nawet jeśli
   ich `mountedJobIds` zostało wcześniej zapamiętane przez bug.
3. **3C defense**: w `useActiveWorksheetGenerationJobs.locateBackendWorksheet`
   USUWAMY fallback po `teacher_id + since` gdy `job.requestId` nie matchuje.
   Bez `requestId` → `return null` (nigdy nie zgaduj). Zapobiega
   przepisaniu B → completed na podstawie worksheet stworzonego przez A.

### Implementation snippets
```ts
// ActiveGenerationMiniPanel.tsx
const PANEL_HEIGHT_PX = 144;
const PANEL_GAP_PX    = 12;

const visibleJobs = jobs
  .filter(job => !(job.status === 'running'
                && mountedJobIds.has(job.jobId)
                && job.originTabId === tabId))
  .filter(/* completed-on-current-worksheet-page guard, bez zmian */)
  .sort((a,b) => a.startedAt - b.startedAt)
  .slice(-4);
```
```ts
// useActiveWorksheetGenerationJob.tsx — locateBackendWorksheet
if (!job.requestId) return null;   // hard guard, drop legacy window query
// (zostawiamy tylko correlation-id lookup)
```

### Verification
- 2 generacje, jedna kończy → druga dalej „in progress" na mini-panelu.
- 2 karty mini-paneli nie nachodzą.
- Mini-panel widoczny na Index dla generacji rozpoczętych w innej karcie.

---

## P4 — Podwójne/potrójne pobranie tokenów

### Dependency scan
SQL: RPC `public.consume_token(p_teacher_id, p_worksheet_id)`.
Callers: `useTokenSystem.consumeToken` → wywoływane przez
`useWorksheetGeneration.handleWorksheetCompletion`, ORAZ
`useActiveWorksheetGenerationJob.applyCompletionSideEffects` (single-job),
ORAZ `useActiveWorksheetGenerationJobs.applyCompletionSideEffects`
(multi-job). Trzech callerów w tej samej karcie, polling co 5s bez
await-locka → 3 wywołania RPC dla tego samego `p_worksheet_id`,
wszystkie wstawiają `token_transactions` i dekrementują `available_tokens`.
Tabela `token_transactions` (zrzut) pokazuje 3× tę samą `reference_id`.

### Root cause
RPC `consume_token` nie jest idempotentne na `p_worksheet_id`.

### Selected solution
Migracja: `CREATE OR REPLACE FUNCTION public.consume_token(...)` — na
samym początku body sprawdza istnienie usage-transakcji dla tej
worksheet, jeśli jest → `RETURN TRUE` bez efektów. Plus krótki
`pg_advisory_xact_lock` na haszu `(p_teacher_id, p_worksheet_id)` aby
zabić wyścig.

```sql
-- Migration: idempotent consume_token on (teacher_id, worksheet_id)
CREATE OR REPLACE FUNCTION public.consume_token(p_teacher_id uuid, p_worksheet_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  already_charged INTEGER;
  -- ... (reszta DECLARE jak dziś)
BEGIN
  -- v6.9.59: serialize concurrent callers for the same (teacher, worksheet)
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_teacher_id::text || ':' || p_worksheet_id::text, 0)
  );

  -- v6.9.59: idempotent short-circuit
  SELECT COUNT(*) INTO already_charged
  FROM public.token_transactions
  WHERE teacher_id  = p_teacher_id
    AND transaction_type = 'usage'
    AND reference_id = p_worksheet_id;
  IF already_charged > 0 THEN
    RAISE NOTICE 'consume_token: already charged for worksheet %, no-op', p_worksheet_id;
    RETURN TRUE;
  END IF;

  -- ... (cała istniejąca logika monthly_limit / available_tokens / insert / return)
END;
$function$;
```

Dodatkowo (defense-in-depth, client-side):
- W `applyCompletionSideEffects`: przed RPC call zaznaczamy
  `markTokenConsumed(job.jobId)` natychmiast w storage, RPC robimy
  tylko gdy poprzednia wartość była null. Race wewnątrz tej samej
  karty zostaje wycięty przed siecią.

```ts
// useActiveWorksheetGenerationJob.tsx
if (userId && job.teacherId === userId && !job.tokenConsumedAt && job.origin !== 'anonymous') {
  const claim = markTokenConsumed(job.jobId); // optimistic
  if (claim && (claim.tokenConsumedAt ?? 0) - Date.now() > -2000) {
    // tylko ten caller realnie zawoła RPC; RPC i tak będzie idempotentne
    await supabase.rpc('consume_token', { p_teacher_id: userId, p_worksheet_id: worksheetId });
  }
}
```

### Verification
- 2 nowe generacje pod rząd → dokładnie 2 wiersze `usage` w
  `token_transactions`, `available_tokens` spada o 2.
- Stress test: trzy karty otwarte na czas zakończenia jednej
  generacji → tylko 1 wiersz, jeden tokeen.

---

## Affected files
- `src/lib/worksheet/generationJobRegistry.ts` — pole `originTabId`,
  parametr w `startGenerationJob`.
- `src/lib/worksheet/tabId.ts` — NEW.
- `src/hooks/useWorksheetGeneration.tsx` — przekazuje `originTabId`.
- `src/hooks/useActiveWorksheetGenerationJob.tsx` — drop window-fallback;
  optimistic `markTokenConsumed` przed RPC.
- `src/components/GeneratingModal.tsx` — switcher (jobsCount, idx,
  onSelectIndex).
- `src/pages/Index.tsx` — `useActiveWorksheetGenerationJobs`, filtr
  per-tab, `activeIdx`.
- `src/components/generation/ActiveGenerationMiniPanel.tsx` — wysokość,
  filtr per-tab.
- `supabase/migrations/<ts>_idempotent_consume_token.sql` — NEW.
- `docs/llm-context.md`, `public/llms.txt`, `mem/index.md`,
  `mem/features/onboarding/v6959-multi-gen-tabs-and-idempotent-tokens.md`.

## Sanctity
Worksheet Generation Engine bez zmian. Brak zmian RLS poza redefiniccją
istniejącego SECURITY DEFINER. Brak zmian schema (tylko ciało funkcji).

## RAG injection
Wpis v6.9.59:
- PROBLEM: many-tab UX leak modal, multiple modals overwrite each other,
  consume_token double-charge.
- SOLUTION: per-tab job scoping, modal switcher, idempotent RPC.
- TECHNICAL: tabId util + sessionStorage; originTabId on registry;
  switcher in GeneratingModal; locateBackendWorksheet drops fallback;
  consume_token uses advisory lock + reference_id existence guard.
- KEYWORDS: idempotent token consumption, advisory lock, sessionStorage
  tab id, generation registry, mini panel stacking, modal switcher,
  resumed generation, refresh-safe, multi-job UX, worksheet generation
  jobs, race condition fix, token transactions dedupe, originTabId,
  per-tab UI scoping, lovable cloud.

## Po Twoim "ok" wchodzę w build mode i wdrażam jednym przebiegiem.
