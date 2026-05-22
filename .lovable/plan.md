# Plan v6.9.21 — Naprawa Post-Sprint 3 + Audyty wieloprovider + Linki + Maile + UI + LinkedIn

Plan napisany od zera, łączy wszystkie 7 problemów. Zachowuje to co już działa po v6.9.20 (audio 2-step, keepalive, CTA do `/admin/error-logs`, Public Gallery infra). Korekty względem wcześniejszych draftów: (a) wszystkie linki `.html` — nie tylko stopka, ale Blog.tsx + Resources.tsx + Footer; (b) audyt modeli pokrywa **wszystkich** providerów (OpenAI, Google Gemini, Anthropic, ElevenLabs, Lovable AI Gateway), nie tylko OpenAI; (c) LinkedIn outreach w stylu „build-in-public" zamiast „kup gotowy DSLM".

---

## SPRINT G — Gallery Rendering Completeness (Problem 1A + 1B)

### G.1 Diagnoza
Obecny `src/pages/gallery/PublicGalleryWorksheetPage.tsx` renderuje tylko: `ex.title`, `ex.instructions`, `ex.content` jako string oraz `ex.questions[]` jako prosta lista. W naszej taksonomii mamy 29 typów ćwiczeń (`src/lib/exerciseTaxonomy.ts`) z różnymi shape'ami payloadu (`items[]`, `pairs[]`, `options[]`, `categories[]`, `transcript`, `imageUrl`, `prompts[]`, `sentences[]`, `words[]`, `dialogue[]`, `gaps[]`, etc.). Stąd „tylko sam tekst" — pozostałe pola są ignorowane.

### G.2 Rozwiązanie: dedykowany read-only renderer

Nowy komponent `src/components/gallery/GalleryExerciseRenderer.tsx`:

