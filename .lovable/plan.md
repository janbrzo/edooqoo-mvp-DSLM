
# Plan v6.9.66 — Naprawa audytu LLM + migracja z Lovable Gateway

Plan rozwiązuje 5 problemów z dziennego audytu i testów manualnych. Każdy ma kompletne rozwiązanie gotowe do implementacji.

---

## P1 — Lovable Gateway zwraca 402 (brak kredytów)

### Dependency scan
`supabase/functions/_shared/aiChat.ts` (główny helper), 8 funkcji wywołujących `chatCompletion`: `classify-knowledge-entry`, `suggest-exercises`, `verify-open-answers`, `translate-flashcard`, `extract-student-profile`, `generate-curriculum-phases`, `generate-timeline`, `process-welcome-test`. `generateWorksheet` jest off-limits (sanctity rule).

### Root cause
`aiChat.ts` używa Lovable Gateway jako primary. Workspace nie ma kredytów, więc każde wywołanie najpierw "marnuje" round-trip na 402, potem fallback na OpenAI. To powoduje:
- niepotrzebne 100–300 ms latencji,
- spam w `error_logs` + StatusPage banner,
- daily audit raportuje FAIL.

### Solution options
| Opcja | Opis | Trade-off |
|---|---|---|
| A. Zostawić Lovable jako primary, wyłączyć go w audycie | minimalna zmiana | nadal +200ms na każde wywołanie, spam logów |
| B. **Przełączyć primary na Google Generative Language API direct (GEMINI_API_KEY)**, OpenAI jako fallback | zerowa zależność od Lovable, te same modele Gemini | trzeba zmapować body z OpenAI-shape → Gemini-shape |
| C. Przełączyć primary na OpenAI gpt-4o-mini | najprostsze | tracimy darmowe Gemini, rosną koszty OpenAI |

### Selected: **B** — Direct Google + OpenAI fallback
Powód: `GEMINI_API_KEY` już istnieje i działa (używany w `generate-image` przez `@google/generative-ai` SDK). Modele `gemini-2.5-flash` i `gemini-2.5-flash-lite` są dostępne na endpointcie `generativelanguage.googleapis.com/v1beta`. Zerowy koszt dla użytkownika, pełna kontrola.

### Impact analysis
Wszystkie 8 funkcji edge nadal otrzymuje response w OpenAI Chat Completions shape (helper konwertuje). `generateWorksheet` nieruszony. Zero regresji w UI.

### Pełna implementacja

**Krok 1.1** — przepisać `supabase/functions/_shared/aiChat.ts`:

