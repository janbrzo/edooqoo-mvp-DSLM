# Plan v6.9.89 — Odciążenie pierwszego ekranu landing page

## 1. Dependency scan

Pierwszy ekran (`/`, tryb anonimowy) składa się z:

| Warstwa | Plik | Co renderuje nad zgięciem |
|---|---|---|
| Nawigacja | `src/components/landing/StickyNav.tsx` (linia 253) + `src/components/landing/FeatureNavPills.tsx` | logo + 8 pigułek z ikonami + How it works + Pricing + Log in + Start Free = 12 elementów w pasku 56 px |
| Hero lewa kolumna | `src/components/landing/HeroHeadline.tsx` | H1 (2 linie), akapit 3-liniowy, drugi akapit 2-liniowy, 2 CTA, 3 checkmarki, marquee z 9 funkcjami |
| Hero prawa kolumna | `src/components/landing/OneMinutePrepHeroProofSwitcher.tsx` + `src/components/PricingCalculator.tsx` | 3 zakładki + kalkulator z 4 polami + 3 wynikami + disclaimer |
| Tło | `src/components/landing/ParticlesBackground.tsx` | animowana siatka cząstek na całej szerokości |
| Poniżej | `src/components/worksheet/FormView.tsx` (variant `landing`) | generator — wchodzi w kadr dopiero na ~790 px |

Sekcje pod hero (`HomeCredibilityBridge`, `HomeWeeklyWorkflowProof`, `HomeCompoundingContext`, `HomeFeatureProofGrid`, `HomeTutorRealityScenario`, `PricingSection`, `HomeFinalCTA`) — poza zakresem, bez zmian.

Zależności do ochrony:
- `FeatureNavPills` daje 8 wewnętrznych linków do `/features/*`. Te same 7 linków + `/one-minute-prep` istnieją w `src/components/GlobalFooter.tsx` (linie 55–61), więc graf linków wewnętrznych (`scripts/seo/audit-internal-link-graph.mjs`) nie ucierpi, jeśli pigułki zwiną się do menu.
- Ukryta nawigacja `canonicalCitationLinks` (`sr-only`) w `HeroHeadline` — zostaje nietknięta (zasób AEO).
- `trackEvent('one_minute_hero_cta_click' | 'one_minute_secondary_cta_click' | pigułki)` — nazwy zdarzeń bez zmian, żeby nie zerwać ciągłości analityki.

## 2. Root cause

Pierwszy ekran nie ma hierarchii, bo każda kolejna iteracja dokładała dowód obok dowodu zamiast pod dowodem: hero pełni jednocześnie 4 role — pozycjonowanie (H1), edukację (2 akapity), dowód ROI (kalkulator) i katalog funkcji (marquee + 8 pigułek w nawigacji). Strukturalny warunek: brak reguły „jedna sekcja = jedno zadanie poznawcze", więc nic nigdy nie zostało usunięte, tylko dołożone. Efekt: w kadrze 1338×889 użytkownik dostaje ~35 osobnych obiektów tekstowych i ani jednego wyraźnego punktu wejścia.

## 3. Solution options

| Opcja | Podejście | Tradeoff | Ryzyko regresji |
|---|---|---|---|
| A. Radykalne cięcie | Usunąć kalkulator i marquee z hero, zostawić H1 + 1 akapit + 2 CTA | Najczystszy ekran, ale tracimy dowód ROI (najsilniejszy element sprzedażowy) nad zgięciem | Średnie — spadek konwersji, utrata treści indeksowanej |
| B. Redystrybucja (wybrana) | Nic nie usuwamy z witryny — przenosimy niżej lub zwijamy: nawigacja do 4 pigułek + „More", drugi akapit do micro-copy pod CTA, marquee pod generator, kalkulator startuje w formie zwiniętej z jednym wynikiem | Wymaga precyzyjnych zmian w 4 plikach | Niskie — same zmiany prezentacyjne |
| C. Tylko typografia i odstępy | Zmniejszyć H1 i paddingi | Nie rozwiązuje problemu — liczba obiektów zostaje ta sama | Bardzo niskie, ale i bardzo niski efekt |

