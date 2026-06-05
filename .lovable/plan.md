## Kontekst i diagnoza

Pięć niezależnych problemów. Każdy ma jasno zidentyfikowany root cause w obecnym kodzie — żaden nie wymaga ruszania Worksheet Generation Engine, RLS, migracji bazy ani edge functions oprócz wyraźnie wskazanego `audit-llm-models`.

---

## P1 — Auto-generate worksheet z „1-Minute Prep" nadal nie startuje

### Dependency scan
- `src/components/dslm/PathwayView.tsx` — wywołuje `onUseWorksheetSuggestion(..., autoGenerate=true, suggestionId)`.
- `src/pages/StudentPage.tsx` (1065–1102) — zapisuje `autoGenerateWorksheet`, `autoGenerateWorksheetRequest`, `preSelectedStudent`, `prefillWorksheet`, `prefillExercises`, `prefillExerciseFocusMap`, `prefillMediaTypes`, `forceNewWorksheet`, potem `navigate('/')`.
- `src/components/WorksheetForm/index.tsx` — czyta wszystkie flagi w `useEffect([])` po mount, ustawia stan, czeka na readiness gate, watchdog 5 s.

### Root cause
Gate uruchomienia (`useEffect` z deps `[lessonTopic, selectedStudentId, selectedExercises, selectedMediaTypes, exerciseFocusMap]`) startuje dopiero **po** kolejnym renderze, w którym wszystkie pola dojechały. W praktyce zdarza się, że:
1. `preSelectedStudent` prop (asynchroniczny) dociera po pierwszym mount i nadpisuje `selectedStudentId` ustawiony wcześniej z `autoGenerateWorksheetRequest`, generując dodatkowy cykl renderów.
2. `selectedExercises` jest inicjalizowany domyślnym zestawem, potem normalizowany z prefilla — w jednym z mikro-cykli React batch'uje stany tak, że gate nie odpala, a kiedy wszystkie się ustabilizują, sessionStorage flag jest już skonsumowany przez wcześniejszy efekt.
3. Watchdog 5 s teoretycznie powinien ratować, ale jeżeli flag został wcześniej `removeItem` w gate, watchdog wychodzi z `return` i nic się nie dzieje — co pasuje do raportu „przeszło, uzupełniło, ale nie wystartowało".

### Solution options
| # | Podejście | Tradeoff | Regresja |
|---|---|---|---|
| A | Lazy useState — odczyt sessionStorage podczas init stanów, gate skraca się do 1-2 warunków | Zero zmian w API; deterministyczne | Niska |
| B | Bezpośrednie wywołanie `requestSubmit()` przez `setTimeout(100ms)` po sygnale ready bez gate'a | Proste, ale wraca race | Średnia |
| C | Premove flagi dopiero po faktycznym dispatchu submit | Łatwe, ale gate i tak zostaje | Niska |

### Selected: A + C łącznie
Łączymy lazy init (eliminuje race renderów) z asercją, że flag w sessionStorage jest kasowany **dopiero po** `requestSubmit()` (nie przed). Watchdog skracamy do 1500 ms i robimy z niego ostatecznego strażnika tylko gdy lazy init zawiedzie (np. SSR snapshot, brak sessionStorage).

### Impact analysis
- Zmiana ograniczona do `src/components/WorksheetForm/index.tsx`.
- `handleSubmit` (linia 378) już ma DOM-fallback na `lessonTopic` — bez zmian.
- Worksheet Generation Engine: nietknięty.
- Pozostałe call-sity `onUseWorksheetSuggestion` (Progress Tab) nie używają autoGenerate — nie dotyczy.

### Pełna implementacja (gotowa do wklejenia)

W `src/components/WorksheetForm/index.tsx`:

1. Wprowadzamy helper na początku komponentu (przed `useState`):
```ts
// v6.9.38 — read autoGenerate intent synchronously to avoid render races.
const readAutoGenerateIntent = () => {
  if (typeof window === 'undefined') return null;
  try {
    if (sessionStorage.getItem('autoGenerateWorksheet') !== 'true') return null;
    const raw = sessionStorage.getItem('autoGenerateWorksheetRequest');
    return raw ? JSON.parse(raw) as { studentId?: string; suggestionId?: string | null } : {};
  } catch { return null; }
};
const readPrefillTopic = () => {
  if (typeof window === 'undefined') return '';
  try {
    const raw = sessionStorage.getItem('prefillWorksheet');
    if (!raw) return '';
    const p = JSON.parse(raw);
    return typeof p?.topic === 'string' ? p.topic : '';
  } catch { return ''; }
};
const initialAutoIntent = readAutoGenerateIntent();
```