```ts
// v6.9.66 — Direct Google Generative Language as primary, OpenAI as fallback.
// Lovable Gateway removed (workspace credits exhausted).
import { logModelFailure } from "./modelFailureLogger.ts";

const GOOGLE_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENAI_ENDPOINT      = "https://api.openai.com/v1/chat/completions";

export interface ChatCompletionOpts {
  /** Gemini model id, e.g. "gemini-2.5-flash" or legacy "google/gemini-2.5-flash". */
  primaryModel: string;
  /** OpenAI fallback model id, defaults to "gpt-4o-mini". */
  fallbackModel?: string;
  /** Caller function name for logModelFailure. */
  functionName: string;
}

function shouldFallback(status: number): boolean {
  return status === 402 || status === 429 || status === 503 || status >= 500;
}

function normalizeGeminiModel(m: string): string {
  // Accept legacy "google/gemini-2.5-flash" → "gemini-2.5-flash"
  return m.startsWith("google/") ? m.slice("google/".length) : m;
}

/**
 * Maps OpenAI chat-completions body → Gemini generateContent body.
 * Forwards: messages, temperature, max_tokens, response_format(json_object), tools(function-calling).
 */
function toGeminiBody(openaiBody: Record<string, unknown>) {
  const messages = (openaiBody.messages as Array<{ role: string; content: string }>) || [];
  const systemMsgs = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const generationConfig: Record<string, unknown> = {};
  if (typeof openaiBody.temperature === "number") generationConfig.temperature = openaiBody.temperature;
  if (typeof openaiBody.max_tokens === "number") generationConfig.maxOutputTokens = openaiBody.max_tokens;
  const rf = openaiBody.response_format as { type?: string } | undefined;
  if (rf?.type === "json_object") generationConfig.responseMimeType = "application/json";

  const out: Record<string, unknown> = { contents, generationConfig };
  if (systemMsgs) out.systemInstruction = { parts: [{ text: systemMsgs }] };

  // Function calling: OpenAI tools[] → Gemini tools[{ functionDeclarations: [...] }]
  const tools = openaiBody.tools as Array<{ type: string; function: any }> | undefined;
  if (tools?.length) {
    out.tools = [{ functionDeclarations: tools.map((t) => t.function) }];
  }
  return out;
}

/**
 * Converts a Gemini generateContent response → OpenAI chat-completions shape,
 * so existing callers keep parsing data.choices[0].message.content / tool_calls unchanged.
 */
function geminiToOpenAIResponse(gemini: any, model: string): any {
  const candidate = gemini?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const textParts = parts.filter((p: any) => typeof p?.text === "string").map((p: any) => p.text);
  const fnCalls = parts
    .filter((p: any) => p?.functionCall)
    .map((p: any, i: number) => ({
      id: `call_${i}`,
      type: "function",
      function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args || {}) },
    }));
  return {
    id: `gemini-${Date.now()}`,
    object: "chat.completion",
    model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: textParts.join("") || null,
        ...(fnCalls.length ? { tool_calls: fnCalls } : {}),
      },
      finish_reason: candidate?.finishReason?.toLowerCase() || "stop",
    }],
    usage: {
      prompt_tokens: gemini?.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: gemini?.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: gemini?.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}

export async function chatCompletion(
  body: Record<string, unknown>,
  opts: ChatCompletionOpts,
): Promise<Response> {
  const fallbackModel = opts.fallbackModel ?? "gpt-4o-mini";
  const googleKey = Deno.env.get("GEMINI_API_KEY");
  const oaKey     = Deno.env.get("OPENAI_API_KEY");

  let primaryResp: Response | null = null;
  const geminiModel = normalizeGeminiModel(opts.primaryModel);

  if (googleKey) {
    try {
      const url = `${GOOGLE_ENDPOINT_BASE}/${geminiModel}:generateContent?key=${googleKey}`;
      primaryResp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toGeminiBody(body)),
      });
      if (primaryResp.ok) {
        const geminiJson = await primaryResp.json();
        const openaiShape = geminiToOpenAIResponse(geminiJson, geminiModel);
        return new Response(JSON.stringify(openaiShape), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const errText = await primaryResp.clone().text().catch(() => "");
      await logModelFailure({
        model: geminiModel, provider: "google",
        status: primaryResp.status, endpoint: GOOGLE_ENDPOINT_BASE,
        error: errText.slice(0, 500), functionName: opts.functionName,
      });
      if (!shouldFallback(primaryResp.status)) return primaryResp;
      console.warn(`[aiChat] Google ${primaryResp.status} for ${geminiModel} → fallback OpenAI ${fallbackModel}`);
    } catch (e) {
      console.warn(`[aiChat] Google fetch threw, falling back:`, (e as Error).message);
    }
  }

  if (!oaKey) {
    if (primaryResp) return primaryResp;
    return new Response(JSON.stringify({ error: "no_ai_provider_configured" }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }

  const r2 = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${oaKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, model: fallbackModel }),
  });
  if (!r2.ok) {
    const errText = await r2.clone().text().catch(() => "");
    await logModelFailure({
      model: fallbackModel, provider: "openai",
      status: r2.status, endpoint: OPENAI_ENDPOINT,
      error: errText.slice(0, 500), functionName: opts.functionName,
    });
  } else {
    console.log(`[aiChat] OpenAI fallback succeeded with ${fallbackModel}`);
  }
  return r2;
}
```

**Krok 1.2** — żadne callsite nie wymaga zmiany (interfejs `chatCompletion(body, opts)` bez zmian). Modele `google/gemini-2.5-flash` zostają w callsite'ach — helper sam zdejmuje prefiks `google/`.

### Verification checklist P1
- [ ] Wszystkie 8 funkcji edge nadal zwracają poprawny JSON.
- [ ] Brak wpisów `lovable-gateway 402` w `error_logs` po wdrożeniu.
- [ ] `translate-flashcard` test: tłumaczenie zwraca `{translation, cefr_level}`.
- [ ] `classify-knowledge-entry` test: zwraca poprawne kategorie.
- [ ] `extract-student-profile` test (problem 4) działa end-to-end.

---

