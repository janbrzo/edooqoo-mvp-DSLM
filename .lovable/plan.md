
# Plan v6.9.24 — Wdrożenie H4 + H5 + H6 + H8

Bazuje na zatwierdzonym v6.9.23. H2/H3/H7/H8a już live.

---

## H4 — Signup Return-To Flow

**Problem:** klik `sign up free` na `/gallery/...`, `/pricing`, `/blog`, landing pSEO → modal `/signup` → X lub login → ląduje na `/` lub `/dashboard` zamiast wrócić na poprzednią stronę.

**Stan obecny (sprawdzone w kodzie):**
- `Signup.tsx` JUŻ czyta `location.state.from` (linia 36: `fromPath = location.state?.from || '/'`) i po sukcesie robi `navigate(fromPath !== '/' ? fromPath : '/dashboard')` (linia 53).
- `Login.tsx` JUŻ ma analogiczny `fromPath` (linia 24, 47).
- Część callsite'ów już przekazuje `state` (StickyNav, AnonPreWorksheetBanner, AnonPostWorksheetCTA, FeatureNavPills, SignupPromptDialog).
- **Brakuje:** propagacji `state.from` w ~25 pozostałych callsite'ach + brak `handleClose` w Signup (X w dialogu obecnie nie istnieje — Signup to pełna strona, nie modal). Trzeba dodać przycisk powrotu (`<ArrowLeft>` w nagłówku) jak w Login.

### H4.1 — Nowy hook `src/hooks/useSignupLinkState.ts`

```ts
import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Centralizes "remember where user came from" before /signup or /login.
 * Used by every CTA button that links into the auth flow.
 *
 * Usage:
 *   const { signupTo, signupState, goToSignup } = useSignupLinkState();
 *   <Link to={signupTo} state={signupState}>Sign up</Link>
 *   // or imperative: onClick={() => goToSignup()}
 *
 * NOTE: signupTo defaults to '/signup'. Pass query-string overrides as arg
 * to goToSignup or build manually: `${signupTo}?level=B1`.
 */
export function useSignupLinkState() {
  const loc = useLocation();
  const nav = useNavigate();
  const from = loc.pathname + loc.search;
  const signupState = { from };
  const goToSignup = useCallback(
    (to: string = '/signup') => nav(to, { state: signupState }),
    [nav, from]
  );
  const goToLogin = useCallback(
    () => nav('/login', { state: signupState }),
    [nav, from]
  );
  return { signupTo: '/signup', loginTo: '/login', signupState, from, goToSignup, goToLogin };
}
```

### H4.2 — `Signup.tsx`: dodanie "Back" CTA

W nagłówku karty obok loga dodać:
```tsx
{fromPath !== '/' && (
  <Button variant="ghost" size="sm" onClick={() => navigate(fromPath)} className="absolute left-4 top-4">
    <ArrowLeft className="mr-1 h-4 w-4" /> Back
  </Button>
)}
```
Import `ArrowLeft` z `lucide-react`. Identyczna logika w `Login.tsx` (już ma navigation, dodać widoczny `<ArrowLeft>` jeśli go nie ma — sprawdzić linia 24).

### H4.3 — Sweep callsites (29 plików, mechanicznie)

**Zasada:** zachowaj istniejące query stringi (np. `?level=B1`, `?topic=...&level=...`). Tylko dodaj `state={{ from: location.pathname + location.search }}` do `<Link>` lub `state` do `navigate()`.

Plik → linia → zmiana (wszystkie wymagają `useLocation()` jeśli brak; albo zastosowanie hooka `useSignupLinkState()`):

