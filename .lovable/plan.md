## Diagnoza po odczycie kodu

### Affected surface

- `.github/workflows/cloudflare-worker-deploy.yml`
- `.github/workflows/seo-integrity.yml` — tylko kontrolnie, nie musi być zmieniany dla tego konkretnego błędu
- `.github/workflows/seo-monitoring.yml` — tylko kontrolnie, nie musi być zmieniany dla tego konkretnego błędu
- `package.json`
- `supabase/functions/audit-llm-models/index.ts`
- `supabase/functions/send-model-audit-email/index.ts`
- `supabase/functions/_shared/aiChat.ts`
- `supabase/functions/classify-knowledge-entry/index.ts`
- `supabase/functions/suggest-exercises/index.ts`
- `supabase/functions/verify-open-answers/index.ts`
- `supabase/functions/process-welcome-test/index.ts`
- `scripts/audit-llm-models.ts`
- `docs/llm-context.md`
- `public/llms.txt`
- `mem/infrastructure/model-health-monitoring.md`

### Root cause

`Cloudflare Worker Deploy #7` nie pada już na `npm ci`; pada screenie i w workflow widać, że pada w kroku `Build static assets`, bo workflow uruchamia bezpośrednio `vite build`, a w shellu GitHub Actions lokalny bin `node_modules/.bin/vite` nie jest automatycznie w `PATH`; `vite` jest dostępny poprawnie przez `npm run build` albo `npx vite build`.

Drugi problem jest koncepcyjny: ostatnia zmiana w audycie Lovable Gateway była głównie zmianą klasyfikacji raportu (`FAIL` → `EXPECTED`) dla dwóch probe'ów, które nadal fizycznie pingują `https://ai.gateway.lovable.dev`. To nie przełącza ruchu aplikacji na inny model. Realny hot path aplikacji jest już w `aiChat.ts` ustawiony na direct Gemini (`GEMINI_API_KEY`) z fallbackiem OpenAI, ale monthly audit nadal trzyma dwa zimne probe'y Lovable Gateway jako obserwacyjny test „czy gateway wrócił”. Masz rację: jeśli strategiczna decyzja brzmi „nie korzystamy z Lovable AI / brak credits jest normalny”, to lepsze jest usunięcie tych probe'ów z audytu albo zastąpienie ich direct-provider smoke testami, nie malowanie ich na bursztynowo.

## Odpowiedź praktyczna: co zmieniliśmy przy `EXPECTED`

Zmieniliśmy trzy rzeczy:

1. Dla dwóch miesięcznych Lovable Gateway probe'ów dodano:
   - `optional: true`
   - `expectedFailureStatuses: [401, 402, 403]`
2. Email audit przestał liczyć te odpowiedzi jako `failed`.
3. Tabela `model_health_checks` dostała `expected = true`, żeby dało się odróżnić „oczekiwany brak kredytów” od realnej awarii.

Czego to NIE zrobiło:

- nie zmieniło modelu używanego przez aplikację;
- nie przeniosło tych dwóch probe'ów z Lovable Gateway na direct Gemini/OpenAI;
- nie usunęło zależności raportowej od `LOVABLE_API_KEY`;
- nie udowodniło, że direct Gemini/OpenAI działają w dokładnie takim samym request shape jak aplikacja.

Wniosek: jako etap awaryjny to było użyteczne, żeby raport nie krzyczał fałszywym `2/12 failed`. Jako finalny stan operacyjny — nie jest wystarczająco czyste. Poprawny finalny stan: monthly audit nie powinien pingować Lovable Gateway, skoro nie chcemy używać Lovable AI.

## Solution options

| Opcja | Zakres | Plusy | Minusy | Ryzyko regresji |
|---|---|---|---|---|
| A. Minimalny fix workflow | Zmienić `vite build` na `npm run build` w `cloudflare-worker-deploy.yml` | Natychmiast naprawia `exit code 127`; najmniejsza zmiana | Nie czyści audytu Lovable Gateway | Niskie |
| B. Workflow fix + pełne oczyszczenie monthly audit | Fix `vite build`; usunąć `lovable-gateway` z monthly audit; zastąpić je direct Gemini/OpenAI smoke probes lub po prostu opierać monthly na direct modelach już w `TARGETS_DAILY` | Zgodne ze strategią „bez Lovable credits”; raport przestaje mieszać stan nieużywanego providera z realnym zdrowiem aplikacji | Trzeba ostrożnie zmienić mail/report docs, żeby historyczne `expected` nie myliło | Niskie/średnie |
| C. Zostawić Lovable probe jako `EXPECTED` | Nic nie ruszać w audycie poza workflow | Zachowuje sygnał, że Lovable credits wróciły | Dalej mentalnie zaśmieca raport providerem, którego nie chcemy używać | Średnie operacyjnie |

