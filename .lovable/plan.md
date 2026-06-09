
# Plan v6.9.49 — Problem Resolution Cycle

Skupiony fix 4 problemów. Zero zmian w Worksheet Generation Engine.

---

## P1. Auto-generate worksheet po kliknięciu „Generate worksheet ↗" znów nie startuje

### Dependency scan
`StudentPage.tsx` (1065–1104), `src/lib/worksheet/autoGenerateBootstrap.ts`,
`src/pages/Index.tsx` (130–281), `src/hooks/useWorksheetState.tsx`,
`src/components/WorksheetForm/index.tsx` (RAF gate 421–490).

### Root cause
StudentPage zapisuje `sessionStorage.forceNewWorksheet = 'true'` (linia 1103),
ale `Index.tsx` honoruje *wyłącznie* query-param `?forceNew=true` (linia 132) i nigdy
nie czyta tej flagi z sessionStorage. Efekt: gdy user już wcześniej wygenerował
worksheet w tej sesji, `worksheetState` ma niezerowy `generatedWorksheet` →
`bothWorksheetsReady === true` → bootstrap z v6.9.48 wcześnie `return`-uje
(`if (bothWorksheetsReady) return;`), a ekran pokazuje stary worksheet zamiast
startu generowania. Drugi pochodny problem: gdy bootstrap fire-uje, **nie**
resetuje stanu, więc nawet po jego naprawie nadal widać stary `GenerationView`.

### Solution options
| Opcja | Opis | Regresja |
|---|---|---|
| A | Zawsze honoruj `sessionStorage.forceNewWorksheet` w Index + przed bootstrap auto-generate wymuś `resetWorksheetState()` | low |
| B | Przenieść `forceNewWorksheet` na URL param w StudentPage | medium (zmiana nawigacji, możliwe regresje QS) |
| C | Wystawić event do WorksheetState | high (nowa magistrala) |

### Selected: A
Najmniej inwazyjne, lokalne w Index.tsx i autoGenerateBootstrap.ts.

### Impact analysis
Zmiany dotyczą tylko Index.tsx mount-effects. Brak zmian w prompcie, RLS,
DB. Manual submit nie tknięty.

### Implementation
1. `src/pages/Index.tsx`, przy mount sprawdzamy **najpierw** `sessionStorage.forceNewWorksheet`:
   ```tsx
   useEffect(() => {
     try {
       if (sessionStorage.getItem('forceNewWorksheet') === 'true') {
         sessionStorage.removeItem('forceNewWorksheet');
         worksheetState.forceNewWorksheet();
       }
     } catch {}
   }, []); // jednorazowo
   ```
2. W istniejącym bootstrap-effect (linie 246–281):
   - Usuwamy `if (bothWorksheetsReady) return;`
   - Tuż przed `handleGenerateWorksheet(payload)` wołamy `worksheetState.resetWorksheetState()` jeżeli `bothWorksheetsReady`.
   - Dodajemy do deps `[isRegisteredUser, authLoading, tokensLoading, bothWorksheetsReady]`, ale z `fired` ref na poziomie komponentu (nie lokalnym), żeby effect mógł re-run bez podwójnego strzału:
     ```tsx
     const autoFiredRef = useRef(false);
     // wewnątrz interval: if (autoFiredRef.current) return;
     // przed `handleGenerateWorksheet`: autoFiredRef.current = true;
     ```
3. `src/lib/worksheet/autoGenerateBootstrap.ts` — dodać export `hasAutoGenerateIntent(): boolean` (tylko sprawdza flagę bez parsowania) i użyć w Index do early-out gdy ani intent ani forceNewWorksheet nie są ustawione.

### Verification
- Klik „Generate worksheet ↗" z 1-Minute Prep po wcześniejszym otwartym worksheecie → reset stanu + auto-submit działa.
- Manual click w `/` bez flag → bez zmian.
- Token-loading retry path nie traci intentu (event handshake z v6.9.48 nadal aktywny).

---

## P2. Welcome Test — jeszcze więcej pytań na jednym ekranie (desktop + mobile)

