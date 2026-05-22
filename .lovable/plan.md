# Plan dokończenia v6.9.7 — Resend zamiast Lovable Emails

## Kontekst i decyzja

Tak — możemy i powinniśmy użyć Resend. Masz `RESEND_API_KEY` w secrets, używamy go już w innych edge functions projektu (np. send-homework-email, bug report). Domena `edooqoo.com` jest zweryfikowana w Resend, więc nie potrzebujemy konfigurować subdomeny `notify.edooqoo.com` ani nameserverów Lovable.

**Korzyści:**
- Brak delegacji NS (Twoja domena zostaje w pełni Twoja)
- Brak nowej infrastruktury (pgmq, cron, vault) — wszystko leci synchronicznie przez API Resend
- Spójność z istniejącymi mailami w aplikacji (homework, bug report)
- Szybciej, mniej ruchomych części, mniej rzeczy do popsucia

**Trade-off (świadomy):** Brak kolejki retry/DLQ jak w Lovable Emails. Dla welcome maila to akceptowalne — jeśli pierwszy strzał padnie, mamy alert w `email_send_log` i ręczny resend.

---

## Status zastany (po audycie)

| Blok | Status |
|---|---|
| A. Edge Function `format-worksheet-prompt` | DONE — istnieje `supabase/functions/format-worksheet-prompt/index.ts`, klient woła `await formatPromptForAI`, sourcemaps off, debugger drop |
| B. Lazy demo content | DONE — `buildDemoData` async, dynamic import `demoWorksheetContent` i mocków |
| C. Welcome email pipeline | NOT DONE — brak edge function, triggera, szablonu |
| D. Dokumentacja | CZĘŚCIOWO — `docs/llm-context.md`, `llms.txt`, `mem://features/security/ip-protection-hardening` zrobione. Brak wpisu o welcome email |

Do dokończenia: **Blok C + uzupełnienie dokumentacji**.

---

## Blok C — Welcome Email przez Resend

### 1. Edge Function: `supabase/functions/send-welcome-email/index.ts`

- `verify_jwt = false` (woła ją trigger DB / webhook, nie zalogowany user)
- W kodzie: walidacja shared secret w nagłówku `x-internal-secret` (nowy secret `WELCOME_EMAIL_SECRET`) — chroni przed publicznym spamem
- Body (Zod): `{ email: string, firstName?: string, signupSource: 'email' | 'google' }`
- Idempotencja: sprawdza `email_send_log` (`template_name='welcome_email' AND recipient_email=$1`) — jeśli już `sent`, zwraca 200 bez ponownej wysyłki
- Wywołanie Resend REST API: `POST https://api.resend.com/emails` z `Authorization: Bearer ${RESEND_API_KEY}`
  - `from: "Edooqoo <hello@edooqoo.com>"`
  - `reply_to: "hello@edooqoo.com"`
  - `subject: "Welcome to Edooqoo, {firstName} 👋"`
  - `html`: render React Email template (poniżej)
- Loguje wynik do `email_send_log` (status `sent` / `failed`, `error_message`, `provider_message_id`)
- CORS: standard z `@supabase/supabase-js/cors`
- Używa `APP_BASE_URL` do linków w mailu (zgodnie z core memory rule)

### 2. Szablon: `supabase/functions/_shared/email-templates/welcome.tsx`

React Email template w stylu marki Edooqoo:
- Tło `#ffffff`
- Akcent: kolor primary z `index.css` (przeczytam i zastosuję inline)
- Heading: powitanie + imię (jeśli jest)
- Sekcja 1: "What you can do now" — 3 bullety (generate worksheet, add student, share homework)
- CTA Button → `${APP_BASE_URL}/dashboard`
- Sekcja 2: zasoby (link do How it works, Glossary)
- Stopka: kontakt + adres firmy (wymaganie CAN-SPAM przy mailach od domeny brandowej)
- Bez unsubscribe (welcome jest transactional/jednorazowy, recipient właśnie się zarejestrował)

### 3. Tabela: `email_send_log` (jeśli nie istnieje)

Sprawdzę przez `supabase--read_query` czy tabela już jest (od istniejących maili Resend). Jeśli nie — migracja:

```
- email_send_log (id uuid pk, recipient_email text, template_name text,
  status text check in ('pending','sent','failed'),
  provider_message_id text, error_message text, sent_at timestamptz,
  created_at timestamptz default now())
- index na (recipient_email, template_name)
- RLS: tylko service_role read/write (zero dostępu z klienta)
```

### 4. Trigger DB: wysyłka po potwierdzeniu emaila

Strategia (sprawdzona w innych projektach Lovable, kompatybilna):

**Trigger na `auth.users` AFTER UPDATE** — gdy `email_confirmed_at` przechodzi z NULL na NOT NULL:

