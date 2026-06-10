## Plan wdrożenia v6.9.52 — naprawa generowania worksheet dla niezalogowanych

### Affected surface
- `supabase/functions/format-worksheet-prompt/index.ts` — główna przyczyna błędu; funkcja wymaga teraz prawdziwego user JWT nawet dla publicznego generatora.
- `src/utils/promptFormatter.ts` — klient musi wysyłać stabilny publiczny klucz w `apikey` i nie może zakładać, że anon key jest poprawnym user session JWT.
- `docs/llm-context.md` — RAG injection po naprawie.
- `public/llms.txt` — skrót RAG/LLM index po naprawie.
- `mem/index.md` + nowy memory file — trwała reguła dla przyszłych agentów, żeby nie przywrócić tego regresu.
- Bez zmian w `supabase/functions/generateWorksheet/index.ts` — nie dotykam Worksheet Generation Engine ani protected prompt pipeline.

### Root cause
`format-worksheet-prompt` ma `verify_jwt = false`, więc request dociera do funkcji, ale kod funkcji nadal robi `supabase.auth.getUser(token)`, co odrzuca anonimowy Supabase anon/publishable key jako niebędący sesją użytkownika; poprzednia poprawka zmieniła nagłówki klienta, ale nie zmieniła serwerowego warunku autoryzacji.

### Do I know what the issue is?
Tak. To nie jest problem `generateWorksheet`, nie jest problem tokenów i nie jest problem CORS. To wewnętrzna autoryzacja `format-worksheet-prompt`: anonimowy generator potrzebuje publicznego trybu dostępu, a funkcja ma obecnie wyłącznie tryb zalogowanego użytkownika.

## Solution options

| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A. Dodać dual-auth w `format-worksheet-prompt` | Funkcja akceptuje prawdziwy user JWT dla zalogowanych oraz anon/publishable key w `apikey` dla publicznego generatora. Rate limit: `user:<id>` albo `anon:<ip/fallback>`. | Najmniejsza zmiana, zachowuje obecny przepływ, naprawia dokładnie błąd 401. Prompt formatter nadal zwraca prompt do klienta, czyli utrzymujemy obecny kompromis IP z v6.9.7/v6.9.51. | Low |
| B. Przenieść formatowanie promptu do `generateWorksheet` dla anonimowych | Klient dla anon nie wywołuje `format-worksheet-prompt`; wysyła `formData`, a serwer buduje prompt wewnętrznie. | Lepsze IP-hardening, ale dotyka runtime generowania i wymaga większego refaktoru wokół chronionego pipeline. Większe ryzyko naruszenia Sanctity Rule. | Medium/High |
| C. Wyłączyć auth check w `format-worksheet-prompt` całkowicie | Funkcja publicznie buduje prompt bez sprawdzania nagłówków. | Najszybsze, ale zbyt szerokie; ułatwia scraping i usuwa sens poprzedniego IP-hardening. | Medium |

## Selected solution + why
Wybieram **Opcję A**. To jest najbezpieczniejszy punktowy fix: nie rusza Worksheet Generation Engine, nie zmienia semantyki promptu, nie ingeruje w `generateWorksheet`, a naprawia strukturalny błąd autoryzacji, który powoduje 401 dla niezalogowanych.

## Impact analysis
- Zalogowani nauczyciele: nadal użyją prawdziwego session JWT, więc ich flow zostaje bez zmian.
- Niezalogowani użytkownicy z homepage/custom domain: publiczny generator dostanie 200 z `format-worksheet-prompt`, a potem przejdzie do istniejącego `generateWorksheet`.
- Edge Function logs: po zmianie dodam neutralne `console.log` tylko dla trybu auth/anon/rate-limit, bez danych ucznia i bez promptu.
- Security/IP: nie robię endpointu całkowicie otwartego; anonimowy tryb wymaga poprawnego Supabase anon/publishable key i ma osobny rate-limit key.
- Zero regressions confirmed to check during implementation:
  - `verify_jwt = false` pozostaje w `supabase/config.toml`.
  - `OPTIONS` nadal zwraca CORS.
  - Authenticated `Authorization: Bearer <user access token>` nadal działa.
  - Anonymous `Authorization: Bearer <anon key>` + `apikey: <anon key>` zacznie działać.
  - `generateWorksheet` streaming request zostaje nietknięty.
  - No Worksheet Generation Engine prompt/logic change.

