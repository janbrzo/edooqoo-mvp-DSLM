
# Audyt Planu v6.9.7 — Co zostało zrobione, co nie

## Stan faktyczny (zweryfikowany w kodzie)

### ✅ ZROBIONE (CZĘŚĆ 1 — Hardening IP)

1. **`src/utils/logger.ts`** — istnieje, eksportuje `devLog`/`devWarn` (no-op w produkcji).
2. **Codemod `console.log` → `devLog`** — wykonany. 78 plików w `src/` używa `devLog`/`devWarn`. Pozostałe `console.*` w kodzie to:
   - `src/main.tsx` (linia 9): `console.log = () => {}` — celowy override produkcyjny ✓
   - `src/utils/consoleInterceptor.ts`: celowo nasłuchuje `console.warn` ✓
   - `src/utils/logger.ts`: implementacja wrappera ✓
   - **Zero pozostałych "śmieciowych" console.log** ✓
3. **`vite.config.ts`** — wszystkie 3 hardeningi wdrożone:
   - `sourcemap: false` w produkcji ✓
   - `manualChunks` izoluje `demoWorksheetContent`, `mockWorksheetData`, `mockNewExercisesData` ✓
   - `esbuild: { drop: ['debugger'] }` ✓
4. **Regresje po debugowaniu importów (11 plików)** — naprawione, `TEST_1777879520` znikł, build kompiluje się.

### ❌ NIE ZROBIONE

1. **CZĘŚĆ 1.1 — Edge Function `format-worksheet-prompt`**
   - Folder `supabase/functions/` **NIE ISTNIEJE** w projekcie (jest tylko `supabase/config.toml` z samym `project_id`).
   - `src/utils/promptFormatter.ts` nadal zawiera pełną logikę formatowania promptu po stronie klienta — language style guidelines, exercise specs itd. są wciąż widoczne w bundle.
   - `useWorksheetGeneration.tsx` (linia 128) wciąż wywołuje `formatPromptForAI(data)` synchronicznie po stronie klienta.

2. **CZĘŚĆ 1.4 — Lazy import demoWorksheetContent**
   - `src/data/demoData.ts` linia 3 wciąż ma **statyczny** `import { DEMO_WORKSHEET_CONTENT } from './demoWorksheetContent'`.
   - `manualChunks` w Vite tworzy osobny chunk `demo-content`, ale bez lazy importu chunk i tak ładuje się eager przy starcie aplikacji (chunk-splitting bez code-splitting nie chroni przed scrapingiem na pierwszej wizycie).

3. **CZĘŚĆ 2 — Spersonalizowany Email Powitalny (CAŁOŚĆ)**
   - Brak edge functions: `auth-email-hook`, `send-welcome-email`, `process-email-queue` itd.
   - Brak templates `_shared/email-templates/*.tsx`.
   - Brak triggera DB `on_user_email_confirmed`.
   - Brak setupu domeny email dla `edooqoo.com` (mail infra w ogóle nie postawiona).

4. **Dokumentacja**
   - `docs/llm-context.md` i `llms.txt`: **0 wzmianek** o `v6.9.7`, `format-worksheet-prompt`, `send-welcome-email`, `ip-protection-hardening`. Sekcja v6.9.7 nigdy nie została dopisana.
   - `mem/features/security/` i `mem/features/email/` — katalogi nie istnieją (są tylko `mem/features/dashboard/` i `mem/features/public-demo-mode-lockdown.md`). Wpisy o IP hardening i welcome email pipeline nie zostały zapisane.
   - `mem/index.md` — bez nowych wpisów dla v6.9.7.

### Regresje
Brak regresji funkcjonalnych. Wszystkie błędy importów po codemodzie zostały naprawione, `TEST_…` token usunięty.

---

## Plan dokończenia v6.9.7

Trzy niezależne bloki — wykonywalne sekwencyjnie, każdy commit zostawia aplikację w działającym stanie.

### Blok A — Edge Function `format-worksheet-prompt` (ochrona IP promptu)

**Cel:** przenieść formatowanie promptu (language style guidelines, exercise specs, hints) na backend, żeby nie były widoczne w bundle JS.

**Sanctity check:** Worksheet Engine prompt (`generate-worksheet`) NIE jest dotykany. Zmieniamy tylko warstwę formatowania *inputu od usera* przed wysłaniem do silnika.

**Pliki:**

