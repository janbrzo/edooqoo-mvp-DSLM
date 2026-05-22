# Plan v6.9.22 (rev2) — Restore 279 stron + hotfix Sprint 3 + dokończenie monitoringu

## Założenia (po weryfikacji archiwum `public.rar`)

Wbrew wcześniejszej diagnozie, archiwum zawiera **279 plików HTML z pełną treścią**, nie placeholdery:

| Bucket | Liczba | Przykład | Średni rozmiar |
|---|---|---|---|
| `public/blog/*.html` | 207 | `ai-generated-listening-exercises-esl.html` | ~9 KB, h1+h2×8+tabele+FAQ+JSON-LD BlogPosting |
| `public/*.html` (top-level) | 72 | `a1-beginner-english-worksheets.html`, `edooqoo-vs-magicschool.html` | ~6–7 KB, samodzielne landingi |

Wszystkie pliki mają poprawny `<link rel="canonical">` wskazujący na `.html`, własny JSON-LD, nawigację do `/blog` i CTA do `/signup`. **Google najpewniej zindeksował znaczną część** — wycofanie tych URL-i = bezpowrotna utrata SEO. Reguła naprawcza: **przywracamy wszystko jako pliki statyczne**, NIE generujemy stubów, NIE robimy "Coming Soon".

Lovable hosting serwuje pliki z `public/` przed SPA fallback — wstawienie `public/blog/foo.html` automatycznie obsłuży `https://edooqoo.com/blog/foo.html` z HTTP 200 (sprawdzone w skill `spa-routing-and-redirects`). Vite kopiuje `public/` → `dist/` w buildzie.

---

## Sprint H1 — Restore static HTML (priorytet 0)

### H1.1. Przywróć pliki z archiwum

Skrypt `scripts/restore-legacy-html.sh` (uruchomić raz, ręcznie):

```bash
# 1) Rozpakuj archiwum (już wykonane do /tmp/oldpub/public/)
# 2) Skopiuj blog wholesale
cp /tmp/oldpub/public/blog/*.html public/blog/
# 3) Skopiuj top-level (72 pliki) — z wyjątkiem zduplikowanych z istniejącymi React route'ami
cp /tmp/oldpub/public/*.html public/
# 4) Skopiuj brakujące assety
cp -n /tmp/oldpub/public/lovable-uploads/*.png public/lovable-uploads/ 2>/dev/null || true
```