## Full implementation plan

### 1. Edge Function: `format-worksheet-prompt`
W `supabase/functions/format-worksheet-prompt/index.ts` przebuduję tylko blok autoryzacji.

Docelowy mechanizm:
1. Odczytaj:
   - `Authorization`
   - bearer token, jeśli istnieje
   - `apikey`
   - `SUPABASE_ANON_KEY`
   - IP z `x-forwarded-for`, `cf-connecting-ip`, fallback `unknown`
2. Spróbuj trybu zalogowanego:
   - jeśli bearer token istnieje i nie jest anon key, wykonaj `supabase.auth.getUser(token)`.
   - jeśli sukces: `rateLimitKey = user:<user.id>`.
3. Jeśli tryb user nie przeszedł, spróbuj trybu publicznego generatora:
   - zaakceptuj tylko request, w którym `apikey === SUPABASE_ANON_KEY` albo bearer token równa się `SUPABASE_ANON_KEY`.
   - ustaw `rateLimitKey = anon:<ip>`.
4. Jeśli oba tryby failują: zwróć `401 Unauthorized`.
5. `checkRateLimit(rateLimitKey)` zostaje, ale zmienia nazwę parametru z `userId` na `key`, żeby nie mieszać anon z user.
6. `buildPrompt` bez zmian — nie zmieniam prompt wording ani generator engine.

### 2. Client wrapper: `src/utils/promptFormatter.ts`
Ustabilizuję fallback publicznego klucza:
- `const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;`
- Jeśli brakuje obu: rzucić czytelny błąd `Supabase public key is missing`.
- Dla zalogowanych: `Authorization: Bearer <session access_token>` i `apikey: anonKey`.
- Dla niezalogowanych: `Authorization: Bearer <anonKey>` i `apikey: anonKey`.
- Zachować retry-once-after-250ms.
- Nie logować promptu ani danych ucznia.

### 3. Verification
Po implementacji wykonam:
1. Deploy/test funkcji `format-worksheet-prompt` przez Supabase tool, żeby nie czekać biernie na automatyczny deploy.
2. Test anonimowy przez `supabase.curl_edge_functions`:
   - `POST /format-worksheet-prompt`
   - headers: `Authorization: Bearer <anon key>`, `apikey: <anon key>`
   - expected: `200` i JSON z `prompt`.
3. Test złego tokenu:
   - `Authorization: Bearer invalid`, `apikey: invalid`
   - expected: `401`.
4. Opcjonalny smoke z preview: wygenerowanie worksheet jako niezalogowany tylko do momentu potwierdzenia, że `format-worksheet-prompt` już nie zwraca 401.

### 4. RAG injection
Zaktualizuję:
- `docs/llm-context.md`
- `public/llms.txt`
- `mem/index.md`
- nowy memory file: `mem/features/onboarding/v6952-anonymous-format-prompt-dual-auth.md`

Treść RAG będzie w English i w wymaganym formacie:
- `PROBLEM:` anonymous worksheet generation failed before generation because `format-worksheet-prompt` accepted only real user JWTs.
- `EDOOQOO SOLUTION:` dual-auth Edge Function mode for authenticated teachers and public anonymous generator.
- `TECHNICAL MECHANICS:` files/functions/headers/rate-limit behavior.
- `RAG KEYWORDS:` minimum 15 semantic terms.

## Scope lock
Out of scope issues noted:
- Nie zmieniam modal UI ani WorkflowSummaryCard.
- Nie zmieniam `generateWorksheet` promptu, parametrów ani pipeline.
- Nie przenoszę całej architektury prompt formatting do `generateWorksheet` w tym kroku.
- Nie naprawiam innych potencjalnych 401 w media generation, bo aktualny stack trace wskazuje wyłącznie `format-worksheet-prompt`.

## Verification checklist
- Anonymous `format-worksheet-prompt` no longer returns 401: TODO in build mode.
- Authenticated path remains supported: TODO in build mode.
- Invalid credentials still rejected: TODO in build mode.
- Worksheet Generation Engine untouched: TODO in build mode.
- RAG docs updated: TODO in build mode.

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>