## Selected solution + why

Wybieram opcję B.

Powód: naprawa `vite build` rozwiązuje tylko obecny failure GitHub Actions. Natomiast Lovable Gateway w monthly audit jest sprzeczny z Twoją decyzją produktowo-operacyjną: Edooqoo ma działać na direct Gemini/OpenAI API, bez zależności od credits Lovable. Raport monitoringowy ma pokazywać zdrowie realnego systemu, a nie „oczekiwaną awarię” nieużywanego providera.

## Plan implementacji

### P1 — Naprawa `Cloudflare Worker Deploy #7`

1. W `.github/workflows/cloudflare-worker-deploy.yml` zmienić krok:

```yaml
- name: Build static assets
  run: vite build
```

na:

```yaml
- name: Build static assets
  run: npm run build
```

2. Zachować obecne env:

```yaml
VITE_SUPABASE_URL: https://bvfrkzdlklyvnhlpleck.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
VITE_SUPABASE_PROJECT_ID: bvfrkzdlklyvnhlpleck
```

3. Nie zmieniać sekretów Cloudflare — ten failure nie dotarł jeszcze do `wrangler deploy`; obecnie błąd jest wcześniej, w buildzie statycznych assetów.

4. Po wdrożeniu: ręcznie uruchomisz ponownie:

```text
GitHub → Actions → Cloudflare Worker Deploy → Run workflow → branch main → Run workflow
```

Oczekiwany efekt: krok `Build static assets` przechodzi; jeśli pojawi się kolejny błąd, będzie już w `Deploy Worker and route bindings` albo `Verify live routing`, czyli będzie to inna warstwa problemu.

### P2 — Oczyszczenie `audit-llm-models` z Lovable Gateway

1. W `supabase/functions/audit-llm-models/index.ts` usunąć `lovable-gateway` z typu providerów, jeśli nie jest potrzebny w tej funkcji:

```ts
type Provider = "openai" | "google" | "google-vertex";
```

2. Usunąć z `TARGETS_MONTHLY` oba wpisy:

```ts
{ provider: "lovable-gateway", model: "google/gemini-2.5-flash", ... }
{ provider: "lovable-gateway", model: "google/gemini-3-flash-preview", ... }
```

3. Zaktualizować komentarz miesięcznego audytu:

- przed: monthly includes cold Lovable Gateway probes;
- po: monthly checks only direct providers used or reserved by Edooqoo: Google Generative Language, OpenAI, Google Vertex.

4. Usunąć z `ping()` gałąź Lovable Gateway albo zostawić tylko jeśli inne targety jej używają. Ponieważ w tej funkcji po usunięciu targetów nie będzie już żadnego `lovable-gateway`, finalnie najlepiej usunąć całą gałąź z `LOVABLE_API_KEY`, żeby monitoring nie był zależny od tego sekretu.

5. Zostawić obsługę `expected` w tabeli i mailu jako neutralny mechanizm historyczny/future-proof, ale monthly audit nie powinien już mieć expected Lovable rows. Dzięki temu stare rekordy pozostaną zrozumiałe, a nowe raporty będą czyste.

6. Oczekiwany nowy monthly count:

- obecnie: `12` modeli, w tym `2` Lovable Gateway probe'y;
- po zmianie: `10` modeli, jeśli zostawiamy `TARGETS_DAILY` + jeden Vertex fallback;
- status maila powinien wyglądać mniej więcej: `0/10 failed`, bez `Expected: 2`.

### P3 — Wzmocnienie audytu: direct-provider smoke checks zamiast Lovable Gateway

Żeby nie skończyć tylko na metadanych `/models`, dodam jednoznaczne rozróżnienie:

1. `google` metadata check — obecne `models.get`, tanie, bez generowania treści.
2. `openai` metadata check — obecne `/v1/models/<id>`, tanie.
3. `google-vertex` metadata check — obecny publisher metadata endpoint.
4. Direct smoke check dla realnego helpera `aiChat` — miesięcznie lub jako osobny target techniczny:
   - minimalny Gemini `generateContent` dla `gemini-2.5-flash` z krótkim `ping`;
   - minimalny OpenAI chat completion fallback dla `gpt-4o-mini` z krótkim `ping`.

To jest ważniejsze niż pingowanie Lovable Gateway, bo sprawdza realny kształt requestów, których używa aplikacja.

Żeby nie zwiększać kosztów bez potrzeby, smoke check ma być minimalny:

```text
input: "Return OK."
max output tokens: 2-5
monthly only, nie daily
```

Jeżeli chcesz absolutnie zero kosztu w monthly audycie, pomijamy smoke checks i zostajemy przy metadata checks. Moja rekomendacja: minimalny monthly smoke check jest wart groszowego kosztu, bo wykrywa błędy request body, których endpoint metadata nie wykryje.