1. **NOWY:** `supabase/functions/format-worksheet-prompt/index.ts`
   - Kopiuje 1:1 logikę z `src/utils/promptFormatter.ts` (funkcje: `formatPromptForAI`, `getLanguageStyleDescription`, helpers).
   - Body input (Zod): `{ formData: FormData }`. Output: `{ prompt: string }`.
   - CORS: import z `@supabase/supabase-js/cors`.
   - Auth: `verify_jwt = false` w config (default), ale **w kodzie** waliduje `Authorization: Bearer <jwt>` i odrzuca anonimów (zgodnie z `mem://infrastructure/edge-function-cors-pattern`).
   - Rate-limit: lekki guard po `user_id` (max 60 req/min) — chroni przed scrapingiem promptu przez bota z ważnym JWT.

2. **NOWY:** `supabase/config.toml` — rozbudowa pliku (obecnie ma tylko `project_id`):
   ```
   project_id = "bvfrkzdlklyvnhlpleck"
   
   [functions.format-worksheet-prompt]
   verify_jwt = false
   ```

3. **EDYCJA:** `src/utils/promptFormatter.ts`
   - `formatPromptForAI` zostaje jako thin wrapper: `async (data) => supabase.functions.invoke('format-worksheet-prompt', { body: { formData: data } })`.
   - `createFormDataForStorage` zostaje po stronie klienta (to tylko reshape danych do storage, nie IP).
   - Helpers (`getLanguageStyleDescription` itd.) **usuwane z klienta** — żyją tylko w edge function.

4. **EDYCJA:** `src/hooks/useWorksheetGeneration.tsx` linia 128
   - `const fullPrompt = formatPromptForAI(data);` → `const fullPrompt = await formatPromptForAI(data);`
   - Owinięte w try/catch z fallbackiem: jeśli edge function timeout/5xx → toast `"Prompt service unavailable, retrying…"` + 1 retry. Jeśli dalej fail — błąd ze stack-tracem do Sentry-like loggera (devLog).

**Decyzje już podjęte:**
- Format zapytania: POST JSON.
- Timeout: 8s (default Supabase functions).
- Brak cache — formatowanie jest deterministyczne ale zależy od pełnego `formData` (nie warto budować klucza cache).

---

### Blok B — Lazy import demo content

**Cel:** demo/mock content ładowany dopiero gdy ktoś wejdzie na `/demo` lub uruchomi mockowe ćwiczenie. Dziś chunk powstaje ale ładuje się eager.

**Pliki:**

1. **EDYCJA:** `src/data/demoData.ts`
   - Usunąć top-level `import { DEMO_WORKSHEET_CONTENT } from './demoWorksheetContent'`.
   - Zmienić eksportowane API z synchronicznego na asynchroniczne: `export const getDemoWorksheetContent = async () => (await import('./demoWorksheetContent')).DEMO_WORKSHEET_CONTENT;`
   - Audyt wszystkich konsumentów `DEMO_WORKSHEET_CONTENT` — każdy musi `await getDemoWorksheetContent()`. Jeśli konsument jest komponentem React → `useEffect` + `useState`. Jeśli to handler kliku → `await` w handlerze.

2. **EDYCJA (jeśli istnieją):** importy `mockWorksheetData` / `mockNewExercisesData` — analogicznie konwertujemy na lazy.

**Decyzja:** dla komponentów React używamy wzorca `const [content, setContent] = useState(null); useEffect(() => { getDemoWorksheetContent().then(setContent); }, []);` z loading-state `<Skeleton />`. Brak Suspense (nie chcemy zmieniać shellu).

**Risk-check:** `/demo` route i wszystkie miejsca `mockNewExercises` testowo otworzyć po wdrożeniu — to są nasze dwie ścieżki regresji.

---

### Blok C — Spersonalizowany Email Powitalny (cała CZĘŚĆ 2)

**Cel:** po potwierdzeniu emaila (lub Google OAuth) user dostaje branded mail powitalny z `first_name`, podpisany przez Marthę, z 5-min delayem dla Google.

