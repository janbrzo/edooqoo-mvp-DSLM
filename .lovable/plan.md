# Plan v6.9.83 — Cloudflare deploy + ręczny audyt LLM

## Problem 1 — Cloudflare Worker Deploy #8: brak CLOUDFLARE_API_TOKEN

### Diagnoza
Workflow `.github/workflows/cloudflare-worker-deploy.yml` w kroku „Deploy Worker and route bindings" ustawia:

```yaml
env:
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Build przeszedł (26s), więc `npm run build` jest już naprawione. Wrangler zgłasza brak `CLOUDFLARE_API_TOKEN` — to oznacza, że sekret **rozwinął się do pustego stringa**. Najczęstsze przyczyny (do sprawdzenia po Twojej stronie, bo agent nie ma dostępu do GitHub Settings):
1. Sekret dodany jako **Environment secret** (np. w środowisku `production`), a job nie deklaruje `environment:` — wtedy `secrets.X` jest puste.
2. Sekret dodany na poziomie **organizacji** bez udostępnienia temu repo.
3. Literówka w nazwie (np. `CLOUDFLARE_TOKEN`, spacja na końcu).
4. Sekret dodany w zakładce Dependabot secrets zamiast Actions secrets.

### Zmiany w kodzie
Do `.github/workflows/cloudflare-worker-deploy.yml` dodać **krok preflight** przed deployem, który jednoznacznie powie, czy sekrety są widoczne (bez ujawniania wartości):

```yaml
      - name: Preflight — verify Cloudflare secrets are visible to this job
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          missing=0
          if [ -z "${CLOUDFLARE_ACCOUNT_ID}" ]; then
            echo "::error::CLOUDFLARE_ACCOUNT_ID is empty in this job context."
            missing=1
          else
            echo "CLOUDFLARE_ACCOUNT_ID present (length ${#CLOUDFLARE_ACCOUNT_ID})"
          fi
          if [ -z "${CLOUDFLARE_API_TOKEN}" ]; then
            echo "::error::CLOUDFLARE_API_TOKEN is empty in this job context."
            missing=1
          else
            echo "CLOUDFLARE_API_TOKEN present (length ${#CLOUDFLARE_API_TOKEN})"
          fi
          if [ "$missing" = "1" ]; then
            echo "Add both as Repository secrets: Settings > Secrets and variables > Actions > Repository secrets."
            exit 1
          fi
```

Dodatkowo dodać `--var`-free, jawne przekazanie tokenu do wranglera oraz `id-token`-free `permissions` bez zmian. Krok deployu zostaje bez zmian merytorycznych, ale dostaje czytelniejszą diagnostykę:

```yaml
      - name: Deploy Worker and route bindings
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: npx wrangler@4 deploy --config wrangler.toml
```

(przypięcie majora `wrangler@4` eliminuje niespodziankę z auto-instalacją losowej wersji).

### Co musisz zrobić ręcznie
1. GitHub → repo `edooqoo-mvp-DSLM` → **Settings** → **Secrets and variables** → **Actions**.
2. Zakładka **Secrets**, sekcja **Repository secrets** (nie „Environment secrets", nie „Dependabot").
3. Upewnij się, że istnieją dokładnie: `CLOUDFLARE_ACCOUNT_ID` oraz `CLOUDFLARE_API_TOKEN`.
4. Jeśli są w „Environment secrets" — przenieś je do Repository secrets (albo powiedz mi, w jakim środowisku są, to dodam `environment:` do joba).
5. Token musi mieć uprawnienia: **Account → Workers Scripts → Edit** oraz **Zone → Workers Routes → Edit** dla strefy `edooqoo.com`.
6. Uruchom ponownie: Actions → Cloudflare Worker Deploy → Run workflow → `main`.

Po zmianie workflow, jeśli sekrety nadal będą puste, run zakończy się na kroku preflight z jasnym komunikatem zamiast mylącego błędu wranglera.

---

## Problem 2 — `curl` wklejony do Supabase SQL Editor

### Diagnoza
Supabase SQL Editor wykonuje wyłącznie SQL. Wklejenie polecenia `curl` daje `42601: syntax error at or near "curl"` — to nie jest błąd naszego kodu, tylko zły kanał wywołania.

### Trzy poprawne sposoby wywołania audytu

**Opcja A — z SQL Editor przez `pg_net` (to, co chciałeś zrobić):**

```sql
select net.http_post(
  url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', '<TWÓJ_CRON_SECRET>'
  ),
  body    := jsonb_build_object('mode', 'monthly')
) as request_id;
```

Zwróci `request_id`. Odpowiedź odczytasz po kilku sekundach:

```sql
select id, status_code, content
from net._http_response
order by created desc
limit 5;
```

**Opcja B — z terminala na Twoim komputerze** (PowerShell / bash), tam `curl` działa:

```bash
curl -X POST \
  "https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models" \
  -H "x-cron-secret: <TWÓJ_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"monthly"}'
```

**Opcja C — sprawdzenie wyników bez wywoływania funkcji** (jeśli cron już przeszedł):

```sql
select provider, model, status, ok, expected, latency_ms, error, checked_at
from public.model_health_checks
order by checked_at desc
limit 30;
```

### Uwaga bezpieczeństwa
Na zrzucie ekranu widać pełną wartość `CRON_SECRET` w edytorze SQL. **Zalecam rotację tego sekretu** — mogę to zrobić w kolejnej turze (wygenerowanie nowego `CRON_SECRET` + aktualizacja obu zadań pg_cron, które go używają).

---

## Zmiany plików w tej iteracji
- `.github/workflows/cloudflare-worker-deploy.yml` — dodanie kroku preflight na sekrety + przypięcie `wrangler@4`.
- `docs/operational/audit-llm-models-cron.md` — dodanie sekcji „Manual invocation" z trzema opcjami (pg_net / lokalny curl / odczyt tabeli), żeby nie było więcej prób wklejania curl do SQL Editora.
- `docs/llm-context.md` i `public/llms.txt` — wpis RAG (PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS).

## Kryterium sukcesu
- Ponowny run „Cloudflare Worker Deploy" albo przechodzi na zielono, albo zatrzymuje się na preflight z jednoznacznym komunikatem, który sekret brakuje.
- Audyt LLM da się wywołać ręcznie z SQL Editora przez `net.http_post` i zwraca `status_code = 200`.