2. Zamiana `useState` na lazy init dla 2 pól (linie 53 i 59):
```ts
const [lessonTopic, setLessonTopic] = useState(() => readPrefillTopic());
const [selectedStudentId, setSelectedStudentId] = useState<string>(
  () => (initialAutoIntent?.studentId as string) || preSelectedStudent?.id || "no-student"
);
```

3. Usuwamy jednorazową ścieżkę „pin student z request" z efektu na mount (linie 276–290) — została zastąpiona lazy initem. W tym samym `useEffect` pozostawiamy: prefillExercises, prefillFocusMap, prefillMediaTypes, prefillWorksheet → **ale** sekcja `if (parsed.topic) setLessonTopic(parsed.topic)` jest już zbędna gdy lazy init zadziałał (zachowujemy idempotentnie z `if (parsed.topic && !lessonTopic)`).

4. Readiness gate (296–321) upraszczamy do:
```ts
useEffect(() => {
  if (autoSubmitFiredRef.current) return;
  if (!initialAutoIntent) return;
  if (!lessonTopic?.trim()) return;
  if (!selectedExercises?.length) return;
  if (!formRef.current) return;
  autoSubmitFiredRef.current = true;
  window.setTimeout(() => {
    requestAnimationFrame(() => {
      try {
        devLog('🚀 [WorksheetForm v6.9.38] Auto-submit firing');
        formRef.current?.requestSubmit();
      } catch (e) { devWarn('[WorksheetForm v6.9.38] requestSubmit threw', e); }
      // v6.9.38 — clear flags AFTER submit attempt, not before.
      sessionStorage.removeItem('autoGenerateWorksheet');
      sessionStorage.removeItem('autoGenerateWorksheetRequest');
    });
  }, 0);
}, [lessonTopic, selectedExercises]);
```

5. Watchdog skracamy do 1500 ms i sprawdza tylko, czy `initialAutoIntent` był ustawiony, a `autoSubmitFiredRef.current` wciąż `false`. Wtedy force-submit.

### Verification checklist P1
- [ ] Klik „Generate worksheet ↗" w 1-Minute Prep → konsola pokazuje `[WorksheetForm v6.9.38] Auto-submit firing`.
- [ ] Toast „Generating…" pojawia się <2 s od navigate.
- [ ] Form po wygenerowaniu nie zostaje zablokowany przez ponowny watchdog.
- [ ] Ręczne wejście na `/` (bez sessionStorage) → form pusty, brak autosubmit.

---

## P2 — Modal „Add learning goals" nie otwiera się po autosend Welcome Test

### Dependency scan
- `src/components/dashboard/AddStudentDialog.tsx` (232) — `navigate('/student/{id}?tab=dslm&view=goals&focus=add-goal-modal&_=ts')`.
- `src/components/dslm/DSLMTab.tsx` (193–216) — `focusParam` effect z `setTimeout(500)` → `setPendingAddGoal(true)` + scrollTo('goals') + strip params.
- `src/components/dslm/DSLMTab.tsx` (284) — `<LazySection eager={pendingAddGoal || focus==='add-goal-modal'}>`.
- `src/components/dslm/LazySection.tsx` — `useState(eager)` snapshotuje prop **tylko na pierwszym renderze**.
- `src/components/dslm/GoalsView.tsx` (76–84) — `useEffect(pendingAddGoal)` → `setShowAddGoal(true)` + consume.