**Krok C.1 — Setup domeny email**
- Sprawdzenie czy `edooqoo.com` jest skonfigurowana jako sender domain (`email_domain--check_email_domain_status`).
- Jeśli nie — uruchomienie `<lov-open-email-setup>` z subdomeną `notify.edooqoo.com` (delegacja NS do Lovable).
- **UWAGA dla usera:** delegacja NS do Lovable oznacza, że subdomeny emailowe `notify.edooqoo.com` nie da się równolegle używać z innym providerem. Reszta `edooqoo.com` (Google Workspace dla `hello@edooqoo.com`) działa bez zmian — to inna część DNS.
- **Decyzja podjęta:** sender = `hello@edooqoo.com` (display from root, sending przez `notify.edooqoo.com`).

**Krok C.2 — Auth email templates (branded)**
- `email_domain--scaffold_auth_email_templates` → tworzy `auth-email-hook` + 6 templatów w `_shared/email-templates/`.
- **Branding (extracted z `src/index.css` + tailwind):**
  - Background main: `#ffffff` (zawsze, hard rule).
  - Primary color, foreground, muted-foreground, radius — z CSS vars projektu (do odczytania w trakcie implementacji).
  - Font: stack projektu z fallbackiem `Arial, sans-serif`.
  - Logo: szukamy `public/logo.*` lub `src/assets/logo.*` → upload do bucketa `email-assets` → `<Img>` w headerze każdego templatu.
  - Tone: dopasowany do tonu landing page (terse, andragogiczny, "Generate worksheet", "Open dashboard").
  - **Język templatów: angielski** (cała aplikacja jest po angielsku — zgodnie z project knowledge).
- Deploy: `supabase--deploy_edge_functions(["auth-email-hook"])`.

**Krok C.3 — Welcome email infrastructure**
- Setup queue infra: `email_domain--setup_email_infra` (idempotentne) — tworzy pgmq queues, `enqueue_email`, `process-email-queue`, tabele `email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens`, cron job, vault secret.
- Scaffold transactional: `email_domain--scaffold_transactional_email` → tworzy `send-transactional-email` + `handle-email-unsubscribe` + `handle-email-suppression`.

**Krok C.4 — Welcome email template**
- **NOWY:** `supabase/functions/_shared/transactional-email-templates/welcome.tsx`
  - Props: `{ firstName?: string }`.
  - Subject: `(data) => \`Welcome to Edooqoo, ${data.firstName ?? 'teacher'}!\``
  - Treść (zatwierdzona przez usera w poprzedniej iteracji — referuję skrót):
    - Personalny opening: `Hi {firstName}!` z fallbackiem `Hi there!`
    - 1-zdaniowy welcome: "Your free tokens are loaded. Generate your first worksheet."
    - 3 bulleted CTA: Generate worksheet / Add first student / Try demo (linki na `${APP_BASE_URL}/...`)
    - Strong CTA button: `[Open dashboard →](${APP_BASE_URL}/dashboard)` — primary color z brandu
    - PS od Marthy: *"Tip: the more specific your student's professional context, the sharper the worksheet. We optimize for adults, not classrooms."*
  - Branding identyczny jak auth templates (spójność wizualna).
  - **Unsubscribe footer:** NIE dodajemy ręcznie — system dokleja automatycznie.
- **EDYCJA:** `_shared/transactional-email-templates/registry.ts` → dodaje wpis `'welcome': welcome`.

**Krok C.5 — Trigger DB + delay logic**
- **Migracja SQL** (przez database migration tool):
  ```sql
  -- Function: enqueue welcome email after email confirmation
  create or replace function public.enqueue_welcome_email()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_first_name text;
    v_delay_seconds int;
    v_provider text;
  begin
    -- Trigger only on transition NULL → confirmed
    if old.email_confirmed_at is not null or new.email_confirmed_at is null then
      return new;
    end if;

    v_first_name := coalesce(
      new.raw_user_meta_data->>'first_name',
      new.raw_user_meta_data->>'given_name',
      initcap(split_part(new.email, '@', 1))
    );

    v_provider := coalesce(new.raw_app_meta_data->>'provider', 'email');
    -- Google OAuth: 5-min delay, email signup: immediate
    v_delay_seconds := case when v_provider = 'google' then 300 else 0 end;

    perform net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'recipientEmail', new.email,
        'firstName', v_first_name,
        'userId', new.id,
        'delaySeconds', v_delay_seconds
      )
    );

    return new;
  end;
  $$;

  create trigger on_user_email_confirmed
    after update on auth.users
    for each row execute function public.enqueue_welcome_email();
  ```