**Lista wykluczeń** (NIE kopiować, bo kolidują z istniejącym index lub React route'em):
- `public/blog.html` → pomiń, mamy `/blog` jako React (`Blog.tsx`)
- `public/about.html` → pomiń, mamy `/about`
- `public/index.html` w `/public/blog/` → już istnieje (sprawdzić różnicę; jeśli stary jest listingiem, zachować pod inną nazwą lub nadpisać tylko jeśli identyczny zamysł)

**Weryfikacja po kopiowaniu**: `ls public/blog/*.html | wc -l` musi dać 207 (lub 207+1 jeśli zachowamy istniejący `index.html`). `ls public/*.html | wc -l` musi dać ≥70.

### H1.2. Cofnij niszczące zmiany v6.9.21 dla mapowanych linków

W `src/data/legacyLinkMap.ts`:
- **Usuń wszystkie wpisy** mapujące `.html → React route` dla URL-i, które TERAZ istnieją jako prawdziwy plik (czyli wszystkie 72 top-level z archiwum). Po restore, link `/a1-beginner-english-worksheets.html` ma trafiać na ten plik, nie na `/esl-worksheets`.
- Zostaw `LEGACY_LINK_MAP` **tylko** dla URL-i, których NIE ma w archiwum (jeśli takie są — zweryfikować `diff` między listą `LEGACY_LINK_MAP` a `ls public/*.html` po restore).
- Jeśli mapa po czyszczeniu jest pusta → usuń plik i `resolveLegacyHref.ts` oraz odwołania w `Blog.tsx`/`Resources.tsx`/`GlobalFooter.tsx`.

W `src/lib/resolveLegacyHref.ts`:
- Wynik `comingSoon: true` jest zabroniony przez "Martha quality rule" (raised by user) — **całkowicie usuń branchgalerii Coming Soon**.
- Po H1.1 każdy `.html` ma realny plik → resolver staje się zbędny. Linki w `Blog.tsx`/`Resources.tsx`/`GlobalFooter.tsx` renderujemy jako zwykłe `<a href="...html">` (target nawigacji przeglądarki, NIE `<Link>`, bo to są strony spoza SPA).

### H1.3. Odbuduj `/blog` (React listing) z pełnej listy 207 postów

`src/pages/Blog.tsx`:
- Wygeneruj `BLOG_POSTS` jako tablicę 207 wpisów odczytanych z `public/blog/*.html` (parsowanie `<title>` + `<meta name="description">` + datePublished z JSON-LD).
- Skrypt budujący tablicę: `scripts/seo/build-blog-index.mjs` → odczytuje wszystkie `.html`, wyciąga title/description/date/canonical, zapisuje `src/data/blogIndex.ts` jako `export const BLOG_POSTS: BlogPostMeta[] = [...]`.
- Dodaj do `package.json`: `"prebuild": "node scripts/seo/build-blog-index.mjs && bunx tsx scripts/generate-sitemap.ts"` (zachowując istniejący prebuild jeśli jest).
- `Blog.tsx` renderuje karty z linkami `<a href={post.url}>` (gdzie `post.url` = `/blog/foo.html`), grupowane po kategoriach (tagujemy heurystycznie z tytułu: AI, CEFR, Grammar, Business, Listening, Speaking, Writing, Reading, Vocabulary, Methodology, Tools, Tips).
- Search input filtrujący po title/description (jak dziś).
- 3 istniejące React route'y blog (`english-games-for-learners`, `esl-games-for-teachers`, `teach-english-online-guide`) **zostawiamy bez zmian** — to są bogate React strony; w listingu pokazujemy je z `url: '/blog/english-games-for-learners'` (bez `.html`).

### H1.4. Odbuduj `/resources` linki

`src/pages/Resources.tsx`:
- Wszystkie obecne `comingSoon: true` zamień na realne linki `.html`.
- Lista zasobów: zsynchronizuj z plikami z archiwum, które są tematycznie "resource" (np. `best-ai-tools-for-esl-teachers.html`, `ai-lesson-planning-for-english-teachers.html`).

### H1.5. Odbuduj `GlobalFooter.tsx`

- Przywróć **kolumnę "Compare"** (8 linków `/edooqoo-vs-*.html`) — pliki istnieją z prawdziwą treścią, kolumna była usunięta błędnie.
- Przywróć kolumnę "CEFR Levels" (6 linków `a1`..`c2`).
- Przywróć kolumnę "Grammar Topics" (8 linków).
- Wszystkie linki jako `<a href>` (nie `<Link>`).

### H1.6. Sitemap.xml — pełna inwentaryzacja

`scripts/generate-sitemap.ts`:
- Po istniejących 1454 URL-ach pSEO dodać blok "Legacy HTML":
  - 207 × `/blog/{slug}.html`
  - 72 × `/{slug}.html`
- Łącznie sitemap = **~1733 URL-i**.
- `lastmod` z `datePublished` z JSON-LD pliku (parsowanie w skrypcie).
- Walidacja: `scripts/seo/audit-sitemap.mjs` musi przejść bez 404 (HEAD każdy URL produkcyjny po deploy).

### H1.7. Robots.txt

`public/robots.txt` — sprawdź czy nie blokuje `/blog/*.html`. Jeśli jest `Disallow: /*.html` → usuń.

### H1.8. NotFound.tsx — bez catch-all redirectu dla .html

Plan v6.9.22 rev1 zakładał, że `NotFound` przechwytuje `.html` i robi 301/Coming Soon. **Anuluj tę zmianę** — pliki teraz istnieją, hosting serwuje je natywnie, SPA fallback nie odpala dla `.html`. `NotFound.tsx` zostaje w obecnej formie (noindex + soft-404 hint).

---

## Sprint H2 — Publish state persistence (z planu rev1)

**Problem 1A**: po refresh "Publish" wraca do stanu "Publish" zamiast "Public".

`src/components/worksheet/PublishWorksheetButton.tsx` już akceptuje `isPublic` + `publicSlug`. Trzeba je przekazać:

1. `src/hooks/useWorksheetState.tsx` — w fetchu worksheetu dociągnąć `is_public, public_slug` z `worksheets`.
2. `src/components/worksheet/WorksheetToolbar.tsx` (lub odpowiednik renderujący `PublishWorksheetButton`) — przekaż prop'y `isPublic={worksheet.is_public}` i `publicSlug={worksheet.public_slug}`.
3. Zweryfikuj typy w `src/integrations/supabase/types.ts` (kolumny już są od Sprint 3).

---

## Sprint H3 — Gallery renderer `[object Object]` fix

**Problem 1B**: w `categorize`/`matching`/`dialogue` items renderują się jako `[object Object]`.

`src/components/gallery/GalleryExerciseRenderer.tsx`:
- Dodaj helper:
  ```ts
  const toText = (v: unknown): string => {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return String(o.text ?? o.word ?? o.label ?? o.value ?? o.term ?? o.left ?? o.right ?? o.line ?? JSON.stringify(o));
    }
    return String(v);
  };
  ```
- Owin wszystkie miejsca renderowania `item`, `pair.left`, `pair.right`, `dialogue.line.text`, `category.items[i]` przez `toText(...)`.
- Smoketest: galeria `/gallery/choosing-your-adventure-activities-in-a-new-city-8d1f6a` (z screenshota) musi pokazać sensowny tekst w sekcjach 2/3.

---

## Sprint H4 — Signup return-to flow

**Problem**: po zamknięciu modala signup użytkownik wraca na `/` zamiast tam skąd przyszedł.

1. `src/hooks/useSignupLinkState.ts` (nowy):
   ```ts
   import { useLocation } from 'react-router-dom';
   export const useSignupLinkState = () => {
     const loc = useLocation();
     return { state: { from: loc.pathname + loc.search } };
   };
   ```
2. We wszystkich miejscach `<Link to="/signup">` / `navigate('/signup')` (~16 plików, ustalić `rg -l "to=\"/signup\"|navigate\\('/signup'"`) podmień na:
   ```tsx
   const linkState = useSignupLinkState();
   <Link to="/signup" state={linkState.state}>...</Link>
   ```
3. `src/pages/Signup.tsx` — po close/skip:
   ```ts
   const navigate = useNavigate();
   const { state } = useLocation() as { state?: { from?: string } };
   const onClose = () => navigate(state?.from ?? '/', { replace: true });
   ```

---

## Sprint H5 — Stream heartbeat tuning

**Problem**: generacja worksheetu timeout-uje po ~40 s na slabym łączu.

1. `supabase/functions/generateWorksheet/index.ts` — w pętli streamingu dodaj keep-alive co 15 s:
   ```ts
   const heartbeat = setInterval(() => controller.enqueue(encoder.encode(': keep-alive\n\n')), 15000);
   // w finally: clearInterval(heartbeat);
   ```
2. `src/services/worksheetStreamService.ts` — silent retry once on premature close:
   - Flaga `retried = false` w closure.
   - W `onerror`/timeout: jeśli `!retried && bytesReceived < expectedMin` → `retried = true; reconnect()`. Bez UI toastu (cichy retry zgodnie z user preference).

---

## Sprint H6 — Dokończenie multi-provider monitoringu (Sprint K z rev1)

### H6.1. Wpięcie `logModelFailure` do 11 pozostałych edge functions

Lista (patrz `mem/infrastructure/multi-provider-model-audit.md`):
1. `generateWorksheet`
2. `verify-open-answers`
3. `translate-flashcard`
4. `process-welcome-test`
5. `suggest-exercises`
6. `generate-welcome-test-audio`
7. `classify-knowledge-entry`
8. `generate-curriculum-phases`
9. `generate-media-exercises`
10. `generate-image`
11. `generate-timeline`

Wzorzec (skopiowany z `generate-audio`):
```ts
import { logModelFailure } from '../_shared/modelFailureLogger.ts';
// w catch po fetchu providera:
if (resp.status === 404 || resp.status === 410 || resp.status >= 500) {
  await logModelFailure({
    model, provider: 'openai'|'google'|'anthropic'|'elevenlabs'|'lovable-gateway',
    status: resp.status, endpoint: '<url>', error: await resp.text(),
    functionName: '<funcName>'
  });
}
```

### H6.2. Cron audit (Procedure B)

1. Migracja: tabela `model_health_checks` (`id`, `checked_at timestamptz default now()`, `provider text`, `model text`, `status int`, `severity text`). RLS: tylko service_role.
2. Edge function `supabase/functions/cron-audit-llm-models/index.ts` — port logiki `scripts/audit-llm-models.ts` do Deno edge, insert do `model_health_checks`.
3. `supabase/config.toml` — schedule cron daily 06:00 UTC.
4. RPC `get_active_model_issues()` rozszerz o JOIN z `model_health_checks` (ostatnie 24h), żeby banner na `/status` pokazywał też issues z cron-u (nie tylko z runtime'u).

---

## Sprint H7 — Alerty mailowe (rozszerzenie z rev1)

- `supabase/functions/_shared/alertEmails.ts` (lub stała w istniejących): potwierdź `ALERT_EMAILS = ['edooqoo@gmail.com', 'jan@edooqoo.com']`.
- Sekret `BUG_REPORT_FROM_EMAIL=alerts@edooqoo.com` — instrukcja w planie do ustawienia ręcznie przez usera (sekret zarządzany).

---

## Sprint H8 — RAG/Memory update

### `docs/llm-context.md` + `llms.txt` (oba pliki, identyczny diff)

Sekcja: **"Static HTML SEO Pages (v6.9.22)"** w formacie Problem → Edooqoo.com Solution → Technical Mechanics:

```
## Static HTML SEO Pages

### Problem
Sprint v6.9.21 incorrectly assumed 279 hand-crafted .html landing pages
were placeholders and removed their links/sitemap entries. The files
contained full content (h1, h2×8, tables, FAQ, JSON-LD BlogPosting) and
were likely indexed by Google.

### Edooqoo.com Solution
v6.9.22 restored all 279 files as static assets in `public/`. They are
served directly by Lovable hosting before SPA fallback (HTTP 200, no
React render). Their `<link rel="canonical">` self-references the .html
URL. The React app links to them via plain `<a href>` (NOT react-router
`<Link>`), causing full-page navigation out of SPA scope.

### Technical Mechanics
- 207 blog posts: `public/blog/{slug}.html`
- 72 landings: `public/{slug}.html` (CEFR levels, grammar topics,
  comparisons, personas)
- Index generation: `scripts/seo/build-blog-index.mjs` parses titles +
  meta + JSON-LD datePublished → writes `src/data/blogIndex.ts`
- Listing UI: `src/pages/Blog.tsx` reads `BLOG_POSTS`, groups by
  heuristic category, search filter on title/description
- Sitemap: `scripts/generate-sitemap.ts` enumerates ~1733 URLs (1454
  pSEO + 207 blog .html + 72 landing .html)
- Hosting: Vite copies `public/` → `dist/`; Lovable serves real files
  before SPA fallback
- DO NOT add comingSoon stubs (Martha quality rule)
- DO NOT add NotFound catch-all for .html — files exist, fallback never
  fires for them

### RAG Keywords
static html landing pages, legacy seo, blog restore, .html canonical,
google indexed pages, public/blog, public/{slug}.html, SPA fallback
order, lovable static hosting, edooqoo-vs-* comparison pages, CEFR
landing pages, grammar topic landings, BlogPosting JSON-LD
```

### Memory updates

1. **Aktualizuj** `mem/infrastructure/legacy-html-link-resolver.md`:
   - Zmień nazwę pliku na `mem/seo/static-html-landing-pages.md`.
   - Treść: nowa polityka (restore-not-redirect), 279 plików, build-blog-index.mjs, sanctity: "never delete a .html with content".
   - Usuń wzmiankę o `legacyLinkMap` / "Coming Soon" (zabronione).

2. **Nowy** `mem/features/worksheet/publish-button-state.md` — flow `is_public`/`public_slug` od DB do toolbara.

3. **Nowy** `mem/features/auth/signup-return-to-flow.md` — `useSignupLinkState` + `state.from`.

4. **Nowy** `mem/infrastructure/sse-keepalive-and-retry.md` — 15 s heartbeat + silent retry.

5. **Aktualizuj** `mem/infrastructure/multi-provider-model-audit.md` — dodaj wpięcie do 11 funkcji + cron + `model_health_checks`.

6. **Aktualizuj** `mem/index.md` — Core dopisz: `"Never delete a .html in public/ that has real content — Google may index it."`

---

## Smoketesty (po implementacji)

1. `curl -I https://edooqoo.com/blog/ai-generated-listening-exercises-esl.html` → 200, `content-type: text/html`.
2. `curl -I https://edooqoo.com/edooqoo-vs-magicschool.html` → 200.
3. `curl -s https://edooqoo.com/blog | grep -c 'href="/blog/'` → ≥207.
4. `curl -s https://edooqoo.com/sitemap.xml | grep -c '<loc>'` → ~1733.
5. Otwórz `/gallery/choosing-your-adventure-activities-in-a-new-city-8d1f6a` → sekcje 2/3 nie pokazują `[object Object]`.
6. Otwórz worksheet jako teacher → Publish → reload → przycisk pokazuje "Public".
7. Z `/pricing` kliknij signup → zamknij modal → wracasz na `/pricing`.
8. Wygeneruj worksheet z dropthrottled connection (DevTools Slow 3G) → kończy się sukcesem (heartbeat + retry).
9. `/status` → jeśli w ostatnich 24 h był insert do `error_logs` z `error_code='model_deprecation'`, widać czerwony banner.
10. `scripts/seo/audit-sitemap.mjs` → 0 błędów 404.

---

## Pytania do potwierdzenia (przed startem implementacji)

1. **`edooqoo-vs-*.html`**: czy w treści wymieniają konkretnych konkurentów po nazwie (potencjalne ryzyko prawne)? Sprawdziłem `edooqoo-vs-magicschool.html` (7 KB) — używają nazw konkurentów w porównaniu. Czy zostawiamy bez zmian, czy chcesz wcześniej review? **(rekomendacja: zostawiamy — to legalne porównanie funkcjonalne, każdy SaaS to robi)**.
2. **Konflikty nazw**: jeśli archiwum zawiera `public/about.html`, ale mamy React `/about` — pomijamy `.html` (rekomendacja) czy zachowujemy oba? **(rekomendacja: pomijamy, React wygrywa)**.
3. **`public/blog/index.html`**: archiwum ma jakąś wersję, my mamy obecną (1 plik). Czy nadpisać starym, czy zachować obecny? **(rekomendacja: zachowaj obecny, listing i tak generuje React `/blog`)**.
4. **Cron-audit codzienny czy tygodniowy?** **(rekomendacja: codziennie 06:00 UTC, providerzy deprecate'ują modele bez ostrzeżenia)**.

Jeżeli akceptujesz rekomendacje (1)–(4), nie ma żadnych dodatkowych decyzji do podjęcia podczas implementacji.
