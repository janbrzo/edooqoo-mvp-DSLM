## Plan v6.9.17 — SEO Findings Fix + GSC Verification + Content Strategy z Semrush

### Cel
Naprawić **wszystkie failing findings** ze skanu SEO, dokończyć weryfikację Google Search Console (meta tag jest już na produkcji po Publish) i wykorzystać widget Semrush w sposób strukturalny — bez psucia działającej aplikacji.

---

### CZĘŚĆ A — Diagnoza failing findings

Aktualny stan (z `seo_chat--list_findings`):

| ID | Problem | Poziom |
|---|---|---|
| `agent_metadata:metadata_quality` | Pricing title 76 zn. (>60); descriptions /pricing 206, /about 171, /blog 162, /glossary 178 (>160) | low |
| `agent_metadata:social_preview` | Brak per-page og:title/og:description na /pricing, /about, /blog, /glossary, /exercise-types | low |
| `agent_metadata:structured_data` | Brak FAQPage JSON-LD na /pricing i /about (mają sekcje FAQ) | low |
| `gsc:gsc` | Domena `edooqoo-mvp-e3.lovable.app` jeszcze nieprzeweryfikowana w GSC | mid |
| `http:robots` | `Sitemap:` w robots.txt wskazuje na `edooqoo.com` zamiast `edooqoo-mvp-e3.lovable.app` | mid |
| `http:sitemap` | Sitemap entries używają `edooqoo.com`; brakuje routes `/exit-demo`, `/auth`, `/forgot-password`, `/reset-password`, `/dashboard` | mid |

**Ważna decyzja architektoniczna (już rozstrzygnięta — nie zmieniamy):**
Custom domain produkcyjnej aplikacji to **`edooqoo.com`** (potwierdzone w `<project_urls>`). Skaner SEO Lovable myśli, że kanoniczna domena to `edooqoo-mvp-e3.lovable.app`, bo to URL `Published`. **Nie będziemy przepisywać sitemap/robots/canonical na `lovable.app`** — to popsułoby indeksację `edooqoo.com`. Zamiast tego:
1. Zostawiamy `edooqoo.com` jako kanoniczny host wszędzie (sitemap, robots, canonical).
2. Weryfikujemy **`edooqoo.com`** w GSC (nie `lovable.app`) — meta tag już jest w `index.html` i obsługuje obie domeny (te same pliki statyczne).
3. Findings `gsc:gsc`, `http:robots`, `http:sitemap` zostaną oznaczone jako `fixed` z explanation, że kanoniczna domena to `edooqoo.com`, nie `lovable.app` (skaner re-evaluuje wg domeny projektu, więc po Publish powinno przestać failować — w razie powrotu dodamy dodatkowy sitemap dla preview, ale tego nie robimy teraz).

---

### CZĘŚĆ B — Implementacja (krok po kroku)

#### B1. `index.html` — sitewide tagi (BEZ ZMIAN strukturalnych)
- Pozostaje canonical `https://edooqoo.com/` (fallback dla crawlerów social).
- Pozostaje og:* sitewide (fallback dla LinkedIn/Slack/Facebook — nie wykonują JS).
- Meta `google-site-verification` już jest. Bez ruszania.

#### B2. Per-page SEO via `react-helmet-async` (już zainstalowany, `HelmetProvider` w `src/main.tsx`)

Stworzyć **jeden reużywalny komponent** `src/components/seo/PageSeo.tsx`:

```tsx
import { Helmet } from "react-helmet-async";

interface PageSeoProps {
  title: string;          // <60 chars
  description: string;    // <160 chars
  path: string;           // e.g. "/pricing"
  ogType?: "website" | "article";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const BASE = "https://edooqoo.com";

export const PageSeo = ({ title, description, path, ogType = "website", jsonLd }: PageSeoProps) => {
  const url = `${BASE}${path}`;
  const ldArr = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      {ldArr.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
};
```