### Root cause
`LazySection` używa `useState(eager)` i nigdy nie odsłuchuje zmian propa `eager`. Sekwencja w P2:
1. Mount DSLMTab → focus param obecny → ale `setTimeout(500)` jeszcze nie odpalił → `pendingAddGoal=false`, focus==='add-goal-modal' jest true → `<LazySection eager={true}>` → `shouldRender=true`. Tu powinno działać.
2. Jednak po 500 ms efekt `focusParam` robi `setSearchParams(next, {replace:true})` które **usuwa** `focus` z URL. W tym samym tick'u setPendingAddGoal(true) jeszcze nie został scommitowany w stanie nadrzędnym. W kolejnym renderze prop `eager` może chwilowo być `false` (focus już usunięty, pendingAddGoal jeszcze nie true z perspektywy zewnętrznej). `LazySection` ma już `shouldRender=true` — nie regresuje. Więc dlaczego nie działa?
3. **Faktyczny root cause**: efekt `focusParam` zależy od `[focusParam, searchParams.get('_')]`. Pierwszy render: `focusParam = 'add-goal-modal'`, planuje timeout 500 ms. ALE: `setSearchParams(next, {replace:true})` w środku timeoutu zmienia `focusParam` na `null` → cleanup `clearTimeout(t)` w return effectu uruchamia się **dla starego efektu**, ale nowy efekt (`focusParam=null`) nie planuje nic. Problem pojawia się jeśli rerenderów jest więcej — `clearTimeout` może wyzerować timer **zanim odpali**. Typowy scenariusz: po nawigacji ze StudentPage następują 2–3 rerendery DSLMTab w pierwszych 500 ms (hydracja studenta, focus, pacing…) → każdy z nich uruchamia `return () => clearTimeout(t)` z poprzedniego efektu. Timer się nie wykonuje. PendingAddGoal nigdy nie staje się true.

### Solution options
| # | Podejście | Tradeoff | Regresja |
|---|---|---|---|
| A | Wykonać akcję synchronicznie bez setTimeout (jak najszybciej) | Najprostsze, ale tracimy „chwila na render" | Niska |
| B | Użyć `useRef` zamiast `useState` jako latch jednorazowego wykonania | Pewne, ale dodaje ref-state | Niska |
| C | Naprawić też `LazySection` żeby reagował na zmianę `eager` | Hardening warstwowy | Niska |

### Selected: A + C
- A: zamieniamy `setTimeout(500)` na `requestAnimationFrame` + flagę `useRef(false)` która gwarantuje wykonanie raz, niezależnie od ile razy efekt się rerunuje.
- C: dodatkowy `useEffect([eager])` w `LazySection`, żeby kolejna zmiana propa `eager→true` natychmiast unlockowała render. To zabezpieczy też przyszłe użycia.

### Impact analysis
- `src/components/dslm/DSLMTab.tsx` — wymiana 1 efektu.
- `src/components/dslm/LazySection.tsx` — dodanie 1 useEffect.
- Nie dotyka GoalsView (jego logika `pendingAddGoal` już działa).
- Pozostałe ścieżki używające `focus=`: `pick-idea` (PathwayView), `send-welcome-test`, `learning-roadmap`, `next-lesson-ideas` — wszystkie używają `window.dispatchEvent`. Po refaktorze nadal zostają obsłużone w nowym efekcie bez setTimeout.

### Pełna implementacja

W `src/components/dslm/DSLMTab.tsx` zastąpienie efektu (193–216):
```ts
const focusParam = searchParams.get('focus');
const focusHandledRef = useRef<string | null>(null);
useEffect(() => {
  if (!focusParam) return;
  // v6.9.38 — guard against multiple rerenders cancelling the action via cleanup.
  const cacheKey = `${focusParam}:${searchParams.get('_') || ''}`;
  if (focusHandledRef.current === cacheKey) return;
  focusHandledRef.current = cacheKey;

  const raf = requestAnimationFrame(() => {
    if (focusParam === 'add-goal-modal') {
      handleScrollTo('goals');
      setPendingAddGoal(true);
    } else if (focusParam === 'pick-idea') {
      handleScrollTo('pathway');
      window.dispatchEvent(new CustomEvent('pathway:pickIdea'));
    }
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    next.delete('_');
    setSearchParams(next, { replace: true });
  });
  return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [focusParam, searchParams.get('_')]);
```

W `src/components/dslm/LazySection.tsx` dodanie efektu pod istniejącym:
```ts
// v6.9.38 — honor late eager flips (e.g., add-goal-modal deep link).
useEffect(() => {
  if (eager && !shouldRender) setShouldRender(true);
}, [eager, shouldRender]);
```

