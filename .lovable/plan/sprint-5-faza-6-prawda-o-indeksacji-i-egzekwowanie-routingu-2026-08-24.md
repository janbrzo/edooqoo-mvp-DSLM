# Sprint 5 — Faza 6: Prawda o indeksacji i egzekwowanie routingu (v6.9.99)

Sprinty 1–4 zamknięte (CTR recovery, intent/conquest + higiena pSEO, 4 huby klastrowe, GEO/AEO + pętla pomiaru). Zostały dwie rzeczy, które blokują realny wzrost: **routing/indeksacja nie jest egzekwowana na produkcji**, a **panel pomiarowy kłamie** — pokazuje 57 „failed" tam, gdzie problem jest w metodzie pomiaru, i 0% widoczności AI, bo runda nigdy nie została wypełniona.

## Co ustalono z produkcji (zweryfikowane w tym turnie)

- `curl https://edooqoo.com/blog/adapting-textbooks-esl-classroom.html` → **HTTP 200**, brak `location`, brak `x-robots-tag`, nagłówek `x-deployment-id` = hosting Lovable. Worker Cloudflare (`cloudflare/worker.mjs`) **nie obsługuje ruchu** na edooqoo.com.
- Te same 45 starych plików w `public/blog/` mają już poprawny stub HTML: `meta robots=noindex,follow` + `meta refresh` + `link canonical` na nowy URL. Czyli sygnał dla Google **jest**, tylko nie jest to 301 na poziomie nagłówka.
- `docs/seo/live-routing.generated.md`: 58 checków, 1 pass, 57 fail — wszystkie fail-e wynikają z oczekiwania nagłówków (301 / `X-Robots-Tag`), których obecny hosting nie emituje. To fałszywe alarmy, nie 57 realnych błędów.
- Konflikt polityki: `/english-for/accountants` w prerenderze ma `meta robots="index,follow"`, a manifest routingu klasyfikuje `/english-for/*` jako `noindex, follow`. Dwa źródła prawdy mówią co innego.
- `/english-for/cabin-crew` nie ma prerenderu (brak katalogu w `public/english-for/`) — crawler dostaje pusty shell SPA.
- `public/sitemap.xml`: 552 URL-e, w tym wpisy z rozszerzeniem `.html` dla starych artykułów. GSC: 1000 „discovered – not indexed", 24 x 404.

## Cel sprintu

1. Każdy stary URL i każda strona `noindex` wysyłają **jeden, spójny** sygnał — bez sprzeczności między prerenderem, manifestem routingu i sitemapą.
2. Audyt `verify-live-routing` mówi prawdę: rozróżnia „brak sygnału" od „sygnał dostarczony inną warstwą niż nagłówek HTTP".
3. Pierwsza realna runda widoczności AI zapisana w trendzie (dziś: pusty szablon).

## Zakres — 5 bloków

### A. Weryfikator routingu zgodny z rzeczywistą warstwą hostingu
- `scripts/seo/verify-live-routing.mjs`: dla checku typu `legacy-redirect`, gdy status = 200, dociągnąć GET i sparsować HTML. Warunek zaliczenia (fallback): `meta robots` zawiera `noindex`, `link rel=canonical` wskazuje dokładnie na oczekiwany target oraz istnieje `meta http-equiv="refresh"` na ten sam target.
- Nowe statusy w raporcie: `pass-header-301`, `pass-html-stub`, `fail-no-signal`. Kolumna „Pass" liczy pierwsze dwa jako sukces.
- Analogicznie dla `*-noindex`: gdy brak `X-Robots-Tag`, akceptować `meta name="robots"` z prerenderu; brak prerenderu = `fail-no-signal` (to realny błąd, nie fałszywy alarm).
- `--strict-headers` jako flaga opt-in (do włączenia dopiero po ewentualnym uruchomieniu workera).
- Efekt oczekiwany: 57 fail → ok. 2–4 realne fail-e (`cabin-crew` i inne persony bez prerenderu).

### B. Jedno źródło prawdy dla polityki indeksacji
- `scripts/seo/audit-pseo-index-policy.mjs` rozszerzyć o **cross-check trzech warstw** dla każdego URL-a pSEO i persony:
  1. `src/data/pseoIndexPolicy.json` (decyzja),
  2. `meta robots` w prerenderowanym HTML,
  3. obecność/brak w `public/sitemap.xml`.
- Reguła twarda: `index` ⇔ jest w sitemapie ⇔ prerender ma `index,follow`. `noindex` ⇔ nie ma w sitemapie ⇔ prerender ma `noindex,follow`. Każde odchylenie = FAIL z nazwą URL-a i wskazaniem, która warstwa odstaje.
- Naprawa wykrytych rozjazdów: `/english-for/*` — ustalić jedną decyzję w `pseoIndexPolicy.json` (rekomendacja: persony z policy = `index`, reszta `noindex,follow`), po czym przegenerować prerender i sitemapę tak, by wszystkie trzy warstwy się zgadzały.