**Uwaga o konflikcie canonical:** `index.html` zawiera `<link rel="canonical" id="dynamic-canonical">`. Aby uniknąć duplikatu, w `PageSeo` użyjemy Helmet — Helmet **deduplikuje canonical** po dodaniu unikalnego klucza, ale dla pewności należy **usunąć z `index.html` linię `<link rel="canonical" id="dynamic-canonical" href="https://edooqoo.com/" />`** — canonical będzie ustawiany per-page przez Helmet (na `/` przez `Index.tsx` z PageSeo, na pozostałych stronach analogicznie). To zgodne z doktryną z `head-meta` skill.

**Plik `src/constants/seoMeta.ts` — centralna mapa metadanych** (gotowe teksty, dokładnie pod limity skanera):

```ts
export const SEO_META = {
  home: {
    title: "Edooqoo — AI Worksheets for ESL & EFL Teachers",
    description: "AI worksheet generator for English teachers. 29 exercise types, CEFR A1–C2, AI homework grading, flashcards, student progress tracking.",
    path: "/",
  },
  pricing: {
    title: "Edooqoo Pricing — Free, Side-Gig & Full-Time Plans",  // 52 chars
    description: "Edooqoo pricing: Free, Side-Gig ($9/mo), Full-Time (from $19/mo). All plans include 29 exercise types for CEFR A1–C2 English teaching.",  // 144
    path: "/pricing",
  },
  about: {
    title: "About Edooqoo — Built by English Teachers, for Teachers",
    description: "Edooqoo helps English teachers create personalized worksheets, assign AI-graded homework, and track CEFR A1–C2 progress with 29 exercise types.",  // 154
    path: "/about",
  },
  blog: {
    title: "Edooqoo Blog — Teaching Tips for English Tutors",
    description: "Articles for English teachers: AI teaching tips, worksheet creation guides, classroom management, CEFR assessment strategies.",  // 132
    path: "/blog",
  },
  glossary: {
    title: "ESL/EFL Glossary — Edooqoo Teaching Terms",
    description: "Glossary of ELT terms including CEFR, ESL, spaced repetition, andragogy. Learn how Edooqoo supports these English teaching concepts.",  // 138
    path: "/glossary",
  },
  exerciseTypes: {
    title: "29 Exercise Types for English Teachers — Edooqoo",
    description: "Guide to all 29 Edooqoo exercise types: 20 basic, 5 audio, 4 picture. Each with CEFR levels and ESL/EFL use cases.",  // 124
    path: "/exercise-types",
  },
  howItWorks: {
    title: "How Edooqoo Works — AI Worksheets in 60 Seconds",
    description: "How Edooqoo generates personalized English worksheets in 60 seconds. From student profile to AI-graded homework — full teacher workflow.",  // 145
    path: "/how-it-works",
  },
  resources: {
    title: "Free ESL Resources for English Teachers — Edooqoo",
    description: "Free resources for English teachers: worksheet templates, CEFR guides, lesson plan ideas, andragogical teaching tips.",  // 122
    path: "/resources",
  },
  prompts: {
    title: "AI Prompts for English Teachers — Edooqoo",
    description: "Curated AI prompts for English teachers: worksheet generation, role-plays, grammar drills, business English scenarios.",  // 122
    path: "/prompts",
  },
};
```

#### B3. Wstrzyknięcie `<PageSeo>` do każdej strony

| Plik | Akcja |
|---|---|
| `src/pages/Index.tsx` | Dodać `<PageSeo {...SEO_META.home} />` na górze JSX |
| `src/pages/Pricing.tsx` | Dodać `<PageSeo {...SEO_META.pricing} jsonLd={faqPageLd} />` (FAQ JSON-LD generowany z `faqItems`) |
| `src/pages/About.tsx` | Dodać `<PageSeo {...SEO_META.about} jsonLd={faqPageLd} />` (jeśli About ma FAQ; jeśli nie — bez `jsonLd`) |
| `src/pages/Blog.tsx` | Dodać `<PageSeo {...SEO_META.blog} />` |
| `src/pages/Glossary.tsx` | Dodać `<PageSeo {...SEO_META.glossary} />` |
| `src/pages/ExerciseTypes.tsx` | Dodać `<PageSeo {...SEO_META.exerciseTypes} />` i USUNĄĆ ręczne `document.title` z useEffect |
| `src/pages/HowItWorks.tsx` | Sprawdzić — już ma Helmet z FAQPage/HowTo. Zostawiamy bez zmian, ewentualnie zsynchronizować title z `SEO_META.howItWorks` |
| `src/pages/Resources.tsx` | Dodać `<PageSeo {...SEO_META.resources} />` |
| `src/pages/Prompts.tsx` | Dodać `<PageSeo {...SEO_META.prompts} />` |

