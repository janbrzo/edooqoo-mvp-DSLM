
# Plan v6.9.65 — Resilience + Audit Coverage + Progress Parity

Trzy niezależne problemy, jeden plan. Worksheet Generation Engine NIE jest dotykany (worksheet już ma własny fallback Gemini→OpenAI direct i nie używa Lovable Gateway — verified).

---

## PROBLEM 1 — Lovable Gateway 402 „Not enough credits"

### Dependency scan
Funkcje wołające `https://ai.gateway.lovable.dev/v1/chat/completions`:
`classify-knowledge-entry`, `extract-student-profile`, `generate-curriculum-phases`, `generate-timeline`, `process-welcome-test`, `suggest-exercises`, `translate-flashcard`, `verify-open-answers`.
(`generateWorksheet` NIE używa Lovable Gateway — używa bezpośrednio Google Generative Language API + OpenAI direct. Pozostaje nietknięte.)

### Root cause
Workspace wyczerpał miesięczny budżet kredytów Lovable AI Gateway → bramka odpowiada `HTTP 402 {type:"payment_required"}`. Każda funkcja ma własny fetch bez ujednoliconej obsługi tego błędu — niektóre wracają błąd 500, inne degradują do pustej analizy.

### Solution options
| Opcja | Opis | Tradeoff |
|---|---|---|
| A | Doładować kredyty Lovable AI | natychmiast działa, ale nie chroni przed kolejnym wyczerpaniem |
| B | Pojedynczy współdzielony helper `callChatJSON(...)` z chainem: **Lovable Gateway → OpenAI direct (`gpt-4o-mini`)**, automatyczny fallback na 402/429/5xx | jeden refactor, ~8 funkcji, zero zmian w logice biznesowej, OPENAI_API_KEY już skonfigurowany |
| C | Helper z chainem Lovable → Gemini direct → OpenAI | wymaga dodania `GEMINI_API_KEY` (sekret nie istnieje) |

### Selected: **B**
OPENAI_API_KEY już skonfigurowany i działa (audit OK 200). Jeden punkt zmiany prowadzi do regresji na ścieżkach AI niezależnie od stanu kredytów. Bez nowych sekretów.

### Impact analysis
- Zero zmian w UX, zero zmian w schematach DB, zero zmian w promptach.
- Worksheet Engine nietknięty.
- Latencja: identyczna gdy Lovable działa; +1 RTT tylko podczas faktycznego 402/429/5xx.

### Implementation

**1) Nowy plik `supabase/functions/_shared/aiChat.ts`** (helper, pełny kod):
```ts
import { logModelFailure } from "./modelFailureLogger.ts";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface CallChatOptions {
  messages: ChatMessage[];
  /** Lovable Gateway model, default google/gemini-2.5-flash */
  primaryModel?: string;
  /** OpenAI fallback model, default gpt-4o-mini (cheap, JSON-capable) */
  fallbackModel?: string;
  /** When true, request JSON object response */
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Identifier of the caller function, used in error_logs */
  functionName: string;
}

export interface CallChatResult {
  content: string;
  model: string;
  provider: "lovable-gateway" | "openai";
}

const LOVABLE_ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_ENDPOINT  = "https://api.openai.com/v1/chat/completions";

function shouldFallback(status: number): boolean {
  return status === 402 || status === 429 || status >= 500;
}

export async function callChatJSON(opts: CallChatOptions): Promise<CallChatResult> {
  const primaryModel  = opts.primaryModel  ?? "google/gemini-2.5-flash";
  const fallbackModel = opts.fallbackModel ?? "gpt-4o-mini";
  const temperature   = opts.temperature ?? 0.3;
  const maxTokens     = opts.maxTokens   ?? 2048;
  const responseFormat = opts.jsonMode ? { type: "json_object" } : undefined;

  const lovKey = Deno.env.get("LOVABLE_API_KEY");
  const oaKey  = Deno.env.get("OPENAI_API_KEY");

  // 1) Try Lovable Gateway
  if (lovKey) {
    try {
      const r = await fetch(LOVABLE_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${lovKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: primaryModel,
          messages: opts.messages,
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      });
      if (r.ok) {
        const j = await r.json();
        const content = j?.choices?.[0]?.message?.content ?? "";
        return { content, model: primaryModel, provider: "lovable-gateway" };
      }
      const errText = (await r.text()).slice(0, 500);
      await logModelFailure({
        model: primaryModel, provider: "lovable-gateway", status: r.status,
        endpoint: LOVABLE_ENDPOINT, error: errText, functionName: opts.functionName,
      });
      if (!shouldFallback(r.status)) {
        throw new Error(`Lovable Gateway ${r.status}: ${errText}`);
      }
      console.warn(`[aiChat] Lovable ${r.status} → falling back to OpenAI ${fallbackModel}`);
    } catch (e) {
      console.warn(`[aiChat] Lovable threw, falling back:`, (e as Error).message);
    }
  }

  // 2) OpenAI fallback
  if (!oaKey) throw new Error("Both Lovable Gateway and OpenAI unavailable");
  const r2 = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${oaKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: fallbackModel,
      messages: opts.messages,
      temperature,
      max_tokens: maxTokens,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });
  if (!r2.ok) {
    const errText = (await r2.text()).slice(0, 500);
    await logModelFailure({
      model: fallbackModel, provider: "openai", status: r2.status,
      endpoint: OPENAI_ENDPOINT, error: errText, functionName: opts.functionName,
    });
    throw new Error(`OpenAI fallback ${r2.status}: ${errText}`);
  }
  const j2 = await r2.json();
  const content = j2?.choices?.[0]?.message?.content ?? "";
  return { content, model: fallbackModel, provider: "openai" };
}
```