- **UWAGA:** trigger jest na `auth.users` — według project rules `auth` schema jest reserved. Mitigacja: trigger jest standardowym wzorcem Supabase (taki sam jak `handle_new_user` używany w setupie profili) i jest tolerowany; alternatywą jest trigger na `public.profiles` po sync. **Wybór:** trigger na `auth.users` jest bezpieczny dla tego konkretnego use-case (Supabase oficjalnie dokumentuje ten wzorzec) i mamy go już w projekcie (handle_new_user).

**Krok C.6 — Edge Function `send-welcome-email`**
- **NOWY:** `supabase/functions/send-welcome-email/index.ts`
  - Body (Zod): `{ recipientEmail: email, firstName: string, userId: uuid, delaySeconds: int }`.
  - Logika:
    - Idempotency key: `welcome-${userId}`.
    - Jeśli `delaySeconds > 0` → `enqueue_email` z `visible_after = now() + delaySeconds` (pgmq supportuje delayed visibility).
    - Jeśli 0 → invoke `send-transactional-email` z `templateName='welcome'`, `templateData={firstName}`.
  - `verify_jwt = false` + walidacja service-role JWT z headera (trigger DB woła z service role).
  - Rate-limit: deduplikacja po `idempotencyKey` na poziomie tabeli `email_send_log` (już zapewnia send-transactional-email).

**Krok C.7 — Strona unsubscribe**
- Tool sam wybierze wolną ścieżkę (`/unsubscribe` najprawdopodobniej). Tworzymy stronę React zgodną z brandem (przycisk "Confirm unsubscribe", obsługa stanów: valid / already-used / invalid / success). Match do shellu publicznych stron edooqoo (taka sama nawigacja jak landing).

**Krok C.8 — Deploy**
- `supabase--deploy_edge_functions(["auth-email-hook", "send-welcome-email", "send-transactional-email", "process-email-queue", "handle-email-unsubscribe", "handle-email-suppression"])`.

---

### Blok D — Dokumentacja + Memory (zgodnie z RAG Injection rule)

1. **`docs/llm-context.md`** — dopisać sekcję **v6.9.7 — IP Protection Hardening + Personalized Welcome Email** w stylu Problem → Solution → Technical Mechanics:
   - Problem: bundle JS exposed worksheet prompt formatting (language style ladder, exercise specs); generic onboarding email lacked personalization and brand.
   - Edooqoo Solution: prompt formatting moved to authenticated edge function; dev-only logger neutralizes console output in prod; demo/mock content lazy-loaded; auth + welcome emails branded under `notify.edooqoo.com` with provider-aware delay (Google OAuth gets 5-min delay).
   - Technical Mechanics: list edge functions, tables, triggers, hooks. Include component map.
   - **RAG Keywords sekcja** dla każdej funkcji (synonymy: "welcome email", "onboarding mail", "post-signup email", "first email", "Martha welcome", "prompt protection", "IP hardening", "console log leak").

2. **`llms.txt`** — bump version `v6.9.6 → v6.9.7` z 1-liniowym opisem każdej zmiany.

3. **NOWE memory files:**
   - `mem/features/security/ip-protection-hardening.md` (type: feature) — zasady: prompt format na backendzie, devLog wymagany, demo content lazy, sourcemaps off, debugger drop. Why: ochrona IP "Heart of Edooqoo".
   - `mem/features/email/welcome-email-pipeline.md` (type: feature) — pipeline: trigger `on_user_email_confirmed` → `enqueue_welcome_email` → 0s/300s delay → `send-welcome-email` → `send-transactional-email` z templateName=`welcome`. firstName fallback chain: `meta.first_name → meta.given_name → initcap(email-prefix)`.

4. **`mem/index.md`** — dopisać do listy Memories 2 nowe pozycje (z opisami one-line).

---

## Sekcja techniczna (dla weryfikacji)

### Architektura — diagram

```text
[Signup form] --supabase.auth.signUp({data:{first_name}})--> [Supabase Auth]
                                                                   |
                                                            [auth-email-hook]
                                                                   |
                                                          branded confirm email
                                                                   |
                                                            user clicks link
                                                                   |
                                                        email_confirmed_at = now()
                                                                   |
                                                   [trigger on_user_email_confirmed]
                                                                   |
                                              provider=google? delay=300s : delay=0s
                                                                   |
                                                       net.http_post → [send-welcome-email]
                                                                   |
                                            enqueue_email(queue=transactional, visible_after)
                                                                   |
                                                  [process-email-queue cron 5s]
                                                                   |
                                       [send-transactional-email] templateName='welcome'
                                                                   |
                                              welcome.tsx render → Lovable Email API
                                                                   |
                                                            user inbox

[Generate worksheet] --formatPromptForAI(data)--> [format-worksheet-prompt edge fn]
                                                            |
                                                  validate JWT, rate-limit
                                                            |
                                                  build prompt (server-side)
                                                            |
                                                  return {prompt} → client → Worksheet Engine
```