## P2 — Vertex AI audit zwraca 404 mimo że generowanie obrazów działa

### Dependency scan
`supabase/functions/audit-llm-models/index.ts` linia 73 — `fetch(endpoint, { headers })` GET na URL `https://us-central1-aiplatform.googleapis.com/v1/projects/.../publishers/google/models/gemini-2.5-flash-image`.

### Root cause
GET na endpoint pod ścieżką `projects/<id>/...publishers/google/models/<id>` **NIE jest publicznym endpointem metadanych** dla modeli publisher w Vertex AI. Vertex zwraca 404 dla GET. Real flow (`generate-image`) używa POST `:generateContent`, który działa. Audit jest błędny — testuje endpoint który nigdy nie istniał.

### Solution options
| Opcja | Opis | Trade-off |
|---|---|---|
| A. Switch na metadata endpoint `v1beta1/publishers/google/models/<id>` (bez projects/) | tani GET, oficjalny | wymaga `aiplatform.publisherModels.get` scope (mamy `cloud-platform`) |
| B. Mini POST `:generateContent` z `responseModalities:["TEXT"]` i `maxOutputTokens:1` | testuje realny flow | model image-only może nie wspierać TEXT modality |
| C. POST `:countTokens` | tani | image generation models nie wspierają countTokens |

### Selected: **A** — publisher metadata endpoint
Powód: oficjalne, darmowe, zerowy koszt inference, faktycznie waliduje że konto ma access do modelu publisher.

### Pełna implementacja

**Krok 2.1** — w `audit-llm-models/index.ts` zmienić `TARGETS_DAILY` i `TARGETS_MONTHLY` endpoint dla Vertex z:
```
https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/us-central1/publishers/google/models/<model>
```
na:
```
https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models/<model>
```

**Krok 2.2** — w funkcji `ping()` dla `google-vertex` usunąć `endpoint.replace("{PROJECT_ID}", projectId)` (już niepotrzebne) i zostawić sam GET z Bearer tokenem:
```ts
if (target.provider === "google-vertex") {
  const sa = Deno.env.get("GEMINI_VERTEX_API_KEY");
  if (!sa) return { status: -1, latency_ms: 0, error: "missing GEMINI_VERTEX_API_KEY" };
  try {
    const accessToken = await getVertexAccessToken(sa);
    const r = await fetch(target.endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
    const err = r.ok ? null : (await r.text()).slice(0, 500);
    return { status: r.status, latency_ms: Date.now() - t0, error: err };
  } catch (e) { … unchanged }
}
```

### Verification checklist P2
- [ ] Manual smoke: `curl -X POST -H "x-cron-secret: …" https://…/audit-llm-models` → Vertex 200.
- [ ] Email audit pokazuje OK dla `gemini-2.5-flash-image`.
- [ ] Generowanie obrazu w worksheet nadal działa (nie zmieniliśmy `generate-image`).

---

## P3 — Audyt nie obejmuje wszystkich modeli używanych w aplikacji

### Dependency scan
Pełny skan wykrył dodatkowe modele:

| Funkcja | Model | Pokrycie obecnie |
|---|---|---|
| `transcribe-audio` | `whisper-1` (OpenAI) | **brak** |
| `generate-media-exercises` | `gpt-4.1-2025-04-14` (OpenAI) | tylko monthly |
| `generate-welcome-test-audio` | `tts-1` (OpenAI primary) | tylko monthly |
| `generate-audio` chat step | `gpt-4o-mini` (OpenAI) | daily ✓ |
| `generate-image` description | `gemini-2.5-flash` + `gemini-2.5-flash-lite` (Google direct) | brak (był pod lovable) |
| `generateWorksheet` primary | `gemini-2.5-flash` (Google direct) | brak |
| `generateWorksheet` fallback | `gpt-5-mini-2025-08-07` (OpenAI) | daily ✓ |
| `aiChat.ts` po P1 | `gemini-2.5-flash`, `gemini-2.5-flash-lite` (Google direct) | brak |

### Selected solution
Zastąpić w daily 2× Lovable Gateway → 2× Google Generative Language direct (`gemini-2.5-flash`, `gemini-2.5-flash-lite`). Dodać `whisper-1` do daily (whisper jest krytyczny dla live session). Przesunąć `tts-1` z monthly → daily (primary welcome-test audio). Dodać Lovable Gateway entries do monthly tylko (na wypadek powrotu kredytów). Dodać `gpt-4.1-2025-04-14` do daily (używany w `generate-media-exercises`).