### P4 — Usunięcie fałszywych zależności od `LOVABLE_API_KEY` w funkcjach hot path

Odczyt kodu pokazał kilka pozostałości nazwowo-warunkowych:

- `classify-knowledge-entry` sprawdza `LOVABLE_API_KEY`, mimo że realnie używa `chatCompletion()` z direct Gemini/OpenAI.
- `suggest-exercises` sprawdza `LOVABLE_API_KEY`, mimo że realnie używa `chatCompletion()`.
- `verify-open-answers` sprawdza `LOVABLE_API_KEY`, mimo że realnie używa `chatCompletion()`.
- `process-welcome-test` warunkuje część AI summary/evolution logic przez `LOVABLE_API_KEY`.

Plan korekty:

1. W funkcjach, które używają `chatCompletion()`, usunąć gate na `LOVABLE_API_KEY`.
2. Zastąpić go checkiem realnych providerów:

```ts
const hasDirectAiProvider = Boolean(Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY"));
```

3. Komunikaty błędów zmienić z `LOVABLE_API_KEY not configured` na neutralne:

```text
AI provider not configured: GEMINI_API_KEY or OPENAI_API_KEY required
```

4. To jest realna naprawa, bo inaczej aplikacja może nadal blokować funkcję tylko dlatego, że nie ma Lovable key, mimo że direct Gemini/OpenAI są gotowe.

### P5 — Aktualizacja offline script `scripts/audit-llm-models.ts`

Ten skrypt nadal zna `lovable-gateway` i `LOVABLE_API_KEY`. Jeśli jest używany jako Procedure B inventory/live-check, trzeba go dostosować do obecnej architektury.

Zmiany:

1. Usunąć lub zdegradować `lovable-gateway` provider z live checks.
2. Usunąć instrukcję wymagającą `LOVABLE_API_KEY` z komentarza uruchomieniowego.
3. Zachować detekcję historycznych stringów `lovable/...` jako inventory warning, ale nie jako active provider check.
4. Raport powinien odróżniać:
   - active direct provider model;
   - legacy string found in code;
   - unsupported/deprecated provider.

### P6 — RAG + pamięć

Po implementacji zaktualizować:

- `docs/llm-context.md`
- `public/llms.txt`
- `mem/infrastructure/model-health-monitoring.md`

Wpis ma jasno mówić:

```text
PROBLEM: Monthly LLM audit still probed Lovable Gateway even though Edooqoo intentionally no longer uses Lovable AI credits.
EDOOQOO SOLUTION: Lovable Gateway probes were removed from active health checks; direct Gemini/OpenAI/Vertex provider checks now define model health.
TECHNICAL MECHANICS: audit-llm-models targets, send-model-audit-email summary compatibility, aiChat direct provider gates, legacy audit script cleanup.
RAG KEYWORDS: direct Gemini API, OpenAI fallback, Lovable Gateway removed, model health audit, monthly LLM audit, GEMINI_API_KEY, OPENAI_API_KEY, Vertex AI, Edooqoo monitoring, provider smoke test, aiChat helper, no Lovable credits
```

## Instrukcja: jak ręcznie wywołać monthly audit teraz

Masz trzy praktyczne opcje.

### Opcja 1 — lokalny terminal / Mac Terminal / Windows PowerShell

To najprostsze, jeśli znasz wartość `CRON_SECRET`.

1. Wejdź w Supabase Dashboard:

```text
Supabase → project bvfrkzdlklyvnhlpleck → Project Settings → Edge Functions → Secrets
```

2. Znajdź sekret `CRON_SECRET`.

Ważne: Supabase często pokazuje tylko nazwę sekretu, nie jego wartość. Jeśli nie masz zapisanej wartości, nie zgaduj i nie resetuj jej pochopnie, bo cron może używać tej samej wartości.

3. W terminalu ustaw zmienną lokalnie:

Mac/Linux:

```bash
export CRON_SECRET='TU_WKLEJ_WARTOSC_CRON_SECRET'
```

Windows PowerShell:

```powershell
$env:CRON_SECRET='TU_WKLEJ_WARTOSC_CRON_SECRET'
```

4. Uruchom:

Mac/Linux:

```bash
curl -X POST 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models' \
  -H "x-cron-secret: $CRON_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"mode":"monthly"}'
```

Windows PowerShell:

```powershell
curl.exe -X POST "https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models" `
  -H "x-cron-secret: $env:CRON_SECRET" `
  -H "Content-Type: application/json" `
  -d '{"mode":"monthly"}'
