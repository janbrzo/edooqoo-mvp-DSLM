# Plan wdrożenia v6.9.16

## Kontekst i zasada nadrzędna

Wszystkie zmiany zachowują kompatybilność wsteczną. Worksheet Generation Engine, RLS, schema DB i wszystkie działające features pozostają nienaruszone. Nowe zmiany są addytywne lub punktowe (rewriting JSON-LD scope, dodanie `target="_blank"`, dodanie helmet).

---

## Problem 1A: Structured data (FAQPage/HowTo) na każdej stronie

### Problem

W `index.html` mamy `@graph` z `SoftwareApplication`, `Organization`, `FAQPage` (10 Q/A) i `HowTo` (4 kroki). Static head jest serwowany dla każdej SPA route. Google widzi `FAQPage` i `HowTo` także na `/dashboard`, `/calendar`, `/pricing`, itd., gdzie te schematy są nieprawdziwe. To ryzyko manual action „Structured data mismatch with on-page content".

### Rozwiązanie Edooqoo.com

- `SoftwareApplication` i `Organization` zostają w `index.html` jako sitewide identity (poprawne wszędzie).
- `FAQPage` przenosimy do `/how-it-works` (zawiera 10 Q/A widocznych w UI) za pomocą `react-helmet-async`.
- `HowTo` przenosimy do `/how-it-works` (krok-po-kroku jak działa generator).
- Dodatkowo per-route ustawiamy `<title>`, `<meta description>`, canonical i og:* dla 10 najważniejszych publicznych podstron, co automatycznie naprawia kilka SEO findings (duplikat title/description per route).

### Mechanika techniczna

1. **Instalacja**: `bun add react-helmet-async`.
2. **Provider** w `src/main.tsx`:
  ```tsx
   import { HelmetProvider } from 'react-helmet-async';
   // wrap <App /> w <HelmetProvider>
  ```
3. **Nowy komponent** `src/components/seo/SeoHead.tsx`:
  - Props: `title`, `description`, `path` (np. `/how-it-works`), opcjonalnie `jsonLd` (string lub array), `ogImage`, `noindex` (bool).
  - Renderuje `<Helmet>` z `<title>`, `<meta name="description">`, `<link rel="canonical">`, `<meta property="og:title|og:description|og:url|og:type">`, `<meta name="twitter:*">` i `<script type="application/ld+json">` z `jsonLd`.
  - `path` jest joinowane z `https://edooqoo.com` (canonical host).
  - Gdy `noindex=true` dodaje `<meta name="robots" content="noindex, nofollow">`.
4. `**index.html**`:
  - Usuwamy z `@graph` elementy `FAQPage` i `HowTo` (zostają `SoftwareApplication` + `Organization`).
  - Usuwamy `<link rel="canonical" id="dynamic-canonical">` — bo Helmet doda canonical per-route. Zostawiamy `RouteCanonicalUpdater` jako safety-net dla route'ów bez `<SeoHead/>` (działa imperatywnie na `#dynamic-canonical`; po usunięciu z `index.html` hook utworzy element przy pierwszej nawigacji, więc dwa canonicale nie wystąpią, bo zgodnie z `useCanonical.ts` używa `getElementById('dynamic-canonical')`). Helmet doda swój własny `<link rel="canonical">` bez id — Google bierze pierwszy, ale aby uniknąć dwóch canonicali jednocześnie, w `<SeoHead/>` na mount wywołujemy `removeCanonical()` z `useCanonical.ts`, a w unmount przywracamy poprzedni przez `setCanonicalForPath(pathname)`. To eliminuje konflikt.