### Pełna implementacja

**Krok 3.1** — nowy helper w `ping()` dla Google Generative Language direct (sprawdzenie metadanych modelu):

```ts
type Provider = "lovable-gateway" | "openai" | "google" | "google-vertex" | "openai-whisper";

// ...inside ping():
if (target.provider === "google") {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return { status: -1, latency_ms: 0, error: "missing GEMINI_API_KEY" };
  // models.get returns metadata if key has access — no inference cost.
  const r = await fetch(`${target.endpoint}?key=${key}`);
  const err = r.ok ? null : (await r.text()).slice(0, 500);
  return { status: r.status, latency_ms: Date.now() - t0, error: err };
}
if (target.provider === "openai-whisper") {
  // Whisper-1 is on the same /v1/models endpoint; just probe metadata.
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return { status: -1, latency_ms: 0, error: "missing OPENAI_API_KEY" };
  const r = await fetch(target.endpoint, { headers: { Authorization: `Bearer ${key}` } });
  const err = r.ok ? null : (await r.text()).slice(0, 500);
  return { status: r.status, latency_ms: Date.now() - t0, error: err };
}
```

(W praktyce `openai-whisper` można pominąć i użyć typu `openai` — endpoint jest taki sam. Zostawiamy jeden case `openai`).

**Krok 3.2** — nowy `TARGETS_DAILY` (8 modeli):

```ts
const TARGETS_DAILY: Target[] = [
  // Google direct (primary chat — replaces Lovable Gateway after v6.9.66 P1)
  { provider: "google", model: "gemini-2.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash",
    purpose: "Primary chat (aiChat helper: classify, suggest-exercises, verify-open-answers, curriculum, timeline, welcome-test, extract-profile)" },
  { provider: "google", model: "gemini-2.5-flash-lite",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite",
    purpose: "Lightweight chat (translate-flashcard, image description fallback)" },
  // OpenAI direct
  { provider: "openai", model: "gpt-4o-mini",
    endpoint: "https://api.openai.com/v1/models/gpt-4o-mini",
    purpose: "OpenAI fallback for aiChat helper + generate-audio chat step" },
  { provider: "openai", model: "gpt-5-mini-2025-08-07",
    endpoint: "https://api.openai.com/v1/models/gpt-5-mini-2025-08-07",
    purpose: "generateWorksheet JSON fallback + welcome-test scoring" },
  { provider: "openai", model: "gpt-4.1-2025-04-14",
    endpoint: "https://api.openai.com/v1/models/gpt-4.1-2025-04-14",
    purpose: "generate-media-exercises (reading/listening passages)" },
  { provider: "openai", model: "whisper-1",
    endpoint: "https://api.openai.com/v1/models/whisper-1",
    purpose: "transcribe-audio (live session STT)" },
  { provider: "openai", model: "gpt-4o-mini-tts",
    endpoint: "https://api.openai.com/v1/models/gpt-4o-mini-tts",
    purpose: "TTS primary (generate-audio)" },
  { provider: "openai", model: "tts-1",
    endpoint: "https://api.openai.com/v1/models/tts-1",
    purpose: "TTS for welcome-test-audio + generate-audio fallback" },
  // Google Vertex (image)
  { provider: "google-vertex", model: "gemini-2.5-flash-image",
    endpoint: "https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models/gemini-2.5-flash-image",
    purpose: "Worksheet image generation (Vertex AI primary)" },
];
```

**Krok 3.3** — nowy `TARGETS_MONTHLY`:

```ts
const TARGETS_MONTHLY: Target[] = [
  ...TARGETS_DAILY,
  { provider: "openai", model: "gpt-4.1-2025-04-14",
    endpoint: "https://api.openai.com/v1/models/gpt-4.1-2025-04-14",
    purpose: "Legacy reasoning fallback (audit only)" },
  { provider: "google-vertex", model: "gemini-3.1-flash-image",
    endpoint: "https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models/gemini-3.1-flash-image",
    purpose: "Vertex AI image fallback (Nano Banana 2)" },
  // Optional Lovable Gateway probe — re-enable if/when credits are topped up.
  { provider: "lovable-gateway", model: "google/gemini-2.5-flash",
    endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
    purpose: "Lovable Gateway probe (currently unused, kept for re-activation)" },
];
```