### Dependency scan
`src/pages/WelcomeTestPage.tsx` — header (582–676), section tabs (679–707),
section header (710–716), question card (719–778), options renderer
`QuestionInput`, nawigacja (781–841), section progress (843–880).

### Root cause
Po v6.9.48 mamy `py-1.5`, `mb-2`, `pt-3 pb-3`, `space-y-3` — opcje
`px-2.5 py-2`. Mimo to 7-10 opcji + header + tabs + nav nie mieści się na
~754 px CSS w desktopie ani na mobile.

### Selected solution (B — agresywna kompresja + dwukolumnowy układ dla krótkich opcji + sticky nav)
| Element | Z | Na |
|---|---|---|
| Section tabs `min-h-[32px] px-2.5 py-1.5` | → | `min-h-[26px] px-2 py-0.5` + opcjonalnie ukryte na mobile (już `section progress` u dołu) |
| Section header (h2 + subtitle) | dwa wiersze | jeden wiersz: `<h2 className="text-sm font-semibold inline">{title}</h2> <span className="text-xs text-muted-foreground ml-2">{subtitle}</span>`, `mb-1` |
| Question card `pt-3 pb-3 space-y-3` | → | `pt-2 pb-2 space-y-2` |
| Pytanie `text-sm font-medium leading-relaxed` | → | `text-[13.5px] leading-snug` |
| Tłumaczenie italics `p-2 mt-2` | → | `p-1.5 mt-1 text-[11px]` |
| Opcje row (RadioGroupItem/Checkbox) | `px-2.5 py-2 text-base` | `px-2 py-1.5 text-[13.5px] leading-tight` |
| `space-y` między opcjami | `space-y-2` | `space-y-1` |
| Header progress bar `h-1.5` | → | `h-1` |
| „Question N of M" + „X%" linia | dedykowany wiersz | wciśnięte do prawej obok title (już prawie tak jest) — usuwamy osobny rząd na desktopie |
| Nav buttons `min-h-[40px]` | → | `min-h-[34px] py-1.5 text-xs` + sticky bottom: `sticky bottom-0 bg-gradient-to-t from-background via-background/95 pt-1 pb-1 -mx-2 px-2` |
| Section progress (mobile) | → | przenieść do paska header (już jest „X%" badge), całkowicie usunąć dolny duplikat na mobile |
| Listy z >7 opcjami (skill q'ki — patrz P10 „learning activities") | jedna kolumna | `grid grid-cols-1 sm:grid-cols-2 gap-1` (auto-detekcja: `options.length >= 7 && wszystkie krótkie ≤32 znaki`) — to da redukcję pionową ~45 % dla pytań typu „pick all that apply" |

### Implementation
- `QuestionInput` (komponent w tym samym pliku, ~linia 900+): wprowadzić logikę:
  ```tsx
  const shortOpts = options.every((o:string)=>o.length<=42);
  const wrapClass = options.length>=7 && shortOpts
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-1'
    : 'space-y-1';
  ```
  Wykorzystać dla `multiple_choice`, `checkbox`, `radio` z odpowiednio dużymi listami.
- Sticky bottom nav: `<div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 -mx-2 px-2 py-1.5 flex items-center justify-between gap-2">`
- Ukrycie dolnego paska „Section progress" na mobile (`hidden`).

### Verification
- Zmierzyć na 360×800 i 1280×754: pytanie z 8 opcjami mieści się bez scrollowania.
- Tłumaczenie aktywne — nadal mieści się (sticky nav zostaje widoczna).
- Long-form pytania (>20 słów) — wciąż czytelne (`text-[13.5px] leading-snug`).

### Martha test
13.5 px to wciąż czytelny rozmiar (>= WCAG min). Adult-tone nienaruszony.

---

## P3. Welcome Test — banner zmiany levelu + repair auto-apply + nazwa testu

### 3A. Banner „Suggested level change" w zakładce `?tab=dslm`

#### Dependency scan
`src/components/student-tests/TestDetailsView.tsx` (banner istnieje), `src/components/dslm/DSLMTab.tsx`, `src/components/dslm/PathwayView.tsx`.

#### Root cause
Banner żyje tylko w TestDetailsView, dostępny dopiero po wejściu w pojedynczy test. Nauczyciele na zakładce DSLM go nie widzą.

#### Selected solution
Wyekstrahować logikę do reużywalnego komponentu `src/components/student-tests/SuggestedLevelChangeBanner.tsx`:
- Props: `studentId, teacherId, currentLevel, onApplied?: () => void`
- Wnętrze: query `student_learning_profiles` po `student_id` + `welcome_test_id IS NOT NULL`, posortowane `updated_at desc limit 1`. Jeżeli `estimated_level && estimated_level !== currentLevel` → render banner z Apply/Keep.
- Dismiss key: `sessionStorage.wt-level-change-dismissed:${studentId}` (per-student, nie per-test, bo na DSLM tabie nie ma kontekstu testu).
- Apply: update `students.english_level = estimated_level` przez istniejący `updateStudent` (z `useStudent`); toast; `onApplied?.()`.

Wstawić instancję na górze DSLMTab (zaraz pod `DslmExplainerBanner`).
Refaktor TestDetailsView: użyć nowego komponentu zamiast inline (zachowuje identyczne API).

#### Verification
- Test z C1→A2 odchyleniem: banner widoczny na DSLM tab i w Test Details, niezależnie dismissowane.
- Apply zmienia level → banner znika z obu miejsc po refetchu.

---

### 3B. Auto-apply nadal nie kończy się dla starych testów

#### Dependency scan
`supabase/functions/process-welcome-test/index.ts` (680–773),
`backfill-welcome-test-auto-apply/index.ts`, `TestDetailsView.handleApplyResults`.

#### Root cause
`process-welcome-test` zawsze próbuje promować status do `reviewed`, ale ten test
(z 6 czerwca) ma `applied_at IS NOT NULL` w `test_skill_results` (poprzedni run
wszystkie oznaczył jako „processed without element"), więc auto-apply nic nie
robi, a status nie został wcześniej spromowany — wpadliśmy w lukę: kiedy w
v6.9.39 nie było jeszcze gwarancji „always promote to reviewed", row pozostał
w `completed`. Force-rerun z UI z v6.9.48 wysyła `force: true`, ale w
edge-function status update na końcu używa `.neq('status','reviewed')` — to OK.
**Realny powód braku skutku**: `handleApplyResults` w TestDetailsView wywołuje
edge func i jeśli ta zwróci `{ ok: true }`, banner powinien zniknąć. Ale po
sukcesie UI nie robi refetch testu i banner „Auto-apply did not complete" jest
wyliczany lokalnie z props `test.status`. Trzeba **wymusić refetch** testu po
udanym `process-welcome-test`.

#### Selected solution
1. `handleApplyResults` po `supabase.functions.invoke('process-welcome-test', { body: { test_id, force: true }})`:
   - po sukcesie wywołać `onRefetch?.()` (nowy prop z parent) lub bezpośrednio re-fetch z DB i lokalny `setTestData`.
2. Dodać w `process-welcome-test` defensywny fix: jeśli `force=true` i brak
   `test_skill_results.applied_at IS NULL`, ale `status != 'reviewed'`, **i tak**
   wykonać `status='reviewed'` (mamy już ten kod, ale upewnić się że jest *poza*
   try który mógłby się wyrzucić wcześniej).
3. Dodać w odpowiedzi edge-funct payload: `{ ok, applied_count, status, reviewed_at }` — UI używa do walidacji.
4. UI w `TestDetailsView` warunkuje banner „Auto-apply did not complete" przez `test.status !== 'reviewed' && applied_count === 0` — po refetch banner sam zniknie.

#### Verification
- Klik „Apply to Progress" na teście z 6 czerwca: spinner → toast „Applied" → banner znika.
- Edge function logs: `[process-welcome-test] auto-apply: applied=X, status=reviewed`.

---

### 3C. (z poprzedniego planu — nadal aktualne, łapka bezpieczeństwa)
Nazwa „Welcome Test - XD12" już używa dynamicznego studenta — bez zmian, ale dodać fallback gdy student został przemianowany: `useEffect` w `useWelcomeTest` re-fetchujący `students.name` po `studentId` na otwarciu, by tytuł w pasku był zawsze świeży.

---

## P4. „How many next steps to add?" — wyjaśnienie + poprawka liczenia

### Dependency scan
`src/components/dslm/MacroTimeline.tsx` (37–62, 250–272, 471+),
`src/components/dslm/PathwayView.tsx` (260–261, 312, 372–373),
`src/hooks/useFutureTimeline.tsx` (128–262),
`supabase/functions/generate-timeline/index.ts` (40–105, prompt 154–172).

### Aktualna mechanika (odpowiedź dla Ciebie)

**Per-batch math**:
- `recommendedStepsPerBatch(phase)` = `min(6, max(1, weeks))` (linia 37) — *ile dodać teraz*.
- `targetStepsForPhase(phase)` = `weeks` (bez clamp) — *docelowa suma w fazie*.
- Tekst „Suggested: 4 per batch (6/10 added — max 6 per generation, repeat to fill)" → liczba „6" to ILE JUŻ JEST w fazie (`phaseSuggestions.length`), „10" to `targetStepsForPhase(phase)` (np. faza 10-tygodniowa), „4" to `target - have = 10-6 = 4` (clamp do 6).

**Czy bierze istniejące pod uwagę przy generowaniu?**
- TAK przez `existingStepsRes` w `generate-timeline/index.ts` (linie 83–88): pobiera do 20 ostatnich nieużytych sugestii **z CAŁEGO STUDENTA** (wszystkie fazy + free next steps), zlicza je do bloku `ACTIVE PENDING STEPS already queued for this student (do NOT duplicate, build COMPLEMENTARILY)`.
- AI ma instrukcję `COMPLEMENTARITY RULE` (linia 157) — *nie powtarzaj, uzupełniaj luki, spaced retrieval ≥2 kroki temu*.
- Dodatkowo `excludeIds` (do 25 sztuk, hard cap) — sugestie aktualnie pokazywane w UI są przekazywane jako „ADDITIONALLY AVOID".

**Czy bierze pod uwagę next_steps z poprzednich faz przy generowaniu dla nowej fazy?**
- TAK — `existingStepsRes` zwraca wiersze **bez filtru po `phase_id`**, więc poprzednie fazy też lądują w bloku. Ale informacja, że one należą do innej fazy, nie jest w prompcie — AI widzi tylko `suggested_topic`, `grammar_focus`, `sequence_number`, `phase_id`. **Tu jest luka** — możemy ulepszyć blok o pokazanie powiązania z fazami, by AI lepiej rozumiało, że one już są zaplanowane gdzie indziej.

### Solution options
| Opcja | Opis |
|---|---|
| A | Tylko poprawić tooltip/copy żeby tłumaczył mechanikę (zero code) |
| B | A + wzbogacić blok `existingSteps` w prompcie o adnotację „phase #N" gdy `phase_id` jest znane |
| C | B + wprowadzić explicit `priorPhaseSteps` blok pokazujący kroki poprzednich faz oddzielnie |

### Selected: B
Najlepszy stosunek wartości do ryzyka. **Nie zmienia** Worksheet Generation
Engine (to inna funkcja `generate-timeline` dla DSLM, nie generator
worksheetów). UI copy też wyjaśnia mechanikę.

### Implementation
1. `supabase/functions/_shared/dslmPromptCore.ts` — `buildExistingStepsBlock(steps, limit)`:
   - Dla każdego rekordu z `phase_id` dorzucić `[phase ${phase_id.slice(0,8)}]` lub mapować na `sequence_number` jeśli dostępne. Sygnatura zostaje, dodajemy fallback bez zmiany API.
2. `generate-timeline/index.ts`: rozszerzyć `existingStepsRes` o join z fazami:
   ```ts
   supabase.from('future_worksheet_suggestions')
     .select('suggested_topic, suggested_grammar_focus, sequence_number, phase_id, dslm_curriculum_phases(sequence_number, title)')
     ...
   ```
   I w `buildExistingStepsBlock` pokazywać `[Phase #N "title"]`.
3. UI copy w `MacroTimeline.tsx` (~linia 480, dropdown helper text):
   - Z: `Suggested: 4 per batch (6/10 added — max 6 per generation, repeat to fill).`
   - Na: `You have 6/10 steps in this phase. Adding 4 now (max 6 per click). The AI sees the 6 existing steps AND steps from other phases, so new ones won't duplicate — they complement and fill gaps.`
4. W `GenerateStepsDialog.tsx` rozszerzyć opis:
   ```
   Adds up to 6 steps per generation. Existing steps in this AND other phases
   are passed to the AI as 'queued steps — do not duplicate'. Repeat to reach
   the phase target.
   ```

### Verification
- Wygenerowanie 4 next steps w fazie z 6 istniejącymi i 3 w innej fazie → w edge logs widać `ACTIVE PENDING STEPS` z 9 wpisami z adnotacją `[Phase #N]`.
- Brak duplikatów topiców.

### Sanctity
Worksheet Generation Engine NIE jest dotykany. `generate-timeline` to osobny DSLM-pipeline.

---

## RAG injection (po implementacji)

`docs/llm-context.md` + `public/llms.txt` — nowy bloczek:

```
PROBLEM: Auto-generate from 1-Minute Prep dropped intent when a worksheet was already visible; Welcome Test overflowed viewport; teachers missed level-change banner on DSLM tab; old completed tests stayed unreviewed; phase-batch math was opaque.

EDOOQOO SOLUTION (v6.9.49): sessionStorage `forceNewWorksheet` honored in Index + `resetWorksheetState` before auto-bootstrap; ultra-compact WT layout (smaller paddings + 2-col options for ≥7 short choices + sticky nav); reusable `SuggestedLevelChangeBanner` on DSLMTab; `process-welcome-test` always promotes status to reviewed and UI refetches test after force-apply; generate-timeline existingSteps block annotates `[Phase #N]` and UI explains batch vs target.

TECHNICAL MECHANICS: src/pages/Index.tsx, src/lib/worksheet/autoGenerateBootstrap.ts, src/pages/WelcomeTestPage.tsx, src/components/student-tests/SuggestedLevelChangeBanner.tsx, src/components/student-tests/TestDetailsView.tsx, src/components/dslm/DSLMTab.tsx, src/components/dslm/MacroTimeline.tsx, src/components/dslm/GenerateStepsDialog.tsx, supabase/functions/process-welcome-test/index.ts, supabase/functions/generate-timeline/index.ts, supabase/functions/_shared/dslmPromptCore.ts.

RAG KEYWORDS: auto generate worksheet bootstrap, force new worksheet reset, dslm pathway phase batch target, welcome test compact layout, options two column grid, sticky bottom navigation, suggested level change banner, dslm tab repair banner, process welcome test force reprocess, refetch test after apply, generate timeline existing steps phase annotation, complementarity rule, max 6 per generation, target steps for phase, recommended steps per batch, student tests reviewed status.
```

`mem/index.md` — dodać wpis:
`- [v6.9.49 fixes](mem://features/onboarding/v6949-force-new-bootstrap-wt-ultra-compact-banner-dslm-existing-steps-annot) — auto-generate reset, WT 2-col & sticky nav, DSLM level banner, force reprocess refetch, phase batch annotation`

---

## Final change report (po implementacji)

**Files modified (planowane):**
- src/pages/Index.tsx
- src/lib/worksheet/autoGenerateBootstrap.ts
- src/pages/WelcomeTestPage.tsx
- src/components/student-tests/SuggestedLevelChangeBanner.tsx (nowy)
- src/components/student-tests/TestDetailsView.tsx
- src/components/dslm/DSLMTab.tsx
- src/components/dslm/MacroTimeline.tsx
- src/components/dslm/GenerateStepsDialog.tsx
- supabase/functions/process-welcome-test/index.ts
- supabase/functions/generate-timeline/index.ts
- supabase/functions/_shared/dslmPromptCore.ts
- docs/llm-context.md, public/llms.txt, mem/index.md, mem/features/onboarding/v6949-*.md

**Out of scope (zalogowane na przyszłość):**
- Pełny refaktor `useWorksheetState` na natywny persistence z `forceNew` flag.
- Server-side enforcement liczby kroków per faza (obecnie tylko hint w UI).
- Multilingual translation toggle dla pytań `open_ended` (poza scope tego cyklu).