**2) Refactor 8 funkcji** — w każdej zastąpić bezpośredni `fetch(LOVABLE_ENDPOINT, …)` wywołaniem `callChatJSON({ messages, jsonMode: <jak dotąd>, functionName: "<nazwa>" })`. Zachować dokładnie: model primary (`google/gemini-2.5-flash` lub `google/gemini-2.5-flash-lite` dla `translate-flashcard`), temperature, max_tokens, response_format. Zmiany czysto mechaniczne, bez modyfikacji promptów ani parsowania odpowiedzi.

Lista plików:
- `supabase/functions/classify-knowledge-entry/index.ts`
- `supabase/functions/extract-student-profile/index.ts`
- `supabase/functions/generate-curriculum-phases/index.ts`
- `supabase/functions/generate-timeline/index.ts` (2 wywołania)
- `supabase/functions/process-welcome-test/index.ts` (2 wywołania: scoring + evolution)
- `supabase/functions/suggest-exercises/index.ts`
- `supabase/functions/translate-flashcard/index.ts` — usuwa istniejący manualny fallback, używa helpera z `primaryModel:"google/gemini-2.5-flash-lite"`, `fallbackModel:"gpt-4o-mini"`
- `supabase/functions/verify-open-answers/index.ts`

### Verification (P1)
- [ ] Każda z 8 funkcji buduje się i deployuje.
- [ ] `curl` do `classify-knowledge-entry` z prostym input → 200 (z OpenAI fallback gdy Lovable zwróci 402).
- [ ] Brak zmian w polach JSON zwracanych do klienta.
- [ ] `error_logs` zapisuje `lovable-gateway 402` ale request kończy się sukcesem.

---

## PROBLEM 2 — Audyt LLM nie pokrywa wszystkich modeli

### Dependency scan
`supabase/functions/audit-llm-models/index.ts`. Brakuje pingowania:
- TTS: `gpt-4o-mini-tts`, `tts-1` (są w `TARGETS_MONTHLY`, **ale nigdy nie pingowane bo cron uruchamia tylko daily**).
- Image: Vertex AI `gemini-2.5-flash-image`, `gemini-3.1-flash-image` — w ogóle nie audytowane.
- Lovable Gateway `google/gemini-3-flash-preview` — tylko monthly.

### Root cause
1. Cron nigdy nie wywołuje trybu `monthly`, więc rozszerzona lista nie była realnie sprawdzana.
2. Brak target dla Vertex AI (image generation) — wymaga `Authorization: Bearer <access_token>` z service-account JSON (`GEMINI_VERTEX_API_KEY`), inny niż wszystkie pozostałe ping-e.

