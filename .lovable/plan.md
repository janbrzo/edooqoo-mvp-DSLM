## Zakres

Dwa problemy: (1) workflow `Cloudflare Worker Deploy` pada na `npm ci`, (2) monthly LLM audit raportuje 2 FAIL, które nie są realnymi awariami.

---

## P1 — Cloudflare Worker Deploy: `npm ci` exit code 1

**Root cause:** `package.json` dostał `@lovable.dev/mcp-js@^0.20.0` (wraz z całym drzewem tranzytywnym: `@modelcontextprotocol/sdk`, `esbuild`, `hono`, `express`, `ajv`...), ale `package-lock.json` nie został zregenerowany. `npm ci` z definicji odmawia instalacji, gdy manifest i lockfile są rozjechane. To nie jest problem sekretów Cloudflare ani wrangler — job pada w kroku *Install dependencies*, zanim cokolwiek dotknie CF.

**Naprawa (dwa poziomy, oba wdrażam):**

1. **Resynchronizacja lockfile w repo** — uruchomienie `npm install` w sandboxie, tak aby `package-lock.json` zawierał `@lovable.dev/mcp-js@0.20.1` i całe drzewo zależności. Commitowany jest wyłącznie `package-lock.json` (żadnych zmian w `package.json`, żadnego bumpu wersji innych paczek — instalacja bez `--force`, bez `npm update`).
2. **Odporność workflow** — w `.github/workflows/cloudflare-worker-deploy.yml` krok instalacji zmienia się z twardego `npm ci` na:
   ```yaml
   - name: Install dependencies
     run: npm ci || (echo "lockfile out of sync — falling back to npm install" && npm install --no-audit --no-fund)
   ```
   Dzięki temu przyszły drift manifest↔lock nie blokuje deployu edge routingu (który jest infrastrukturą SEO, nie buildem produkcyjnym aplikacji). To samo zabezpieczenie trafia do `.github/workflows/seo-monitoring.yml` i `.github/workflows/seo-integrity.yml`, jeśli używają `npm ci` — sprawdzę i ujednolicę.

**Dodatkowa optymalizacja (opcjonalna, w tym samym kroku):** `@lovable.dev/mcp-js` jest potrzebny tylko do buildu funkcji MCP, nie do `vite build` workera. Jeśli po resynchronizacji `npm ci` będzie zauważalnie wolniejszy, rozważymy przeniesienie go do `devDependencies` — ale nie robię tego teraz, żeby nie ruszać działającego pipeline'u MCP.

**Weryfikacja:** lokalnie `rm -rf node_modules && npm ci` musi przejść bez błędu; potem `npm run seo:generate-edge-routing` i `vite build` (kroki z workflow) muszą wyjść z kodem 0. Po merge'u trzeba ręcznie odpalić `Actions → Cloudflare Worker Deploy → Run workflow`.

---

## P2 — Monthly LLM Audit: 2 fałszywe FAIL (lovable-gateway 402)

**Root cause:** `TARGETS_MONTHLY` w `supabase/functions/audit-llm-models/index.ts` nadal zawiera dwa probe'y Lovable Gateway. Po migracji na bezpośrednie Google/OpenAI Gateway jest celowo nieużywany, a workspace nie ma creditów → gateway zwraca `402 payment_required`. Kod klasyfikuje wszystko poza 2xx jako `ok:false`, więc raport pokazuje „Failed: 2" dla stanu, który jest oczekiwany i nieszkodliwy.

**Rozwiązanie — wprowadzenie trzeciego stanu `INFO / EXPECTED` zamiast usuwania probe'ów** (usunięcie straciłoby sygnał „credity wróciły"):

1. W `Target` dodaję pole `optional?: boolean` oraz `expectedFailureStatuses?: number[]`. Oba probe'y `lovable-gateway` dostają `optional: true, expectedFailureStatuses: [402, 401, 403]`.
2. W pętli audytu wyliczam trzy stany zamiast dwóch:
   - `ok` = HTTP 2xx
   - `expected` = `!ok && optional && expectedFailureStatuses.includes(status)`
   - `failed` = pozostałe