| Plik | Linie | Akcja |
|---|---|---|
| `src/components/anon/WelcomeBackBanner.tsx` | 54 | Dodać `state={fromState}` (już ma pattern z `state` w innych anon banerach) |
| `src/components/PricingSection.tsx` | 190, 278, 386 | Dodać `state={{from: location.pathname}}` |
| `src/components/LoginRequiredModal.tsx` | 24 | `navigate('/signup', { state: { from: location.pathname } })` |
| `src/components/GlobalFooter.tsx` | 44 | `state` na `<Link to="/signup">` |
| `src/components/landing/StickyNav.tsx` | 57 | `navigate('/signup', { state: { from: location.pathname } })` |
| `src/pages/Pricing.tsx` | 144, 200, 323 | `navigate('/signup', { state })` |
| `src/pages/gallery/PublicGalleryWorksheetPage.tsx` | 111, 132 | `state` na `<Link>` |
| `src/pages/About.tsx` | 20, 225 | `state` |
| `src/pages/Blog.tsx` | 344 | `state` |
| `src/pages/Resources.tsx` | 145 | `state` |
| `src/pages/Glossary.tsx` | 105 | `state` |
| `src/pages/HowItWorks.tsx` | 118 | `state` |
| `src/pages/ExerciseTypes.tsx` | 82 | `state` |
| `src/pages/Prompts.tsx` | 204 | Zamiana `<a href>` na `<Link to>` + `state` |
| `src/pages/WorksheetExpiredPage.tsx` | 46 | `state` |
| `src/pages/tools/VocabCefrChecker.tsx` | 154 | `state` |
| `src/pages/tools/LessonPlanGenerator.tsx` | 288 | `state` |
| `src/pages/tools/CefrLevelTest.tsx` | 91, 178 | `state` (zachować `?level=`) |
| `src/pages/seo/programmatic/TopicLevelPage.tsx` | 74 | `state` |
| `src/pages/seo/programmatic/PersonaPage.tsx` | 45 | `state` |
| `src/pages/seo/programmatic/ExerciseTopicPage.tsx` | 55 | `state` |
| `src/components/features/FeaturePageLayout.tsx` | 35 | `state` |
| `src/components/features/FeatureHero.tsx` | 22 (default) | Akceptować `state` z propsa, przekazywać do `<Link>` |
| `src/components/features/FeatureCTA.tsx` | 17 (default) | jak wyżej |
| `src/components/seo/SeoLandingLayout.tsx` | 50, 164 | `state` |
| `src/constants/anonFeaturesShowcase.ts` | 31–71 | Constants — bez zmian. Komponent konsumujący (znajdę przez `rg "ctaHref"`) dostaje już-string i sam dodaje `state`. |

### H4.4 — Test akceptacyjny

- `/gallery/<dowolny>` → klik "sign up free" → URL `/signup` → klik nowy "Back" → wraca na `/gallery/<dowolny>`.
- `/pricing` → "Start free" → `/signup` → "Back" → `/pricing`.
- `/blog/<slug>.html` — statyczny HTML, nie ma React Routera; jego CTA już są `<a href>`, return-to nie dotyczy.

**Pliki zmienione:** ~28 + 1 nowy hook + 2 page'e (Signup, Login).

---

## H5 — SSE Heartbeat + Silent Retry

**Problem:** `generateWorksheet` często traci 40s ciszy → false-positive modal "Connection lost".

**Stan obecny (sprawdzone):**
- `src/services/worksheetStreamService.ts` ma `HEARTBEAT_MS = 40000`, resetowany na każdy `chunk`, ale brak server-side keepalive.
- `supabase/functions/generateWorksheet/streaming.ts` eksportuje `createSSEStream()` z metodami `send/close`.
- W `generateWorksheet/index.ts` (1140 linii) wywołanie `sseStream.send('progress', ...)` istnieje na progressie generowania.

### H5a — Serwer: heartbeat co 15s

**`supabase/functions/generateWorksheet/streaming.ts`** — dopisać metodę `heartbeat()` do interfejsu `SSEStream`:

```ts
export interface SSEStream {
  readable: ReadableStream;
  send: (event: string, data: any) => void;
  heartbeat: () => void;   // ← NEW
  close: () => void;
}
```

W ciele `createSSEStream()` przed `return {`:
```ts
const heartbeat = () => {
  try {
    controller.enqueue(new TextEncoder().encode(`event: keepalive\ndata: {"t":${Date.now()}}\n\n`));
  } catch (e) {
    console.warn('SSE heartbeat skipped (controller closed)', e);
  }
};
return { readable, send, heartbeat, close: ... };
```

