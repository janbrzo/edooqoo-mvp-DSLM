# Plan v6.9.28 — Loss-framing + finalizacja monitoringu

## Analiza pytania (a) vs (b)

**To są 2 OSOBNE kwestie**, nie alternatywa. (a) jest warunkiem koniecznym do działania `audit-llm-models` (bez `CRON_SECRET` w sekretach + bez wpisu pg_cron funkcja nigdy nie zostanie wywołana). (b) jest dokończeniem sweepa z poprzedniej tury — bez tego ~5 funkcji AI nadal po cichu połknie 404/410 z gateway. Robimy **obie** w jednej iteracji, bo razem dopinają H6 do końca.

---

## Sekcja 1 — H6 finalizacja (CRON_SECRET + sweep loggera)

### 1A. Sekret `CRON_SECRET`

Dodajemy projektowy sekret `CRON_SECRET` przez `secrets--add_secret` (interaktywny formularz — użytkownik wkleja losową wartość, np. 32-bajtowy hex z `openssl rand -hex 32`). Funkcja `audit-llm-models` już go odczytuje (`Deno.env.get("CRON_SECRET")`); bez sekretu zwraca 401 dla każdego wywołania, więc samo dodanie zera regresji. `config.toml` (`verify_jwt=false`) już jest.

### 1B. SQL pg_cron (ręcznie, NIE w migracji)

W planie podajemy gotowy snippet do uruchomienia przez użytkownika w SQL editorze (zawiera anon URL + sekret — nie wchodzi do `supabase/migrations/`). Plik referencyjny tworzymy jako `docs/operational/audit-llm-models-cron.md`:

```sql
-- Run ONCE in Supabase SQL editor. Requires pg_cron + pg_net extensions enabled.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'audit-llm-models-daily',
  '0 6 * * *',  -- 06:00 UTC daily
  $$
  select net.http_post(
    url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  '<PASTE_CRON_SECRET_VALUE_HERE>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To unschedule later: select cron.unschedule('audit-llm-models-daily');
-- To inspect runs: select * from cron.job_run_details where jobname = 'audit-llm-models-daily' order by start_time desc limit 10;
```

Doc instruuje też, jak ręcznie odpalić jednorazowy smoke-test przez `curl -H "x-cron-secret: ..." https://.../functions/v1/audit-llm-models` i co sprawdzić w tabeli `model_health_checks`.

### 1C. Sweep loggera w pozostałych funkcjach AI

Brakujące funkcje (potwierdzone `rg`):

1. `generateWorksheet` — główny pipeline Gemini 2.5; każdy nie-OK status z gateway musi wołać `logModelFailure` przed throw.
2. `generate-image` — Lovable Gateway (gemini-2.5-flash-image / nano-banana).
3. `generate-media-exercises` — generacja exercises pod media.
4. `generate-timeline` — pomocnicze AI.
5. `generate-welcome-test-audio` — OpenAI Whisper TTS (provider `openai`).
6. `process-pending-ai-evaluations` — batch evaluator (cron).
7. `process-welcome-test` — scoring placement testu (provider Gemini przez gateway).

**Wzorzec wpięcia** (identyczny jak w `verify-open-answers` z poprzedniej tury):

```ts
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

const response = await fetch(GATEWAY_URL, { ... });
if (!response.ok) {
  const errBody = await response.text().catch(() => "");
  await logModelFailure({
    model: MODEL_NAME,
    provider: "lovable-gateway", // lub "openai"
    status: response.status,
    endpoint: GATEWAY_URL,
    error: errBody.slice(0, 500),
    functionName: "<nazwa-funkcji>",
  });
  // istniejące zachowanie throw / fallback — BEZ ZMIAN
  throw new Error(`AI gateway failed: ${response.status}`);
}
```

**Zasady kompatybilności (zero regresji):**

- Logger jest `await`-owany przed `throw` — nigdy nie zastępuje istniejącej obsługi błędu.
- Nie modyfikujemy promptów (SACRED — Worksheet Generation Engine; tylko `if (!response.ok)` branch w `generateWorksheet/aiService.ts` lub odpowiednim wraperze fetch, nie w `streaming.ts` jeśli to zmieni prompt).
- Dla `generateWorksheet` szukamy istniejących `if (!response.ok)` w wraperze gateway (`aiService.ts` / `geminiClient.ts`) — wpinamy tylko tam, nie w streaming SSE handlerze.
- Jeśli funkcja ma fallback OpenAI po Lovable Gateway, logujemy oba etapy (jak w `translate-flashcard`).
- Brak nowych migracji DB w tej sekcji.