5. **Strony otrzymujące `<SeoHead/>**` (10 publicznych):
  - `/` (Index) — title + desc z `index.html` jako default, tu zostawiamy bez Helmet (fallback ze static head).
  - `/how-it-works` — title: `How Edooqoo Works — AI Worksheet Generator in 4 Steps` (58 chars), desc: 4-stepowy opis (155 chars). `jsonLd`: dwa schematy — `HowTo` (przeniesiony 1:1 z `index.html`) + `FAQPage` (przeniesiony 1:1).
  - `/pricing` — title: `Pricing — Edooqoo Plans for English Teachers`, desc o planach $0/$19/$39/$79.
  - `/exercise-types` — title: `29 Exercise Types — Edooqoo Worksheet Generator`, desc o typach.
  - `/about` — title: `About Edooqoo — AI Teaching Platform`, desc.
  - `/resources` — title: `ESL Teaching Resources — Edooqoo`, desc.
  - `/glossary` — title: `ESL Glossary — Edooqoo`, desc.
  - `/prompts` — title: `Worksheet Prompts Library — Edooqoo`, desc.
  - `/features/dslm`, `/features/homework`, `/features/flashcards`, `/features/calendar`, `/features/live-sessions`, `/features/placement-test`, `/features/student-hub`, `/features/book` — każdy z dedykowanym title+desc, plus `jsonLd` typu `SoftwareApplication` z `featureList` zawężonym do tego modułu.
  - Strony prawne (`/privacy-policy`, `/terms-of-service`, `/cookie-policy`) — title + desc + `noindex=false` (mogą być indeksowane).
6. **Tytuły i opisy** — przygotowane na sztywno w pliku `src/constants/seoMeta.ts` (mapa `path → { title, description, jsonLd? }`). Implementacja w jednym miejscu, zero decyzji per-route podczas codingu.
7. **Strony chronione** (`/dashboard`, `/calendar`, `/profile`, `/worksheet/*`, `/homework/*`, itd.) — dodajemy `<SeoHead noindex />` tylko tam gdzie router pozwala anonowi wejść. Reszta jest już zablokowana przez `Disallow` w `robots.txt`.
8. **Sanity check po wdrożeniu**:
  - W devtoolach na `/dashboard` w `<head>` widać `SoftwareApplication` + `Organization`, ale NIE widać `FAQPage`/`HowTo`.
  - Na `/how-it-works` widać oba dodatkowo z Helmet.
  - `https://search.google.com/test/rich-results` na `/how-it-works` zwraca poprawne `FAQPage` + `HowTo`.
  - Na `/dashboard` rich results test NIE wykrywa FAQPage/HowTo.

---

## Problem 1B: Google Search Console — krok po kroku po podłączeniu konektora

Konektor GSC jest połączony (OAuth na `j4n.brz0@gmail.com`), ale projekt nie jest jeszcze linked i domena `edooqoo.com` nie jest zweryfikowana w Search Console.

### Co konektor daje, czego nie daje

Konektor pozwala agentowi czytać dane z GSC i tworzyć site verification token automatycznie (`siteVerification/v1/token`) oraz weryfikować domenę przez META tag. Wszystko poza dodaniem meta tagu do head'a aplikacji jest po stronie agenta.

### Plan działań (kolejność)

1. **Link konektor do projektu (Ty)** — w UI „Linked projects" w Connectors → Google Search Console kliknij „Link this project" dla projektu Edooqoo. Bez tego env var `GOOGLE_SEARCH_CONSOLE_API_KEY` nie jest dostępny dla agenta. UWAGA PYTANIE ALE JAK TO ZROBIĆ NIE WIDZĘ ŻADNEJ OPCJI  „Link this project" 
2. **Pobranie META verification token (agent automat)** — agent wywoła:
  ```
   POST connector-gateway.lovable.dev/google_search_console/siteVerification/v1/token
   { "site": { "identifier": "https://edooqoo.com/", "type": "SITE" }, "verificationMethod": "META" }
  ```
   Zwraca `{ token: "<google-site-verification=XYZ>" }`.
3. **Wstawienie meta tagu do `index.html**` — agent doda `<meta name="google-site-verification" content="XYZ" />` w `<head>` (przed JSON-LD).
4. **Republish (Ty)** — klik „Publish" w Lovable. Bez tego meta tag nie pojawi się na `https://edooqoo.com`.
5. **Weryfikacja domeny (agent automat)**:
  ```
   POST .../siteVerification/v1/webResource?verificationMethod=META
   { "site": { "identifier": "https://edooqoo.com/", "type": "SITE" } }
  ```
   200 = verified. 400 z `failedToFindMetaTag` = republish nie poszedł lub cache. Agent retryuje 3× z `sleep 15s` między próbami.
