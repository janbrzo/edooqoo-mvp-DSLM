# v6.9.91 — Hero jeszcze większy, neutralny stan proof-switchera, oddzielenie tickera

## Cel
1. Jeszcze mocniej powiększyć nagłówek hero, aby generator był tylko lekko widoczny na dole pierwszego ekranu.
2. Panel "Prep impact / Workflow proof / Evidence stack" ma startować bez aktywnej zakładki — treść pojawia się dopiero po najechaniu lub kliknięciu.
3. Baner "Create a free account to save student context for 1-Minute Prep" nie może wizualnie zlewać się z sekcją poniżej.

## Zakres zmian

### 1. Hero (`src/components/landing/HeroHeadline.tsx`)
- H1: skala z `xl:text-[4.25rem]` na `lg:text-[4rem] xl:text-[5rem] 2xl:text-[5.5rem]`, `leading-[1.12]`, marginesy `mb-8`.
- Lead paragraph: `lg:text-[1.5rem]`, `lg:max-w-[36rem]`, `mb-8`.
- CTA: `sm:h-[4.25rem]`, tekst `sm:text-[1.35rem]` (primary) i `sm:text-xl` (secondary).
- Checkmarki + micro-copy: o jeden stopień większe (`sm:text-lg` / `sm:text-base`).
- Padding sekcji: `lg:pt-24 lg:pb-28`.
- Cel pomiarowy: przy viewport 1338x889 górna krawędź `#worksheet-form` ma wypadać ok. 820-860 px (obecnie ~758 px) — czyli widoczny tylko wąski pasek generatora.
- Weryfikacja Playwright: brak poziomego scrolla na 390 px i 1338 px, brak przycięcia descenderów w gradientowym wierszu.

### 2. Neutralny stan proof-switchera (`src/components/landing/OneMinutePrepHeroProofSwitcher.tsx`)
- Typ stanu: `HeroProofPanel | null`, wartość początkowa `null` (prop `defaultPanel` staje się opcjonalnym `initialPanel`, domyślnie `null`, bez zmiany wywołań).
- Gdy stan = `null`:
  - żaden tab nie ma stylu aktywnego, `aria-selected={false}` dla wszystkich,
  - zamiast panelu renderowany jest niski placeholder (jedna ramka, ~2 linijki tekstu, np. "Hover or tap a tab to see the proof"), aby layout prawej kolumny nie skakał i aby fold był lżejszy.
- Aktywacja: `onMouseEnter`, `onFocus`, `onClick` (jak dziś). Po pierwszej interakcji panel pozostaje wybrany (nie wraca do `null` po zjechaniu myszką).
- Klawiatura: tabowanie na przycisk ustawia panel przez `onFocus`, więc dostępność bez zmian.
- `OneMinutePrepProofSection.tsx` (sekcja poniżej folda) pozostaje bez zmian — tam domyślna zakładka nadal ma sens.

### 3. Separacja bannera (`src/components/landing/UnlockFeaturesTicker.tsx` + `src/pages/Index.tsx`)
- Ticker dostaje własny oddech: wrapper `px-4 pt-10 pb-12` zamiast samego `px-4`.
- Baner "Create a free account…" zyskuje wyraźniejsze odseparowanie wewnątrz karty: większy odstęp (`mb-3`) oraz cienki dzielnik `border-b border-border/60` między banerem a paskiem marquee.
- W `Index.tsx` kontener generatora: `pb-16` -> `pb-10`, a odstęp przenosimy do tickera, żeby sekwencja generator → ticker → `HomeCredibilityBridge` miała czytelne przerwy zamiast stykających się bloków.

## Poza zakresem
- Brak zmian w logice generowania worksheetów, kalkulatorze i eventach analitycznych.
- Brak zmian w treści copy (poza brakiem zmian — wszystkie zdania zostają).

## Weryfikacja
- Playwright: zrzuty folda przy 1338x889 i 390x844, pomiar `getBoundingClientRect().top` dla `#worksheet-form`.
- Sprawdzenie, że po wejściu na stronę prawa kolumna nie pokazuje kalkulatora, a po najechaniu na "Prep impact" pojawia się natychmiast.
- Typecheck projektu.