**`supabase/functions/generateWorksheet/index.ts`** — znaleźć miejsce, gdzie tworzony jest `sseStream` (w handlerze streamingowym). Tuż po utworzeniu dodać:
```ts
const hbInterval = setInterval(() => sseStream.heartbeat(), 15000);
```
W `finally` (przed `sseStream.close()`):
```ts
clearInterval(hbInterval);
```
Jeśli kod ma wiele `try/catch/return`, ujednolicić w jeden `try { ... } finally { clearInterval(hbInterval); sseStream.close(); }`.

### H5b — Klient: ignorowanie keepalive + silent retry

**`src/services/worksheetStreamService.ts`**:

1. **Heartbeat timeout** → `45000` ms (margines dla 3× 15s + sieć).
2. **Obsługa `keepalive`** w switchu (zignoruj — server-side `event: keepalive` już resetuje `resetHeartbeat()` przez sam fakt nadejścia chunka, bo `resetHeartbeat()` jest wywoływane przed pętlą `for (const event of events)`).
3. **Silent retry** — pierwszy `AbortError` z heartbeat-timeout NIE wywołuje `onError`, tylko cicho restartuje `fetch(GENERATE_WORKSHEET_URL, ...)`. Drugi → `onError` jak dzisiaj.

Refaktor (skrót — pełna funkcja będzie ~190 linii vs obecnie 148):

```ts
export function streamWorksheetGeneration(formData, userId, callbacks): AbortController {
  let retryCount = 0;
  let activeController = new AbortController();

  const startStream = (): AbortController => {
    const controller = new AbortController();
    activeController = controller;
    let lastProgress = { exercisesGenerated: 0, expectedTotal: 0 };
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

    const HEARTBEAT_MS = 45000;
    const onSilentTimeout = () => {
      if (retryCount < 1) {
        retryCount++;
        devLog('🔁 Heartbeat timeout — silent retry attempt 1');
        try { controller.abort(); } catch {}
        startStream();  // restart
      } else {
        // Second timeout → surface to user
        const detail = lastProgress.exercisesGenerated > 0
          ? `Connection lost — generated ${lastProgress.exercisesGenerated}/${lastProgress.expectedTotal || '?'} exercises. Please retry.`
          : 'Connection lost — server unresponsive. Please retry.';
        callbacks.onError?.(new Error(detail));
      }
    };
    const resetHeartbeat = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(onSilentTimeout, HEARTBEAT_MS);
    };
    resetHeartbeat();

    fetch(GENERATE_WORKSHEET_URL, { /* same body */ signal: controller.signal })
      .then(/* SAME parsing loop, dodaj case 'keepalive': break; */)
      .catch(error => {
        if (heartbeatTimer) clearTimeout(heartbeatTimer);
        if (error.name === 'AbortError' && retryCount >= 1) {
          // silent retry path — nie wywołuj onError
          return;
        }
        if (error.name === 'AbortError') return;  // user abort
        callbacks.onError?.(error);
      })
      .finally(() => { if (heartbeatTimer) clearTimeout(heartbeatTimer); });

    return controller;
  };

  startStream();

  // Public AbortController — abort() forwards to currently-active stream
  const publicController = new AbortController();
  publicController.signal.addEventListener('abort', () => {
    try { activeController.abort(); } catch {}
  });
  return publicController;
}
```

**Kluczowe założenie bezpieczeństwa:** silent retry powtarza tylko request HTTP — backend `generateWorksheet` jest idempotentny per worksheetId? **NIE** — może wygenerować drugi worksheet. **Mitigacja:** retry tylko gdy `lastProgress.exercisesGenerated === 0` (nic jeszcze nie dotarło) → wtedy retry. Jeśli już są dane → user surface error (lepiej pokazać błąd niż wygenerować duplikat i odjąć token).

Zmodyfikuj `onSilentTimeout`:
```ts
const onSilentTimeout = () => {
  if (retryCount < 1 && lastProgress.exercisesGenerated === 0) {
    retryCount++;
    /* silent retry */
  } else {
    /* surface error */
  }
};
```

### H5c — Test akceptacyjny

1. Manualnie: wstaw `await new Promise(r => setTimeout(r, 25000))` w `generateWorksheet/index.ts` w środku pętli generującej → klient nie pokaże modala (heartbeat keepalive co 15s spłaszcza).
2. Manualnie: na chwilę zatrzymać edge function (uncaught throw przed pierwszym `send('progress')`) → klient cicho retryuje raz, drugi timeout → modal.
3. Regresja: zwykłe generowanie 6-ćwiczeniowe → bez zmian UX.