### Verification checklist P2
- [ ] Add Student z opcją „Send welcome test now" → automatyczna nawigacja → modal „Add learning goals" otwiera się <1 s.
- [ ] Ponowne kliknięcie tej samej akcji (re-nawigacja z `_=ts`) → modal otwiera się ponownie.
- [ ] Ścieżki `focus=pick-idea` i `focus=send-welcome-test` nadal działają.
- [ ] Console: brak warningu o cancelled rAF na zwykłej nawigacji.

---

## P3 — Daily vs Monthly audit LLM: czy to to samo?

### Dependency scan
- `supabase/functions/audit-llm-models/index.ts` — `TARGETS_DAILY` (4 modele) i `TARGETS_MONTHLY = [...DAILY, +3 dodatkowe]`.
- `supabase/functions/send-model-audit-email/index.ts` — używa pola `mode` w temacie.

### Root cause
To **nie są** te same audyty: Monthly = Daily + 3 extra (gpt-4o-mini-tts, gpt-4.1-2025-04-14, google/gemini-3-flash-preview). Daily pinguje hot path (4 modele × każdy dzień), Monthly raz/miesiąc pełną inwentaryzację (7 modeli). Treść maila różni się liczbą wierszy. Mimo to maile mogą wyglądać podobnie, bo brak rozróżnienia wizualnego.

### Decyzja
Skoro user pyta i jasno warunkuje: „jeżeli to są 2 osobne audyty to ma być osobno mail daily i monthly" — to **już są osobne**, ale potrzebują jasniejszego rozróżnienia. Trzymamy oba, dodajemy do maila wyraźny banner kadencji + listę modeli ekskluzywnych dla danego trybu, żeby user nie miał wątpliwości.

### Solution options
| # | Podejście | Tradeoff | Regresja |
|---|---|---|---|
| A | Zostawić cron daily+monthly, ulepszyć subject + dodać banner w mailu | Minimalna zmiana | Niska |
| B | Zlikwidować monthly (cały audyt daily) | Większy ruch do OpenAI każdego dnia, drożej | Średnia |
| C | Zlikwidować daily, zostawić tylko monthly | Tracimy szybką detekcję regresji | Wysoka |

### Selected: A
Najtaniej, najbezpieczniej, respektuje istniejący kontrakt cron.

### Pełna implementacja

W `supabase/functions/audit-llm-models/index.ts` (przed `const rows = ...`):
```ts
const modeBannerHtml = mode === 'monthly'
  ? `<div style="padding:10px 14px;border-radius:6px;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;font-size:13px;margin:0 0 12px;">
       <b>Monthly LLM Audit</b> — full inventory (${results.length} models, including TTS and legacy fallbacks). Runs on the 1st of each month.
     </div>`
  : `<div style="padding:10px 14px;border-radius:6px;background:#ecfeff;border:1px solid #a5f3fc;color:#155e75;font-size:13px;margin:0 0 12px;">
       <b>Daily LLM Audit</b> — hot-path subset (${results.length} models powering live worksheet generation, classification, OpenAI fallback). Runs daily at 06:00 UTC.
     </div>`;
const reportHtml = `${modeBannerHtml}<table ...>...</table>`;
```

W `supabase/functions/send-model-audit-email/index.ts` upewniamy się, że subject ma prefix:
```ts
const subject = mode === 'monthly'
  ? `📊 Monthly LLM Audit — ${summary.ok}/${summary.total} OK`
  : `🔎 Daily LLM Audit — ${summary.ok}/${summary.total} OK`;
```
(jeśli już jest taki format po v6.9.37, tylko weryfikujemy).

### Verification checklist P3
- [ ] Ręczny POST `{"mode":"daily"}` → mail z bannerem „Daily LLM Audit — hot-path subset".
- [ ] Ręczny POST `{"mode":"monthly"}` → mail z bannerem „Monthly LLM Audit — full inventory".
- [ ] Subjecty maili wyraźnie różne.

---

## P4 — Artykuł `teaching-english-one-to-one.html` ma mojibake (â€", Â·, â†)