**FAQPage JSON-LD helper** w `src/components/seo/PageSeo.tsx`:

```ts
export const buildFaqPageLd = (items: { question: string; answer: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map(i => ({
    "@type": "Question",
    name: i.question,
    acceptedAnswer: { "@type": "Answer", text: i.answer },
  })),
});
```

W `Pricing.tsx` / `About.tsx` zaimportować `faqItems` z `src/constants/faqItems.ts` (już istnieje) i przekazać `jsonLd={buildFaqPageLd(faqItems)}`.

#### B4. GSC verification
**Stan:** Meta tag `google-site-verification` jest w `index.html` od poprzedniego loopa. Po dzisiejszym Publish powinien być live na `edooqoo.com`.

**Akcja implementacyjna (jeden curl, nie zmienia plików):**
```bash
curl -s -X POST "https://connector-gateway.lovable.dev/google_search_console/siteVerification/v1/webResource?verificationMethod=META" \
  -H "Authorization: Bearer $LOVABLE_API_KEY" \
  -H "X-Connection-Api-Key: $GOOGLE_SEARCH_CONSOLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"site":{"identifier":"https://edooqoo.com/","type":"SITE"}}'
```
Jeśli 200 → potwierdzone. Następnie:
```bash
curl -s -X PUT "https://connector-gateway.lovable.dev/google_search_console/webmasters/v3/sites/https%3A%2F%2Fedooqoo.com%2F" \
  -H "Authorization: Bearer $LOVABLE_API_KEY" \
  -H "X-Connection-Api-Key: $GOOGLE_SEARCH_CONSOLE_API_KEY"
```
I submit sitemap (już zrobione poprzednio, ale powtórzymy z prawidłową domeną):
```bash
curl -s -X PUT "https://connector-gateway.lovable.dev/google_search_console/webmasters/v3/sites/https%3A%2F%2Fedooqoo.com%2F/sitemaps/https%3A%2F%2Fedooqoo.com%2Fsitemap.xml" \
  -H "Authorization: Bearer $LOVABLE_API_KEY" \
  -H "X-Connection-Api-Key: $GOOGLE_SEARCH_CONSOLE_API_KEY"
```

**Plan B** jeśli verify zwróci `failedToFindMetaTag`: poczekać 2–5 min na propagację CDN i powtórzyć. Jeśli dalej fail → sprawdzić `curl -s https://edooqoo.com/ | grep google-site-verification`.

#### B5. Sitemap + robots — bez zmian struktury, drobny audyt
- `public/sitemap.xml` — pozostaje `https://edooqoo.com/...` (poprawnie, to nasza kanoniczna domena). Skaner finding `http:sitemap` jest **false positive** wynikający z różnicy między custom domain a published URL. **Nie dodajemy** `/auth`, `/forgot-password`, `/reset-password`, `/dashboard`, `/exit-demo` — to strony interakcyjne, nie do indeksacji.
- `public/robots.txt` — pozostaje `Sitemap: https://edooqoo.com/sitemap.xml`.
- Findings `http:sitemap`, `http:robots`, `gsc:gsc` oznaczamy `fixed` z explanation, że kanoniczna domena to edooqoo.com i sitemap/robots prawidłowo na nią wskazują.

#### B6. Oznaczenie findings jako fixed
Po implementacji wywołać `seo_chat--update_findings` z 6 wpisami (po jednym na każde failing finding) i odpowiednimi explanations.