**Pliki zmienione:** 2 (`streaming.ts`, `worksheetStreamService.ts`) + 1 fragment w `generateWorksheet/index.ts` (setInterval/clearInterval).

---

## H6 — Multi-Provider Model Monitoring

**Cel:** wcześnie wykrywać deprecation modeli (jak `gpt-4o-audio-preview` w v6.9.21).

### H6a — Wpięcie `logModelFailure` w 11 funkcji edge

Dla każdej funkcji w liście poniżej: znaleźć blok `catch` po `fetch` do providera (lub po `openai.chat.completions.create`, lub po `model.generateContent`), dodać:

```ts
import { logModelFailure } from '../_shared/modelFailureLogger.ts';

// w catch:
const status = (err as any)?.status ?? (err as any)?.response?.status ?? 0;
const model = '<hardcoded-or-from-variable>';
if (status === 404 || status === 410 || status >= 500) {
  await logModelFailure({
    model, provider: '<provider>', status,
    endpoint: '<endpoint-path>',
    error: err instanceof Error ? err.message : String(err),
    functionName: '<this-fn-name>'
  });
}
throw err;  // ← zachować istniejący flow
```

**Lista funkcji** (po skanie `rg -ln "OPENAI_API_KEY|GEMINI_API_KEY|..."`):

| # | Funkcja | Provider(y) | Model(e) |
|---|---|---|---|
| 1 | `generateWorksheet` | google + openai | gemini-2.5-flash, gpt-4o-mini (repair) |
| 2 | `verify-open-answers` | google | gemini-2.5-flash |
| 3 | `translate-flashcard` | google | gemini-2.5-flash |
| 4 | `process-welcome-test` | google | gemini-2.5-flash |
| 5 | `suggest-exercises` | google | gemini-2.5-flash |
| 6 | `generate-welcome-test-audio` | openai | tts-1 |
| 7 | `classify-knowledge-entry` | google | gemini-2.5-flash |
| 8 | `generate-curriculum-phases` | google | gemini-2.5-flash |
| 9 | `generate-media-exercises` | google | gemini-2.5-flash |
| 10 | `generate-image` | openai | gpt-image-1 (lub inny — sprawdzić w pliku) |
| 11 | `generate-timeline` | google | gemini-2.5-flash |
| 12 | `transcribe-audio` | openai | whisper-1 |

(`generate-audio` już ma wpiety logger od v6.9.21 — pomijamy.)

**Wzór dla każdego pliku:** 5–10 dodanych linii. Ryzyko regresji minimalne (try/catch tylko wrapuje istniejący błąd, nie zmienia flow).

### H6b — Migracja: tabela `model_health_checks`

```sql
CREATE TABLE public.model_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL,
  model text NOT NULL,
  http_status int,
  severity text NOT NULL CHECK (severity IN ('ok','warning','critical','skipped')),
  details jsonb
);
ALTER TABLE public.model_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_read" ON public.model_health_checks
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_mhc_checked_at ON public.model_health_checks(checked_at DESC);
CREATE INDEX idx_mhc_severity_active ON public.model_health_checks(severity)
  WHERE severity IN ('critical','warning');
```

Uwaga: brak `INSERT` policy → tylko `service_role` (omija RLS) może wpisywać. Admini mogą czytać przez panel `/admin/error-logs` (rozszerzymy view w osobnej turze; na razie SQL Editor wystarczy).

### H6c — Nowa edge function `audit-llm-models`