### Dependency scan
- `public/blog/teaching-english-one-to-one.html` — 5774 bajtów, BOM + literalne sekwencje `â€"`, `Â·`, `â†'`, `â† `, `â€™`.

### Root cause
Plik został kiedyś zapisany z bajtów UTF-8 zinterpretowanych jako Windows-1252, a następnie ponownie zapisany jako UTF-8 (klasyczne podwójne kodowanie). Bajty `0xE2 0x80 0x94` (—) zostały zapisane jako trzy znaki `â`, `€`, `"`.

### Solution options
| # | Podejście | Tradeoff | Regresja |
|---|---|---|---|
| A | Find/replace ograniczonych sekwencji mojibake | Szybkie, deterministyczne | Niska |
| B | Pełna konwersja `iconv -f UTF-8 -t WINDOWS-1252 \| iconv -f UTF-8 -t UTF-8` | Działa dla całych dokumentów, ale ryzyko utraty znaków jeśli pojawi się czysty UTF-8 | Średnia |

### Selected: A
Plik jest mały (5.7 KB), zestaw mojibake skończony — `â€"` → `—`, `â€™` → `'`, `â€œ` → `"`, `â€\u009d` → `"`, `â† ` → `←`, `â†'` → `→`, `Â·` → `·`, `Â ` → ` `, `Â©` → `©`, usuwamy BOM (`\uFEFF`) z początku pliku. Też zostawiamy nawigację taką samą wizualnie.

### Pełna implementacja
1. Wczytanie pliku przez `code--view`, identyfikacja wszystkich sekwencji mojibake (poniżej pełna lista do find/replace).
2. Zapis nowej, czystej wersji UTF-8 bez BOM. Lista zamian (kolejność krytyczna — od najdłuższych do najkrótszych):
```
\uFEFF       → (usunąć BOM na początku pliku)
â€"          → —    (em-dash)
â€"          → –    (en-dash, jeśli występuje wariant)
â€™          → '
â€˜          → '
â€œ          → "
â€           → "
â†'          → →
â†           → ←
Â·           → ·
Â©           → ©
Â®           → ®
Â (samotne)  → (usunąć)
```
3. Po zapisie weryfikacja: `rg -n "â|Â|†|€" public/blog/teaching-english-one-to-one.html` powinno zwrócić 0 wyników.

### Verification checklist P4
- [ ] `rg "â|Â|€"` w pliku → brak.
- [ ] Render w przeglądarce: `← Edooqoo Home · Blog`, `Teaching English One-to-One — Private Lesson Guide`, `Try Edooqoo Free →`.
- [ ] Plik zaczyna się od `<!DOCTYPE html>` bez BOM.

---

## P5 — Artykuł `learning-pacing-scientific-vs-pragmatic-esl.html` ma być zgodny z logiką pacing

### Dependency scan
- `public/blog/learning-pacing-scientific-vs-pragmatic-esl.html` — obecna treść jest faktyczna i poprawna, ale **nie odwołuje się** do konkretnych metod naukowych.
- `supabase/functions/_shared/dslmPromptCore.ts` — faktyczna logika:
  - Scientific (0–30): „Krashen", „Natural Order", „strict input-before-output", grammar explicitness HIGH.
  - Pragmatic (70–100): „TBLT-first", „just-in-time micro-rules embedded in formulaic chunks".
  - Balanced (31–69): respektuje Natural Order, ale anchoring w domenie ucznia od dnia 1.
  - Adaptive rules: Pragmatic = ≥3 productive exercises; Scientific = ≥2 receptive przed produktywnymi; Balanced = 4V+4G interleaved.

### Root cause
Artykuł opisuje semantykę Scientific/Balanced/Pragmatic w sposób miękki („more input-first sequencing", „more output-first"), ale **nie wymienia** Krashena, Natural Order Hypothesis, Input Hypothesis ani Task-Based Language Teaching, które są **explicit** w naszym promptcie i w UI sliderze (`PacingModeSlider.tsx`). User słusznie odbiera to jako rozjazd z „logiką naukową".