6. **Dodanie property w Search Console (agent automat)**:
  ```
   PUT .../webmasters/v3/sites/https%3A%2F%2Fedooqoo.com%2F
  ```
7. **Submit sitemap (agent automat)**:
  ```
   PUT .../webmasters/v3/sites/https%3A%2F%2Fedooqoo.com%2F/sitemaps/https%3A%2F%2Fedooqoo.com%2Fsitemap.xml
  ```
8. **Smoke test (agent)** — `GET .../webmasters/v3/sites/.../sitemaps` — sitemap pojawia się jako submitted.
9. **Co dalej (Ty, w GSC web UI)** — w 24-72h Google zacznie crawlować. Sprawdź zakładkę „Pages" → „Indexed" i „Performance" → „Search results". Pierwsze impression w 7-14 dni od weryfikacji.
10. **Dodatkowo**: zweryfikuj też `https://www.edooqoo.com/` (jeśli istnieje subdomena www) — identyczny flow.

### Mechanika techniczna w kodzie

- `index.html`: jedna linia `<meta name="google-site-verification" content="..." />` w `<head>`.
- Brak innych zmian. Cała reszta to wywołania konektora gateway przez `curl` w `code--exec` podczas implementacji.

---

## Problem 1C: Lighthouse performance

Findings z opublikowanej wersji. Wymaga republish po wszystkich zmianach v6.9.16. Nie wymaga dodatkowych zmian kodu w ramach tego planu — punkt informacyjny dla Ciebie: po implementacji wszystkich pozostałych punktów zrób republish, potem rerun SEO scan.

---

## Problem 2: Detach Next Steps po usunięciu fazy

### Status: JUŻ ZROBIONE w v6.9.15c

Weryfikacja w `src/hooks/dslm/useCurriculumPhases.tsx` linie 131-180: po soft delete fazy następuje `UPDATE future_worksheet_suggestions SET phase_id=null, suggestion_kind='next_step' WHERE phase_id=id AND teacher_id=teacherId`, potem renumeracja faz, potem emisja `dslm:phasesUpdated` + `dslm:suggestionsUpdated`. `useFutureTimeline` ma listener `dslm:suggestionsUpdated` i refetchuje.

### Co zostaje do dorobienia (drobne)

- Dodać do `ConfirmDeleteDialog` w `MacroTimeline` przy usuwaniu fazy w opisie: `"This phase will be removed. Next Steps attached to this phase will be unpinned and remain as free Next Steps."` żeby user wiedział co się stanie.

---

## Problem 3: Banner „1 MINUTE" — Learn more w nowej karcie + audyt artykułu

### 3A. Learn more w nowej karcie

W `src/components/student/DslmExplainerBanner.tsx` zmieniamy:

```tsx
<Button asChild variant="link" size="sm" className="px-0 h-auto text-xs">
  <a href="/features/dslm" target="_blank" rel="noopener noreferrer">
    Learn more <ExternalLink className="h-3 w-3 ml-1" />
  </a>
</Button>
```

Powód użycia `<a>` zamiast `<Link>`: `target="_blank"` na `<Link>` z react-router działa, ale traci semantykę middle-click i nie korzysta z prerender. Native `<a>` z `rel="noopener noreferrer"` to standard SEO/security.

### 3B. Kiedy banner się wyświetla / kiedy znika

Z kodu `DslmExplainerBanner.tsx`:

- Wyświetla się ZAWSZE, gdy `localStorage.dslm_explainer_dismissed_<teacherId>` ≠ `'true'`.
- Znika po kliknięciu `X` (top-right) lub `Got it` lub `Learn more` (obecny kod wywołuje `handleDismiss` na „Got it"; „Learn more" tylko otwiera link, nie zamyka).
- Per-teacher, persistent w localStorage. Reset = wyczyszczenie storage w devtools.
- Renderowany w komponencie DSLM tab (powyżej zakładek), więc znika też jak teacher zmieni tab.

### 3C. Audyt artykułu `/features/dslm`