### C. Higiena sitemapy i domykanie „discovered – not indexed"
- `scripts/seo/build-blog-index.mjs`: wykluczyć z sitemapy każdy plik zawierający `meta http-equiv="refresh"` (45 stubów) — stub nigdy nie powinien być zgłaszany do indeksacji.
- Nowy audyt `scripts/seo/audit-sitemap-integrity.mjs`: FAIL, gdy w sitemapie jest URL ze stubem redirectu, URL z `noindex`, URL zwracający 404 na liście lokalnych plików, albo duplikat `<loc>`.
- `public/robots.txt`: bez zmian merytorycznych; potwierdzić `Allow` dla botów LLM i utrzymać `Sitemap:`.
- Dokument `docs/seo/gsc-manual-actions.md` uzupełnić o listę URL-i do „Removals"/ponownej indeksacji wygenerowaną z audytu.

### D. Pierwsza realna runda widoczności AI
- Wypełnić `docs/seo/runs/ai-search/<data>.csv` odpowiedziami z ChatGPT Search, Perplexity, Gemini i Claude dla zestawu 30 zapytań z `docs/seo/ai-search-query-set.md` (część ręczna — bez tego trend nie ma punktu odniesienia).
- `npm run seo:ai-search-baseline -- --answers` → `seo:ai-visibility-trend` → `seo:dashboard`.
- `scripts/seo/generate-seo-dashboard.mjs`: sekcja „Routing truth" (rozbicie pass-header / pass-html / fail-no-signal) zamiast surowego licznika fail-i, plus sekcja „Sitemap integrity".

### E. Decyzja o Cloudflare Worker (jawnie zamknięta, nie odkładana)
- **Rekomendacja domyślna:** worker zostaje w repo jako artefakt generowany, ale **wypada z łańcucha prawdy** — audyty nie oczekują nagłówków, dopóki DNS edooqoo.com nie jest proxowany przez Cloudflare. W `cloudflare/worker.mjs` i `docs/seo/gsc-monitoring.md` dopisać nagłówek statusu: `STATUS: NOT ACTIVE ON edooqoo.com`.
- Jeśli zdecydujesz się uruchomić workera (wymaga przełączenia DNS na proxy Cloudflare — czynność poza kodem), włączamy `--strict-headers` i mamy realne 301 zamiast meta refresh. Do zrobienia w osobnym kroku, po Twojej decyzji.

## CI i dokumentacja
- `package.json`: `seo:audit-sitemap-integrity`, `seo:routing-truth` (verify-live-routing --soft + audyt sitemapy + audyt polityki pSEO).
- `.github/workflows/seo-integrity.yml`: dodać `seo:audit-sitemap-integrity` i rozszerzony `seo:audit-pseo-policy` (bez wywołań sieciowych do produkcji — te zostają w `seo-monitoring.yml`).
- `docs/llm-context.md` + `public/llms.txt`: wpis w formacie PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS.
- Pamięć projektu: `mem://seo/indexation-truth-layer`.

## Kolejność wykonania
A (weryfikator) → B (spójność polityki) → C (sitemapa) → D (pomiar) → E (CI + docs + decyzja o workerze).
Po blokach B i C: `npm run seo:audit`, `seo:audit-duplicate-meta`, `seo:audit-cluster-hubs`, `seo:geo-pass`, `seo:repair-snapshot-snippets` — regeneracja treści zawsze resetuje długości meta.

## Reguły ochronne
- Zero zmian w silniku generowania worksheetów (sanctity rule).
- Zero zmian w logice biznesowej aplikacji — sprint dotyka wyłącznie warstwy SEO, skryptów, prerenderu i dokumentacji.
- Baseline `audit-duplicate-meta` (slugTitles 17 / longTitles 3 / longDescriptions 0) nie może się pogorszyć.

## Kryteria akceptacji
- `verify-live-routing`: 0 pozycji `fail-no-signal` (poza jawnie zaakceptowanymi personami bez prerenderu, jeśli świadomie zostają SPA-only).
- `audit-pseo-index-policy`: 0 rozjazdów między policy / prerender / sitemap.
- `audit-sitemap-integrity`: PASS; 0 stubów redirectu i 0 URL-i `noindex` w sitemapie.
- `docs/seo/ai-visibility-trend.generated.md` zawiera co najmniej jedną rundę z `answered > 0`.
- Wszystkie dotychczasowe audyty nadal PASS.
