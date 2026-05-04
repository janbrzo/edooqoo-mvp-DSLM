# Plan v6.9.7 — Ochrona IP + Spersonalizowany Email Powitalny

## Kontekst i ocena ryzyka

### Co realnie może wyciec z przeglądarki (audyt)

Każda aplikacja React/Vite jest **klientem JavaScript** — cały kod renderowany w przeglądarce jest z definicji widoczny (View Source, DevTools → Sources, Network). Nie da się tego "zaszyfrować". Ale można **przesunąć wartościowe IP na backend**, żeby plagiator dostał tylko skorupę UI bez "mózgu". Audyt obecnego stanu Edooqoo:


| Element                                                                                                     | Gdzie jest dziś               | Ryzyko                                                                                  | Co robimy                                             |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Worksheet Generation Engine prompt** (sanctity)                                                           | ✅ Edge Function (Supabase)    | Niskie — niewidoczny dla klienta                                                        | Bez zmian (sanctity rule)                             |
| `**src/utils/promptFormatter.ts**` — formatowanie inputu + szczegółowe instrukcje "language style 1-5"      | ❌ Bundle klienta              | **WYSOKIE** — to część metodyki Marthy, plagiator dostaje ją gratis                     | Przenieść do Edge Function `format-worksheet-prompt`  |
| `**src/data/demoWorksheetContent.ts**` (~950 KB) — 10 pełnych produkcyjnych worksheetów z `ai_response`     | ❌ Bundle klienta (lazy chunk) | **ŚREDNIE** — pokazuje dokładny output Engine, ale to materiały demo, świadomy showcase | Lazy-load + dynamic import, brak zmian merytorycznych |
| `**src/lib/exerciseTaxonomy.ts**` + `constants/featurePromptCopy.ts`                                        | Bundle klienta                | Niskie — to taksonomia widoczna i tak w UI                                              | Bez zmian                                             |
| **Mock data** (`src/mockWorksheetData.ts`, `mockNewExercisesData.ts`)                                       | Bundle klienta                | Średnie — pokazują strukturę odpowiedzi                                                 | Tree-shake — używać tylko w trybie dev/demo           |
| **467 wystąpień `console.log`/`console.warn**` — m.in. `📝 Formatting prompt for AI with data:` w produkcji | Bundle + runtime              | **WYSOKIE** — wyciek user IDs, emaili, pełnych form data, struktur AI w DevTools        | Migracja na `devLog/devWarn` (no-op w prod)           |
| **Supabase anon key + URL**                                                                                 | `client.ts`                   | Brak ryzyka — to publishable key, RLS chroni dane                                       | Bez zmian                                             |
| **Edge Function names** w Network tab                                                                       | DevTools                      | Brak ryzyka — i tak chronione przez JWT/RLS                                             | Bez zmian                                             |
| **Source maps**                                                                                             | `dist/*.map` (build)          | Średnie — pokazuje czytelny kod TS                                                      | Wyłączyć w prod build                                 |
| **Fake demo emails** w `demoData.ts`                                                                        | Bundle                        | Brak — celowo demo                                                                      | Bez zmian                                             |


**Werdykt strategiczny (Critical Advisor):** Twoje główne IP (Worksheet Engine prompt) jest już bezpieczne na serwerze. Realne wycieki to: (a) `promptFormatter.ts` z metodyką andragogiczną Marthy, (b) gadatliwe `console.log` zalewające DevTools danymi userów + strukturami AI, (c) sourcemapy w prod. Te 3 rzeczy łatamy. Reszta to UI/szkielet — plagiator i tak musiałby zbudować Engine od zera. **Nie warto inwestować w obfuskację** (false sense of security, łamie dev experience, +5-10% bundle, debug w prod = piekło).

### Email powitalny — stan obecny

- Signup (`src/pages/Signup.tsx`) zapisuje `first_name`, `last_name`, `school_institution` w `auth.users.user_metadata`.
- Po rejestracji email/Google → Supabase wysyła **domyślny generyczny** email konfirmacyjny ("Confirm your signup") bez brandingu Edooqoo.
- **Po potwierdzeniu emaila NIE MA dedykowanego welcome maila.**
- Domena `edooqoo.com` jest custom domeną Lovable, ale **nie została jeszcze skonfigurowana jako email domain** (sprawdzone tooling — workspace nie ma żadnej email domain).
- Nie istnieje folder `supabase/functions/` — to pierwsza Edge Function w projekcie.