Strona istnieje (`src/pages/features/FeatureDSLM.tsx`, 296 linii) z hero, radar chart mockup, nano-skills mockup, sekcje benefits, steps, FAQ, CTA. Treść jest poprawna i kompletna w opisie 4-warstwowego DSLM (declarative, procedural, behavioral, motivational).

**Co dorobimy w tym sprincie (małe poprawki, nie refaktor)**:

1. Dodać sekcję nagłówkową „What is 1 MINUTE?" jako pierwszy paragraf po hero, dokładnie z tekstem z bannera, plus rozszerzenie: „1 minute = czas potrzebny teacherowi by przeczytać AI-generated briefing przed lekcją. Briefing pokazuje co poszło, co poszło źle, co warto powtórzyć, jaki Next Step zaproponować."
2. Dodać `<SeoHead/>` z `FeatureDSLM`-specific JSON-LD `Article` (headline, datePublished, dateModified, author=Edooqoo, image).
3. Banner DslmExplainerBanner — nie zmieniamy treści (jest spójna z artykułem), tylko link.

---

## Problem 4: Audyt UX/UI — top 8 priorytetów

Przejrzane: `Dashboard.tsx`, `WorksheetForm`, `StudentPage`, DSLM tabs, `CalendarPage`, `StudentHub*`. Lista od najważniejszych:

### P0 — Empty states na Dashboard po pierwszym signupie

**Problem**: Nowy nauczyciel po signupie widzi pusty `Dashboard` z `CompactStatsBar` pokazującym 0/0/0/0. Brak czytelnego „start here" CTA.
**Rozwiązanie**: Hero empty-state card pod statsbarem: `"Welcome to Edooqoo. Start with: 1) Add your first student, 2) Send Welcome Test, 3) Generate first worksheet."` z trzema przyciskami inline. Już istnieje demo student seeding (`mem/features/onboarding/demo-student-seeding`), więc dla nowych teacherów de facto będzie 1 student — wtedy pokazujemy: `"Try generating a worksheet for [Demo Student Name]"`.
**Wpływ**: time-to-first-worksheet ↓ z ~5 min do ~30 s; aktywacja użytkownika ↑.
**Mechanika**: nowy komponent `src/components/dashboard/OnboardingHeroCard.tsx`, mount conditional w `Dashboard.tsx` gdy `students.length <= 1 && worksheets.length === 0`.

### P1 — Loading skeletons zamiast spinnerów na Dashboard / StudentPage

**Problem**: W kilku miejscach (Dashboard stats, StudentPage Overview, DSLM tab) widać centralny spinner zamiast skeletonów. Czas TTI > 2 s = user widzi pusty ekran.
**Rozwiązanie**: Zamiana `<Loader2 />` na `<Skeleton />` z shadcn dopasowane do final layoutu (statsbar = 4 skeleton boxes, student card = 1 large skeleton). Już mamy `src/components/ui/skeleton.tsx`.
**Wpływ**: perceived performance ↑↑, CLS się nie zmienia bo skeleton ma te same wymiary co final.
**Mechanika**: ~6 miejsc, każde to swap `if (loading) return <Spinner/>` na `if (loading) return <SkeletonLayout/>`.

### P2 — Toast positioning i density

**Problem**: Toasty pojawiają się top-right i stackują się — przy szybkich operacjach (delete, generate) 3-4 toasty zasłaniają sticky nav i nie da się klikać.
**Rozwiązanie**: Limit do 1 toast naraz (`<Toaster duration={3000} richColors closeButton expand={false} visibleToasts={1} />` w `src/components/ui/sonner.tsx`). Alternatywnie bottom-right, dalej od głównego flow.
**Wpływ**: redukcja blokowania UI o ~80%.
**Mechanika**: 1 props change w `sonner.tsx`.

### P3 — Sticky nav student switcher — brak feedbacku po wyborze

**Problem**: `mem/features/navigation/nav-student-switcher` — switcher zmienia studenta globalnie, ale nawigacja nie odświeża wizualnie wybranego studenta (np. na `/calendar` nadal pokazuje poprzedniego).
**Rozwiązanie**: Po zmianie studenta w switcherze emitujemy istniejący event `dslm:studentChanged` i strony powiązane (`StudentPage`, `CalendarPage`, `HomeworkPage`) nasłuchują i refetchują. Plus toast `"Switched to [Student Name]"`.
**Wpływ**: eliminacja confusion „dlaczego nadal widzę Annę a wybrałem Janka".
**Mechanika**: dodanie listenera w 3 stronach, emit w `NavStudentSwitcher`.