### Deploy

Po edycji: `supabase--deploy_edge_functions` z listą wszystkich 7 nazw + już istniejącym `audit-llm-models`.

---

## Sekcja 2 — Kompaktowy kalkulator w wariancie `hero`

**Plik:** `src/components/PricingCalculator.tsx` (jedyna zmiana w komponencie).

### 2A. Inputy 2×2 zamiast 1-kolumny w hero

Linia 194: `grid grid-cols-1` → w trybie `isHero` użyć `grid-cols-2 gap-3` (na bardzo wąskich ekranach <380px wracamy do 1 kolumny via `grid-cols-1 xs:grid-cols-2`, ale ponieważ Tailwind nie ma `xs`, używamy `grid-cols-1 sm:grid-cols-2` także dla hero — Twój viewport 1229px to bez problemu obsłuży, mobile 360px pójdzie w 1 kolumnie). Dokładna zmiana:

```tsx
<div className={cn("grid gap-3", isHero ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
```

(efektywnie zawsze 2 kolumny od `sm`+; w hero 4 pola tworzą siatkę 2×2: Prep/Students w pierwszym rzędzie, Lesson price/Lesson length w drugim).

### 2B. Wyniki: 2 KPI w jednym rzędzie + revenue pod spodem

Linia 396: obecna siatka `isHero ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"`.

Refaktor na **2 wiersze** w trybie hero:

- Wiersz 1: `monthlyPrepHoursTiedUp` (4.9h) + `monthlyLessonSlotsTiedUp` (4) — `grid-cols-2 gap-3`.
- Wiersz 2: `monthlyRevenueCapacityTiedUp` ($100) — pełna szerokość (`col-span-2`).

Implementacja: zostawiamy jeden `div className="grid grid-cols-1 sm:grid-cols-2 gap-3"` i trzecia karta dostaje `sm:col-span-2`:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  <div>{/* hours tile */}</div>
  <div>{/* slots tile */}</div>
  <div className="sm:col-span-2">{/* revenue tile */}</div>
</div>
```

Dla wariantu `pricing`/`landing` zachowujemy `sm:grid-cols-3` (revenue w trzeciej kolumnie obok, BEZ zmiany layoutu) — ternary po `isHero`.

### 2C. Zmniejszenie paddingu/textu w hero (mieści się na 1 ekranie)

- Kafelki KPI (linie 397/404/411): w hero `p-2` zamiast `p-3`; wartości `text-xl` zamiast `text-2xl`.
- Sub-label: `text-[10px]` zamiast `text-xs` w hero.
- Disclaimer (linia 417): w hero zwijamy do 1 linii `text-[10px] mt-2`.
- Header CardHeader (linia 362): w hero `pb-1 pt-3` zamiast `pb-2 pt-4`; subtitle (linia 368) `text-xs` zamiast `text-sm`.

Wszystkie zmiany przez `cn(..., isHero ? "..." : "...")` — żadnych side-effects dla `pricing`/`landing`.

---

## Sekcja 3 — Loss-framing copy (utrata > zysk)

Psychologia: prospect theory Kahneman & Tversky — strata waży ~2.25× bardziej niż zysk. Obecne copy ma już bazę („tied up monthly") ale gdzieniegdzie miesza pozytywne („impact"). Przesuwamy 100% w stronę utraty.  
  
UWAGA to wprowadzam zmiany w kilku miejscach ponieważ zbytt agresywne komunikaty zaproponowałeś UWAGA

### 3A. PricingCalculator.tsx


| Lokalizacja (linia)           | Obecnie                                                                                                | Zmiana                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 366 — CardTitle               | `Calculate your 1-Minute Prep impact`                                                                  | `See how much prep is silently costing you`                                                                                      |
| 369 — opis                    | `Compare your weekly inputs with a monthly estimate based on about 1 focused prep minute per student.` | `See how many hours, lessons and dollars you currently lose to prep every month. Benchmark: about 1 focused minute per student.` |
| 389 — sekcja wyników nagłówek | `Estimated monthly prep impact`                                                                        | `What prep is costing you monthly`                                                                                               |
| 402 — label                   | `prep time currently tied up monthly`                                                                  | `hours lost to prep every month`                                                                                                 |
| 409 — label                   | `lesson slots tied up monthly`                                                                         | `paid lessons you can't fit in`                                                                                                  |
| 413 — label                   | `monthly revenue capacity tied up in prep`                                                             | `revenue you leave on the table monthly`                                                                                         |
| 418 — disclaimer              | bez zmian (legal)                                                                                      | bez zmian                                                                                                                        |
| 392 — badge                   | `Side-Gig fit` / `Full-Time fit`                                                                       | bez zmian (kategoria planu, neutralne)                                                                                           |
| 424 — CTA primary             | `Start 1-Minute Prep Free`                                                                             | bez zmian                                                                                                                        |
| 427 — CTA secondary           | `See plans`                                                                                            | bez zmian                                                                                                                        |


