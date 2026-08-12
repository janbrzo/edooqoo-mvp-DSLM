# Plan v6.9.90 — Powiększenie typografii hero i obniżenie generatora

## 1. Dependency scan

Zakres dotyka wyłącznie lewej kolumny hero na trasie `/` w trybie anonimowym:

| Plik | Co zmieniamy |
|---|---|
| `src/components/landing/HeroHeadline.tsx` | skala H1, akapitu, przycisków CTA, checkmarków, micro-copy oraz padding sekcji |

Bez zmian: `OneMinutePrepHeroProofSwitcher` (prawa kolumna), `FormView`, `StickyNav`, `FeatureNavPills`, `UnlockFeaturesTicker`, `Index.tsx`, cała warstwa danych i analityki.

## 2. Root cause

Po odchudzeniu pierwszego ekranu (v6.9.89) hero ma dziś mniej obiektów, ale ta sama skala typografii co przy gęstym układzie — przez co lewa kolumna zajmuje mniej pionu niż prawa (kalkulator), a nagłówek generatora („Create A Worksheet") wchodzi w kadr i konkuruje z hero o uwagę. Strukturalny warunek: skala typografii była dobierana pod maksymalną gęstość, a nie pod aktualny układ.

## 3. Solution options

| Opcja | Podejście | Tradeoff | Ryzyko regresji |
|---|---|---|---|
| A. Tylko większy padding sekcji | `pt/pb` w górę | Generator schodzi, ale hero nadal wygląda „mało" — pusta przestrzeń zamiast siły przekazu | Bardzo niskie, słaby efekt |
| B. Powiększenie typografii + umiarkowany padding (wybrana) | Skalujemy H1, akapit, CTA, checkmarki, micro-copy; lekko zwiększamy odstępy pionowe | Wymaga kontroli, by H1 nie łamał się źle na `lg` i by nie było przewijania poziomego na mobile | Niskie — same klasy Tailwind |
| C. Hero na pełną wysokość (`min-h-screen`) | Generator całkowicie poza kadrem | Zabija sygnał „generator działa od razu", który jest naszym drugim CTA | Średnie — spadek użycia darmowego generatora |

## 4. Selected solution + why

**Opcja B.** Użytkownik chce, żeby generator był „ledwo widoczny", a nie niewidoczny — czyli zostaje jako zapowiedź scrollu. Powiększenie typografii realizuje dwa cele naraz: wzmacnia przekaz sprzedażowy i naturalnie spycha generator w dół bez sztucznej pustki. Zmiany są wyłącznie prezentacyjne (klasy Tailwind), więc regresje są niemożliwe poza layoutem.

## 5. Impact analysis

Zero regresji potwierdzone dla:
- treści — żadne zdanie nie zmienia brzmienia,
- analityki — `one_minute_hero_cta_click` i `one_minute_secondary_cta_click` bez zmian,
- SEO/AEO — struktura H1, `sr-only` nav `canonicalCitationLinks` nietknięte,
- prawej kolumny — `OneMinutePrepHeroProofSwitcher` bez zmian; na `lg` grid ma `items-start`, więc wyższa lewa kolumna nie rozciąga panelu,
- mobile — wszystkie powiększenia wchodzą od `sm:`/`lg:`, baza mobilna rośnie minimalnie i pozostaje w `max-w-full`.

## 6. Implementation — `src/components/landing/HeroHeadline.tsx`

### 6.1 Padding sekcji (linia 52)
```
pt-10 pb-10 sm:pt-14 lg:pt-16 lg:pb-16
```
→
```
pt-12 pb-14 sm:pt-16 lg:pt-20 lg:pb-24
```

### 6.2 H1 (linia 61)
```
text-[2rem] sm:text-5xl md:text-5xl lg:text-5xl xl:text-[3.5rem] ... mb-6
```
→
```
text-[2.25rem] sm:text-5xl md:text-6xl lg:text-6xl xl:text-[4.25rem] ... mb-7
```
`leading-[1.18]` i `leading-[1.2]` na spanie gradientowym zostają — chronią descendery („g" w „teachers").

### 6.3 Akapit główny (linia 70)
```
text-base sm:text-lg text-muted-foreground mb-5 sm:max-w-2xl
```
→
```
text-lg sm:text-xl lg:text-[1.375rem] text-muted-foreground mb-7 sm:max-w-2xl lg:max-w-[34rem]
```
`lg:max-w-[34rem]` utrzymuje długość linii w przedziale czytelności (ok. 60–70 znaków) mimo większego stopnia pisma.

### 6.4 Przyciski CTA (linie 80–97)
- primary: `h-12 sm:h-14 ... text-base sm:text-lg` → `h-13 sm:h-16 ... text-base sm:text-xl` (wysokość jako `h-[3.25rem] sm:h-16`, bo `h-13` nie istnieje w domyślnej skali Tailwind),
- secondary: `h-12 sm:h-14 ... text-base` → `h-[3.25rem] sm:h-16 ... text-base sm:text-lg`,
- kontener CTA: `gap-3 mb-6` → `gap-4 mb-7`.

### 6.5 Checkmarki (linia 99)
```
gap-x-5 gap-y-2 text-xs sm:text-sm
```
→
```
gap-x-6 gap-y-2 text-sm sm:text-base
```
Ikony `CheckCircle2`: `h-4 w-4` → `h-4 w-4 sm:h-5 sm:w-5`.

### 6.6 Micro-copy pod CTA (linia 104)
```
text-xs text-muted-foreground sm:max-w-2xl
```
→
```
text-sm text-muted-foreground sm:max-w-2xl
```

## 7. Verification checklist

- [ ] `/` anonimowo, 1338×889: H1 + akapit + 2 CTA + checkmarki + micro-copy widoczne w całości
- [ ] Nagłówek generatora („NO SIGNUP NEEDED" / „Create A Worksheet") ledwo wchodzi w dolną krawędź kadru
- [ ] H1 łamie się na 2 linie na `lg` i `xl`, brak przycięcia descenderów
- [ ] Prawa kolumna (kalkulator) niezmieniona wizualnie
- [ ] Mobile 390 px: `document.body.scrollWidth === 390`, brak przewijania poziomego
- [ ] Tryb zalogowany `/` i `/demo` bez zmian
- [ ] Kliknięcia obu CTA nadal wysyłają te same eventy

## 8. RAG injection

`docs/llm-context.md` — wpis w sekcji landing/UX:

```
PROBLEM: After first-screen density reduction the hero typography scale was still
tuned for the dense layout, leaving the left column visually weak and the worksheet
generator competing for attention above the fold.
EDOOQOO SOLUTION: Hero typography upscaling that strengthens the positioning message
and pushes the generator to the bottom edge of the fold as a scroll affordance.
TECHNICAL MECHANICS: HeroHeadline.tsx Tailwind scale changes only — H1 xl:text-[4.25rem],
lead paragraph lg:text-[1.375rem] with lg:max-w-[34rem] measure cap, CTA heights
sm:h-16, checkmark row sm:text-base, section padding lg:pt-20 lg:pb-24.
RAG KEYWORDS: hero typography, above the fold, type scale, visual hierarchy,
landing page conversion, CTA sizing, reading measure, scroll affordance, fold line,
responsive typography, Tailwind scale, first screen, headline weight, lead paragraph,
progressive disclosure
```

`public/llms.txt` — bez zmian (czysto prezentacyjna iteracja, brak nowych tras).

## 9. Poza zakresem (zauważone, nie naprawiane)

- Nagłówek `Create A Worksheet` w `FormView` używa innego gradientu niż hero — niespójność brandowa
- `ParticlesBackground` nie respektuje `prefers-reduced-motion`