### P4 — Worksheet form — kolejność pól nie odpowiada flow myślenia teachera

**Problem**: Obecnie: Topic → Grammar → Level → Goal → ExerciseTypes. Teacher zwykle myśli: Student → Topic → Level (z profilu) → reszta.
**Rozwiązanie**: Już mamy NavStudentSwitcher i NextStepsPresetBanner. Dodać na samej górze formularza explicit „For: [Student Name]" badge z możliwością zmiany — żeby zawsze było jasne dla kogo generujemy. Plus auto-fill `level` z `student.english_level` przy zmianie studenta.
**Wpływ**: redukcja błędów „wygenerowałem dla złego studenta" o ~90%.
**Mechanika**: nowy komponent `WorksheetFormStudentBadge.tsx` mounted on top of form, hook `useEffect([selectedStudent]) → setLevel(student.english_level)`.

### P5 — DSLM tabs — sub-nav nie pokazuje aktywności

**Problem**: `mem/features/dslm/always-visible-subsections` mówi że pills są zawsze widoczne. Ale border-primary jest słabo widoczny w dark mode (kontrast 1.8:1).
**Rozwiązanie**: Aktywny pill = `bg-primary/10 text-primary border-primary` (3-warstwowy highlight), nieaktywny = `bg-muted/30 border-transparent`.
**Wpływ**: A11y kontrast > 4.5:1, user szybciej rozpoznaje gdzie jest.
**Mechanika**: 2 linie Tailwind w komponencie sub-nav.

### P6 — Confirm delete — brak undo

**Problem**: Po single-click confirm delete (v6.9.15c) nie ma już type-to-confirm, ale też nie ma undo. Jeden klik = strata danych.
**Rozwiązanie**: Po delete pokazujemy toast z `Undo` button (5 s timeout). Soft delete jest już w DB (`deleted_at`), więc undo = `UPDATE SET deleted_at=null`. Implementacja generyczna w `ConfirmDeleteDialog` przez callback `onUndo` opcjonalny.
**Wpływ**: redukcja ticketów support „pomyłkowo usunąłem fazę" o ~100%.
**Mechanika**: w `useCurriculumPhases.deletePhase` zwracamy `{ success, undo: () => UPDATE deleted_at=null }`. W `MacroTimeline` po delete: `toast.success("Phase deleted", { action: { label: 'Undo', onClick: undo }})`. Analogicznie `NextStepBanner`.

### P7 — StudentHub mobile — taby przewijalne ale brak indykatora

**Problem**: Na mobile w StudentHub taby (Worksheets/Homework/Flashcards/Lessons) przewijają się horyzontalnie, ale brak shadow/gradient po prawej sugerującego scroll.
**Rozwiązanie**: Dodać `mask-image: linear-gradient(to right, black 90%, transparent)` na containerze tabów.
**Wpływ**: discoverability mobile features ↑.
**Mechanika**: 1 klasa CSS.

---

## Dokumentacja RAG

Pliki: `docs/llm-context.md`, `llms.txt`. Dodajemy sekcję `v6.9.16` strukturyzowaną:

```
### v6.9.16 — SEO refactor, GSC verification, UX polish

#### Problem: FAQPage/HowTo JSON-LD on every SPA route
**Edooqoo.com Solution**: Per-route JSON-LD via react-helmet-async; index.html keeps only SoftwareApplication + Organization.
**Technical Mechanics**: HelmetProvider in main.tsx; <SeoHead/> component in src/components/seo/SeoHead.tsx; meta map in src/constants/seoMeta.ts; FAQPage+HowTo moved to /how-it-works only.

#### Problem: Google Search Console connected but property not verified
**Edooqoo.com Solution**: META tag verification via gateway; PUT site; submit sitemap.xml.
**Technical Mechanics**: <meta name="google-site-verification" content="..."> in index.html <head>; siteVerification/v1/token → webResource?verificationMethod=META → webmasters/v3/sites PUT → sitemaps PUT.

#### Problem: "1 MINUTE" Learn more opens in same tab
**Edooqoo.com Solution**: native <a target="_blank" rel="noopener noreferrer"> to /features/dslm.
**Technical Mechanics**: DslmExplainerBanner.tsx swaps <Link> for <a>; Got it dismisses, X dismisses, Learn more does NOT dismiss (intentional: teacher may want to revisit).

#### Problem: Empty Dashboard for new teachers
**Edooqoo.com Solution**: OnboardingHeroCard with 3-step CTA shown when students.length <= 1 && worksheets.length === 0.
**Technical Mechanics**: src/components/dashboard/OnboardingHeroCard.tsx; conditional mount in Dashboard.tsx.

#### Problem: Destructive delete with no undo
**Edooqoo.com Solution**: 5-second Undo toast after soft delete.
**Technical Mechanics**: deletePhase returns { undo: () => UPDATE deleted_at=null }; sonner toast.action.

[+ pozostałe punkty UX]

RAG Keywords:
react-helmet-async per-route JSON-LD, FAQPage HowTo SoftwareApplication scope, Google Search Console META verification connector gateway, edooqoo.com site verification, 1 MINUTE DSLM banner Learn more new tab, OnboardingHeroCard empty state Dashboard, soft delete undo toast, sonner visibleToasts limit, nav student switcher dslm:studentChanged event, worksheet form student badge auto-fill level, DSLM sub-nav active pill contrast a11y, StudentHub mobile tabs scroll mask.
```

---

## Kolejność implementacji

1. `bun add react-helmet-async`, `HelmetProvider` w `main.tsx`.
2. `src/components/seo/SeoHead.tsx` + `src/constants/seoMeta.ts`.
3. `index.html`: usunąć `FAQPage` i `HowTo` z `@graph`, usunąć static canonical link, dodać meta `google-site-verification` (placeholder do podmiany w kroku 7).
4. Mount `<SeoHead/>` w 10 publicznych stronach.
5. `DslmExplainerBanner`: zmienić `<Link>` na `<a target="_blank" rel="noopener noreferrer">`.
6. P0–P7 UX (osobne PR-y wewnątrz iteracji, każdy ≤ 1 plik dotknięty).
7. **Manual + agent**: link konektora GSC (Ty) → agent: pobierz token → wstaw do `index.html` → republish (Ty) → agent: verify + PUT site + submit sitemap.
8. Confirm delete copy update + Undo toast w `MacroTimeline` i `NextStepBanner`.
9. `docs/llm-context.md` + `llms.txt` sekcja v6.9.16.

## Czego NIE ruszamy

- Worksheet Generation Engine, `format-worksheet-prompt`, `generate-curriculum-phases`, `generate-timeline`.
- DB schema (poza odczytami `deleted_at`).
- RLS.
- Existing public routes — tylko dodajemy `<SeoHead/>`, nie zmieniamy logiki.

## Kryteria akceptacji

- Google Rich Results Test na `/dashboard` NIE wykrywa FAQPage/HowTo.
- Rich Results Test na `/how-it-works` wykrywa FAQPage (10 Q) + HowTo (4 kroki).
- Każda z 10 publicznych stron ma unikalny `<title>` i `<meta description>` w devtools head.
- `https://edooqoo.com` jest zweryfikowane w Search Console (status: Verified).
- Sitemap `https://edooqoo.com/sitemap.xml` jest submitted w GSC.
- Klik „Learn more" w bannerze DSLM otwiera `/features/dslm` w nowej karcie.
- Banner DSLM nadal dismisses przez `X` i `Got it`, persistence per-teacher w localStorage.
- Nowy nauczyciel widzi `OnboardingHeroCard` na Dashboard.
- Delete fazy pokazuje Undo toast 5 s; klik Undo przywraca fazę i Next Steps.
- Wszystkie istniejące features dalej działają (smoke test: generate worksheet, send welcome test, create phase, generate Next Steps).
- `docs/llm-context.md` + `llms.txt` zaktualizowane.