### Solution options
| Opcja | Opis | Tradeoff |
|---|---|---|
| A | Dodać scheduler dla monthly (1. dnia miesiąca) + dodać Vertex pingery | pełne pokrycie, lekki refactor |
| B | Wszystko codziennie | wzrost kosztu audytu, dłuższy run |
| C | Tylko rozszerzyć daily o image+tts | proste, ale traci sens „daily=hot path" |

### Selected: **A**
Hot-path daily zostaje cienki. Pełne pokrycie raz w miesiącu + image i TTS jednak również w daily (są krytyczne dla worksheet generation z obrazem). Cron pg_cron dla monthly raz w miesiącu.

### Implementation

**1) Edycja `supabase/functions/audit-llm-models/index.ts`:**

- Dodać `TARGETS_DAILY`:
  ```ts
  { provider: "openai", model: "gpt-4o-mini-tts",
    endpoint: "https://api.openai.com/v1/models/gpt-4o-mini-tts",
    purpose: "TTS for generate-audio (primary)" },
  { provider: "google-vertex", model: "gemini-2.5-flash-image",
    endpoint: "https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/us-central1/publishers/google/models/gemini-2.5-flash-image",
    purpose: "Worksheet image generation (Vertex AI)" },
  ```

- Dodać `TARGETS_MONTHLY` (extra):
  ```ts
  { provider: "openai", model: "tts-1",
    endpoint: "https://api.openai.com/v1/models/tts-1",
    purpose: "TTS legacy fallback (generate-audio, welcome-test audio)" },
  { provider: "google-vertex", model: "gemini-3.1-flash-image",
    endpoint: "...publishers/google/models/gemini-3.1-flash-image",
    purpose: "Worksheet image generation (Vertex AI preview/next-gen)" },
  ```

- Rozszerzyć `Provider` o `"google-vertex"`. Dodać gałąź w `ping()`:
  ```ts
  if (target.provider === "google-vertex") {
    const sa = Deno.env.get("GEMINI_VERTEX_API_KEY");
    if (!sa) return { status: -1, latency_ms: 0, error: "missing GEMINI_VERTEX_API_KEY" };
    // Reuse the same access-token helper as generate-image:
    const accessToken = await getVertexAccessToken(sa);
    const projectId = JSON.parse(sa).project_id;
    const endpoint = target.endpoint.replace("{PROJECT_ID}", projectId);
    // Use models.get (cheaper than generateContent) for liveness:
    const metaEndpoint = endpoint.replace(":generateContent", "")
      .replace("https://us-central1-aiplatform.googleapis.com/v1/",
               "https://us-central1-aiplatform.googleapis.com/v1/");
    const r = await fetch(metaEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const err = r.ok ? null : (await r.text()).slice(0, 500);
    return { status: r.status, latency_ms: Date.now() - t0, error: err };
  }
  ```
  Skopiować helper `getVertexAccessToken` z `generate-image/index.ts` do nowego `supabase/functions/_shared/vertexAuth.ts` (jeden plik, importowany z obu miejsc). `generate-image` przełącza import (mechaniczne, bez zmian logiki).

- TTS audit: użyć tego samego pinga co dla zwykłego OpenAI (`/v1/models/<id>`) — już działa.

**2) Operator-only SQL** (do `docs/operational/audit-llm-models-cron.md`, nie do migracji):
```sql
-- Monthly full audit, 1. dnia miesiąca o 06:15 UTC
select cron.schedule(
  'audit-llm-models-monthly',
  '15 6 1 * *',
  $$select net.http_post(
      url := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
      headers := jsonb_build_object('Content-Type','application/json',
                                    'x-cron-secret', current_setting('app.cron_secret', true)),
      body := jsonb_build_object('mode','monthly')
    )$$
);
```

### Verification (P2)
- [ ] Manual call `POST {mode:"daily"}` zwraca 6 wpisów (3 dotychczasowe + tts-mini + vertex 2.5-image; nie mylić: 4 + 2 = 6).
- [ ] Manual call `{mode:"monthly"}` zwraca pełną listę (≥ 8).
- [ ] Vertex ping zwraca 200 (model dostępny w GCP).
- [ ] Mail audytu pokazuje nowe wiersze i właściwy banner cadence.

---

## PROBLEM 3 — Mini-panel % ≠ duży modal %