---

## Rozwiązanie

### CZĘŚĆ 1 — Hardening IP (3 łatki, bez zmian funkcjonalnych)

#### 1.1 Przeniesienie `promptFormatter` na backend

**Nowa Edge Function:** `supabase/functions/format-worksheet-prompt/index.ts`

- Przyjmuje `FormData` z UI, zwraca `{ formattedPrompt: string }`.
- Cała logika "language style 1-5" + opisy stylów + exercise focus map → po stronie serwera.
- Walidacja JWT (zalogowany user) + rate limit (przez RLS na `worksheet_history`).
- Klient (`useWorksheetGeneration.tsx`) wywołuje `supabase.functions.invoke('format-worksheet-prompt', { body: data })` zamiast lokalnej funkcji.

**Plik `src/utils/promptFormatter.ts`:** redukujemy do thin wrappera, który wywołuje Edge Function. Stara implementacja kasowana. 

**Zachowanie kompatybilności:** sygnatura wejścia/wyjścia bez zmian dla `WorksheetForm`. `useWorksheetGeneration` zyskuje await na wywołanie funkcji (już jest async — zerowy regress).

#### 1.2 Czyszczenie console.log w produkcji

- Utworzyć skrypt `scripts/codemod/replace-console.mjs` (jeden run, jednorazowo) — zamienia w `src/**/*.{ts,tsx}` (z wyłączeniem `src/utils/logger.ts`):
  - `console.log(` → `devLog(` + auto-import `import { devLog } from '@/utils/logger'`
  - `console.warn(` → `devWarn(`
  - `console.error` **zostaje** (krytyczny debug w prod)
- Ręczne wyjątki: pliki edge functions, testy, Sentry-style.
- Po codemocie: `rg "console\.(log|warn)" src/ | wc -l` musi = 0.

#### 1.3 Vite production build hardening

W `vite.config.ts` w sekcji `build`:

```ts
build: {
  sourcemap: false,           // brak .map w prod
  minify: 'esbuild',
  target: 'es2020',
  rollupOptions: {
    output: {
      // demo content jako osobny chunk, ładowany tylko dla /demo
      manualChunks: (id) => {
        if (id.includes('demoWorksheetContent')) return 'demo-content';
        if (id.includes('mockWorksheet') || id.includes('mockNewExercises')) return 'mock-data';
      }
    }
  },
  esbuild: { drop: ['debugger'] }
}
```

Plus: `src/data/demoWorksheetContent.ts` ładowane przez `await import()` w `buildDemoData()` (już dziś jest statyczny import — zmiana na lazy).

#### 1.4 Co świadomie odrzucamy (i dlaczego)

- ❌ **Obfuskacja kodu (javascript-obfuscator):** koszt > korzyść, łamie sourcemapy dla legit błędów, +20% bundle, false security.
- ❌ **Disable DevTools / right-click:** dziecinne, łatwo obejść, psuje UX.
- ❌ **Watermarking JS:** ślad legalny, ale nie chroni przed plagiatem UI.
- ❌ **Server-side rendering całego dashboardu:** ogromna refaktoryzacja, niespójne z architekturą Vite SPA, sanctity violation.

---

### CZĘŚĆ 2 — Spersonalizowany Email Powitalny

#### 2.1 Konfiguracja email domain (prerequisite)

Domena `edooqoo.com` jest custom domeną projektu, ale workspace nie ma jeszcze skonfigurowanej email domain. **Pierwszy krok implementacji:** otworzyć dialog setup email domain dla `edooqoo.com` (DNS będzie weryfikowany w tle). Bez tego scaffold nie zadziała.

Sender: `Edooqoo <hello@edooqoo.com>` (lub `welcome@`, do potwierdzenia po setup — tool dobierze automatycznie sender wg config domeny).

#### 2.2 Brandowane szablony auth (6 templates)