```sql
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_signup_source text;
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    v_signup_source := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
    -- Wywołanie edge function przez net.http_post (pg_net)
    PERFORM net.http_post(
      url := current_setting('app.settings.welcome_email_url'),
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-internal-secret', current_setting('app.settings.welcome_email_secret')
      ),
      body := jsonb_build_object(
        'email', NEW.email,
        'firstName', NEW.raw_user_meta_data->>'first_name',
        'signupSource', v_signup_source
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_email_confirmed
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();
```

**Timing rozróżnienie email vs Google OAuth:**
- Email signup: `email_confirmed_at` ustawia się po kliknięciu w link → mail leci natychmiast (to jest moment, w którym user "wszedł")
- Google OAuth: Supabase ustawia `email_confirmed_at` od razu przy callbacku → mail leci natychmiast (5-min opóźnienie z poprzedniej iteracji planu odpada — użytkownik OAuth nie potrzebuje "remindera o sprawdzeniu skrzynki")

Jeśli użytkownik usunie konto i założy ponownie — `email_send_log` zapobiegnie duplikatowi (idempotencja per email).

### 5. Settings DB

`ALTER DATABASE` ustawia:
- `app.settings.welcome_email_url` = `https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/send-welcome-email`
- `app.settings.welcome_email_secret` = wartość z `WELCOME_EMAIL_SECRET` (przekażę w migracji jako placeholder, wartość ustawi user przez add_secret)

### 6. Sekret

Nowy secret `WELCOME_EMAIL_SECRET` (random 32-char) — używany do walidacji `x-internal-secret` w edge function. Poproszę przez `add_secret` po zatwierdzeniu planu.

### 7. Test end-to-end

Po wdrożeniu:
- `supabase--curl_edge_functions` z poprawnym `x-internal-secret` → status 200, log w `email_send_log`
- Bez secretu → 401
- Powtórne wywołanie z tym samym emailem → 200 z `{ skipped: true }` (idempotencja)
- Manualny test trigger: `UPDATE auth.users SET email_confirmed_at=now() WHERE id='...'` na test userze → mail przychodzi

---

## Blok D — Dokumentacja

### 1. `docs/llm-context.md`

Nowa sekcja w v6.9.7:
- **Problem:** New users had no personalized onboarding email; Supabase default confirmation email was generic
- **Edooqoo Solution:** Branded welcome email via Resend, fired on email confirmation, idempotent per recipient
- **Technical Mechanics:** trigger `on_user_email_confirmed` → `pg_net.http_post` → `send-welcome-email` edge function → Resend REST API → log in `email_send_log`. Source rozróżnia email/google OAuth via `raw_app_meta_data->>'provider'`.
- **RAG Keywords:** welcome email, post-signup, email confirmation, transactional email, Resend, onboarding mail, hello@edooqoo.com

### 2. `llms.txt`

Aktualizacja sekcji "Latest version" — dodać Welcome Email do v6.9.7.

### 3. Memory

Nowy plik `mem://features/email/welcome-email-pipeline`:
- Trigger DB jest jedynym źródłem wysyłki — nie wywoływać `send-welcome-email` z klienta
- `email_send_log` zapewnia idempotencję — nigdy nie ścierać tej tabeli
- Resend `from` musi pozostać `hello@edooqoo.com` (zweryfikowana skrzynka)
- Sekret `WELCOME_EMAIL_SECRET` chroni endpoint — nigdy nie hardcodować

Aktualizacja `mem://index.md` — dodać wpis do Memories.

---

## Brak regresji — checklist

- Trigger działa tylko AFTER UPDATE OF `email_confirmed_at` (NULL → NOT NULL) — istniejący userzy z już potwierdzonym mailem NIE dostaną maila przy żadnej innej zmianie
- Edge function jest niezależna — żadne istniejące funkcje nie są modyfikowane
- `email_send_log` (jeśli już istnieje od homework/bug report) — używamy istniejącej, dodajemy tylko `template_name='welcome_email'`
- Jeśli `pg_net` extension nie jest aktywne — migracja je włączy (`CREATE EXTENSION IF NOT EXISTS pg_net`)
- Resend rate limit (10 req/sec na default) — welcome ma <1 req/min realnie, brak ryzyka
- Brak zmian w `format-worksheet-prompt`, demo lazy loading, vite config, sourcemap, logger

---

## Kolejność wykonania

1. Migracja DB: `email_send_log` (jeśli brak) + `pg_net` extension + trigger + GUC settings
2. `add_secret` → `WELCOME_EMAIL_SECRET`
3. Stworzenie `_shared/email-templates/welcome.tsx`
4. Stworzenie `send-welcome-email/index.ts` + wpis w `config.toml`
5. Deploy `send-welcome-email`
6. Aktualizacja `app.settings.welcome_email_secret` (osobna migracja po dodaniu secretu)
7. Test curl + test trigger na test userze
8. Aktualizacja docs (llm-context, llms.txt, mem)

Po Twojej zgodzie wykonam wszystko w jednej sesji build mode.