3. `model_health_checks` — wiersz nadal jest zapisywany z realnym `status` i `ok:false`, ale dochodzi kolumna informacyjna. Żeby nie robić migracji schematu, stan „expected" koduję w istniejącym polu `error` prefiksem `EXPECTED: ` i dodatkowo w `purpose`. **Alternatywnie**, jeśli wolisz czysto: migracja dodająca `expected boolean default false` do `model_health_checks`. Rekomenduję migrację — jest tania i pozwoli filtrować historię. Domyślnie idę migracją.
4. `logModelFailure` **nie jest wywoływane** dla stanów `expected` (dziś i tak nie było, bo 402 nie mieści się w 404/410/5xx — ale dopiszę jawny guard, żeby to było intencjonalne, nie przypadkowe).
5. **Email:** licznik nagłówka zmienia się z `Checked: 12 · OK: 10 · Failed: 2` na `Checked: 12 · OK: 10 · Expected: 2 · Failed: 0`. Wiersz w tabeli dostaje status `EXPECTED` w kolorze bursztynowym (`#b45309`) zamiast czerwonego `FAIL`, a w kolumnie Error pojawia się skrócony komunikat z adnotacją „probe only — Lovable Gateway intentionally unused". `summary` wysyłane do `send-model-audit-email` zyskuje pole `expected`.
6. `send-model-audit-email` — sprawdzam, czy subject buduje się z `summary.failed`; jeśli tak, po zmianie subject stanie się `— 0/12 failed`, czyli dokładnie to, czego oczekujesz. Jeżeli funkcja liczy fail samodzielnie, dostosuję ją do nowego kształtu `summary`.

**Weryfikacja P2 — ręczne wywołanie audytu:** tak, możemy odpalić jednorazowo bez czekania na 2026-08-01. Po deployu wykonam:
```
POST /functions/v1/audit-llm-models
Header: x-cron-secret: <CRON_SECRET>
Body:   {"mode":"monthly"}
```
przez `supabase--curl_edge_functions`. Oczekiwany rezultat: `checked: 12`, `ok: 10`, `expected: 2`, `failed: 0`, oraz e-mail z tematem `— 0/12 failed`. Dodatkowo odpytam `model_health_checks` żeby potwierdzić, że wiersze zapisały się z poprawnym statusem.

---

## P3 — SEO (40 stron)

Pominięte w tej iteracji, zgodnie z Twoją decyzją. Zostaje w backlogu.

---

## Pliki do zmiany

| Plik | Zmiana |
|---|---|
| `package-lock.json` | resync przez `npm install` (bez zmian w `package.json`) |
| `.github/workflows/cloudflare-worker-deploy.yml` | `npm ci` → `npm ci \|\| npm install` fallback |
| `.github/workflows/seo-monitoring.yml`, `seo-integrity.yml` | ten sam fallback, jeśli używają `npm ci` |
| `supabase/functions/audit-llm-models/index.ts` | `optional`/`expectedFailureStatuses`, trójstanowa klasyfikacja, nowy HTML raportu |
| `supabase/functions/send-model-audit-email/index.ts` | obsługa `summary.expected` w temacie/nagłówku |
| migracja SQL | `ALTER TABLE public.model_health_checks ADD COLUMN expected boolean NOT NULL DEFAULT false` |
| `docs/llm-context.md`, `public/llms.txt` | wpis RAG (PROBLEM / SOLUTION / MECHANICS / KEYWORDS) |
| `mem/infrastructure/model-health-monitoring.md` | aktualizacja o trójstanową klasyfikację |

## Kolejność wykonania

1. Migracja SQL (`expected` w `model_health_checks`) — wymaga Twojej akceptacji, więc idzie pierwsza.
2. `npm install` → resync lockfile → weryfikacja `npm ci` na czysto.
3. Edycja obu workflowów.
4. Edycja `audit-llm-models` + `send-model-audit-email`, deploy obu funkcji.
5. Ręczny `mode:"monthly"` run + odczyt `model_health_checks` + potwierdzenie maila.
6. RAG + memory.

Poza zakresem (loguję, nie ruszam): findingi lintera `SUPA_security_definer_view`, `calendar_slots`, `download_sessions`.