Scaffold: `email_domain--scaffold_auth_email_templates`. Tworzy:

- `supabase/functions/auth-email-hook/index.ts`
- `supabase/functions/_shared/email-templates/` × 6 (signup, magic-link, recovery, invite, email-change, reauthentication)

**Branding (z `src/index.css` + tailwind config):**

- Primary: `worksheet-purple` (HSL z tokens) — buttony
- Background body: `#ffffff` (zawsze, nawet jeśli app ma dark)
- Logo: `public/logo.png` lub `src/assets/` (sprawdzić podczas implementacji) → upload do `email-assets` bucket w Storage
- Font stack: `Inter, -apple-system, sans-serif`
- Border radius: `--radius` (8px)

**Personalizacja w szablonie `signup.tsx` (welcome email):**

- Nagłówek: `Welcome to Edooqoo, {{ first_name }}!`
- Body (andragogiczny ton, nie "school-like"):
  > Hi {{ first_name }},
  >
  > You're now part of a community of professional English tutors who specialize in 1-on-1 adult education.
  >
  > **Your account is ready** → confirm your email to unlock 2 free worksheet tokens.
  >
  > [Confirm email & start →]
  >
  > Once you're in, here's what most tutors do first:
  >
  > 1. Generate your first worksheet (90 seconds, fully editable)
  > 2. Share it with a student via `edooqoo.com/my` — no login needed for them
  > 3. Track their homework, flashcards, and progress in one dashboard
  >
  > Edooqoo team
- Footer: link Privacy / Terms / Unsubscribe (Lovable wstawia automatycznie dla auth)

**Dane do template:**

- `siteName`, `siteUrl`, `recipient`, `confirmationUrl` — auto z auth hook
- `first_name` — wyciągamy z `user_metadata.first_name` w `auth-email-hook/index.ts` (przekazany w `signUp({ data: { first_name }})` — już jest w `Signup.tsx`)
- Google OAuth: `first_name` pobieramy z `user_metadata.given_name` (Google fill) jako fallback

#### 2.3 Drugi mail — "Welcome (post-confirmation)"

Domyślny `signup.tsx` to mail **konfirmacyjny** (przed kliknięciem linku). Po potwierdzeniu emaila chcemy **drugi, czysto powitalny mail** z onboardingiem (bez CTA "confirm"). Architektura:

**Trigger:** Database trigger na `auth.users` → przy `email_confirmed_at IS NOT NULL` (UPDATE) → wywołuje Edge Function przez `pg_net` lub enqueue do `pgmq`.

**Implementacja:**

1. Migration: trigger `on_user_email_confirmed` po UPDATE `auth.users`, gdy `OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL`.
2. Trigger wywołuje funkcję bazodanową `enqueue_welcome_email(user_id, email, first_name)` — wrzuca do kolejki `pgmq` (jeśli setup_email_infra utworzył) lub bezpośrednio invokes Edge Function.
3. Nowa Edge Function `send-welcome-email`: renderuje template `_shared/email-templates/welcome.tsx` (post-confirmation, oddzielny od `signup.tsx`), wysyła przez Lovable Email API.

**Template `welcome.tsx**` (post-confirmation):

- Brak CTA "confirm"
- "Your free tokens are loaded. Generate your first worksheet."
- 3 bullety z linkami: Generate worksheet / Add first student / Try demo
- Mocne CTA: `[Open dashboard →]({{site_url}}/dashboard)`
- PS od Marthy z 1 zdaniem heurystyki: *"Tip: the more specific your student's professional context, the sharper the worksheet. We optimize for adults, not classrooms."*

#### 2.4 Lokalizacja first_name — fallback

Jeśli `first_name` puste (rzadki case Google OAuth bez given_name):

- Fallback: `email.split('@')[0]` z capitalize
- Edge case: jeśli email = `john.doe@x.com` → `John`

---

## Pliki do utworzenia / zmiany

**Nowe:**