## 4. Selected solution + why

**Opcja B.** Wszystkie treści mają wartość SEO/AEO i sprzedażową — problem jest w gęstości, nie w istnieniu. B redukuje liczbę obiektów w kadrze z ~35 do ~18 bez usuwania ani jednego zdania z dokumentu, więc audyty treści (`audit-martha-test.mjs`, `audit-strategic-content.mjs`, graf linków) przechodzą bez zmian, a ryzyko konwersyjne jest zerowe: główne CTA i dowód ROI zostają nad zgięciem, tylko ciszej.

## 5. Impact analysis

Zero regresji potwierdzone dla:
- routingu — żadna trasa się nie zmienia,
- linków wewnętrznych — 8 tras `/features/*` nadal linkowanych ze stopki na każdej stronie oraz z menu „More" (renderowane jako `<a>` po otwarciu; wersja mobilna `stacked` bez zmian),
- analityki — te same nazwy `eventType`,
- generatora arkuszy — plik `FormView.tsx` i cały silnik generacji nietknięte,
- trybu zalogowanego i demo — zmiany dotyczą wyłącznie gałęzi anonimowej `StickyNav` oraz `HeroHeadline`, których zalogowany widok nie renderuje,
- mobile — układ mobilny hero jest jednokolumnowy; wszystkie zmiany są `lg:`-scoped albo neutralne.

## 6. Implementation

### Krok 1 — `src/components/landing/FeatureNavPills.tsx`

Dodać opcjonalny prop `maxVisible?: number` (domyślnie `Infinity`, więc obecni konsumenci działają identycznie). W wariancie `inline` (linia 85), gdy `maxVisible` jest ustawione:

- renderować pierwsze `maxVisible` pozycji jako pigułki,
- resztę w `DropdownMenu` (`@/components/ui/dropdown-menu`) z triggerem `More features` + `ChevronDown`,
- pozycje w menu jako `DropdownMenuItem asChild` z `<Link to={item.path}>` (zachowanie middle-click zgodne z regułą `mem://features/navigation/middle-click-anchor-pattern`),
- `trackEvent` dla pozycji w menu z tym samym payloadem co dziś.

Wariant `stacked` (mobile sheet) ignoruje `maxVisible` — bez zmian.

### Krok 2 — `src/components/landing/StickyNav.tsx`, nawigacja anonimowa (linia 256)

`<FeatureNavPills />` → `<FeatureNavPills maxVisible={4} />`.

Widoczne pozostają: 1-Minute Prep, Welcome Test, DSLM, Homework. Pozostałe 4 (Flashcards, Live Sessions, Calendar, Student Hub) w menu „More features".

### Krok 3 — `src/components/landing/HeroHeadline.tsx`

1. **H1** — usunąć kropkę: `for 1:1 English teachers.` → `for 1:1 English teachers` (spójne z `index.html` po v6.9.85). Zmniejszyć skalę na desktopie: `lg:text-[3.25rem] xl:text-6xl` → `lg:text-5xl xl:text-[3.5rem]`.
2. **Akapit główny** — skrócić do jednego zdania decyzyjnego:
   `Edooqoo turns student goals, lesson notes, homework and flashcard progress into a clear next focus — and a ready-to-teach worksheet with audio, images and AI-assisted review.`
   Klasy: `mb-6` → `mb-5`.
3. **Drugi akapit** (`The worksheet generator is still available instantly…`) — usunąć jako osobny blok i przenieść treść jako jedną linijkę micro-copy pod CTA, `text-xs text-muted-foreground`, brzmienie:
   `Worksheet generator works instantly. 1-Minute Prep starts when you create a student profile.`
   Zdanie nie znika ze strony, zmienia tylko wagę wizualną.