### Dependency scan
- `src/components/GeneratingModal.tsx` — postęp liczony **wyłącznie z elapsed time** (`progressIncrement = 100/expectedSeconds`, tick 1s, cap 99%).
- `src/components/generation/ActiveGenerationMiniPanel.tsx` — postęp hybrydowy: preferuje `progress.percent` z SSE, fallback do phase floors + exercise count + drift.

### Root cause
Dwa niezależne algorytmy postępu. Duży modal ignoruje SSE i polega tylko na zegarze; mini-panel używa rzeczywistego SSE percent. Stąd rozjazd (na screenie: modal 33% vs mini 18%).

### Solution options
| Opcja | Opis | Tradeoff |
|---|---|---|
| A | Wyekstrahować jedną funkcję `computeGenerationProgress(job, elapsedSec, estimatedDuration)` i użyć w obu komponentach | jedno źródło prawdy, zero rozjazdu |
| B | Modal czyta tylko `progress.percent` z SSE | szybkie, ale traci płynność gdy brak eventu |
| C | Mini-panel używa zegara jak modal | regresja P3 z v6.9.64 |

### Selected: **A**
Eliminuje rozjazd na dobre. Mini-panel zachowuje swój obecny (zweryfikowany) algorytm — staje się on kanonicznym źródłem.

### Implementation

**1) Nowy plik `src/lib/worksheet/computeProgress.ts`:**
```ts
import type { WorksheetGenerationJob } from './generationJobRegistry';

export function estimateDurationSec(meta?: WorksheetGenerationJob['formMeta']): number {
  let s = 50;
  if (meta?.requiresImage) s += 25;
  if (meta?.requiresAudio) s += 25;
  if (meta?.hasGrammar)    s += 8;
  s += Math.max(0, (meta?.selectedExercises?.length || 6) - 6) * 4;
  return s;
}

export function computeGenerationProgress(
  job: Pick<WorksheetGenerationJob, 'progress' | 'formMeta' | 'startedAt' | 'status'>,
  elapsedSec: number,
): number {
  const p = job.progress ?? null;
  if (typeof p?.percent === 'number') {
    return Math.max(0, Math.min(99, Math.round(p.percent)));
  }
  const dur = estimateDurationSec(job.formMeta);
  if (p?.phase === 'media') {
    return Math.min(18, Math.max(3, Math.round((elapsedSec / Math.max(20, dur * 0.25)) * 18)));
  }
  if (p && p.expectedTotal > 0) {
    const completed = Math.max(0, p.exercisesGenerated);
    const perExercise = 74 / p.expectedTotal;
    const floor = 18 + completed * perExercise;
    const liveDrift = Math.min(perExercise * 0.85, Math.max(0, elapsedSec - 20) * 0.35);
    return Math.min(91, Math.round(floor + liveDrift));
  }
  return Math.min(18, Math.max(2, Math.round(elapsedSec * 0.8)));
}
```

**2) `ActiveGenerationMiniPanel.tsx`** — zastąpić inline'owy `const pct = (() => { … })()` wywołaniem `computeGenerationProgress(job, elapsedSec)`. Funkcja `estimateDuration` znika lokalnie (już niepotrzebna do progress, ale zachowujemy jeśli używana gdzieś indziej — w obecnym pliku tylko do pct).

**3) `GeneratingModal.tsx`** — usunąć `const [progress, setProgress] = useState(0)` i całą logikę inkrementu z `progressInterval`. Zamiast tego:
```tsx
const job = useActiveWorksheetGenerationJob(jobId); // lub przez prop meta
const [elapsedSec, setElapsedSec] = useState(initialElapsedSec);
useEffect(() => { const id = setInterval(() => setElapsedSec(s => s+1), 1000); return () => clearInterval(id); }, []);
const progress = computeGenerationProgress({
  progress: meta?.progress ?? null,
  formMeta: meta?.formMeta,
  startedAt: startedAt ?? Date.now(),
  status: 'running',
}, elapsedSec);
```
Reszta JSX (`<Progress value={progress}/>`, `{Math.round(progress)}%`) bez zmian. Sekcyjna animacja exercises (linie 272+) pozostaje — opiera się na `progress` jako %, więc działa identycznie.