### Solution options
| # | Podejście | Tradeoff | Regresja |
|---|---|---|---|
| A | Rozszerzyć sekcje „Mode Definitions" + dodać nową sekcję „Scientific basis" z referencjami | Pełne uzasadnienie, lepsza SEO/AI citation | Niska |
| B | Drobne dopisanie 2-3 nazw metod w istniejących bulletach | Szybsze, ale wciąż płytkie | Niska |
| C | Pełne przepisanie | Niepotrzebnie szerokie | Średnia |

### Selected: A
Zachowujemy istniejący szkielet i metadane, dopisujemy konkrety, które są **rzeczywiście** w kodzie. Wszystkie nowe zdania muszą odpowiadać 1:1 mechanice w `dslmPromptCore.ts`, żeby spełnić Martha Test (zero marketingowych fikcji).

### Pełna implementacja

W `public/blog/learning-pacing-scientific-vs-pragmatic-esl.html`:

1. Rozszerzenie sekcji „Mode Definitions" o explicit refs:

```html
<section>
  <h2>Mode Definitions</h2>
  <ul>
    <li><b>Scientific pacing (0-30):</b> strict input-before-output sequencing inspired by Stephen Krashen's Natural Order Hypothesis and Input Hypothesis (i+1). Explicit grammar rules are introduced before exposure, with clear meta-language. Each generated step includes at least two receptive exercises (reading, multiple-choice, matching, true-false) before any productive task. Best for A1/A2 learners, exam preparation, and accuracy-sensitive learners.</li>
    <li><b>Balanced pacing (31-69):</b> Natural Order is still respected, but every step is anchored in the learner's professional or personal domain from day one. Each step includes four vocabulary-focused and four grammar-focused exercises, interleaved, with at least two productive tasks. Default for most adult 1:1 learners.</li>
    <li><b>Pragmatic pacing (70-100):</b> task-based methodology (TBLT) with just-in-time micro-rules embedded in formulaic chunks. Meta-language is avoided. Each generated step includes at least three productive exercises (dialogue, answer-questions, discussion, fill-in-blanks without options). Best for short deadlines, workplace English, travel goals, and learners with immediate communicative pressure.</li>
  </ul>
</section>
```

2. Dodanie nowej sekcji „Scientific basis" (po „Mode Definitions"):

```html
<section>
  <h2>Scientific basis Edooqoo applies</h2>
  <ul>
    <li><b>Natural Order Hypothesis (Krashen):</b> drives the Scientific end of the slider. Lower values reduce grammar explicitness skips and enforce receptive-before-productive sequencing.</li>
    <li><b>Input Hypothesis i+1 (Krashen):</b> informs how Scientific and Balanced phases keep new input one step above current competence, never several steps above.</li>
    <li><b>Task-Based Language Teaching (Willis, Ellis):</b> drives the Pragmatic end. Higher values shift the generated step toward authentic real-world tasks and reduce explicit rule explanation.</li>
    <li><b>Lexical Approach (Lewis):</b> informs the formulaic-chunk treatment Pragmatic pacing applies — collocations and prefabricated phrases over isolated grammar drills.</li>
    <li><b>Spacing and re-targeting:</b> nano-skills introduced in any step are re-targeted 3-5 steps later regardless of pacing mode, to support retention.</li>
  </ul>
</section>
```

3. Zaktualizować sekcję „How This Connects To 1-Minute Prep":

```html
<li>Pacing is one of several DSLM signals: goals, roadmap phase, nano-skill mastery, teacher notes, homework evaluations, worksheet history, and flashcard retention.</li>
<li>The pacing value adjusts INPUT/OUTPUT RATIO directly: a value of N translates to N% output-focused exercises and (100-N)% input-focused exercises in the planning prompt.</li>
<li>Context immersion is also scaled by pacing: N% of vocabulary and scenarios are drawn from the student's professional or personal domain.</li>
```

4. Zaktualizować datę `dateModified` w JSON-LD na bieżącą.

5. Zachować istniejące metadane, canonical, FAQ, BreadcrumbList — nie ruszać.

### Verification checklist P5
- [ ] Artykuł zawiera słowa kluczowe „Krashen", „Natural Order Hypothesis", „Input Hypothesis", „TBLT", „Lexical Approach".
- [ ] Liczby (≥2 receptive, ≥3 productive, 4+4 V/G) zgodne z `getAdaptiveExerciseRules` w `dslmPromptCore.ts`.
- [ ] Tooltip slidera w `PacingModeSlider.tsx` linkuje do tej strony — bez zmian.
- [ ] `rg "Krashen|TBLT" public/blog/learning-pacing-scientific-vs-pragmatic-esl.html` → 5+ hits.