### 3B. HeroHeadline.tsx (sekcja niżej na stronie głównej)


| Linia                         | Obecnie                                                                                                                                                                                              | Zmiana                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 73-75 (subheadline)           | `Edooqoo uses student goals, lesson notes, homework, flashcards and DSLM signals to help you decide what to teach next, then generate a ready-to-teach worksheet with audio, images and AI grading.` | bez zmian                       |
| 78                            | `The worksheet generator is still available instantly. 1-Minute Prep starts when you create a student profile.`                                                                                      | bez zmian                       |
| 113 (ticker pre-label)        | `Create a free account to unlock 1-Minute Prep`                                                                                                                                                      | bez zmian                       |
| 99 — chip „2 worksheets free" | bez zmian                                                                                                                                                                                            | bez zmian (neutralna obietnica) |


### 3C. PricingSection.tsx

| Linia 124 | `Estimate how 1-Minute Prep can affect recurring student prep and worksheet usage` | `Estimate how much recurring prep is costing you — and how much you stop losing with 1-Minute Prep.` |

**Zasada bezpieczeństwa copy:** nie ruszamy żadnych komunikatów w `featurePromptCopy.ts`, page'ach SEO, `seoMeta.ts` (Codex-owned, patrz `mem/decisions/reconciliation-v6926-codex.md`), `WelcomeBackBanner`, generator promptów. Loss-framing tylko na 3 plikach: kalkulator + hero + pricing section.

---

## Sekcja 4 — Dokumentacja RAG

### 4A. `docs/llm-context.md` — nowa sekcja `## v6.9.28 — Loss-framing landing & H6 finalization`

Trzy podsekcje w formacie Problem → Solution → Mechanics:

1. **Hero calculator visual density**
  - Problem: hero variant kalkulatora wymagał 4 wierszy inputów + 3 wierszy KPI → przewijanie poniżej fold-line.
  - Solution: 2×2 grid inputów, KPI hours+slots w jednym rzędzie, revenue jako span-2 niżej.
  - Mechanics: `PricingCalculator.tsx`, `cn(..., isHero ? "grid-cols-2" : ...)`, `sm:col-span-2` na revenue tile, paddingi/typografia zmniejszone w hero. Layouty `pricing`/`landing` nietknięte.
  - RAG Keywords: pricing calculator, hero variant, 1-minute prep, kpi tiles, responsive grid, sm:col-span-2
2. **Loss-aversion copy framework**
  - Problem: dotychczasowe copy obiecywało zysk/oszczędność („save", „impact") — prospect theory wskazuje że strata waży ~2.25× silniej.
  - Solution: przemapowanie 9 labelek na narrację utraty bez zmian numerycznych metryk. Nie dotyka SEO/page metadata.
  - Mechanics: edycje wyłącznie w `PricingCalculator.tsx`, `HeroHeadline.tsx`, `PricingSection.tsx`. Brak migracji, brak zmian eventów `useEventTracking` (event names stałe).
  - RAG Keywords: loss aversion, prospect theory, copywriting, calculator labels, hero subhead, landing copy
