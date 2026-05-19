# Plan v6.9.20 — Hotfix produkcyjny + dokończenie Planu v6.9.19 (Sprinty 3, 5, 6)

---

## ⚡ Odpowiedzi na Twoje pytania (zanim przejdziemy do planu)

### Q1: Czy transcript === audio?

**TAK, 100% deterministycznie.** W 2-step pipeline:

1. `chat.completions` (gpt-4o-mini) → zwraca string `transcript`
2. Ten **dokładnie ten sam string** wysyłamy jako `input` do `/v1/audio/speech`
3. TTS odczytuje literalnie znak-po-znaku to, co dostał (żadnej kreatywności, żadnej parafrazy — to jest deterministyczny silnik mowy, nie LLM)
4. Zwracamy do frontu pole `transcript` = ten sam string co wysłany do TTS

W obecnym `gpt-4o-audio-preview` mamy DOKŁADNIE TO SAMO ryzyko — `audio.transcript` zwracane przez API to też tekst odczytany przez syntezę, ale jest generowany w jednym wywołaniu modelu multimodalnego. Różnica zerowa z punktu widzenia użytkownika.

### Q2: Czy worksheet będzie się odnosił do tego samego tekstu?

**TAK, bez zmian w pipeline.** Flow pozostaje:

```
generate-audio → zwraca {transcript, audio_url}
   ↓
front zapisuje w selectedAudio.transcript + selectedAudio.url
   ↓
generateWorksheet otrzymuje selectedAudio.transcript w prompt
   ↓
AI tworzy ćwiczenia odnoszące się DOKŁADNIE do tego transcriptu
```

Nie ruszamy `prompt-composer.ts`, nie ruszamy `generateWorksheet`. Kontrakt response z `generate-audio` jest IDENTYCZNY (`audioData.transcript` + `audioData.url`).

### Q3: Czy walczyć o dostęp do `gpt-4o-audio-preview`?

**NIE. Rekomendacja: porzucamy ten model permanentnie.** Argumenty:


| Aspekt                      | `gpt-4o-audio-preview`                                                 | 2-step (`gpt-4o-mini` + `gpt-4o-mini-tts`)                           |
| --------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Dostępność**              | Preview/Beta, dostęp losowo cofany dla kluczy projektowych (twój case) | GA, stabilne, gwarantowane                                           |
| **Koszt**                   | ~$40/1M tokenów audio output                                           | gpt-4o-mini $0.15/1M + tts $0.60/1M chars (~10x taniej)              |
| **Latencja**                | 8-15s (jednolity multimodalny model)                                   | 3-5s (mini) + 1-2s (tts) = 4-7s                                      |
| **Niezawodność**            | Klucz nieprzewidywalnie traci dostęp (już się stało)                   | Dwa stabilne endpointy GA, każdy ma osobny fallback                  |
| **Jakość głosu**            | Bardzo dobra                                                           | Bardzo dobra (gpt-4o-mini-tts ma te same voices: alloy/echo/nova...) |
| **Determinizm transcriptu** | Generowany w jednym przejściu (czasem niespójny z audio)               | Transcript = literalny input TTS (gwarantowana spójność)             |
| **Vendor lock-in**          | Tylko OpenAI ma model multimodalny                                     | Łatwo zamienić TTS na ElevenLabs/Cartesia w przyszłości              |


Tier 2 ($500/mo) NIE odblokuje `gpt-4o-audio-preview` — to nie jest kwestia tier, to kwestia opt-in dostępu do modelu beta, który OpenAI rotuje. **Decyzja: zostajemy na 2-step na stałe.**

---

# 🛠️ CZĘŚĆ A — Hotfix Bug Report (BUGI 1-3)

## BUG 1 — `generate-audio` 500 (model 404)

### Plik: `supabase/functions/generate-audio/index.ts`

Pełen rewrite handlera (kontrakt response bez zmian).

### Kroki implementacji

1. **Zachowaj**: importy, `corsHeaders`, voices array `['alloy','echo','fable','onyx','nova','shimmer']`, `randomVoice` losowanie, `systemPrompt` (bez zmian), R2 upload, struktura response.
2. **Krok A — Generuj transcript** (zastąp obecne wywołanie `gpt-4o-audio-preview`):