Usunąć duplikat `gpt-4.1` w monthly (jeden raz wystarczy).

### Verification checklist P3
- [ ] Email audit pokazuje 8 modeli daily, wszystkie OK.
- [ ] `model_health_checks` ma świeże wpisy dla `whisper-1`, `gpt-4.1`, `tts-1`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`.
- [ ] Brak entries `lovable-gateway` w daily.

---

## P4 — Smoke test: "Paste notes about student to set up profile (AI, optional)"

### Dependency scan
- `src/components/dashboard/PasteIntakeSection.tsx` — UI textarea + przycisk Analyze.
- `src/components/dashboard/AddStudentDialog.tsx` (linia 462) — osadzenie sekcji.
- `src/components/dashboard/ExtractionPreviewCard.tsx` — preview wykryta danych.
- `supabase/functions/extract-student-profile/index.ts` — backend (używa aiChat → po P1 będzie Gemini direct).
- `src/lib/intake/applyIntakeExtraction.ts` — apply/rollback.
- `src/components/student/IntakeExtractionBanner.tsx` — banner z opcją rollback.

### Test plan (ręczny, do wykonania po wdrożeniu P1)
**Scenariusze:**
1. **Happy path:** wkleić tekst (PL+EN) z imieniem, emailem, celami, deadline → `Analyze` → preview pokazuje wykryte pola → checkbox per pole → `Apply` → student powstaje z prefilled fieldsami → banner "Undo" w StudentPage.
2. **Edge — tekst pusty:** przycisk `Analyze` disabled gdy < 20 znaków.
3. **Edge — tylko email:** wykrywa tylko email, reszta pól pusta, brak crash.
4. **Edge — duplicate email:** intake nie nadpisuje istniejącego studenta (extract-student-profile waliduje).
5. **Edge — Gemini fail → OpenAI fallback:** wymuszony przez P1, sprawdzić logi `aiChat` "fallback succeeded".
6. **Rollback:** kliknąć Undo w bannerze → pola wracają do stanu pre-extract.
7. **Marta test:** preview używa profesjonalnego języka, brak "school textbook" nazewnictwa.

### Potencjalne usprawnienia do dyskusji
- Po `Apply` automatyczne przewinięcie do pierwszego puste required field.
- `Analyze` powinno wyświetlać licznik tokenów / szacowany czas (~3s).
- Trim długich notatek do 8000 znaków po stronie klienta z toastem "Truncated for AI processing".

**Implementacja zmian (jeśli testy wykryją bug):** placeholder — zaproponuję patch po testach. Plan v6.9.66 nie zakłada zmian kodu w P4 dopóki nie znajdziemy konkretnej regresji.

### Verification checklist P4
- [ ] 7 scenariuszy przechodzi.
- [ ] Brak entries `model_failure` w `error_logs` z `source_name=extract-student-profile`.
- [ ] Latency < 5s na typowej notatce 500 słów.

---

## P5 — Smoke test: "Możliwość dodawania flashcards do swoich zestawów przez /my"

### Dependency scan
- `src/pages/StudentHubFlashcards.tsx` (linia 68) — renderuje `AddStudentFlashcardDialog`.
- `src/components/student-hub/AddStudentFlashcardDialog.tsx` — modal z front/back/native.
- RPC `public.student_add_flashcard(uuid, text, text, text, text)` w migracji `20260617163003_…`.
- Kolumna `flashcard_sets.allow_student_contributions boolean DEFAULT true`.

### Test plan (ręczny)
1. **Happy path:** student na `/my` otwiera zestaw → klika "Add card" → wpisuje front+back → Save → toast "Card added!" → lista flashcards się refreshuje.
2. **Edge — contributions disabled:** nauczyciel ustawia `allow_student_contributions=false` na zestawie → student widzi "Add card" ale po Save toast "Your teacher has disabled student additions".
3. **Edge — pusty front/back:** Save disabled lub toast walidacji.
4. **Edge — bardzo długi text:** Input ma `maxLength=200`, textarea `1000`, native `200`.
5. **Edge — student z innym emailem (nie należy do zestawu):** RPC zwraca `student_not_authorized` → toast.
6. **Native field visibility:** pokazuje się tylko jeśli `hasNative=true` (zestaw ma native_language).
7. **Realtime sync:** nauczyciel widzi nową kartę w swoim panelu po refresh.
8. **Marta test:** karta dodana przez studenta wygląda identycznie jak ta od nauczyciela, brak stigma'y.

### Potencjalne usprawnienia (do dyskusji, nie wdrażam bez decyzji)
- Toggle "Show only my added cards" w nauczycielskim widoku zestawu.
- Email notification dla nauczyciela gdy student doda > 3 karty/dzień (anti-spam).
- Możliwość moderacji: nauczyciel akceptuje/odrzuca student-added cards (`status: pending/approved`).

**Implementacja zmian:** zero zmian kodu w P5 — to są smoke testy + zgłoszenie potencjalnych usprawnień. Czekam na decyzje przed budową.

### Verification checklist P5
- [ ] 8 scenariuszy przechodzi.
- [ ] RPC `student_add_flashcard` w `pg_stat_statements` ma niskie p95.
- [ ] Brak race condition przy podwójnym kliknięciu Save (button ma `disabled={busy}`).

---

## RAG injection — `docs/llm-context.md` i `public/llms.txt`

Dodać sekcję:

```
PROBLEM: Lovable AI Gateway credits exhausted; daily audit reports false-positive 404 for Vertex; coverage gaps for whisper/tts/gpt-4.1.
EDOOQOO SOLUTION (v6.9.66):
  • _shared/aiChat.ts now calls Google Generative Language direct (GEMINI_API_KEY) as primary, OpenAI as fallback. Lovable Gateway no longer in hot path.
  • audit-llm-models switched Vertex probe to v1beta1 publisher metadata endpoint (no project prefix), eliminating 404.
  • Daily audit expanded from 6 → 9 models: gemini-2.5-flash, gemini-2.5-flash-lite (Google direct), gpt-4o-mini, gpt-5-mini, gpt-4.1, whisper-1, gpt-4o-mini-tts, tts-1, gemini-2.5-flash-image.