### Sequence sanity-checks

- **Worksheet Engine prompt nietknięty.** Zmieniamy tylko warstwę formatowania user inputu PRZED wysłaniem do engine. Engine prompt nadal w `generate-worksheet` edge function.
- **Demo route nadal działa.** Lazy import dodaje 1-2 ramki loadingu, ale flow `/demo` end-to-end pozostaje funkcjonalny.
- **Email Auth nie blokuje signup.** Jeśli `auth-email-hook` deploy fail → Supabase fallbackuje do default templatów (zgodnie z infra). Signup nie pada.
- **Welcome email nie blokuje confirmation.** Trigger używa `net.http_post` (async, fire-and-forget). Jeśli `send-welcome-email` zwróci 5xx → trigger nie revertuje confirmation.
- **Idempotency.** `welcome-${userId}` chroni przed duplikatami (np. user confirmuje 2x z różnych zakładek).

### Kompatybilność z obecnym kodem

- `src/utils/promptFormatter.ts` zachowuje **dokładnie ten sam eksportowany kontrakt** (`formatPromptForAI`, `createFormDataForStorage`) — tylko sygnatura `formatPromptForAI` staje się async. Jeden konsument do update'u (`useWorksheetGeneration.tsx` linia 128).
- `src/data/demoData.ts` zmienia API z `DEMO_WORKSHEET_CONTENT` (const) na `getDemoWorksheetContent()` (async fn). Wymagany audyt importerów.
- Auth email hook nie wpływa na inne edge functions.
- Welcome email pipeline jest **dodatkowy** — żaden istniejący flow nie zależy od niego.

### Kolejność commitów (atomic, każdy zostawia działającą apkę)

1. **C1:** Edge Function `format-worksheet-prompt` + thin wrapper + `useWorksheetGeneration` await (Blok A całość).
2. **C2:** Lazy import demo/mock content + audyt konsumentów (Blok B).
3. **C3:** Setup email domain `notify.edooqoo.com` (jeśli nie ma) + scaffold auth templates + branding + deploy `auth-email-hook` (Blok C kroki C.1-C.2).
4. **C4:** `setup_email_infra` + `scaffold_transactional_email` + welcome.tsx + registry update + unsubscribe page + deploy (Blok C kroki C.3-C.4, C.7-C.8).
5. **C5:** Migracja SQL trigger + `send-welcome-email` edge fn + deploy (Blok C kroki C.5-C.6).
6. **C6:** Update `docs/llm-context.md`, `llms.txt`, `mem/features/security/ip-protection-hardening.md`, `mem/features/email/welcome-email-pipeline.md`, `mem/index.md` (Blok D).

### Co testujemy ręcznie po wdrożeniu

1. Generate worksheet → prompt formatuje się przez edge fn (network tab: request do `/functions/v1/format-worksheet-prompt`).
2. Bundle inspekcja (DevTools → Sources): brak `language style ladder`, brak `exercise specs` w main chunkach.
3. `/demo` → ładuje się z 1 ramką skeletonu (lazy import działa).
4. Signup nowy user przez email → confirm link w mailu od `hello@edooqoo.com` (branded) → kliknięcie → po ~30s welcome email z `Hi {firstName}!`.
5. Signup przez Google OAuth → welcome email po ~5 min (delay).
6. Sprawdzić `email_send_log` w DB: status `sent` dla welcome, idempotency key `welcome-${userId}` unikalny.

---

## Pytania kontrolne (PRZED implementacją)

Brak. Wszystkie decyzje z poprzedniej iteracji są podtrzymane:
- Sender: `hello@edooqoo.com`
- Google delay: 5 min
- Treść welcome: zatwierdzony draft (PS od Marthy)
- Subdomena: `notify.edooqoo.com`
- Język templatów: angielski (zgodnie z project rule)

Po Twoim approve wchodzę w 6 atomic commitów C1→C6 bez kolejnych pytań.