```

5. Oczekiwany wynik teraz, przed oczyszczeniem Lovable Gateway:

```json
{
  "ok": true,
  "mode": "monthly",
  "checked": 12,
  "results": [ ... ]
}
```

Dwa Lovable Gateway rows mogą mieć `status: 402`, `ok: false`, `expected: true`.

6. Oczekiwany wynik po mojej rekomendowanej poprawce:

```json
{
  "ok": true,
  "mode": "monthly",
  "checked": 10,
  "results": [ ... no lovable-gateway rows ... ]
}
```

### Opcja 2 — Supabase Dashboard

Możesz użyć Supabase, ale praktycznie i tak musisz wysłać HTTP request z headerem `x-cron-secret`.

Kroki:

1. Supabase Dashboard → Edge Functions.
2. Otwórz `audit-llm-models`.
3. Jeśli panel ma zakładkę `Invoke` / `Test`, ustaw:

```text
Method: POST
Headers:
  x-cron-secret: <wartość CRON_SECRET>
  Content-Type: application/json
Body:
  {"mode":"monthly"}
```

4. Po wywołaniu sprawdź:

```text
Edge Functions → audit-llm-models → Logs
Edge Functions → send-model-audit-email → Logs
```

5. Jeśli Supabase UI nie pozwala wygodnie dodać custom headera, użyj opcji 1 z terminalem.

### Opcja 3 — GitHub Actions

Można zrobić workflow `workflow_dispatch`, który odpali monthly audit, ale obecnie nie rekomenduję tego jako pierwszego kroku, bo:

- trzeba dodać `CRON_SECRET` także jako GitHub Secret;
- to jest kolejny pipeline do utrzymania;
- dla jednorazowego testu terminal/Supabase jest prostszy.

Jeśli chcesz, mogę w osobnej iteracji dodać workflow:

```text
Actions → Run Monthly LLM Audit → Run workflow
```

ale tylko wtedy, gdy świadomie chcesz trzymać `CRON_SECRET` również w GitHub Secrets.

## Impact analysis

### Zero regressions confirmed przed implementacją

- `package.json` ma poprawny script `build: "vite build"`, więc `npm run build` jest właściwą formą uruchomienia Vite w GitHub Actions.
- Aktualny failure `exit code 127` jest zgodny z bezpośrednim `vite build`, nie z Cloudflare credentials.
- `aiChat.ts` deklaruje aktualny kierunek: primary direct Google Generative Language, fallback OpenAI, Lovable Gateway removed from hot path.
- `TARGETS_DAILY` nie zawiera Lovable Gateway; problem dotyczy miesięcznego audytu.
- `send-model-audit-email` już obsługuje `summary.expected`, więc usunięcie expected rows nie wymaga przebudowy maila od zera.

### Ryzyka

- Jeśli jakiś historyczny cron/dashboard oczekuje dokładnie `checked: 12`, po usunięciu Lovable Gateway będzie `checked: 10`. To jest pożądana zmiana, ale trzeba ją udokumentować.
- Jeśli `process-welcome-test` naprawdę nadal używa starych bezpośrednich fetchy do Lovable Gateway w dalszych liniach, trzeba je przepiąć ostrożnie na `chatCompletion()` albo direct OpenAI/Gemini. Tego nie wolno robić jako ślepy replace; wymaga lokalnej edycji tylko w tych blokach, które faktycznie korzystają z AI.

## Scope lock

W tej iteracji nie ruszać:

- P5 SEO 40 stron — nadal pominięte zgodnie z Twoją decyzją.
- Worksheet Generation Engine — sanctity rule, brak zmian promptu/logiki generacji worksheetów.
- Security findings `calendar_slots`, `download_sessions`, `SUPA_security_definer_view` — nie są przyczyną obecnego GitHub failure ani audytu LLM.
- Cloudflare secrets — obecny błąd jest przed `wrangler deploy`, więc nie diagnozujemy sekretów Cloudflare bez nowego loga z kroku deploy.

## Verification plan

Po wdrożeniu sprawdzę:

1. `cloudflare-worker-deploy.yml` nie zawiera już bezpośredniego `vite build`.
2. Workflow używa `npm run build`, więc lokalny `vite` rozwiązuje się z `node_modules/.bin`.
3. `audit-llm-models` nie ma aktywnych `lovable-gateway` targetów.
4. `audit-llm-models` nie wymaga `LOVABLE_API_KEY` do miesięcznego raportu.
5. Funkcje hot path nie blokują się już przez brak `LOVABLE_API_KEY`, jeśli mają `GEMINI_API_KEY` albo `OPENAI_API_KEY`.
6. RAG i memory są zaktualizowane.
7. Ręczny monthly audit po zmianie zwraca `checked: 10`, `failed: 0`, bez rows `provider: lovable-gateway`.

## Change report po implementacji będzie zawierał

- Summary of what was implemented
- Files modified
- Documentation updated: YES/NO
- Out of scope issues flagged
- Verification result: PASS/FAIL