- Wejście: `exercise: any, index: number`.
- Wewnętrzny switch po `normalizeExerciseType(exercise.type)` (re-eksport helpera z `ExerciseSection.tsx` lub minimalny lokalny — usuwa sufiksy `-picture`/`-audio`).
- Każdy case renderuje **wyłącznie wizualnie** (zero state'u, zero `<input>`, zero API). Mapa:
  - `reading`/`gap-text` → `<p whitespace-pre-wrap>` + lista `comprehension_questions[]` numerowana
  - `fill-in-blanks`/`fill-in-blanks-audio` → `sentences[]` z `___` (placeholder bez inputu) + lista `word_bank[]` jako badge'y
  - `multiple-choice`/`multiple-choice-picture`/`multiple-choice-audio` → pytania + `options[]` jako lista A/B/C/D (bez radio)
  - `true-false`/`true-false-picture`/`true-false-audio` → `statements[]` z badge'em „True/False" zamiast inputu
  - `matching` → tabela 2-kolumnowa `left | right` z `pairs[]`
  - `matching-halves` → tabela 2-kolumnowa `first | second`
  - `dialogue` → `speakers[]` jako bullet list `**Speaker:** line`
  - `answer-questions`/`answer-questions-picture`/`answer-questions-audio`/`discussion` → ol z `questions[]`
  - `error-correction` → tabela `incorrect | correction` (jeśli jest answer key — pokaż jako szary)
  - `odd-one-out` → grupa słów rzędem, brak akcji
  - `word-order` → linia ze słowami w boxach (shuffled)
  - `negative-prefixes`/`complete-word`/`synonyms`/`antonyms`/`paraphrasing` → tabela 2-kolumnowa input/answer
  - `categorize` → `categories[]` jako grid kolumn, `items[]` jako badge'y nieprzypisane
  - `describe-picture`/`answer-questions-picture` → `<img>` z `imageUrl` (lub `image_url`) + prompty
  - `listening-comprehension` (i `-audio` warianty) → `<audio controls>` z `audio_url` jeśli jest, plus transcript jako szary blok zwijany + pytania
  - default fallback → JSON.stringify w `<pre>` z ostrzeżeniem „Preview not supported"

### G.3 TL;DR/edu banner (Problem 1B — wytłumaczenie formy)

Strona galerii to **preview SEO-friendly**, nie interaktywny worksheet — pokazuje treść by Google/Bing/LLM-crawler mógł zaindeksować pełny content, a człowiek-nauczyciel dostaje smak treści i CTA do rejestracji. Dlatego forma „read-only tekst + struktura" jest świadoma. Dodajemy na górze (`PublicGalleryWorksheetPage.tsx`, nad `<article>`) jasny info-banner:
```tsx
<aside className="container mx-auto max-w-4xl px-4 pt-6">
  <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
    <strong>Preview mode.</strong> This is a static read-only preview of a worksheet a teacher published. Interactive answers, AI grading, audio playback and downloads are available only in the full editor — <Link to="/auth?mode=signup" className="underline font-semibold">sign up free</Link> to generate or open this worksheet interactively.
  </div>
</aside>
```
Plus drobne polerowanie wizualne: każdy `<li>` ćwiczenia dostaje `border-l-4 border-l-primary/40 pl-4`, badge'e typu ćwiczenia w prawym górnym rogu karty.

### G.4 Plik do edycji
- **Edycja** `src/pages/gallery/PublicGalleryWorksheetPage.tsx`: zamienia w pętli `parsed.exercises.map(...)` aktualne renderowanie na `<GalleryExerciseRenderer exercise={ex} index={i} />`.
- **Nowy plik** `src/components/gallery/GalleryExerciseRenderer.tsx`.
- Bez zmian w DB, bez zmian w `publish-worksheet`/`unpublish-worksheet`. Bez zmian w edytorze nauczyciela.

---

## SPRINT H — CTA Copy Fix (Problem 1C)

W `PublicGalleryWorksheetPage.tsx` blok końcowy `Build your own worksheet in 30 seconds`:
- Zmieniamy tytuł: **„From idea to ready-to-teach worksheet in under 1 minute"**.
- Sub-copy: **„Edooqoo's DSLM 1-Minute Prep turns your student's goals into a tailored worksheet — fully editable, with audio, images and AI-grading built in. Free to start, no credit card."**
- Button label: **„Try 1-Minute Prep free"** → `/auth?mode=signup`.
- Identyczna podmiana w `src/pages/gallery/PublicGalleryIndex.tsx` jeśli ma analogiczny CTA (do potwierdzenia w implementacji — jeśli ma „30 seconds", podmienić).

Nie zmieniamy `featurePromptCopy.ts` ani nigdzie indziej w aplikacji w tej turze — tylko Galeria.

---

## SPRINT I — SEO Cloaking decyzja (Problem 1D — „pokazać Google, schować człowiekowi")

### Stanowisko (do akceptacji)
**Odradzam pełny cloaking** (different content for Googlebot vs human). Google klasyfikuje to jako manipulację indeksu, kara to deindexacja całej domeny — ryzyko nieproporcjonalne do korzyści. Nasza domena ma 1k+ landing pages programatycznych, wszystkie mogą zostać dotknięte. Nie warto.

### Co możemy zrobić bezpiecznie zamiast cloakingu
**Wariant „Open Index, Gated Detail"** (akceptowalny SEO i UX):
1. Lista wszystkich worksheetów teachers (publish=true) — w galerii widoczna jak teraz.
2. Drugi typ: **„Catalog page"** dla niepublishedowanych — generowane automatycznie na `/catalog/{slug}` z:
   - Tytułem, levelem, topikiem, lista exercise types, ~30-word summary (extract z transcript/title).
   - **Bez pełnej treści ćwiczeń** — tylko meta + zachęta.
   - JSON-LD `LearningResource` + canonical do `/catalog/{slug}`.
   - W footerze CTA: „This worksheet was created by a teacher. Sign up to generate your own version with the same parameters."
   - Klikalne dla człowieka, indexable dla Google. Bez cloakingu, bez ryzyka.
3. Wymaga: nowej kolumny `worksheets.catalog_eligible BOOLEAN DEFAULT true` (teacher może opt-out w settings), nowej edge function `generate-catalog-summary` (jednorazowo per worksheet) i nowego route'u. **Decyzja: NIE wdrażamy w tym sprincie** — wymaga osobnej dyskusji (PII, opt-out flow, polityka prywatności). Dodajemy do `.lovable/plan.md` BACKLOG jako „Worksheet Catalog SEO Layer — Plan v6.10".

### Co robimy teraz (bez Sprint I implementacji)
Tylko dokumentujemy w `docs/llm-context.md` decyzję i ryzyko cloakingu, by przyszły agent nie wpadł na pomysł realizacji.

---

## SPRINT J — Naprawa wszystkich linków `.html` (Problem 2)

### J.1 Skala
Skan repo: ~330 wystąpień `.html` w `src/`. Główne źródła:
- `src/pages/Blog.tsx` — 36 wpisów, wszystkie `/blog/{slug}.html`. Realne route'y istnieją tylko dla 3 (`english-games-for-learners`, `esl-games-for-teachers`, `teach-english-online-guide`). **33 linki → 404.**
- `src/pages/Resources.tsx` — ~40 linków, część do `/blog/*.html` (duplikat z Blog), część do `/{slug}.html` top-level (generatory, CEFR-poziomy, comparisons).
- `src/components/GlobalFooter.tsx` — 16 linków do `/{slug}.html` (CEFR Guide, Present Simple, Past Simple, modal verbs, edooqoo-vs-*).
- Łącznie unikalnych broken: ~80+ URL-i.
- `public/sitemap.xml` — zawiera część z nich → Google indeksuje 404 → tracimy crawl budget.

### J.2 Strategia: 3 kubełki

**Kubełek 1 — MAPOWANIE do istniejących programatic SEO routes** (działa od razu, bez nowego contentu):
Tworzymy `src/data/legacyLinkMap.ts`:
```ts
export const LEGACY_LINK_MAP: Record<string, string> = {
  // Resources → existing programmatic SEO
  "/cefr-worksheet-generator.html": "/esl-worksheets",
  "/grammar-worksheet-generator.html": "/esl-worksheets/grammar",
  "/vocabulary-exercise-generator.html": "/esl-worksheets/vocabulary",
  "/reading-comprehension-worksheet-maker.html": "/esl-worksheets/reading",
  "/fill-in-the-blanks-worksheet-generator.html": "/esl-worksheets/fill-in-blanks",
  "/multiple-choice-quiz-generator-english.html": "/esl-worksheets/multiple-choice",
  "/listening-comprehension-exercises-esl.html": "/esl-worksheets/listening",
  "/a1-beginner-english-worksheets.html": "/esl-worksheets/grammar/a1-beginner",
  "/a2-elementary-english-worksheets.html": "/esl-worksheets/grammar/a2-elementary",
  "/b1-intermediate-english-worksheets.html": "/esl-worksheets/grammar/b1-intermediate",
  "/b2-upper-intermediate-english-worksheets.html": "/esl-worksheets/grammar/b2-upper-intermediate",
  "/c1-advanced-english-worksheets.html": "/esl-worksheets/grammar/c1-advanced",
  "/c2-proficiency-english-worksheets.html": "/esl-worksheets/grammar/c2-proficiency",
  "/present-simple-worksheets.html": "/esl-worksheets/present-simple/b1-intermediate",
  "/past-simple-worksheets.html": "/esl-worksheets/past-simple/b1-intermediate",
  "/modal-verbs-worksheets-esl.html": "/esl-worksheets/modal-verbs/b1-intermediate",
  "/business-english-worksheet-generator.html": "/esl-worksheets/business-english/b2-upper-intermediate",
  "/exam-preparation-worksheets-cambridge-ielts.html": "/esl-worksheets",
  "/ai-worksheet-generator-for-english-teachers.html": "/",
  "/ai-lesson-planning-for-english-teachers.html": "/resources",
  "/online-english-teaching-tools.html": "/blog/teach-english-online-guide",
  "/esl-student-progress-tracking-tool.html": "/features/dslm",
  "/esl-homework-grading-tool.html": "/features/homework",
  "/ai-grading-tool-for-english-homework.html": "/features/homework",
  "/spaced-repetition-flashcards-esl.html": "/features/flashcards",
  "/how-to-save-time-as-english-teacher.html": "/blog/teach-english-online-guide",
  "/how-to-create-english-worksheets-with-ai.html": "/blog/teach-english-online-guide",
  "/best-ai-tools-for-esl-teachers.html": "/resources",
  "/ai-tools-for-private-english-tutors.html": "/for-english-tutors",
  "/worksheet-generator-for-language-schools.html": "/for-english-tutors",
  "/ai-tools-for-online-esl-teachers.html": "/blog/teach-english-online-guide",
  // Blog .html → 3 real posts (keep slug, drop .html)
  "/blog/english-games-for-learners.html": "/blog/english-games-for-learners",
  "/blog/esl-games-for-teachers.html": "/blog/esl-games-for-teachers",
  "/blog/teaching-english-online-complete-guide.html": "/blog/teach-english-online-guide",
};
```
(Końcowa lista mapowań — pełna 80+ pozycji — generowana w implementacji przez `rg` i ręczny review każdej pozycji vs `App.tsx` routes oraz `src/constants/pseoMatrix.ts`. Każde mapowanie wskazuje na **istniejący** route. Jeśli target nie istnieje → przechodzi do Kubełka 3.)

**Kubełek 2 — REAL** (3 posty bloga): aktualizujemy `Blog.tsx` żeby ich `href` był czystym slugiem bez `.html`.

**Kubełek 3 — COMING SOON** (33 posty bloga bez treści + 4 comparisons `edooqoo-vs-*`): **NIE linkujemy**. UI renderuje kafelek bez `<a>`, z badgem „Coming soon", `cursor-not-allowed`, `opacity-60`, tooltipem „Full article shipping soon". To eliminuje 404, nie tworzy fake stub-pages (Martha quality rule), zachowuje listę tytułów dla scan/SEO discovery wewnątrz `/blog` index.

### J.3 Helper i refaktor

Nowy plik `src/lib/resolveLegacyHref.ts`:
```ts
import { LEGACY_LINK_MAP } from "@/data/legacyLinkMap";
export type ResolvedHref = { url: string; comingSoon: boolean };
export function resolveLegacyHref(href: string): ResolvedHref {
  if (href in LEGACY_LINK_MAP) return { url: LEGACY_LINK_MAP[href], comingSoon: false };
  if (href.endsWith(".html")) return { url: href, comingSoon: true };
  return { url: href, comingSoon: false };
}
```

Edycje:
- `src/pages/Blog.tsx` — w mapowaniu kart: `const r = resolveLegacyHref(item.href);` → jeśli `comingSoon` to `<div role="listitem" class="opacity-60 cursor-not-allowed">...<Badge variant="secondary">Coming soon</Badge>` (bez `<a>`); inaczej `<Link to={r.url}>` z react-router-dom (zamiana `<a href>` na `<Link>`).
- `src/pages/Resources.tsx` — identyczny refaktor w pętli `items.map`.
- `src/components/GlobalFooter.tsx` — refaktor wszystkich `<a href="...html">`: jeśli mapowane → `<Link to={r.url}>`; jeśli niemapowane → **usuwamy z DOM** (footer nie powinien mieć kafelków Coming Soon — zaśmieca). Usuwamy całą kolumnę „Compare" (4 `/edooqoo-vs-*.html` — brak treści, brak planu). Grid footera przechodzi z 5 na 4 kolumny — zaktualizować klasy Tailwind `md:grid-cols-4`.
- `public/sitemap.xml` — usunąć wszystkie URL `.html` które nie mają mapowania. Zostawić wyłącznie URL-e prowadzące do istniejących stron + Public Gallery URL-e.
- `scripts/seo/audit-sitemap.mjs` — jeśli istnieje i robi link check, dopisać assertion: `expect(no .html broken links)`.

### J.4 Test
Po implementacji: ręczny click-test `/blog`, `/resources`, footer na 5 losowych stronach (`/`, `/features/dslm`, `/esl-worksheets`, `/glossary`, `/pricing`) — 0 linków zwracających 404.

---

## SPRINT K — Multi-provider Model Audit (Problem 3, część A)

### K.1 Inwentaryzacja modeli (jednorazowy skan)
Skrypt `scripts/audit-llm-models.ts` (Deno):
1. Skan `supabase/functions/**/*.ts` regexami:
   - `gpt-[\w.-]+`, `o[1-4][\w.-]*`, `tts-\d+`, `whisper-[\w.-]+`, `dall-e-\d`, `gpt-4o[-\w]*tts`, `gpt-4o-audio[-\w]*` → OpenAI
   - `gemini-[\w.-]+`, `google/[\w.-]+` → Google AI Studio (direct) / Lovable AI Gateway (jeśli URL zawiera `ai.gateway.lovable`)
   - `claude-[\w.-]+`, `anthropic/[\w.-]+` → Anthropic
   - `elevenlabs[\/_-][\w.-]+` → ElevenLabs
2. Output etap 1: tabela `model | provider | files[]` w `docs/closed-loops/LLM_MODEL_INVENTORY.md`.

### K.2 Live-check per provider
Per model uruchamiamy:
- **OpenAI**: `GET https://api.openai.com/v1/models/{id}` z `Authorization: Bearer ${OPENAI_API_KEY}` → status 200 OK; 404 = deprecated.
- **Google AI Studio**: `GET https://generativelanguage.googleapis.com/v1beta/models/{id}?key=${GEMINI_API_KEY}`.
- **Anthropic**: minimalny `POST https://api.anthropic.com/v1/messages` z body `{model, max_tokens:1, messages:[{role:"user",content:"ping"}]}`, headers `x-api-key`, `anthropic-version: 2023-06-01`. Sukces lub `model_not_found`.
- **ElevenLabs**: `GET https://api.elevenlabs.io/v1/models` (zwraca pełną listę — sprawdzamy obecność `model_id`).
- **Lovable AI Gateway**: `POST {GATEWAY}/v1/chat/completions` z `Authorization: Bearer ${LOVABLE_API_KEY}`, `{model, messages:[{role:"user",content:"ping"}], max_tokens:1}`.

### K.3 Procedure B (rozszerzona) — `docs/prompts/AUDIT_PROCEDURES.md`
Aktualizujemy istniejący plik (lub tworzymy jeśli nie istnieje):

```markdown
## Procedure B — Monthly Multi-Provider Model Audit (1st day of month, ~20 min)

### Step 1: Run inventory
`deno run --allow-net --allow-env --allow-read --allow-write scripts/audit-llm-models.ts`
Generates `docs/closed-loops/LLM_MODEL_INVENTORY.md`.

### Step 2: Live-check all models
The same script live-pings each model against its provider. Output:
`docs/closed-loops/STATUS_LIVE.md` with columns: model | provider | http_status | last_checked | files[] | severity.

### Step 3: Manual deprecation page scan (browser)
Open and Ctrl-F each model name from inventory in:
- OpenAI: https://platform.openai.com/docs/deprecations
- Google: https://ai.google.dev/gemini-api/docs/models#model-versions
- Anthropic: https://docs.anthropic.com/en/docs/about-claude/models/all-models#model-deprecations
- ElevenLabs: https://elevenlabs.io/docs/models
- Lovable AI Gateway: https://docs.lovable.dev/features/ai

Each match → add row to STATUS_LIVE.md with deprecation_date and migration_target.

### Step 4: File tickets
For each model with severity ≥ warning:
- Append entry to `.lovable/plan.md` BACKLOG: `[CRITICAL] Migrate {model} ({provider}) — used in: {files}. Deprecation: {date}. Suggested replacement: {target}.`
- INSERT into `error_logs` (severity='critical', error_type='model_deprecation', model_name, source_files JSON).
- Send notification email via `notify-generation-failure` with errorType='model_deprecation'.

### Step 5: Pricing shift check
For each provider, check pricing page diff vs `docs/closed-loops/PRICING_BASELINE.md`. Shift ≥25% → BACKLOG ticket.
```

### K.4 Auto-log w runtime (Problem 3 część B — `/admin/error-logs` i `/status`)

Dodajemy w **każdej edge function** wywołującej OpenAI/Gemini/Anthropic/ElevenLabs uniform helper `logModelFailure(model, status, errorBody)`:

Nowy `supabase/functions/_shared/modelFailureLogger.ts`:
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export async function logModelFailure(opts: {
  model: string; provider: string; status: number; endpoint: string; error: string; functionName: string;
}) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  const sb = createClient(url, key);
  const severity = opts.status === 404 || opts.status === 410 ? "critical" : opts.status >= 500 ? "warning" : "info";
  const errorType = opts.status === 404 || opts.status === 410 ? "model_deprecation" : "model_failure";
  await sb.from("error_logs").insert({
    severity, error_type: errorType, source_name: opts.functionName,
    message: `${opts.provider} ${opts.model} → ${opts.status}`,
    context: { model: opts.model, provider: opts.provider, endpoint: opts.endpoint, error: opts.error.substring(0, 1000) },
  }).then(() => {}, (e) => console.error("logModelFailure insert error:", e));
}
```

Wpinamy w `catch` w: `generate-audio`, `generateWorksheet`, `verify-open-answers`, `translate-flashcard`, `process-welcome-test`, `suggest-exercises`, `generate-welcome-test-audio`, `classify-knowledge-entry`, `generate-curriculum-phases`, `generate-media-exercises`, `generate-image`, `generate-timeline`. Każdy 404/410/5xx z provider API → INSERT do `error_logs`.

`/status` page (`src/pages/StatusPage.tsx`) i `/admin/error-logs` już czytają z `error_logs` → auto-podchwycą nowe wpisy. Dodatkowo na `StatusPage.tsx` dodajemy sekcję „Active model issues" filtrującą `error_logs` po `error_type IN ('model_deprecation', 'model_failure') AND created_at > now() - interval '24h'` — jeśli niepuste, pokazuje czerwony banner „We're investigating an issue with {provider} {model}. Audio/worksheet generation may be temporarily affected."

Migracja DB: brak — `error_logs` już istnieje. Jeśli nie ma kolumn `context jsonb` lub `source_name` → migration to dodać (do potwierdzenia w implementacji przez `supabase--read_query` na `information_schema`).

---

## SPRINT L — Email Alerts (Problem 4)

### L.1 notify-generation-failure
W `supabase/functions/notify-generation-failure/index.ts` linia 9:
```ts
const ALERT_EMAILS = ["j4n.brz0@gmail.com", "edooqoo@gmail.com"];
```
W body fetch do Resend: `to: ALERT_EMAILS,` (zamiast `[ALERT_EMAIL]`).

### L.2 submit-bug-report
W `supabase/functions/submit-bug-report/index.ts`:
- Znaleźć tablicę adresatów (`bugEmails` lub analogiczna). Dodać `"edooqoo@gmail.com"`.
- Jeśli używa zmiennej env `BUG_REPORT_FROM_EMAIL` — sprawdzić czy jest, jeśli nie to skonfigurować (sekret). Defaultowy `From: "Edooqoo Bugs <notifications@edooqoo.com>"` jeśli sekret pusty.

### L.3 Sekret
Dodać sekret `BUG_REPORT_FROM_EMAIL = "Edooqoo Bugs <notifications@edooqoo.com>"`. (Akcja przez `secrets--add_secret` w implementacji — wymagana aprobata.)

### L.4 Walidacja
Smoke-test po deploy:
```
curl -X POST {SUPABASE_URL}/functions/v1/notify-generation-failure -H "Authorization: Bearer {SERVICE_KEY}" -H "Content-Type: application/json" -d '{"errorType":"audio","errorMessage":"test","timestamp":"...","teacherEmail":"test@x.com"}'
```
Oczekiwane: 200, oba adresy w logu Resend.

---

## SPRINT M — UI Layering Fix (Problem 5)

### M.1 Diagnoza
`src/components/GeneratingModal.tsx` renderuje modal w drzewie React lokalnie. `src/components/GlobalFooter.tsx` (i potencjalnie Sticky Nav) używa `backdrop-blur`, który tworzy nowy stacking context — zasłania modal mimo wysokiego `z-index`.

### M.2 Rozwiązanie

**Edycja `src/components/GeneratingModal.tsx`**:
```tsx
import { createPortal } from "react-dom";
// W returnie:
return createPortal(
  <div className="fixed inset-0 z-[100] flex items-center justify-center ...">
    {/* dotychczasowa treść modala */}
  </div>,
  document.body
);
```

**Edycja `src/components/GlobalFooter.tsx`**: root `<footer>` dostaje `className="... relative z-0"` — explicit niższy z-index niż portal.

**Edycja `src/components/Sidebar.tsx`** (jeśli też używa backdrop-blur i tworzy stacking context): identyczny `relative z-0` na root.

### M.3 Walidacja
Smoke-test wizualny: na `/` (anonimowy user) kliknąć generator → modal pojawia się i widać całość, footer pod spodem. Powtórzyć na `/dashboard` (logged in) i `/student-hub`.

---

## SPRINT N — LinkedIn outreach copy (Problem 6) — build-in-public

**3 warianty** napisane w stylu „buduję, oto co już działa, oto co dowożę, zostań testerem" — NIE „mam gotowy DSLM". Każdy wariant zostaje w `.lovable/plan.md` jako template do skopiowania. **Nie wdrażamy do kodu aplikacji.**

### Wariant 1 — Founder, krótki (neutralny build-in-public)
> Hi [name], for the past 9 months I've been building Edooqoo — a tool for 1-on-1 English teachers working with adult learners. What's already shipping: AI-generated worksheets tailored to each student's goal (29 exercise types), auto-graded homework, per-skill mastery tracking, integrated calendar with Google Meet. What we're rolling out in July: DSLM 1-Minute Prep — 60 seconds from "I have a lesson in 5 min" to a ready, student-tailored worksheet. I'm looking for 20 teachers for a 4-week pilot — free access, honest feedback in return. Interested?

### Wariant 2 — Pain-point hook (build-in-public, prowokacyjny)
> [name], how many hours a week do you spend prepping materials for adult Business English / Cambridge / IELTS students? For Martha (10 yrs ESL, co-founder) it was 8h/week. That's why we've been building Edooqoo for the last 9 months. What works today: AI worksheet generator tied to your student's actual goal, auto-grading, mastery tracking, teacher calendar. What's next (July release): DSLM 1-Minute Prep — full lesson prep in under 60 seconds. We're onboarding 20 teachers as early testers — free access, you tell us what sucks. In?

### Wariant 3 — Low-pressure (soft build-in-public)
> Hi [name], saw on your profile that you teach [Business English / adults / online]. I'm building Edooqoo (with Martha — 10 yrs ESL background) for 1-on-1 adult ESL teachers. Happy to send a 2-minute demo of what's already working (worksheet generator + grading + mastery tracking) and what we're shipping in July (DSLM 1-Minute Prep). Zero sales pitch — just gathering teacher feedback before the bigger launch. OK if I send the link?

**Tracking**: każdy link `?utm_source=linkedin&utm_campaign=invite_2026q3&utm_content=v1|v2|v3`. Po 2 tygodniach `/admin/analytics` decyduje który skalujemy do 1000.

---

## SPRINT O — Dokumentacja RAG (obowiązkowa)

W tym samym commicie aktualizujemy:

### `docs/llm-context.md` — dopisać sekcje:

```markdown
## Public Gallery Exercise Renderer (v6.9.21)

**Problem:** v6.9.20 Public Gallery rendered only `title`/`instructions`/`content`/`questions` per exercise, ignoring shape variations across 29 exercise types — students/teachers saw "text-only" preview missing tables, options, dialogs, audio players.

**Edooqoo.com Solution:** Dedicated read-only renderer `GalleryExerciseRenderer.tsx` with switch over `normalizeExerciseType(ex.type)`, mapping each type to its visual structure (table for matching, A/B/C/D list for multiple-choice, audio player + transcript for listening, etc.). Zero state, zero inputs, zero API — pure presentation. SEO-friendly (full content rendered for crawlers), human-friendly (structure preserved). Top banner clarifies "Preview mode — sign up for interactive editor."

**Technical Mechanics:**
- `src/components/gallery/GalleryExerciseRenderer.tsx` — switch on normalized type, fallback to `<pre>{JSON.stringify(ex)}</pre>` for unknown types.
- `src/pages/gallery/PublicGalleryWorksheetPage.tsx` — renders banner + uses GalleryExerciseRenderer in map.
- CTA copy updated to DSLM 1-Minute Prep narrative (not "30 seconds worksheet").

**RAG Keywords:** public gallery, worksheet preview, read-only renderer, exercise types, SEO worksheet, 1-Minute Prep CTA.

## Legacy .html Link Resolver (v6.9.21)

**Problem:** Historical SEO landing pages used `.html` suffix (~330 hrefs across `Blog.tsx`, `Resources.tsx`, `GlobalFooter.tsx`). ~80 unique targets never existed → 404 storm hurting crawl budget and UX. Examples: `/blog/reading-comprehension-activities-english.html`, `/modal-verbs-worksheets-esl.html`, `/edooqoo-vs-magicschool.html`.

**Edooqoo.com Solution:** Three-bucket strategy: (1) `src/data/legacyLinkMap.ts` maps ~50 legacy `.html` hrefs to existing programmatic routes; (2) 3 real blog posts use clean slugs; (3) 33 unwritten blog posts + 4 comparisons render as non-clickable "Coming soon" tiles. Sitemap pruned to live URLs only. Footer "Compare" column removed.

**Technical Mechanics:**
- `src/data/legacyLinkMap.ts` — exhaustive map.
- `src/lib/resolveLegacyHref.ts` — `(href) => {url, comingSoon}`.
- `Blog.tsx`/`Resources.tsx`/`GlobalFooter.tsx` — consume resolver; `<Link>` for mapped, disabled tile for comingSoon, removed from DOM in footer.
- `public/sitemap.xml` pruned.

**RAG Keywords:** broken links, 404, coming soon tiles, legacy redirects, sitemap pruning, .html cleanup, SEO crawl budget.

## Multi-Provider LLM Model Audit (v6.9.21)

**Problem:** OpenAI removed `gpt-4o-audio-preview` access without notification → `generate-audio` returned 500 for weeks. No systematic monitoring across OpenAI, Google Gemini, Anthropic, ElevenLabs, Lovable AI Gateway. `/admin/error-logs` and `/status` didn't surface provider model issues.

**Edooqoo.com Solution:** (1) Monthly Procedure B audit script (`scripts/audit-llm-models.ts`) inventories all model refs in `supabase/functions/**`, live-pings each provider, writes `docs/closed-loops/STATUS_LIVE.md`, files BACKLOG tickets for deprecations. (2) Runtime auto-logging via `_shared/modelFailureLogger.ts` — every provider 404/410/5xx inserts `error_logs` row with `error_type='model_deprecation'` or `'model_failure'`. (3) `StatusPage.tsx` reads `error_logs` last 24h and shows banner when active model issues exist. (4) Notification email sent on critical severity.

**Technical Mechanics:**
- Regex scope: OpenAI (gpt-/o[1-4]/tts/whisper/dall-e), Google (gemini-/google/), Anthropic (claude-/anthropic/), ElevenLabs (elevenlabs*), Lovable Gateway (via URL detection).
- Live checks: provider-specific endpoints (see `AUDIT_PROCEDURES.md` Procedure B).
- `_shared/modelFailureLogger.ts` wired into 12 edge functions catch blocks.
- StatusPage banner queries `error_logs WHERE error_type IN ('model_deprecation','model_failure') AND created_at > now() - interval '24h'`.

**RAG Keywords:** model deprecation, LLM audit, multi-provider monitoring, gpt-4o-audio-preview, status page banner, error_logs, Procedure B, runtime model logging.

## Bug Alert Email Recipients (v6.9.21)

**Problem:** Bug reports and generation failures sent only to founder's personal Gmail — secondary monitoring mailbox not notified.

**Edooqoo.com Solution:** Both `notify-generation-failure` and `submit-bug-report` send to `["j4n.brz0@gmail.com", "edooqoo@gmail.com"]`. Sender configurable via `BUG_REPORT_FROM_EMAIL` secret (default `"Edooqoo Bugs <notifications@edooqoo.com>"`).

**RAG Keywords:** bug alerts, email recipients, notifications@edooqoo.com, Resend, alert escalation.

## Modal Stacking Context Fix (v6.9.21)

**Problem:** `GlobalFooter` `backdrop-blur` created a new stacking context that visually covered `GeneratingModal` and other in-page modals despite high z-index.

**Edooqoo.com Solution:** `GeneratingModal.tsx` portals to `document.body` via `createPortal` with `z-[100]`. Footer/sidebar root elements explicitly get `relative z-0`.

**RAG Keywords:** modal layering, createPortal, backdrop-blur stacking context, z-index conflict, GeneratingModal.
```

### `llms.txt` + `public/llms.txt` — dopisać te 5 sekcji jako bullets w „Updates v6.9.21".

### `mem/index.md` — dopisać:
```
- [Gallery Exercise Renderer](mem://features/public-gallery/gallery-exercise-renderer) — Read-only switch by exercise type for /gallery/:slug
- [Legacy HTML Link Resolver](mem://infrastructure/legacy-html-link-resolver) — Three-bucket strategy for .html cleanup
- [Multi-Provider Model Audit](mem://infrastructure/multi-provider-model-audit) — Procedure B + runtime logger for all LLM providers
- [Modal Portal Pattern](mem://ux/modal-portal-pattern) — createPortal + z-100 to escape backdrop-blur stacking
```
plus 4 nowe pliki memów (każdy ~10 linii skrótu z `docs/llm-context.md`).

---

## Kolejność implementacji (1 tura)
1. **Sprint M** (UI fix — natychmiastowy UX impact).
2. **Sprint L** (emaile + sekret).
3. **Sprint J** (linki .html — legacyLinkMap + resolver + refaktor Blog/Resources/Footer + sitemap).
4. **Sprint G** (GalleryExerciseRenderer + edycja PublicGalleryWorksheetPage).
5. **Sprint H** (CTA copy w galerii).
6. **Sprint K** (scripts/audit-llm-models.ts + _shared/modelFailureLogger.ts + wpięcie w 12 funkcji + Procedure B w AUDIT_PROCEDURES.md + StatusPage banner).
7. **Sprint O** (RAG docs + mem index + 4 mem files).
8. **Sprint N** (TYLKO copy do `.lovable/plan.md`, brak edycji aplikacji).
9. **Sprint I** — tylko dokumentacja decyzji (brak kodu).

## Nie wchodzi w tę turę
- Catalog SEO Layer (Sprint I implementacja) — wymaga osobnej dyskusji prywatności.
- Sprint 5 (AEO/LLMO) — następna tura.
- Sprint 6 (4 long-form artykuły) — 4 osobne tury.
- GH Action dla model audit — Plan v6.10 BACKLOG.

## Walidacja końcowa
- `/gallery/choosing-your-adventure-...` → wszystkie ćwiczenia widoczne strukturalnie, banner Preview u góry, CTA „Try 1-Minute Prep free" na dole.
- `/blog` i `/resources` — 0 linków 404 (klick-test 100% pozycji).
- Footer — 4 kolumny, bez Compare.
- `/admin/error-logs` — log z błędem modelu po wymuszonym 404 OpenAI.
- `/status` — banner gdy świeży `model_deprecation` w bazie.
- Email z bug-report dochodzi do obu adresów.
- `GeneratingModal` nad footerem na każdej stronie.
- `scripts/audit-llm-models.ts` odpalony lokalnie → produkuje `STATUS_LIVE.md`.

Daj zielone światło, ruszamy z implementacją w następnej turze. Sprint 5 i 6 trzymamy na osobne tury — sugeruję każdy artykuł content z Sprintu 6 jako osobna tura (jakość > prędkość, zgodnie z regułą Marthy).