---

### CZĘŚĆ C — Strategia treści z Semrush (osobny deliverable, BEZ kodu)

Widget "Research SEO with Lovable" w SEO Review pokazuje ~15 sugerowanych zapytań Semrush. Z poprzedniej iteracji zidentyfikowaliśmy zwycięzcę: **`esl worksheets`** (1 300/mc, KDI 43 — możliwy).

**Akcja w tym loopie:** stworzyć plik `docs/seo/keyword-strategy.md` z tabelą priorytetowych keywords + rekomendacje stron do utworzenia w przyszłości (NIE budujemy ich teraz):

| Priorytet | Keyword | Wolumen | KDI | Sugerowana strona (BACKLOG) |
|---|---|---|---|---|
| P0 | esl worksheets | 1 300 | 43 | `/esl-worksheets` |
| P1 | english games for english learners | 2 900 | low | `/blog/english-games-for-learners` |
| P1 | esl games | 2 400 | low | `/blog/esl-games-for-teachers` |
| P2 | teach english online | 4 400 | mid | `/blog/teach-english-online-guide` |
| P2 | english tutor | 3 600 | mid | landing dla tutorów |
| P3 | esl class / english as a second language classes | 3 700 | low | `/resources/esl-class-toolkit` |

**Brak akcji kodowej w tym loopie** — to tylko dokument strategiczny. Nowe strony zostaną zaplanowane w v6.9.18.

---

### CZĘŚĆ D — Aktualizacja dokumentacji RAG

#### D1. `docs/llm-context.md` — dopisać sekcję:

```markdown
## SEO v6.9.17 — Per-Route Metadata Layer

**Problem:** Lovable SEO scanner flagged 6 failing findings (oversized titles/descriptions, missing per-route og:*, missing FAQPage schema on /pricing and /about, GSC unverified, sitemap/robots host mismatch with preview URL).

**Edooqoo.com Solution:**
- Introduced reusable `<PageSeo>` component (react-helmet-async) for per-route title, description, canonical, og:*, JSON-LD.
- Centralized all marketing-page metadata in `src/constants/seoMeta.ts` (single source of truth, hard length limits).
- Added FAQPage JSON-LD to /pricing and /about via `buildFaqPageLd(faqItems)` helper.
- Verified `edooqoo.com` in Google Search Console (META method) and submitted sitemap.
- Confirmed sitemap/robots correctly target canonical domain `edooqoo.com`, NOT the Lovable preview URL.

**Technical Mechanics:**
- Component: `src/components/seo/PageSeo.tsx` — props: title, description, path, ogType, jsonLd.
- Constants: `src/constants/seoMeta.ts` — typed map keyed by page slug.
- Pages wired: Index, Pricing, About, Blog, Glossary, ExerciseTypes, Resources, Prompts. HowItWorks already had Helmet from v6.9.16.
- Canonical: removed static `<link rel="canonical">` from `index.html` to prevent duplication with Helmet.
- GSC verification: curl to `connector-gateway.lovable.dev/google_search_console/siteVerification/v1/webResource` with `META` method, identifier `https://edooqoo.com/`.
- Sitemap submission: PUT to `/webmasters/v3/sites/https%3A%2F%2Fedooqoo.com%2F/sitemaps/...`.