`supabase/functions/audit-llm-models/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

const corsHeaders = { /* same */ };
const TARGETS = [
  { provider: 'openai',  model: 'gpt-4o-mini',         endpoint: 'https://api.openai.com/v1/chat/completions' },
  { provider: 'openai',  model: 'tts-1',               endpoint: 'https://api.openai.com/v1/audio/speech' },
  { provider: 'openai',  model: 'whisper-1',           endpoint: 'https://api.openai.com/v1/models/whisper-1' },
  { provider: 'openai',  model: 'gpt-image-1',         endpoint: 'https://api.openai.com/v1/models/gpt-image-1' },
  { provider: 'google',  model: 'gemini-2.5-flash',    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const results: any[] = [];
  let critical = 0, warning = 0, ok = 0;

  for (const t of TARGETS) {
    let status = 0, severity: 'ok'|'warning'|'critical'|'skipped' = 'skipped', detail: any = null;
    try {
      let url = t.endpoint;
      const headers: Record<string,string> = {};
      if (t.provider === 'openai') {
        const key = Deno.env.get('OPENAI_API_KEY');
        if (!key) { severity = 'skipped'; detail = { reason: 'no_api_key' }; throw 0; }
        headers['Authorization'] = `Bearer ${key}`;
      } else if (t.provider === 'google') {
        const key = Deno.env.get('GEMINI_API_KEY');
        if (!key) { severity = 'skipped'; detail = { reason: 'no_api_key' }; throw 0; }
        url = `${t.endpoint}?key=${key}`;
      }
      // GET model meta — istnieje? Cheap call, no token cost.
      const resp = await fetch(url, { method: 'GET', headers });
      status = resp.status;
      if (status === 404 || status === 410) { severity = 'critical'; critical++; }
      else if (status >= 500) { severity = 'warning'; warning++; }
      else if (status >= 200 && status < 300) { severity = 'ok'; ok++; }
      else { severity = 'warning'; warning++; detail = { body: (await resp.text()).slice(0, 300) }; }

      if (severity === 'critical') {
        await logModelFailure({
          model: t.model, provider: t.provider, status,
          endpoint: t.endpoint, error: `audit detected ${status}`,
          functionName: 'audit-llm-models',
        });
      }
    } catch (e) {
      if (severity !== 'skipped') { severity = 'warning'; warning++; detail = { error: String(e).slice(0, 300) }; }
    }
    await sb.from('model_health_checks').insert({
      provider: t.provider, model: t.model, http_status: status, severity, details: detail,
    });
    results.push({ ...t, status, severity });
  }

  return new Response(JSON.stringify({
    checked: TARGETS.length, critical, warning, ok, results,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
```

**Uwagi:**
- Dla OpenAI używamy `GET /v1/models/<id>` (404 jeśli zdeprecjonowany).
- Dla Google `GET /v1beta/models/<id>?key=...` (404 jeśli deprec).
- Endpointy `tts-1` i `chat/completions` testujemy via `/v1/models/<id>` zamiast prawdziwego call — żeby nie palić tokenów.
- `whisper-1` przez `/v1/models/whisper-1`.
- ElevenLabs/Anthropic: nieużywane obecnie — nie dodajemy. Lista TARGETS = tylko realnie używane.

### H6d — Cron daily 06:00 UTC