### Verification (P3)
- [ ] Modal i mini-panel pokazują dokładnie tę samą wartość % co sekundę podczas streamingu (test ręczny: porównanie po refreshu strony).
- [ ] Brak migotania/cofania paska.
- [ ] Po `phase: 'media'` → 'exercises' → 'repairing' (92-98) → 'saving' (99) modal i mini-panel poruszają się synchronicznie.

---

## RAG injection — `docs/llm-context.md` + `public/llms.txt`

Dodać sekcję **v6.9.65 — Resilience & Audit Coverage**:
```
PROBLEM: Lovable AI Gateway 402 (credits exhausted) wywalał klasyfikację notatek,
sugestie ćwiczeń, generowanie faz, welcome-test scoring, translate-flashcard,
extract-student-profile, generate-timeline, verify-open-answers.
EDOOQOO SOLUTION: Współdzielony helper supabase/functions/_shared/aiChat.ts
(callChatJSON) z chainem Lovable Gateway → OpenAI direct (gpt-4o-mini) na
402/429/5xx. Worksheet Engine NIETKNIĘTY (ma własny Gemini direct + OpenAI direct).
TECHNICAL MECHANICS: 8 funkcji zrefaktorowanych, error_logs nadal loguje 402 dla
StatusPage, response_format/temperature/max_tokens zachowane 1:1.
RAG KEYWORDS: lovable gateway, payment_required, 402, openai fallback,
gpt-4o-mini, ai resilience, edge function fallback, gemini quota,
classification fallback, translate flashcard fallback, suggest exercises fallback,
welcome test scoring fallback, curriculum phases fallback, verify open answers,
extract student profile.

PROBLEM: Daily LLM Audit nie pokrywał image (Vertex AI) ani TTS; monthly nigdy
nie był uruchamiany przez crona.
EDOOQOO SOLUTION: audit-llm-models v6.9.65: daily +tts-mini +vertex 2.5-image,
monthly +tts-1 +vertex 3.1-image. Vertex pinger przez models.get z reused
getVertexAccessToken (vyextrahowany do _shared/vertexAuth.ts). Operator dodaje
pg_cron monthly schedule.
TECHNICAL MECHANICS: Provider type rozszerzony o google-vertex; nowy plik
_shared/vertexAuth.ts; generate-image przełączony na import.
RAG KEYWORDS: model audit, vertex ai ping, image generation health,
tts health check, monthly audit, daily audit, google-vertex provider,
service account token, audit-llm-models, model_health_checks.

PROBLEM: Mini-panel postępu pokazywał inny % niż duży GeneratingModal.
EDOOQOO SOLUTION: src/lib/worksheet/computeProgress.ts jako single source
of truth. Modal i mini-panel używają tej samej funkcji
computeGenerationProgress(job, elapsedSec).
TECHNICAL MECHANICS: GeneratingModal usuwa lokalny progressInterval;
ActiveGenerationMiniPanel usuwa inline pct(); oba czytają identyczny algorytm
hybrydowy (SSE percent → exercise count + drift → media floor → bootstrap).
RAG KEYWORDS: progress parity, generation progress, mini panel sync,
sse percent, exercise count progress, hybrid progress, computeGenerationProgress.
```

Analogiczna sekcja w `public/llms.txt` (skrócona, faktualna, bez nazw promptów).

---

## Final change report (po wdrożeniu)

Pliki nowe:
- `supabase/functions/_shared/aiChat.ts`
- `supabase/functions/_shared/vertexAuth.ts`
- `src/lib/worksheet/computeProgress.ts`

Pliki edytowane:
- 8× edge functions (P1 refactor)
- `supabase/functions/audit-llm-models/index.ts` (+ targets + vertex)
- `supabase/functions/generate-image/index.ts` (import vertexAuth)
- `src/components/GeneratingModal.tsx`
- `src/components/generation/ActiveGenerationMiniPanel.tsx`
- `docs/llm-context.md`, `public/llms.txt`
- `docs/operational/audit-llm-models-cron.md` (operator SQL)
- `mem/index.md` + nowy `mem/infrastructure/lovable-gateway-fallback.md`

Out of scope (zalogowane do przyszłych zadań):
- Worksheet Engine sanctity — nietknięty.
- `extract-student-profile` ma własny prompt — refactor tylko warstwy HTTP.
- Brak `GEMINI_API_KEY` — nie dodajemy nowego sekretu; OpenAI fallback wystarcza.