4. **Checkmarki** — zostają 3, bez zmian, ale `mb-8` → `mb-6`.
5. **Marquee `unlockFeatures`** — usunąć z `HeroHeadline` i przenieść bez zmian treści do nowego komponentu `src/components/landing/UnlockFeaturesTicker.tsx` (czysty cut-paste JSX + tablicy `unlockFeatures`), montowanego w `src/pages/Index.tsx` **bezpośrednio pod `FormView`**, przed `HomeCredibilityBridge` (linia 491). Wszystkie 9 etykiet zostaje w DOM.
6. **Paddingi sekcji** — `pt-16 pb-16 sm:pt-20 lg:pt-24 lg:pb-24` → `pt-10 pb-10 sm:pt-14 lg:pt-16 lg:pb-16`.

### Krok 4 — `src/components/landing/OneMinutePrepHeroProofSwitcher.tsx`

Nie zmieniamy logiki zakładek ani domyślnego panelu (`calculator`). Zmiana czysto wizualna w panelu kalkulatora: nagłówek „See how much prep is silently costing you" schodzi z `text-base` na `text-sm`, disclaimer (`Estimate only…`) trafia do `<details>` z podsumowaniem `How this estimate works`. Trzy kafle wyników (12.1h / 12 / $300) zostają widoczne — to najsilniejszy dowód na ekranie.

### Krok 5 — `src/pages/Index.tsx`

Import i montaż `UnlockFeaturesTicker` pod `FormView` (opisane w kroku 3.5). Żadnych innych zmian.

## 7. Verification checklist

- [ ] Nav anonimowy: 4 pigułki + „More features" na `lg`; menu otwiera się i zawiera pozostałe 4 linki
- [ ] Nav mobilny (sheet): nadal wszystkie 8 pozycji
- [ ] `/` nad zgięciem 1338×889: widoczne H1, akapit, 2 CTA, checkmarki, kalkulator z wynikami — bez marquee
- [ ] H1 bez kropki końcowej
- [ ] Marquee widoczny pod generatorem, wszystkie 9 etykiet w DOM
- [ ] Zdanie o generatorze nadal obecne na stronie (micro-copy pod CTA)
- [ ] Tryb zalogowany `/` i `/demo` bez zmian wizualnych
- [ ] Mobile 390 px: hero jednokolumnowy, brak przepełnień poziomych
- [ ] `npm run seo:audit` i audyt grafu linków bez nowych błędów

## 8. RAG injection

`docs/llm-context.md` — nowy wpis w sekcji landing/UX:

```
PROBLEM: The anonymous homepage first screen presented ~35 competing objects,
with no visual hierarchy between positioning, education, ROI proof and feature catalogue.
EDOOQOO SOLUTION: First-screen density reduction by redistribution, not deletion.
TECHNICAL MECHANICS: FeatureNavPills maxVisible prop + More-features dropdown;
HeroHeadline copy compression; UnlockFeaturesTicker extracted below FormView;
calculator disclaimer collapsed into details element.
RAG KEYWORDS: above the fold, landing page density, hero hierarchy, cognitive load,
navigation overflow menu, ROI calculator, first screen, conversion path, feature pills,
internal link graph, marquee ticker, CTA hierarchy, homepage information architecture,
visual noise, progressive disclosure
```

`public/llms.txt` — bez zmian merytorycznych (plik jest indeksem od v6.9.85; ta zmiana nie dodaje ani nie usuwa żadnej trasy).

## 9. Poza zakresem (zalogowane, nie naprawiane)

- `ParticlesBackground` dokłada ruchu w tle pierwszego ekranu — do rozważenia osobno (np. wyłączenie przy `prefers-reduced-motion`)
- Sekcje pod hero powielają część dowodów z kalkulatora — osobny cykl konsolidacji
- Nagłówek `Create A Worksheet` w `FormView` używa gradientu innego niż hero — niespójność brandowa