3. **H6 monitoring fully wired**
  - Problem: po v6.9.27 logger `logModelFailure` był wpięty w 5 funkcji; 7 pozostałych połykało 404/410 z gateway w ciszy. Brak `CRON_SECRET` + brak pg_cron blokował uruchomienie `audit-llm-models`.
  - Solution: sweep w 7 funkcjach (`generateWorksheet`, `generate-image`, `generate-media-exercises`, `generate-timeline`, `generate-welcome-test-audio`, `process-pending-ai-evaluations`, `process-welcome-test`); dodanie sekretu `CRON_SECRET`; instrukcja pg_cron w `docs/operational/audit-llm-models-cron.md`.
  - Mechanics: wzorzec `await logModelFailure(...)` przed `throw` w bloku `if (!response.ok)`. Cron snippet używa `pg_net` + `cron.schedule` z headerem `x-cron-secret`. Tabela `model_health_checks` + StatusPage banner czyta wyniki bez zmian.
  - RAG Keywords: model failure logger, gateway 410, deprecation alert, pg_cron, cron secret, edge function audit, status page banner

### 4B. `llms.txt` — analogiczny update (gęsty, bez marketingu)

Trzy bloki H2 odpowiadające 4A, z 1-2 zdaniami każdy + lista plików dotkniętych.

### 4C. Memory `mem/`

- `mem/features/landing/loss-framing-copy.md` (preference): zasada „all hero/pricing copy uses loss framing; never re-introduce gain-only phrasing" + tabela mapowań przed/po.
- `mem/infrastructure/cron-audit-llm-models.md` (feature): jak wystartować pg_cron, jak ręcznie odpalić curl, jak debugować przez `cron.job_run_details`.
- Update `mem/index.md` — 2 nowe wpisy w `## Memories` + 1 linia w `## Core`: „Hero/landing copy uses loss-aversion framing; do not revert to gain-only phrasing."

---

## Sekcja 5 — Kolejność wykonania (build mode)

1. **Sekret** — `secrets--add_secret(["CRON_SECRET"])` (user wkleja wartość).
2. **Sweep loggera** — 7 plików edge w jednej batchowej apply_patch, każdy edytowany chirurgicznie tylko w `if (!response.ok)`.
3. **Deploy** — `supabase--deploy_edge_functions` z 7 nazwami.
4. **Kalkulator** — jeden `apply_patch` na `PricingCalculator.tsx` (grid inputów + grid wyników + paddingi).
5. **Copy loss-framing** — `apply_patch` na `PricingCalculator.tsx` (kontynuacja), `HeroHeadline.tsx`, `PricingSection.tsx`.
6. **Docs operational** — utworzenie `docs/operational/audit-llm-models-cron.md`.
7. **Docs RAG** — update `docs/llm-context.md`, `llms.txt`.
8. **Memory** — 2 nowe pliki `mem/` + update `mem/index.md`.
9. **Weryfikacja**: `rg "1-Minute Prep impact|tied up monthly|save hours every week"` — żadnych pozostałości starych fraz w 3 edytowanych plikach. Screenshot preview w viewport 1229×754 — kalkulator mieści się nad fold-line.

---

## Sekcja 6 — Ryzyka i mitygacja

- **Worksheet Engine Sanctity**: `generateWorksheet` ruszamy WYŁĄCZNIE w bloku `if (!response.ok)` w wraperze fetch — zero zmian w promptach, system messages, output parsingu. Przed edycją czytamy plik i pokazujemy diff jednego bloku.
- **Codex-owned files**: pomijamy `seoMeta.ts`, `faqItems.ts`, `HowItWorks.tsx`, page'y SEO, public/*.html (zgodnie z `mem/decisions/reconciliation-v6926-codex.md`).
- **i18n**: aplikacja jest 100% EN — copy zmieniamy tylko po angielsku, żadnych plików tłumaczeń.
- **Event tracking**: `eventType` w `trackCalculatorCta` zostaje (`one_minute_calculator_cta_click`) — nie psujemy analytics.
- **Mobile**: 2×2 grid inputów na 360px=11rem/kolumna może być ciasny dla input number + 2 buttonów; zostawiamy fallback `grid-cols-1 sm:grid-cols-2` (od ≥640px 2 kolumny).
- **CRON_SECRET rotation**: instrukcja w doc mówi jak unschedule i ponownie zaplanować po rotacji sekretu.

---

## Akceptacja?

Po Twoim „tak" wykonuję sekcje 1→9 sekwencyjnie w jednej turze. Sekret `CRON_SECRET` poprosi Cię o wartość w bezpiecznym formularzu — możesz wygenerować `openssl rand -hex 32` po swojej stronie.