```sql
-- pg_cron + pg_net (już włączone w v6.9.21)
SELECT cron.schedule(
  'daily-llm-model-audit',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Uwaga o vault.decrypted_secrets:** jeśli sekret `service_role_key` nie jest w Vault, dodać go (jednorazowo, ręcznie w SQL Editorze przez `select vault.create_secret(...)` lub w cron użyć anon key z `verify_jwt=false` na funkcji). Drugi wariant bezpieczniejszy: w `supabase/config.toml` ustawić `verify_jwt = false` dla `audit-llm-models` i wysyłać bez auth z crona — bo funkcja sama nic destrukcyjnego nie robi (tylko czyta external API + INSERT do `model_health_checks` jako service_role z env).

Polecane: `verify_jwt = false` + brak `Authorization` header w cronie. Edit `supabase/config.toml`:
```toml
[functions.audit-llm-models]
verify_jwt = false
```

### H6e — Test akceptacyjny

- Ręcznie: `POST /functions/v1/audit-llm-models` → JSON `{checked:5, critical:0, warning:0, ok:5, results:[...]}`.
- `SELECT * FROM model_health_checks ORDER BY checked_at DESC LIMIT 5;` → 5 wpisów `severity='ok'`.
- Symulacja deprecation: `TARGETS` dodać fake `gpt-4o-audio-preview` → audit zwraca `critical:1`, `error_logs` dostaje wpis `model_deprecation`, baner na `/status` zaświeca się.
- Cron: `SELECT * FROM cron.job WHERE jobname = 'daily-llm-model-audit';` → istnieje. Po 06:00 UTC następnego dnia: nowe 5 wpisów w `model_health_checks`.

**Pliki zmienione:** 12 funkcji (logger) + 1 nowa funkcja (`audit-llm-models/index.ts`) + 1 migracja + 1 cron SQL + 1 update `supabase/config.toml`.

---

## H8 — Dokumentacja i memory

### H8b — RAG injection do `docs/llm-context.md` + `llms.txt` + `public/llms.txt`

Sprawdzić, czy `docs/llm-context.md`, `llms.txt`, `public/llms.txt` istnieją (jeśli nie — utworzyć). Dopisać sekcje (format: Problem → Solution → Technical Mechanics + RAG Keywords):

1. **Publish State Persistence**
   - **Problem:** Teacher publishes a worksheet; after page reload the button reverts to "Publish".
   - **Solution:** PublishWorksheetButton hydrates `is_public`/`public_slug` from `worksheets` table on mount.
   - **Mechanics:** `useEffect([worksheetId])` → `supabase.from('worksheets').select('is_public, public_slug').eq('id', worksheetId).maybeSingle()` → `setPub`/`setSlug`. Two extra `useEffect` re-sync if parent passes props.
   - **RAG Keywords:** publish state, hydration, worksheet visibility, gallery slug, public flag persistence, page refresh button state

2. **Signup Return-To Navigation**
   - **Problem:** "Sign up free" CTA on /gallery/x → /signup → success → user lands on /dashboard instead of returning to /gallery/x.
   - **Solution:** `useSignupLinkState` hook centralizes `location.state.from`; Signup.tsx reads it; Login.tsx already did. 28 callsites updated.
   - **Mechanics:** Hook returns `{ signupTo, signupState: { from: pathname+search }, goToSignup }`. CTAs use `<Link to={signupTo} state={signupState}>`. Signup post-signup redirect: `nav(fromPath !== '/' ? fromPath : '/dashboard')`.
   - **RAG Keywords:** return-to navigation, location state, post-signup redirect, deep-link auth flow, CTA persistence

3. **SSE Keepalive + Silent Retry**
   - **Problem:** generateWorksheet stream sometimes silent >40s → false-positive "Connection lost".
   - **Solution:** Server `event: keepalive` every 15s; client watchdog 45s; first timeout = silent retry (only if 0 exercises received); second = surface error.
   - **Mechanics:** `streaming.ts.heartbeat()` enqueues `event: keepalive\ndata: {"t":...}\n\n`. `setInterval(heartbeat, 15000)` in handler; cleared in `finally`. Client: `startStream()` factory + `retryCount` closure; silent retry guarded by `lastProgress.exercisesGenerated === 0` to prevent double-charge.
   - **RAG Keywords:** SSE heartbeat, server-sent events keepalive, stream retry, watchdog timeout, idempotent retry guard

4. **Multi-Provider Model Monitoring**
   - **Problem:** OpenAI deprecated `gpt-4o-audio-preview` without warning → live audio generation broke.
   - **Solution:** 3-layer monitoring: (1) passive — `logModelFailure` in 12 edge functions writes to `error_logs` on 404/410/5xx; (2) active — daily cron 06:00 UTC calls `audit-llm-models` which GETs each model's metadata endpoint; (3) surfacing — RPC `get_active_model_issues()` + red banner on `StatusPage.tsx`.
   - **Mechanics:** `model_health_checks` table (provider, model, http_status, severity, details, checked_at). `audit-llm-models` iterates `TARGETS = [{provider, model, endpoint}]` and inserts row + escalates 404/410 to `logModelFailure` for instant banner. Cron via `pg_cron + pg_net + verify_jwt=false`.
   - **RAG Keywords:** model deprecation, LLM health check, provider monitoring, daily audit, error_logs, status page banner, gpt-4o-audio-preview deprecation

5. **Static HTML SEO Sanctity**
   - **Problem:** Removing static `.html` pages from `public/` would drop hundreds of Google-indexed URLs (~277 pages, mostly long-tail keywords).
   - **Solution:** Never delete files under `public/blog/*.html` or `public/*.html`. Each is a fully-rendered SEO landing serving HTTP 200. React Router never owns these paths because Lovable hosting serves static files first.
   - **Mechanics:** `scripts/seo/build-blog-index.mjs` scans these files and generates `src/data/blogIndex.ts` for the React Blog list. `sitemap.xml` includes all 277 + 1459 pSEO + 29 core React routes = 1736 URLs total. CTAs in static HTML use plain `<a>` (full page nav).
   - **RAG Keywords:** legacy HTML, static SEO pages, long-tail keywords, blog index, sitemap, SPA fallback, public folder

6. **Google Search Console Sitemap Workflow**
   - **Problem:** GSC sitemap submission with bare `sitemap.xml` for Domain property returns "Invalid sitemap URL".
   - **Solution:** Domain property (`sc-domain:edooqoo.com`) requires full URL `https://edooqoo.com/sitemap.xml`. Existing entries auto-refresh every 1–7 days. Force re-fetch via remove + re-add through ⋮ menu.
   - **Mechanics:** GSC fetches sitemap on its own cadence. "Discovered URLs" count updates 24–72h after refetch.
   - **RAG Keywords:** Google Search Console, sitemap submission, domain property, full URL, refetch, indexed URLs

### H8c — Memory files (`mem/`)

5 nowych plików + update `mem/index.md` (zachowując całą istniejącą listę 40+ wpisów):

1. `mem/features/worksheet/publish-state-persistence.md` (feature)
2. `mem/features/navigation/signup-return-to-state.md` (feature)
3. `mem/infrastructure/sse-keepalive-pattern.md` (feature)
4. `mem/infrastructure/model-health-monitoring.md` (feature)
5. `mem/seo/google-search-console-sitemap-workflow.md` (preference)

Każdy z YAML frontmatter (name, description, type) + 3–8 linii treści w stylu "Problem / Rule / How to apply".

Update `mem/index.md` — dopisać 5 nowych wpisów do listy "## Memories", zachowując sekcję "## Core" w 100%.

---

## Kolejność wykonania w build mode

1. **H4** (29 plików + 1 hook + 1 nowy widget Back) — niskie ryzyko, pure UI.
2. **H6a** (12 plików, logger wpięcie) — niskie ryzyko, additive.
3. **H6b** (1 migracja) — wymaga zatwierdzenia migracji.
4. **H6c** (1 nowa edge function) — auto-deploy.
5. **H6d** (1 cron SQL + 1 update config.toml) — wymaga insert (nie migracja, bo zawiera env-specific).
6. **H5** (2 pliki + 1 fragment) — średnie ryzyko (timing). Testować lokalnie najpierw.
7. **H8b** (3 pliki docs) — minimalne ryzyko.
8. **H8c** (5 mem + 1 update index) — minimalne ryzyko.

**Razem:** ~50 plików, 1 migracja, 1 cron, 1 nowa edge function.

---

## Smoke testy końcowe (po deploy)

| Test | Oczekiwane |
|---|---|
| `/gallery/<x>` → "sign up free" → "Back" | wraca na `/gallery/<x>` |
| `/pricing` → "Start Free" → signup success | redirect na `/pricing` |
| Generowanie worksheetu (normalny flow) | bez regresji |
| Symulacja 30s ciszy w `generateWorksheet` | brak modala "Connection lost" |
| `POST /functions/v1/audit-llm-models` | JSON `{checked:5, ok:5}` + 5 wpisów w `model_health_checks` |
| Bug report z UI | mail z `From: notifications@edooqoo.com` (po wdrożeniu sekretu) |
| Publish worksheet → F5 | button = "Public" |
| `/gallery/<categorize-quiz>` | brak `[object Object]` |
| `/blog/<dowolny-z-207>.html` | HTTP 200 + treść |

---

## Czego NIE robimy

- ❌ Anthropic/ElevenLabs targets w audit (nieużywane).
- ❌ Email z `[Audit] critical detected` — po prostu wpis w `error_logs` zaświeca baner na `/status`.
- ❌ UI dla `model_health_checks` history — admin patrzy w SQL Editor lub w osobnej turze dodamy `/admin/model-health`.
- ❌ Sprint 5 (AEO/LLMO), Sprint 6 (long-form articles).