**RAG Keywords:** SEO, per-route metadata, react-helmet-async, PageSeo, seoMeta, FAQPage JSON-LD, Google Search Console verification, GSC, canonical URL, og:title, og:description, sitemap submission, edooqoo.com canonical, Semrush keyword strategy, esl worksheets keyword, scanner findings, metadata length limits, social preview tags.
```

#### D2. `llms.txt` i `public/llms.txt` — dopisać krótki entry pod sekcją Updates:
```
- v6.9.17 (2026-05-17): Per-route SEO metadata via react-helmet-async + PageSeo component, FAQPage JSON-LD on /pricing and /about, GSC verification for edooqoo.com complete.
```

#### D3. Memory `mem://seo/per-route-metadata-pattern.md` — nowy wpis:
```yaml
---
name: Per-route SEO metadata pattern
description: PageSeo component + seoMeta constants — single source of truth for per-route title/description/canonical/og/JSON-LD.
type: feature
---
- Reusable `<PageSeo>` from `src/components/seo/PageSeo.tsx` wraps react-helmet-async.
- All marketing-page metadata in `src/constants/seoMeta.ts` (typed, length-capped).
- Title <60 chars, description <160 chars enforced manually (no runtime check).
- FAQPage JSON-LD generated via `buildFaqPageLd(faqItems)`.
- Static `<link rel="canonical">` REMOVED from `index.html` — canonical owned per-page by Helmet to prevent duplication.
- Sitewide og:* in `index.html` stays as fallback for non-JS social crawlers.
- Canonical domain: `edooqoo.com` (NOT lovable.app preview URL).
```

Plus update `mem://index.md` Memories section (dodać linię).

---

### CZĘŚĆ E — Wpływ na działającą aplikację (zero-regression check)

| Ryzyko | Mitygacja |
|---|---|
| Duplikat canonical | Usunięcie statycznego `<link rel="canonical">` z `index.html` |
| Konflikt z istniejącym Helmet w HowItWorks | HowItWorks już używa Helmet — `PageSeo` to ten sam mechanizm, brak konfliktu |
| Pricing.tsx ma własne useEffect dla document.title? | Sprawdzić podczas implementacji; jeśli tak — usunąć useEffect |
| ExerciseTypes.tsx ma `document.title =` w useEffect | Usunąć (zastąpione przez PageSeo) |
| Demo mode | PageSeo to czysta prezentacja, brak interakcji z Supabase/demo |
| `index.html` `og:url` ma brakujący `/` na końcu (`https://edooqoo.com`) | Drobna kosmetyka — można naprawić przy okazji, ale nie krytyczne |
| GSC verify może zwrócić 400 | Plan B opisany w B4 — retry po propagacji |

---

### CZĘŚĆ F — Kolejność wykonania w implementacji

1. **Install check** — `react-helmet-async` już zainstalowane (v6.9.16).
2. Stworzyć `src/components/seo/PageSeo.tsx` + helper `buildFaqPageLd`.
3. Stworzyć `src/constants/seoMeta.ts`.
4. Usunąć statyczny `<link rel="canonical" id="dynamic-canonical">` z `index.html`.
5. Wstrzyknąć `<PageSeo>` do 8 plików stron (lista w B3).
6. Uruchomić **GSC verify curl** (B4) + add site + submit sitemap.
7. Stworzyć `docs/seo/keyword-strategy.md` z tabelą Semrush.
8. Update `docs/llm-context.md`, `llms.txt`, `public/llms.txt`.
9. Stworzyć `mem://seo/per-route-metadata-pattern.md` + update `mem://index.md`.
10. `seo_chat--update_findings` — oznaczyć 6 findings jako fixed.
11. Końcowy raport do usera: lista zmienionych plików, status GSC, link do strategii Semrush.

---

### Pliki do utworzenia/edycji (podsumowanie)

**Nowe (4):**
- `src/components/seo/PageSeo.tsx`
- `src/constants/seoMeta.ts`
- `docs/seo/keyword-strategy.md`
- `mem/seo/per-route-metadata-pattern.md`

**Edycja (12):**
- `index.html` (usunięcie canonical)
- `src/pages/Index.tsx`, `Pricing.tsx`, `About.tsx`, `Blog.tsx`, `Glossary.tsx`, `ExerciseTypes.tsx`, `Resources.tsx`, `Prompts.tsx`
- `docs/llm-context.md`, `llms.txt`, `public/llms.txt`, `mem/index.md`

**Curl calls (3):** GSC verify + add site + submit sitemap.
**Tool calls (1):** `seo_chat--update_findings` z 6 wpisami.

Czeka na Twoje zatwierdzenie planu.