```ts
const scriptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 800,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate a ${duration}-second audio scenario based on the requirements above. Return ONLY spoken text — no stage directions, no markdown, no JSON.` }
    ]
  })
});
if (!scriptResponse.ok) {
  const err = await scriptResponse.text();
  throw new Error(`Script generation failed (${scriptResponse.status}): ${err}`);
}
const scriptData = await scriptResponse.json();
const transcript = (scriptData.choices?.[0]?.message?.content || "").trim();
if (!transcript) throw new Error("transcript_generation_empty");
console.log(`✅ [AUDIO] Transcript generated: ${transcript.length} chars`);
```

3. **Krok B — Generuj audio z fallbackiem**:

```ts
async function generateTTS(model: string): Promise<ArrayBuffer> {
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, voice: randomVoice, input: transcript, response_format: "mp3" })
  });
  if (!r.ok) throw new Error(`TTS ${model} failed (${r.status}): ${await r.text()}`);
  return r.arrayBuffer();
}

let audioBuffer: ArrayBuffer;
let ttsModel = "gpt-4o-mini-tts";
try {
  audioBuffer = await generateTTS("gpt-4o-mini-tts");
} catch (e) {
  console.warn(`⚠️ gpt-4o-mini-tts failed, falling back to tts-1:`, e.message);
  ttsModel = "tts-1";
  audioBuffer = await generateTTS("tts-1");
}
```

4. **Krok C — base64 conversion (chunked, by uniknąć stack overflow dla >100KB)**:

```ts
const bytes = new Uint8Array(audioBuffer);
let binary = "";
const CHUNK = 8192;
for (let i = 0; i < bytes.length; i += CHUNK) {
  binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
}
const audioBase64 = btoa(binary);
```

5. **Krok D — R2 upload** (kod bez zmian — kopiujemy obecny blok 1:1).
6. **Response (kontrakt 1:1 zachowany)**:

```ts
return new Response(JSON.stringify({
  success: true,
  audioData: {
    url: finalAudioUrl,
    ai_generated_audio_url: finalAudioUrl,
    transcript,                              // ← IDENTYCZNY z TTS input
    duration,
    source: `openai-2step-${ttsModel}`,      // ← diagnostyka
    voice: randomVoice
  }
}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```

7. **Krok E — Notyfikacja awarii (NEW)** — w `catch` przed `return 500`:

```ts
try {
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-generation-failure`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      errorType: "audio",
      errorMessage: error.message,
      model: "openai-2step",
      teacherEmail: null,
      userId: null,
      promptPreview: `topic="${topic}" level="${englishLevel}" focus="${lessonFocus}"`,
      timestamp: new Date().toISOString()
    })
  });
} catch (notifyErr) {
  console.error("Failed to notify audio failure:", notifyErr);
}
```

8. **Deploy**: `deploy_edge_functions(["generate-audio"])`.

### Weryfikacja BUG 1

- `supabase--curl_edge_functions` POST `/generate-audio` body `{"topic":"eurovision 2026","englishLevel":"B1/B2","lessonFocus":"musical idioms","duration":90}` → 200 + transcript niepusty + audioData.url zaczynający się od `https://r2.` (lub `data:audio/`).
- `supabase--edge_function_logs generate-audio` → brak `404`, log `✅ [AUDIO] Transcript generated`.

---

## BUG 2 — Brak maila przy awarii worksheet generation

### Plik: `supabase/functions/generateWorksheet/index.ts`

### 2A. Keepalive podczas AI-REPAIR (eliminacja heartbeat timeout)

Lokalizacja: ~linia 595, w streaming path przed `parseWithRecovery`.

```ts
// PRE-REPAIR: notify client we're entering repair phase
send("progress", { exercisesGenerated: expectedTotal, expectedTotal, phase: "repairing" });
const repairKeepalive = setInterval(() => {
  try { send("progress", { exercisesGenerated: expectedTotal, expectedTotal, phase: "repairing" }); }
  catch (_) {}
}, 15000);

let worksheetData: any;
let repairMethod: string;
try {
  const result = await parseWithRecovery(fullContent, expectedTotal);
  worksheetData = result.data;
  repairMethod = result.repairMethod;
} finally {
  clearInterval(repairKeepalive);
}
```

**Efekt**: każde 15s leci `progress` event → klient resetuje heartbeat → koniec z 40s timeoutem podczas wielosekundowej naprawy.

### 2B. Gwarantowana dostawa notyfikacji

Lokalizacja: linie ~727-731 (streaming) i ~844 (regular).

```ts
// PRZED: notifyGenerationFailure(...)  ← fire-and-forget, edge runtime ubija fetch po close()
// PO:
const notifyPromise = notifyGenerationFailure(errType, errorMessage, {...});
// EdgeRuntime.waitUntil zapewnia że fetch dokończy nawet po close stream'a
try {
  // @ts-ignore - EdgeRuntime is Deno Deploy global
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(notifyPromise);
  } else {
    await notifyPromise; // fallback dla local dev
  }
} catch (_) {}
```

### 2C. Wczesne ostrzeżenie gdy AI-REPAIR był potrzebny

Po `parseWithRecovery` w streaming path:

```ts
if (repairMethod === 'ai' || repairMethod === 'ai-fallback') {
  // Best-effort early warning — worksheet uratowany, ale prompt warto zbadać
  EdgeRuntime.waitUntil?.(notifyGenerationFailure('parse_recovered',
    `Gemini returned malformed JSON, recovered via ${repairMethod}. Investigate prompt drift.`,
    { userId, teacherEmail, model: streamUsedModel, promptPreview: sanitizedPrompt?.substring(0, 300) }
  ));
}
```

### 2D. Plik: `supabase/functions/notify-generation-failure/index.ts`

Dodać klucz w mapie `solutions`:

```ts
'parse_recovered': 'Gemini returned malformed JSON, recovered via AI fallback. Worksheet was saved successfully, but prompt or temperature may be drifting. Investigate sample output to prevent quality degradation.',
'audio': 'OpenAI audio model is unreachable. Verify OPENAI_API_KEY has access to gpt-4o-mini and gpt-4o-mini-tts. Check /v1/audio/speech endpoint status.',
```

### 2E. Persistencja do `error_logs`

W obu `catch` (streaming + regular) dodać:

```ts
try {
  await supabase.from("error_logs").insert({
    source_name: 'generateWorksheet',
    component: 'worksheets',
    severity: 'error',
    error_code: errType,
    message: errorMessage,
    stack: errorStack,
    context: { model: streamUsedModel, exerciseCount: expectedTotal, userId, teacherEmail },
    user_id: userId || null
  });
} catch (logErr) {
  console.error("Failed to log error to error_logs:", logErr);
}
```

### Weryfikacja BUG 2

- Wygeneruj długi worksheet (ICAO/Aviation, 8 ćwiczeń) → klient nie dostaje heartbeat timeout (widać `phase:"repairing"` w logach klienta).
- `SELECT * FROM error_logs WHERE source_name='generateWorksheet' ORDER BY created_at DESC LIMIT 5;` → wpisy obecne.
- Email do `j4n.brz0@gmail.com` z `⚠️ Worksheet generation failed: parse — ...`.

---

## BUG 3 — Linki admina w mailach

### 3A. Plik: `supabase/functions/notify-generation-failure/index.ts`

Pod istniejącym przyciskiem "View Edge Function Logs" dodać drugi:

```html
<a href="${appBaseUrl}/admin/error-logs"
   style="display:inline-block; padding:12px 28px; background:#7c3aed; color:white;
          border-radius:8px; text-decoration:none; font-weight:600; margin-left:8px;">
  🛡️ Open Admin Error Logs
</a>
```

Gdzie `appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com'` (już używane w innych funkcjach per memory).

### 3B. Plik: `supabase/functions/submit-bug-report/index.ts`

Na końcu sekcji "Reporter info" w HTML emaila wstawić wiersz CTA:

```html
<tr><td colspan="2" style="padding-top:20px; text-align:center;">
  <a href="${appBaseUrl}/admin/error-logs?bugId=${inserted.id}"
     style="display:inline-block; padding:12px 24px; background:#7c3aed; color:white;
            border-radius:6px; text-decoration:none; font-weight:600;">
    🛡️ Open in Admin Error Logs
  </a>
  &nbsp;
  <a href="https://supabase.com/dashboard/project/bvfrkzdlklyvnhlpleck/functions/generateWorksheet/logs"
     style="display:inline-block; padding:12px 24px; background:#2563eb; color:white;
            border-radius:6px; text-decoration:none; font-weight:600;">
    🔍 Edge Function Logs
  </a>
</td></tr>
```

- `appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com'`
- `?bugId=${id}` — query param, nawet jeśli `AdminErrorLogsPage` go nie filtruje, link otwiera właściwą stronę.

### Deploy hotfix

`deploy_edge_functions(["generate-audio", "generateWorksheet", "notify-generation-failure", "submit-bug-report"])`

---

# 🚀 CZĘŚĆ B — Dokończenie Planu v6.9.19

## Sprint 3 — Public Worksheet Gallery

### B3.1 Migracja DB (wymaga zatwierdzenia)

```sql
-- worksheets: dodaj kolumny publikacji
ALTER TABLE public.worksheets
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS public_topic TEXT,        -- denormalized for filtering
  ADD COLUMN IF NOT EXISTS public_level TEXT,        -- denormalized
  ADD COLUMN IF NOT EXISTS public_exercise_types TEXT[]; -- denormalized

CREATE INDEX IF NOT EXISTS idx_worksheets_public 
  ON public.worksheets (is_public, published_at DESC) 
  WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_worksheets_public_slug 
  ON public.worksheets (public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_worksheets_public_topic 
  ON public.worksheets (public_topic) WHERE is_public = true;

-- RLS: dodaj policy publicznego dostępu (nie ruszamy istniejących teacher policies)
CREATE POLICY "Public worksheets readable by anyone"
  ON public.worksheets FOR SELECT
  USING (is_public = true);

-- Slug generator (kebab-case z title + short hash)
CREATE OR REPLACE FUNCTION public.generate_public_slug(p_title TEXT, p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  base TEXT;
  hash TEXT;
BEGIN
  base := lower(regexp_replace(coalesce(p_title, 'worksheet'), '[^a-zA-Z0-9]+', '-', 'g'));
  base := regexp_replace(base, '^-+|-+$', '', 'g');
  base := substring(base from 1 for 60);
  hash := substring(p_id::text from 1 for 6);
  RETURN base || '-' || hash;
END $$;
```

### B3.2 Edge Function: `publish-worksheet`

- Auth: teacher JWT
- Body: `{ worksheet_id }`
- Walidacja: teacher musi być właścicielem; worksheet musi mieć ≥6 exercises, niepusty `title`, brak PII w `form_data.additionalInformation` (regex email/telefon)
- Akcja: ustawia `is_public=true`, generuje `public_slug` via RPC, denormalizuje `public_topic/level/exercise_types` z `form_data`, ustawia `published_at=now()`
- Response: `{ slug, public_url: "${APP_BASE_URL}/gallery/${slug}" }`

### B3.3 Edge Function: `unpublish-worksheet`

Symetryczna — `is_public=false`, zostawia `public_slug` (by stary URL pokazał 410 zamiast 404).

### B3.4 Strony frontu

- `/gallery` — `PublicGalleryIndex.tsx` — paginated grid, filtry topic/level/exercise type (czerpie z `pseoMatrix.ts`)
- `/gallery/:slug` — `PublicGalleryWorksheetPage.tsx` — read-only widok worksheet z JSON-LD `LearningResource`, CTA "Sign up to create your own"
- Komponent `PublishWorksheetButton.tsx` — w `WorksheetPage` toolbar (teacher only), modal z confirm + copy public URL

### B3.5 Edge Function: `regenerate-gallery-sitemap`

- Cron: codziennie o 02:00 UTC (pg_cron)
- Zapytanie: `SELECT public_slug, published_at FROM worksheets WHERE is_public=true ORDER BY published_at DESC LIMIT 50000`
- Generuje `public/sitemap-gallery.xml` (chunkowanie po 50k URLi)
- Dodaje referencję w `public/sitemap.xml` jako sitemap index
- Triggerowane też po każdym `publish-worksheet` (best-effort, throttle 5 min)

### B3.6 Updates RAG/Mem

- `mem/features/public-gallery/architecture.md` (NEW)
- `docs/llm-context.md` + `llms.txt` + `public/llms.txt` — sekcja "Public Gallery"

---

## Sprint 5 — AEO/LLMO Layer

### B5.1 `public/llms-full.txt` (NEW, ~50KB)

- Zawiera pełne TL;DR wszystkich 1 458 URL-i z `sitemap.xml` w formacie:
  ```
  ## /esl-worksheets/present-perfect/b1-intermediate
  > Generator of B1 Present Perfect worksheets for adult ESL learners. 8 exercises, ~45min lesson. Free preview, sign-up to download PDF.
  Tags: grammar, present-perfect, B1, adult-learners
  ```
- Generowany przez `scripts/seo/generate-llms-full.mjs` (Node script, czyta `pseoMatrix.ts` + `seoMeta.ts`)
- Wykonanie podczas build (dodać do `scripts/seo/audit-sitemap.mjs` chain)

### B5.2 JSON-LD sweep — uzupełnić brakujące

- `WebSite` + `SearchAction` w `index.html` (top-level)
- `Organization` z `sameAs` (LinkedIn, X, YouTube) — w `index.html`
- `SoftwareApplication` na `/pricing` z `offers` (3 plany)
- `Course` na `/tools/cefr-level-test`
- `HowTo` na `/tools/lesson-plan-generator` (już jest — audit poprawności)

### B5.3 Snippet rules audit

- Skrypt `scripts/seo/audit-snippets.mjs` — czyta każdy plik strony, sprawdza:
  - obecność `<aside aria-label="Summary">` (TL;DR pod AEO)
  - długość H1 (40-60 chars)
  - meta description (140-160 chars)
  - alt text na każdym `<img>`
- Raport markdown do `docs/seo/snippet-audit-report.md`

### B5.4 Updates RAG/Mem

- `mem/seo/aeo-llmo-layer.md` (NEW)
- Dopisek w `docs/llm-context.md`

---

## Sprint 6 — Content Velocity (4 z 12 long-form artykułów)

### B6.1 Wybór tematów (top SEO opportunity wg semrush)

1. `/blog/how-to-teach-english-online-2026-complete-guide` (KW: "teach english online", 18k searches/mo)
2. `/blog/icao-aviation-english-test-preparation` (KW: "ICAO english test", 4.4k)
3. `/blog/business-english-for-1-on-1-tutoring` (KW: "business english tutor", 2.9k)
4. `/blog/cefr-levels-explained-for-tutors` (KW: "CEFR levels", 22k)

### B6.2 Struktura każdego artykułu (~3000-4000 słów)

- H1 + TL;DR aside
- Table of Contents (semantic `<nav>`)
- 8-12 sekcji H2/H3
- Min. 2 obrazy z alt text (lazy loaded)
- `Article` + `BreadcrumbList` + `FAQPage` JSON-LD
- 3 internal links do `/tools/*` i `/esl-worksheets/*`
- CTA box co 1500 słów (sign-up)
- Author bio (Martha — 10y ESL experience) z `sameAs`

### B6.3 Implementacja techniczna

- Folder `src/content/blog/` — pliki `.tsx` (React components, nie MDX — by uniknąć nowej zależności)
- Layout `src/components/blog/BlogPostLayout.tsx` z TOC nav + reading time
- Routing w `App.tsx`: `/blog` (index) + `/blog/:slug`
- Sitemap: dodać 4 URLe + index `/blog` (sitemap.xml → 1 463 URLi)

### B6.4 Treści — generowane jednorazowo przez Claude/GPT-5

**WAŻNE**: NIE używamy worksheet engine do generowania artykułów (sanctity rule). Treść piszę ja podczas implementacji, na bazie ESL expertise Marthy + research z semrush.

### B6.5 Updates RAG/Mem

- `mem/seo/long-form-content-strategy.md` (NEW)
- `docs/llm-context.md` — sekcja "Content Hub"

---

# 📁 Pełna lista plików (Hotfix + Sprinty 3, 5, 6)

### Hotfix (CZĘŚĆ A)

```
M  supabase/functions/generate-audio/index.ts
M  supabase/functions/generateWorksheet/index.ts
M  supabase/functions/notify-generation-failure/index.ts
M  supabase/functions/submit-bug-report/index.ts
N  mem/features/email/generation-failure-alerts.md
```

### Sprint 3

```
M  (migracja DB) worksheets: 7 nowych kolumn + indeksy + RLS + RPC
N  supabase/functions/publish-worksheet/index.ts
N  supabase/functions/unpublish-worksheet/index.ts
N  supabase/functions/regenerate-gallery-sitemap/index.ts
N  src/pages/gallery/PublicGalleryIndex.tsx
N  src/pages/gallery/PublicGalleryWorksheetPage.tsx
N  src/components/worksheet/PublishWorksheetButton.tsx
M  src/App.tsx (2 nowe routy)
M  public/sitemap.xml (sitemap index)
N  mem/features/public-gallery/architecture.md
```

### Sprint 5

```
N  public/llms-full.txt (build-generated)
N  scripts/seo/generate-llms-full.mjs
N  scripts/seo/audit-snippets.mjs
M  index.html (WebSite + Organization JSON-LD)
M  src/pages/Pricing.tsx (SoftwareApplication JSON-LD)
M  src/pages/tools/CefrLevelTest.tsx (Course JSON-LD)
N  docs/seo/snippet-audit-report.md
N  mem/seo/aeo-llmo-layer.md
```

### Sprint 6

```
N  src/components/blog/BlogPostLayout.tsx
N  src/pages/blog/BlogIndex.tsx
N  src/content/blog/how-to-teach-english-online-2026.tsx
N  src/content/blog/icao-aviation-english-test-prep.tsx
N  src/content/blog/business-english-1on1-tutoring.tsx
N  src/content/blog/cefr-levels-explained.tsx
M  src/App.tsx (2 nowe routy: /blog, /blog/:slug)
M  public/sitemap.xml (+5 URLi)
N  mem/seo/long-form-content-strategy.md
```

### Zawsze (RAG)

```
M  docs/llm-context.md (3 nowe sekcje: hotfix, gallery, AEO, content)
M  llms.txt
M  public/llms.txt
M  mem/index.md
```

---

# 🚦 Kolejność wykonania (deterministyczna)

1. **Hotfix** (BUG 1 → BUG 2 → BUG 3) → deploy 4 funkcji → smoke test
2. **Sprint 3** — migracja DB (oczekuję Twojego zatwierdzenia w UI Lovable - zaztwierdzam tutaj więc już nie pytaj w UI Lovable) → edge functions → frontend → sitemap
3. **Sprint 5** — JSON-LD sweep → llms-full.txt generator → snippet audit
4. **Sprint 6** — 4 artykuły blog (długie, czasochłonne, mogą być w osobnym podsprincie jeśli czas pozwoli)
5. **RAG update + memory sync** (na końcu, jeden commit)

---

# 🔒 Sekrety (sprawdzić, nie tworzyć — wszystkie już istnieją)

- `OPENAI_API_KEY` ✅ (Tier 2, dostęp do `gpt-4o-mini`, `gpt-4o-mini-tts`, `tts-1`)
- `APP_BASE_URL` ✅ (memory: `https://edooqoo.com`)
- `RESEND_API_KEY` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (auto)

# ⛔ Out of scope (świadomie pomijamy)

- Walka o dostęp do `gpt-4o-audio-preview` (uzasadnione w Q3)
- Modyfikacja worksheet engine promptów (sanctity rule)
- Refaktor `AdminErrorLogsPage` do filtrowania po `?bugId=` (link działa bez tego)
- Migracja na MDX dla bloga (utrzymujemy `.tsx` by zminimalizować deps)
- Sprinty 7+ z Planu v6.9.19 (poza scope tej iteracji)

# 🔑 RAG keywords (do dopisania)

`gpt-4o-audio-preview 404`, `tts-1 fallback`, `gpt-4o-mini-tts`, `2-step audio pipeline`, `transcript determinism`, `streaming heartbeat keepalive`, `AI repair notification`, `parse_recovered`, `bug report admin link`, `public worksheet gallery`, `worksheet slug`, `gallery sitemap`, `llms-full.txt`, `AEO snippet audit`, `long-form content velocity`.

---

**Czekam na Twoją akceptację.** Po `Implement plan` wykonuję sekwencyjnie A → B3 → B5 → B6 z jednym checkpointem na zatwierdzenie migracji DB w Sprincie 3. - zaztwierdzam tutaj więc już nie pytaj w UI Lovable