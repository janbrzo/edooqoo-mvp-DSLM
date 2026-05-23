# Plan v6.9.23 (rev3) — Dokończenie H2–H8 + wyjaśnienie GSC sitemap

---

## Część A — Wyjaśnienie sprawy z Google Search Console (Twoje pytanie)

### Co widzę na Twoich zrzutach

**Zrzut 1 (image-187):** masz już dodaną mapę witryny `https://edooqoo.com/sitemap.xml`, przesłaną i odczytaną przez Google **18 maja 2026**, status **"Sukces"**, **23 wykryte strony**.

**Zrzut 2 (image-188):** próbujesz dodać drugą mapę wpisując tylko `sitemap.xml` — Google odpowiada **"Nieprawidłowy adres mapy witryny"**.

### Dlaczego pojawia się błąd

Twoja właściwość w GSC to **Domain property** (`sc-domain:edooqoo.com`), nie URL-prefix. Dla Domain property Google wymaga w polu wpisania:

- albo pełnego URL: `https://edooqoo.com/sitemap.xml`
- albo ścieżki ze slashem na początku: `/sitemap.xml`

Sam `sitemap.xml` (bez slasha) jest interpretowany jako URL względny → niepoprawny → błąd. To **nie jest** problem z plikiem na serwerze — plik istnieje, jest serwowany z HTTP 200 i już raz został odczytany.

### Co realnie trzeba zrobić (a czego NIE trzeba)

**NIE musisz** dodawać sitemap drugi raz. Już istnieje wpis dla `https://edooqoo.com/sitemap.xml`. Google co kilka dni automatycznie sam pobiera ten plik ponownie i indeksuje nowe URL-e.

**Liczba "23 wykryte strony"** to **stary stan** sitemap sprzed naszych zmian — pochodzi z odczytu 18 maja 2026, kiedy plik zawierał ~23 URL-e (głównie core React routes). Po naszym deploy plik zawiera 1736 URL-i, ale Google **jeszcze nie pobrał** zaktualizowanej wersji.

### Trzy opcje (od najmniej do najbardziej agresywnej)

**Opcja A — Nic nie rób, poczekaj (rekomendacja):**

- Google sam re-fetchuje sitemap co 1–7 dni.
- Liczba "Wykryte strony" zaktualizuje się automatycznie do ~1736 w ciągu tygodnia.
- Plus: nie ryzykujesz pomyłki w GSC.
- Minus: czekanie do 7 dni na zauważenie przez Google nowych URL-i.

**Opcja B — Wymuś re-fetch ręcznie (zalecane jeśli ci pilno):**

1. Na liście "Przesłane mapy witryn" kliknij **trzy kropki ⋮** po prawej stronie wpisu `https://edooqoo.com/sitemap.xml`.
2. Wybierz **"Usuń mapę witryny"** ("Remove sitemap"). To tylko czyści zapis o przesłaniu, nie kasuje pliku z serwera.
3. W polu "Dodaj nową mapę witryny" wpisz `**https://edooqoo.com/sitemap.xml**` (pełny URL — to ważne, bo `sitemap.xml` samodzielnie nie działa dla Domain property — to właśnie ten błąd, który widziałeś).
4. Klik **PRZEŚLIJ**.
5. Status powinien przejść na "Sukces" w 5–30 minut, "Wykryte strony" w 24–72h zaktualizuje się na liczbę bliską 1736.

**Opcja C — Pójście dalej (do rozważenia za 2–4 tygodnie po H1):** dodać dodatkowo dynamiczną sitemap galerii jako osobny wpis:

- `https://abc.supabase.co/functions/v1/regenerate-gallery-sitemap` (już istnieje, sprawdziłem w `supabase/functions/regenerate-gallery-sitemap/index.ts`).
- To pokaże Google strony `/gallery/<slug>` publikowane przez nauczycieli, oddzielnie od głównej sitemap.
- Ale nie pilne — najpierw stabilizujemy 1736 URL-i z głównej sitemap.

### Co zrobimy w kodzie w tym sprincie

**Nic specjalnego dla GSC** — plik `public/sitemap.xml` już jest, już ma 1736 URL-i, już jest serwowany z HTTP 200. Akcja w GSC to **wyłącznie Twoja ręczna interakcja** po deploy. Dodam za to do dokumentacji `mem://seo/google-search-console-sitemap-workflow.md` notatkę: dla Domain property zawsze wpisywać pełny URL, nie samo "sitemap.xml".

---

## Część B — Stan obecny (co już zrobione w v6.9.21 i v6.9.22)

### Plan v6.9.21 — wykonany w pełni:

- `GalleryExerciseRenderer.tsx` (29 typów ćwiczeń, read-only).
- `legacyLinkMap.ts` + `resolveLegacyHref.ts` (v1, potem uproszczone w v6.9.22 do passthrough).
- `supabase/functions/_shared/modelFailureLogger.ts` — istnieje, wpięty w `generate-audio`.
- `scripts/audit-llm-models.ts` (Procedure B, Deno).
- Migracja: `error_code='model_deprecation'/'model_failure'` w `error_logs` + RPC `get_active_model_issues()`.
- Czerwony baner na `StatusPage.tsx` (aktywne issues z ostatnich 24h).
- `submit-bug-report` — funkcja edge istnieje, gotowa na ENV.

### Plan v6.9.22 — Sprint H1 wykonany:

- **277 statycznych HTML** przywróconych w `public/blog/` (207) i `public/` (70).
- `scripts/seo/build-blog-index.mjs` — skrypt istnieje.
- `public/sitemap.xml` → **1736 URL-i** (1459 React/pSEO + 277 static HTML).
- `Blog.tsx`, `Resources.tsx`, `GlobalFooter.tsx` używają `<a href>` dla `.html` (full-page nav, opuszcza SPA).
- `resolveLegacyHref.ts` uproszczony do passthrough, bez `comingSoon`.
- `toText()` helper w `GalleryExerciseRenderer.tsx` — częściowo (sweep w H3 tego sprintu).

### Weryfikacja produkcji (zrobiona):


| URL                                                   | HTTP  |
| ----------------------------------------------------- | ----- |
| `/modal-verbs-worksheets-esl.html`                    | 200 ✅ |
| `/blog/reading-comprehension-activities-english.html` | 200 ✅ |
| `/business-english-worksheet-generator.html`          | 200 ✅ |
| `/edooqoo-vs-magicschool.html`                        | 200 ✅ |


**Wniosek: Problem 4 (legacy SEO) rozwiązany na produkcji.**

---

## Część C — Sprinty H2–H8 do wykonania (pełna specyfikacja)

### H2 — Persystencja stanu Publish (Problem 1A)

**Co jest źle:** po publikacji worksheetu i odświeżeniu strony przycisk "Public" wraca do "Publish". `PublishWorksheetButton` przyjmuje propsy `isPublic` i `publicSlug`, ale callsite nie przekazuje danych z bazy.

**Diagnoza:** kolumny `worksheets.is_public` (bool), `worksheets.public_slug` (text), `worksheets.published_at` (timestamptz) istnieją (migracja Sprint 3). Hook `useWorksheetState` ładuje rekord, ale nie wyłuskuje tych pól; `WorksheetPage` renderuje button bez nich; button ma lokalny stan, który nie jest hydratowany przy mount.

**Zmiany (3 pliki):**

1. `**src/hooks/useWorksheetState.tsx**` — rozszerzyć stan o `isPublic: boolean` i `publicSlug: string | null`; w mapperze worksheet → state wyciągnąć `is_public` i `public_slug` z rekordu; zwrócić w obiekcie hooka.
2. `**src/pages/WorksheetPage.tsx**` (potwierdzić callsite przez `rg "PublishWorksheetButton"`) — wyciągnąć `isPublic`, `publicSlug` z hooka i przekazać jako propsy do `<PublishWorksheetButton>`.
3. `**src/components/worksheet/PublishWorksheetButton.tsx**` — dodać `useEffect(() => { setPub(isPublic); setSlug(publicSlug); }, [isPublic, publicSlug])` żeby button re-syncował się przy hydratacji propsów.

**Test akceptacyjny:** Publish → F5 → button pokazuje "Public" + otwiera dialog z opcją Unpublish.

---

### H3 — Dokończenie `toText()` w GalleryExerciseRenderer (Problem 1B)

**Co jest źle:** strona galerii pokazuje `[object Object]` w zadaniach typu `categorize`. AI generuje items jako obiekty `{ text: "museum", category: "places" }`, a JSX renderuje surowo `{item}` → React stringifikuje to jako `[object Object]`.

**Zmiany (1 plik, `src/components/gallery/GalleryExerciseRenderer.tsx`):**

Sweep wszystkich miejsc, gdzie renderowany jest element tablicy z `ex.items/pairs/options/lines/steps/statements`:


| Case                  | Pole           | Fix                                            |
| --------------------- | -------------- | ---------------------------------------------- |
| `categorize`          | `items[]`      | `{toText(it)}`                                 |
| `matching`            | `pairs[]`      | `{toText(pair.left)}` ↔ `{toText(pair.right)}` |
| `dialogue`            | `lines[]`      | `{toText(l.speaker)}: {toText(l.text)}`        |
| `sequence`/`ordering` | `steps[]`      | `{toText(step)}`                               |
| `true-false`          | `statements[]` | `{toText(s.text                                |
| `multiple-choice`     | `options[]`    | `{toText(opt)}` (prewencyjnie)                 |


Reguła: każde `{var}` w JSX wewnątrz tego pliku, gdzie `var` może być obiektem AI-generated → opakować w `toText()`.

**Test akceptacyjny:** `/gallery/choosing-your-adventure-activities-in-a-new-city-8d1f6a` → brak `[object Object]`.

---

### H4 — Signup return-to flow (Problem 2)

**Co jest źle:** "sign up free" na `/gallery/...` → modal `/signup` → X → ląduje na `/` zamiast wrócić na `/gallery/...`. Tracimy kontekst i intencję użytkownika.

**Rozwiązanie:**

1. **Nowy hook `src/hooks/useSignupLinkState.ts`:**

```ts
import { useLocation, useNavigate } from 'react-router-dom';

export function useSignupLinkState() {
  const loc = useLocation();
  const nav = useNavigate();
  const goToSignup = (opts?: { replace?: boolean }) =>
    nav('/signup', {
      state: { from: loc.pathname + loc.search },
      replace: opts?.replace
    });
  return { goToSignup, currentPath: loc.pathname + loc.search };
}
```

2. `**src/pages/Signup.tsx**` — w handlerze close/X:

```ts
const location = useLocation();
const from = (location.state as any)?.from || '/';
const handleClose = () => nav(from, { replace: true });
```

Również po pomyślnej rejestracji: jeśli `from` istnieje, redirect tam; inaczej zachowanie obecne (`/dashboard`).

3. **Callsite'y (~16 miejsc)** — wszystkie `<Link to="/signup">` i `navigate('/signup')` zamienić na `goToSignup()`. Priorytetowo:
  - `src/pages/gallery/PublicGalleryWorksheetPage.tsx` (CTA "Try 1-Minute Prep free" i "sign up free")
  - `src/pages/WorksheetPage.tsx` (anon CTA)
  - `src/pages/PublicBookingPage.tsx`
  - `src/components/GlobalFooter.tsx`, `StickyNav.tsx`, hero CTA, anon banery
  - Pełny zbiór: `rg "/signup" src/ -l`

**Test akceptacyjny:** klik z `/gallery/...` → modal → X → wracam dokładnie tam. To samo z `/pricing`.

---

### H5 — SSE heartbeat + silent retry (Problem 6)

**Co jest źle:** stream `generateWorksheet` umiera po 40s ciszy → fałszywy modal "Connection lost — server stopped responding for 40s". Token nie jest zużywany, ale UX = zły.

**Dwustronne rozwiązanie:**

#### H5a — Serwer: heartbeat

`**supabase/functions/generateWorksheet/index.ts**` (część SSE writer) — co 15s wysyłka komentarza SSE (`: keepalive`), który parser klienta ignoruje, ale TCP keep-alive jest zachowany:

```ts
const heartbeat = setInterval(() => {
  try { writer.write(encoder.encode(`: keepalive ${Date.now()}\n\n`)); }
  catch { clearInterval(heartbeat); }
}, 15000);
try {
  // ... istniejąca logika streamingu
} finally {
  clearInterval(heartbeat);
  await writer.close();
}
```

#### H5b — Klient: silent retry

`**src/services/worksheetStreamService.ts**`:

- Watchdog timeout 40s → **45s** (margines dla 3× heartbeat).
- Dodać `retryCount` w closure.
- Pierwszy timeout I `retryCount === 0` → **cicho** zrestartuj request (bez `onError`, bez toast), inkrementuj `retryCount`.
- Drugi timeout → standardowy `onError` → modal jak teraz.
- Refaktor: wydzielić logikę startującą stream do `startStream()`, żeby retry mógł ją wywołać ponownie.

**Test akceptacyjny:**

- Symulacja: `await new Promise(r => setTimeout(r, 30000))` w środku `generateWorksheet` → klient nie pokazuje modala.
- Symulacja: kill edge function pośrodku → klient cicho retryuje raz, drugi fail → modal.

---

### H6 — Monitoring modeli LLM kompleksowo (Problem 5)

**Rekonstrukcja A–Z, dlaczego deprecation `gpt-4o-audio-preview` zaskoczył:**

A. Nauczyciel zgłosił bug: nie działa generowanie audio.
B. Diagnoza: `generate-audio` używało `gpt-4o-audio-preview` → OpenAI go zdeprecjonowało bez ostrzeżenia.
C. Bugfix (już zrobiony): rozdzielenie na `gpt-4o-mini` (transcript) + `tts-1` (TTS). Działa.
D. Plan v6.9.21 dodał: `logModelFailure`, RPC, baner na `/status`, skrypt audytu.
E. Co realnie działa: infrastruktura zbudowana, ale logger wpięty tylko w 1 z 12 funkcji, skrypt audytu manualny (nikt go nie uruchamia), brak tabeli historii.
F. Co naprawiamy w H6: dystrybucja loggera, tabela `model_health_checks`, codzienny cron 06:00 UTC.

#### H6a — `logModelFailure` w 11 pozostałych funkcjach

Wzór: w bloku `catch` po fetch do providera lub przed `throw` gdy `!response.ok`:

```ts
if (response.status === 404 || response.status === 410 || response.status >= 500) {
  await logModelFailure({
    model,
    provider: 'openai', // lub 'google', 'anthropic', 'elevenlabs', 'lovable-gateway'
    status: response.status,
    endpoint: '/v1/chat/completions',
    error: errorText,
    functionName: 'generateWorksheet'
  });
}
```

Funkcje do wpięcia (11):

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

#### H6b — Tabela `model_health_checks` (migracja)

```sql
CREATE TABLE public.model_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL,
  model text NOT NULL,
  http_status int,
  severity text NOT NULL CHECK (severity IN ('ok','warning','critical','skipped')),
  details jsonb
);