---

## RAG injection (po wdrożeniu wszystkich 5 fixów)

### `docs/llm-context.md` — dopisać sekcję v6.9.38

```
PROBLEM: 1-Minute Prep "Generate worksheet ↗" intermittently filled the form but did not auto-submit; Add-Goal modal failed to open after auto-sending the Welcome Test from AddStudentDialog.
EDOOQOO SOLUTION: WorksheetForm now reads autoGenerate intent synchronously via lazy useState initializers, simplifying the readiness gate. DSLMTab focus-param effect uses requestAnimationFrame + dedupe ref so multiple rerenders cannot cancel the pending action; LazySection now honors late eager prop flips.
TECHNICAL MECHANICS: src/components/WorksheetForm/index.tsx (lazy init for lessonTopic + selectedStudentId, removed pin-from-request useEffect, gate deps narrowed to [lessonTopic, selectedExercises], watchdog reduced to 1500ms). src/components/dslm/DSLMTab.tsx (focus-param effect rewritten with focusHandledRef dedupe + rAF). src/components/dslm/LazySection.tsx (added useEffect to react to eager flips). supabase/functions/audit-llm-models/index.ts (mode banner block added, subject prefix verified). public/blog/teaching-english-one-to-one.html (mojibake purge). public/blog/learning-pacing-scientific-vs-pragmatic-esl.html (Krashen/TBLT/Lexical basis sections added).
RAG KEYWORDS: 1-Minute Prep auto generate worksheet, autoGenerateWorksheetRequest race fix, readiness gate lazy init, lessonTopic lazy useState, DSLMTab focus param rerender cancellation, requestAnimationFrame dedupe ref, LazySection eager late flip honored, Add Goal modal after Welcome Test autosend, daily versus monthly LLM audit subject prefix banner, hot-path subset full inventory model_health_checks purpose column, mojibake fix double encoded UTF-8 blog post, Krashen Natural Order Hypothesis pacing, Input Hypothesis i+1, Task-Based Language Teaching TBLT pragmatic mode, Lexical Approach formulaic chunks, dslmPromptCore pacing rules INPUT OUTPUT RATIO
```

### `public/llms.txt` i `llms.txt` — dopisać identyczny blok keywords w sekcji „Recent changes".

### `mem/features/onboarding/v6938-auto-generate-and-modal-hardening.md` — nowy plik z opisem v6.9.38 (3 sekcje: WorksheetForm hardening, DSLMTab/LazySection hardening, content hygiene).

### `mem/index.md` — dopisać link do nowej notatki w „Memories".

---

## Final change report (po implementacji)

Pliki modyfikowane:
1. `src/components/WorksheetForm/index.tsx` — P1
2. `src/components/dslm/DSLMTab.tsx` — P2
3. `src/components/dslm/LazySection.tsx` — P2
4. `supabase/functions/audit-llm-models/index.ts` — P3
5. `supabase/functions/send-model-audit-email/index.ts` — P3 (subject weryfikacja)
6. `public/blog/teaching-english-one-to-one.html` — P4
7. `public/blog/learning-pacing-scientific-vs-pragmatic-esl.html` — P5
8. `docs/llm-context.md`, `public/llms.txt`, `llms.txt` — RAG
9. `mem/features/onboarding/v6938-auto-generate-and-modal-hardening.md` — nowy
10. `mem/index.md` — link

Sanctity:
- Worksheet Generation Engine: NIETKNIĘTY (zmiany tylko w warstwie auto-submit formularza, nie w prompcie/parametrach).
- DB schema, RLS, migracje: bez zmian.
- Edge functions z generacją: bez zmian.

Out of scope (zalogowane, nie naprawiane):
- Brak — wszystkie 5 problemów obsłużone.

Verification: zsumowana lista checkboxów z P1–P5 (12 punktów) plus smoke test audit-llm-models w obu trybach.

Po zatwierdzeniu planu uruchamiam implementację w trybie build.