- `supabase/functions/format-worksheet-prompt/index.ts` (CZĘŚĆ 1.1)
- `supabase/functions/auth-email-hook/index.ts` (scaffold)
- `supabase/functions/auth-email-hook/deno.json` (scaffold)
- `supabase/functions/_shared/email-templates/signup.tsx` (scaffold + branding)
- `supabase/functions/_shared/email-templates/{magic-link,recovery,invite,email-change,reauthentication}.tsx` (scaffold + branding)
- `supabase/functions/_shared/email-templates/welcome.tsx` (NOWY — post-confirmation)
- `supabase/functions/send-welcome-email/index.ts` (CZĘŚĆ 2.3)
- Migration SQL: trigger `on_user_email_confirmed`
- `scripts/codemod/replace-console.mjs` (CZĘŚĆ 1.2, jednorazowy)
- `mem/features/security/ip-protection-hardening.md`
- `mem/features/email/welcome-email-pipeline.md`

**Edytowane:**

- `src/utils/promptFormatter.ts` → thin wrapper na Edge Function
- `src/hooks/useWorksheetGeneration.tsx` → await na nowy call
- `vite.config.ts` → sourcemap: false, manualChunks, drop debugger
- `src/data/demoData.ts` → `await import('./demoWorksheetContent')` (lazy)
- `supabase/config.toml` → rejestracja 3 nowych funkcji
- `src/pages/Signup.tsx` → komentarz że welcome mail wysyłany automatycznie po confirm
- ~80-150 plików `src/**/*.{ts,tsx}` — codemod console.log → devLog (auto)
- `docs/llm-context.md` → sekcja v6.9.7
- `llms.txt` → bump version
- `mem/index.md` → 2 nowe wpisy

---

## Sekcja techniczna (dla weryfikacji)

### Sequence: Welcome Email Pipeline

```text
User → Signup form → supabase.auth.signUp({ data: { first_name }})
  ↓
Supabase Auth → confirmation email (auth-email-hook → signup.tsx template, branded)
  ↓
User clicks link → email_confirmed_at = now()
  ↓
Trigger on_user_email_confirmed → enqueue_welcome_email(...)
  ↓
pgmq queue → cron → send-welcome-email Edge Function
  ↓
welcome.tsx rendered → Lovable Email API → user inbox
```

### Google OAuth path

- Google signup: `email_confirmed_at` ustawiane natychmiast → trigger pali od razu → welcome mail wysyłany w ciągu ~30s.
- Brak konfirmacyjnego maila (Google już zweryfikował) — to jest poprawne UX.

### RLS / Security

- Edge Function `format-worksheet-prompt`: wymaga JWT (verify_jwt: true w config.toml).
- Edge Function `send-welcome-email`: `verify_jwt: false` (wywoływana przez pg_net z service role key w headerach).
- Trigger używa `security definer` z `set search_path = public`.

### Sanctity check

- Worksheet Engine prompt **NIE jest dotykany**. Zmiana 1.1 dotyczy jedynie *formatowania inputu od usera* (language style guidelines), nie głównego prompta.

---

## Kolejność implementacji (atomic commits)

1. Codemod console.log → devLog (CZĘŚĆ 1.2)
2. vite.config.ts hardening (CZĘŚĆ 1.3)
3. Edge Function `format-worksheet-prompt` + thin wrapper (CZĘŚĆ 1.1)
4. Setup email domain dla `edooqoo.com` (dialog)
5. Scaffold auth email templates + branding (CZĘŚĆ 2.2)
6. Welcome email template + Edge Function + trigger (CZĘŚĆ 2.3)
7. Deploy edge functions
8. Update `docs/llm-context.md`, `llms.txt`, `mem/`

---

## Pytanie kontrolne (potrzebne PRZED implementacją)

1. **Sender address welcome maila:** `hello@edooqoo.com`, `welcome@edooqoo.com`, czy `martha@edooqoo.com` (bardziej osobiste, zgodne z personą Marthy)? `hello@edooqoo.com`
2. **Welcome mail po Google OAuth:** wysyłać natychmiast, czy z 5-min delay (uniknąć "spam-vibe")? 5-min delay
3. **Tekst welcome maila:** zatwierdzasz draft powyżej, czy podać 2-3 alternatywne warianty tonu (np. krótszy / cieplejszy / bardziej business)? zmieniłem draft

Po Twoich odpowiedziach wchodzę w implementację bez kolejnych pytań.