ALTER TABLE public.model_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.model_health_checks
  FOR ALL USING (false);

CREATE INDEX idx_mhc_checked_at ON public.model_health_checks(checked_at DESC);
CREATE INDEX idx_mhc_severity ON public.model_health_checks(severity)
  WHERE severity IN ('critical','warning');
```

#### H6c — Nowa edge function `audit-llm-models`

`supabase/functions/audit-llm-models/index.ts`:

- Port logiki ze skryptu Deno do edge function.
- Live-check przeciw OpenAI / Google / Anthropic / ElevenLabs / Lovable.
- Dla każdego modelu wpis do `model_health_checks`.
- Gdy `severity='critical'` (HTTP 404/410) → dodatkowo `logModelFailure()`, żeby baner na `/status` zaświecił się natychmiast.
- Zwraca JSON: `{checked: N, critical: X, warning: Y, ok: Z}`.

#### H6d — Cron daily 06:00 UTC

```sql
SELECT cron.schedule(
  'daily-llm-model-audit',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/audit-llm-models',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Test akceptacyjny:** ręcznie `POST /functions/v1/audit-llm-models` → JSON. `SELECT * FROM model_health_checks ORDER BY checked_at DESC LIMIT 20;` → wpisy widoczne.

---

### H7 — `BUG_REPORT_FROM_EMAIL` (Problem 3)

**Stan:** sekret dodany; funkcja `submit-bug-report` go nie czyta.

**Zmiana (1 plik, `supabase/functions/submit-bug-report/index.ts`):**

```ts
const fromAddr = Deno.env.get('BUG_REPORT_FROM_EMAIL')
              || 'Edooqoo Bugs <notifications@edooqoo.com>';
// w body do Resend:
from: fromAddr,
```

**Test akceptacyjny:** wyślij bug → mail z `From: Edooqoo Bugs <notifications@edooqoo.com>`.

---

### H8 — Dokumentacja, memory, sprzątanie

#### H8a — Uruchomienie skryptu blog index

`bun scripts/seo/build-blog-index.mjs` → wygeneruje `src/data/blogIndex.ts` z 277 wpisami; `Blog.tsx` automatycznie pokaże pełną listę.

#### H8b — RAG injection do `docs/llm-context.md` + `llms.txt` + `public/llms.txt`

Format: **Problem → Edooqoo.com Solution → Technical Mechanics + RAG Keywords**

Nowe sekcje:

1. **Publish State Persistence** — prop drilling z DB → hook → button, `useEffect` re-sync.
2. **Signup Return-To Navigation** — hook `useSignupLinkState`, `state.from`, `nav(from, {replace})`.
3. **SSE Keepalive (15s heartbeat + 1 silent retry)** — server `: keepalive`, client `retryCount`, watchdog 45s.
4. **Multi-Provider Model Monitoring** — trójwarstwowe: passive (`logModelFailure` w 12 funkcjach) + active (cron 06:00 UTC `audit-llm-models`) + surfacing (RPC + baner `/status`); tabela `model_health_checks` jako historia.
5. **Static HTML SEO Sanctity** — 277 stron w `public/`, nigdy nie kasować, sitemap zawiera wszystkie.
6. **Google Search Console Sitemap Workflow** — dla Domain property wpisywać pełny URL `https://edooqoo.com/sitemap.xml`, nigdy `sitemap.xml`; istniejący wpis Google sam refreshuje co 1–7 dni; przyspieszenie = remove+re-add przez ⋮ menu.

#### H8c — Nowe pliki memory (`mem/`)

1. `mem/features/worksheet/publish-state-persistence.md` (feature)
2. `mem/features/navigation/signup-return-to-state.md` (feature)
3. `mem/infrastructure/sse-keepalive-pattern.md` (feature)
4. `mem/infrastructure/model-health-monitoring.md` (uzupełnia istniejący `multi-provider-model-audit.md` o cron + tabelę)
5. `mem/seo/google-search-console-sitemap-workflow.md` (preference/reference) — Domain property requires full URL; existing sitemap entry auto-refreshes; force re-fetch via remove+re-add.
6. Update `mem/index.md` — dopisać 5 wpisów (zachowując całą istniejącą zawartość, bo `code--write` zastępuje plik).

---

## Część D — Kolejność wykonania


| #   | Sprint | Pliki                               | Ryzyko                |
| --- | ------ | ----------------------------------- | --------------------- |
| 1   | H7     | 1                                   | minimalne             |
| 2   | H3     | 1                                   | niskie                |
| 3   | H2     | 3                                   | niskie                |
| 4   | H8a    | 1 cmd                               | minimalne             |
| 5   | H6a    | 11                                  | niskie                |
| 6   | H4     | 17                                  | średnie (regresja UX) |
| 7   | H5     | 2                                   | średnie (timing)      |
| 8   | H6b–d  | migracja + edge function + cron SQL | średnie               |
| 9   | H8b+c  | docs + 5 mem + index                | minimalne             |


Razem: ~38 plików, 1 migracja, 1 cron, 1 nowa edge function.

---

## Część E — Smoke testy po deploy

1. **H1 (już live):** `curl -I /edooqoo-vs-magicschool.html` → 200 ✅ / `/blog/ai-generated-listening-exercises-esl.html` → 200 ✅.
2. **H2:** publish → F5 → button = "Public".
3. **H3:** `/gallery/<dowolny>` → brak `[object Object]`.
4. **H4:** `/gallery/...` → klik "sign up free" → modal → X → wracasz na `/gallery/...`.
5. **H5:** wygenerowanie worksheet z ~60s opóźnieniem → brak modala "Connection lost".
6. **H6:** ręcznie `POST /functions/v1/audit-llm-models` → wpisy w `model_health_checks`.
7. **H7:** bug report → mail z `notifications@edooqoo.com`.
8. **H8:** `/blog` → > 200 wpisów.

---

## Część F — Akcje po Twojej stronie (manual, po deploy)

1. **Google Search Console** — opcja B (rekomendowana):
  1. Wejdź: [https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aedooqoo.com](https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aedooqoo.com)
  2. Klik ⋮ przy `https://edooqoo.com/sitemap.xml` → "Usuń mapę witryny". zrobiłem przed chwilą
  3. W polu wpisz **pełny URL** `https://edooqoo.com/sitemap.xml` (nie samo `sitemap.xml` — to powoduje błąd, który widziałeś). zrobiłem przed chwilą
  4. PRZEŚLIJ → status "Sukces" w 5–30 min → "Wykryte strony" rośnie do ~1736 w 24–72h.
2. (Po 2 tyg.) Sprawdzenie zakładki "Strony" w GSC → ile "Indexed" vs "Discovered – not indexed". Cel: 60–80% z 1736 w 4–8 tyg.
3. Akceptacja planu → implementacja od H7 → H3 → H2 → H8a → H6a → H4 → H5 → H6b-d → H8b+c.

---

## Część G — Czego NIE robimy w tym sprincie

- ❌ Sprint 5 (AEO/LLMO, `llms-full.txt`, JSON-LD sweep) — osobna tura.
- ❌ Sprint 6 (4 long-form artykuły Marthy) — ręczny copywriting.
- ❌ sitemap-index.xml (rozdzielenie głównej + gallery dynamic) — przy >50k URL-i.
- ❌ Dalsza ekspansja pSEO (>3000 URL-i) — po obserwacji indexacji 4–6 tyg.

**Akceptujesz? Po Twoim "tak" zaczynam od H7 (1 plik, najtrywialniejszy) i lecę w dół.**