TECHNICAL MECHANICS:
  • aiChat.ts maps OpenAI chat-completions body → Gemini generateContent body and back; tools/function-calling preserved.
  • Existing 8 callsites unchanged (interface stable).
  • model_health_checks table receives 9 rows per daily run.
RAG KEYWORDS: lovable gateway fallback, gemini direct api, generative language api, vertex publisher metadata, whisper-1 audit, tts-1 audit, daily llm audit, model health monitoring, openai chat completions to gemini, function calling gemini mapping, payment_required 402, vertex 404 false positive, audit-llm-models v6.9.66, gpt-4o-mini fallback, gemini-2.5-flash primary.
```

Zaktualizować `mem/infrastructure/lovable-gateway-fallback.md` → nowa nazwa `gemini-direct-with-openai-fallback.md` + zmienić Core w `mem/index.md`.

---

## Final change report (po implementacji)

**Pliki zmodyfikowane:**
- `supabase/functions/_shared/aiChat.ts` — pełna rewrite (P1)
- `supabase/functions/audit-llm-models/index.ts` — Vertex endpoint + TARGETS expand (P2, P3)
- `docs/llm-context.md` — RAG injection
- `public/llms.txt` — RAG injection
- `docs/operational/audit-llm-models-cron.md` — update listy modeli
- `mem/infrastructure/lovable-gateway-fallback.md` → rename + przepisać
- `mem/index.md` — update referencji

**Pliki bez zmian (potwierdzone scope lock):**
- `generateWorksheet/*` — sanctity rule
- 8 funkcji edge wywołujących `chatCompletion` — interfejs helpera stabilny
- `generate-image/index.ts` — działa poprawnie, bez zmian

**Out of scope flagged (z testów P4/P5):**
- Lista potencjalnych usprawnień UX dla paste-intake i student flashcards — czekają na decyzje, nie implementuję w tym cyklu.

**Decyzje pozostawione człowiekowi:**
1. Czy zostawić Lovable Gateway w `TARGETS_MONTHLY` (probe na wypadek powrotu kredytów)? **Sugeruję: TAK** (1 zapytanie/miesiąc to zerowy koszt).
2. Czy implementować usprawnienia UX z P4/P5 w v6.9.67? **Decyzja po testach.**

Proszę o zatwierdzenie — wtedy implementuję P1, P2, P3 w kodzie i poproszę Cię o ręczne wykonanie smoke testów P4/P5.
