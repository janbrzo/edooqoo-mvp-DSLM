
# Plan v6.9.11 — Naprawy formularza Worksheet, Progress crash, UX Next Steps

## ZAKRES — co robimy, czego NIE ruszamy

**Robimy:** drobne UI/UX poprawki w `WorksheetForm`, naprawa krytycznego błędu React #310 w `StudentProgressTab`, lepsze komunikaty, sortowanie chipów, karuzela 3-z-N, doprecyzowanie tekstów w `NextStepBanner`.

**NIE ruszamy:** silnika generowania worksheetów, edge functions `generate-timeline` / `generate-curriculum-phases` (sanctity rule), promptów AI, schematów DB, RLS, hooka `useFutureTimeline` (tylko czytamy), kategoryzacji notatek.

---

## BLOK 1 — Krytyczny bug: biała strona na `/student/{id}?tab=progress`

### Problem
W konsoli `Minified React error #310` (Rendered more hooks than during the previous render) w `StudentProgressTab.tsx:154`. Hook `useGoalProgress(...)` jest wywoływany **po** wczesnym `return` `if (loading) return <Loader/>` (linia 148). Łamie to Rules of Hooks → biała strona dla każdego studenta.

### Rozwiązanie
Przenieść `const { map: progressMap } = useGoalProgress(goals as any, studentId, teacherId);` **przed** wczesny `return`. Wewnętrzny `useGoalProgress` już bezpiecznie obsługuje pusty `goals` (zwraca pusty Map), więc bezpieczne.

### Plik
- `src/components/student-progress/StudentProgressTab.tsx`
  - Usunąć linię 154 z miejsca po `if (loading)`.
  - Wstawić ją w bloku przed `if (loading)` — zaraz po wszystkich pozostałych hookach komponentu (najlepiej zaraz po destrukturyzacji `goals` z `useStudentProgress`).
  - Pozostawić `supportingGoals`/`additionalGoals`/`editingGoal` jako zwykłe wartości pochodne tam, gdzie są (po `if (loading)` jest OK — to nie hooki).

### Akceptacja
- `/student/{id}?tab=progress` renderuje się bez błędu w konsoli.
- Pole "Open Learning Plan" w bannerze formularza działa.

---

## BLOK 2 — `WorksheetForm`: gdy NIE wybrano studenta

### 2.1 Wizualne podświetlenie selektora studenta
**Plik:** `src/components/WorksheetForm/index.tsx` (linie 655-668).

Gdy `selectedStudentId === 'no-student'`:
- Dodać klasy: `border-amber-400 ring-1 ring-amber-300 bg-amber-50/40 dark:bg-amber-900/10` na `SelectTrigger`.
- Po wybraniu studenta klasa znika (powrót do default `border-input`).

### 2.2 Zmiana etykiet
- `placeholder="No specific student"` → `placeholder="Choose a student"`.
- `<SelectItem value="no-student">No specific student</SelectItem>` → `Generic worksheet (no student)` (zachowujemy wartość `'no-student'` dla kompatybilności).

### 2.3 Mała podpowiedź pod selektorem (tylko gdy `no-student`)
Pod selektorem dodać `<p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">Pick a student to unlock personalized goals, level, and Next Steps.</p>` — render warunkowy.

---

## BLOK 3 — `NextStepsPresetBanner` (3 ulepszenia + karuzela)

**Plik:** `src/components/WorksheetForm/NextStepsPresetBanner.tsx`

### 3.1 Jasna identyfikacja źródła
Zmienić nagłówek `Suggested next steps:` →  
`Next Steps from Learning Plan` + ikona `Map` + mały link `View plan →` (po prawej) → `navigate('/student/{studentId}?tab=progress')`.

Każdy chip dostaje pełny **tooltip z metadanymi**:
- Linia 1: `Step #{displayIndex} • {phaseLabel ?? 'Free step'}`
- Linia 2: pełen `suggested_topic`
- Linia 3 (jeśli jest): `Goal: {suggested_goal}`
- Linia 4 (jeśli jest): `Why: {rationale}`

Etykieta chipu (widoczna): `#{displayIndex} {topic (truncated 32)}`. Dodaje to czytelność, że to z planu, nie losowe.

### 3.2 Sortowanie zgodne z Profile/Pathway
Obecnie banner robi `[...phaseSteps, ...nextSteps].slice(0,3)` — phaseSteps są sortowane TYLKO po `sequence_number`, więc Phase 4 może być przed Phase 1 (bug C).

Skopiować logikę sortowania z `PathwayView` (linie ~125-145):
1. Dociągnąć fazy (nowy lekki hook lub bezpośrednie zapytanie wewnątrz banneru — patrz pkt techniczny niżej).
2. Sortować `phaseSteps` po `(currentPhase first, phaseOrder ASC, sequence_number ASC)`.
3. Doliczyć `displayIndex` per-phase identycznie jak w `PathwayView` (numer kroku w obrębie fazy zaczyna od 1).
4. Konkatenować z legacy `nextSteps` na końcu.

**Decyzja techniczna (zero ambiguity):** użyć istniejącego hooka `useCurriculumPhases({ studentId, teacherId })` z `src/hooks/dslm/useCurriculumPhases` (już używany w `PathwayView`). Brak nowych hooków, brak nowych zapytań.

### 3.3 Karuzela 3-z-N
Zamiast `slice(0,3)` zachować pełną listę `presets`. Stan lokalny `const [windowStart, setWindowStart] = useState(0)`.

UI:
- Strzałka `<` po lewej (disabled gdy `windowStart === 0`).
- 3 chipy `presets.slice(windowStart, windowStart + 3)`.
- Strzałka `>` po prawej (disabled gdy `windowStart + 3 >= presets.length`).
- Mały tekst po prawej: `{windowStart+1}–{Math.min(windowStart+3, presets.length)} of {presets.length}`.

Krok `>` zwiększa `windowStart` o 1 (sliding window, nie strona) — zgodnie z prośbą "przesunięcie w bok pokazuje kolejny, ukrywa pierwszy".

Reset `windowStart` do 0 gdy zmieni się `studentId`.

### 3.4 Empty state — silniejsza zachęta
Zamiast obecnego komunikatu, render:
```
💡 No learning plan for {studentName} yet.

Students with a structured Learning Plan (Phases + Next Steps) get worksheets that
build on each other instead of being standalone exercises. Strongly recommended.

[Open Learning Plan ↗]
```
Klasy: `border-amber-300/60 bg-amber-50` (zostaje), tekst w 2 liniach, przycisk po prawej.

**Uwaga:** świadomie NIE podajemy konkretnych liczb procentowych ("z X% do Y%") — nie mamy danych, więc unikamy fałszywych obietnic. Zamiast tego mocny, ale uczciwy tekst dydaktyczny.

### 3.5 Wyczyszczenie `windowStart` po użyciu
Gdy presset zostanie kliknięty i `applyPreset` wywołane → `setWindowStart(0)` (UX: po wygenerowaniu lista mogła się zmienić).

---

## BLOK 4 — `NextStepBanner` (Progress) — komunikaty

**Plik:** `src/components/dslm/NextStepBanner.tsx` (linie 61-77).

### 4.1 Komunikat "Add goals first"
Obecnie: `Add goals first for better worksheet suggestions.` + przycisk `disabled`. Problem: po dodaniu goals i bez refetchu wciąż się pokazuje.

Zmiana tekstu:
```
Add goals first for better worksheet suggestions.
Just added some? Refresh the page to see them.
```
Druga linia: `text-[11px] opacity-70`. Plus dodać mały button `<Button variant="ghost" size="sm" onClick={() => window.location.reload()}>Refresh</Button>` obok zablokowanego "Generate next steps".

### 4.2 Pytanie o ilość przy pierwszym generowaniu (problem 2.B2)
Obecnie pierwsze generowanie nie pyta o ilość (sztywno 3 — `onGenerateMore(3, [])`), a kolejne i per-phase pytają. Konsekwencja: ujednolicić — przy pierwszym też pytamy.

**Plik:** `src/components/dslm/NextStepsSection.tsx` (linia 105).

Zmiana: `onGenerate={() => onGenerateMore(3, [])}` → otwórz ten sam dialog wyboru ilości, który już istnieje dla "Generate more next steps". Najprościej: wyciągnąć istniejący stan dialogu z `NextStepsSection` (`countDialog` w sekcji "more") i użyć go również dla przycisku w `NextStepBanner` (przekazać przez prop `onGenerate`). Default count: 3, opcje: 1/2/3/5.

---

## BLOK 5 — Błąd 500 z `generate-timeline`

### Diagnoza
Edge function żyje poza repo (zdalnie w Supabase). Krok diagnostyczny w implementacji:
1. Pobrać logi: `supabase--edge_function_logs(function_name="generate-timeline")` — szukać konkretnego stack trace.
2. Najczęstsze przyczyny historyczne: brak `LOVABLE_API_KEY`, rate-limit 429/402 z gateway, nieprawidłowy `phaseId` (gdy student nie ma faz). 
3. Po zidentyfikowaniu: jeżeli to brak danych (np. zero goals), edge function powinna zwracać `200` z pustą listą + `info`. Zaproponować PATCH (poza sanctity worksheetów — to jest curriculum, nie worksheet engine).

**Reguła:** jeśli przyczyną są ograniczenia gateway (429/402) — frontend już to obsługuje (toast). Wtedy nie poprawiamy edge — dopisujemy lepszy komunikat w `useFutureTimeline.generateNextSteps` catch block: rozróżnić `429` / `402` / `5xx`.

### Plik (jeśli potrzebne)
- `src/hooks/useFutureTimeline.tsx` — w `catch`, sprawdzić `error.context?.status` i pokazać:
  - 402 → `AI credits exhausted. Add credits in Workspace settings.`
  - 429 → `Too many AI requests. Wait a moment and retry.`
  - else → `Failed to generate next steps. Please try again.`

---

## BLOK 6 — Wyjaśnienie liczby faz i Next Steps (dokumentacja, nie kod)

### 6.1 `generate-curriculum-phases` — 3-6 faz
**Uzasadnienie dydaktyczne (do wpisania w `docs/llm-context.md`):**
- 3-6 faz = pokrycie typowego cyklu B2B / kursowego: 3 fazy ≈ kwartał, 6 faz ≈ semestr (12-24 tyg.).
- Mniej niż 3 = brak postępu narracji nauki (uczeń nie czuje progresji).
- Więcej niż 6 = nauczyciel gubi się w planowaniu, faza staje się równa pojedynczej lekcji (sprzeczne z definicją "fazy" jako bloku 3-6 tygodni).
- Liczba **faktycznie wybierana** zależy od: (a) liczby goals studenta, (b) horyzontu `nearest_goal_deadline`, (c) szerokości `mainGoal`. AI dobiera w tym przedziale.

To nie jest losowy wybór — to przedział oparty na praktyce kursowej (4-6 tyg./fazę × 3-6 faz = 12-36 tyg. = typowy semestr/kwartał plus bufor).

### 6.2 `generate-timeline` — 1-3 (default) Next Steps
**Uzasadnienie:**
- 1 Next Step = minimalny "what's next" (zawsze widoczny banner #1).
- 3 = optymalny zakres planowania krótkoterminowego (najbliższe 3 lekcje), zgodny z heurystyką "rolling 3-week plan".
- >3 sztywno = dezaktualizacja (po 2 lekcjach 4-5 step staje się nieaktualne, bo zmienia się kontekst po feedbacku).
- Nauczyciel może w UI zażądać 1/2/3/5 (dialog ilości — patrz BLOK 4.2).

### 6.3 Aktualizacja dokumentacji
- `docs/llm-context.md`: nowa sekcja `## Pathway Generation Counts (Why)` z powyższym rozumowaniem.
- `llms.txt`: skrócony wpis (1 akapit) o 3-6 faz, 1-3 next steps, dlaczego.

---

## BLOK 7 — System notatek (Student Knowledge): co już jest, czego brakuje

### Stan obecny (po v6.9.10)
✅ Quick capture (free-form input) → AI klasyfikacja w tle (`classify-knowledge-entry` edge fn) → notatki migrują z "Notes" do właściwej kategorii przy `confidence ≥ 0.65`.  
✅ Stale Badge (>90 dni) z akcjami `Still current` (resetuje `metadata.last_confirmed_at`) i `Mark outdated` — dla kategorii Personal, Skill Assessment, Goals.  
✅ Integracja z DSLM (Skill Assessment notatki widoczne w mastery) — z poprzedniej iteracji.  
✅ Next Lesson Ideas widoczne w `PathwayView` jako collapsible.

### Wciąż NIE zrobione (świadomie)
❌ **Auto-suggest cron "is this still current?" po 90 dniach** — wymaga `pg_cron` + edge function generująca powiadomienia. To OSOBNA iteracja (poza tym planem). Powód: cron + notyfikacje to nowy backend pipeline, lepiej go zaplanować jako odrębny v6.9.12.  
❌ Auto-link `used_in_worksheet_id` — celowo pominięte (sanctity worksheet engine).  
❌ Sentiment trend / wykres aktualności — nice-to-have, nie blokuje.

### Co dostarczamy w tym planie
Tylko **dokumentacja stanu** w `mem/features/student-knowledge/quick-capture-and-ai-classify.md` (dopisać sekcję "Status v6.9.11: implemented vs. deferred").

---

## BLOK 8 — Aktualizacje dokumentacji

### `docs/llm-context.md`
Dopisać sekcję **`## Worksheet Form: Next Steps Preset Banner v6.9.11`**:
- Problem: nauczyciel nie wiedział, skąd biorą się chipy + losowy porządek + brak karuzeli + brak zachęty bez planu.
- Solution: nagłówek "Next Steps from Learning Plan" + Map ikona + tooltip z metadanymi + sortowanie po phase order (currentPhase first) + sliding-window karuzela 3-z-N + mocna zachęta w empty state.
- Mechanics: `NextStepsPresetBanner` używa `useFutureTimeline` + `useCurriculumPhases`; lokalny `windowStart` state; chipy z displayIndex per-phase; tooltip pełny content; empty state przycisk → `/student/{id}?tab=progress`.
- RAG Keywords: next steps preset, learning plan banner, worksheet form student selector, suggested topics chips, no learning plan empty state, sliding window suggestions, phase-ordered next steps.

Dopisać sekcję **`## Curriculum Counts: 3-6 Phases, 1-3 Next Steps (Rationale)`** — zawartość z bloku 6.

Dopisać sekcję **`## Critical Fix v6.9.11: useGoalProgress Hook Order`** — opis bugu React #310 i fix.

### `llms.txt`
- Dodać wiersze:
  - `Worksheet form preset banner: 'Next Steps from Learning Plan'; sorted by phase order; sliding window 3-of-N; tooltip with topic+goal+why; empty state CTA to Progress tab.`
  - `Curriculum: 3-6 phases (semestral horizon); 1-3 next steps (rolling 3-lesson plan); teacher can pick 1/2/3/5 in dialog.`
  - `v6.9.11 fix: useGoalProgress moved above early return in StudentProgressTab to satisfy Rules of Hooks.`

### `mem/features/worksheet-form/next-step-preset.md`
Zaktualizować: dodać akapit o sortowaniu phase-ordered, karuzeli sliding-window, nagłówku z linkiem do planu, empty-state CTA.

### `mem/index.md` Core
Dopisać linijkę: `Hooks must be called above any early return — see useGoalProgress in StudentProgressTab.`

---

## KOLEJNOŚĆ IMPLEMENTACJI (atomowa)

```text
1. BLOK 1   → fix React #310 (1 plik, 1-liner przesunięcia hooka)
2. BLOK 2   → WorksheetForm selector amber + label changes
3. BLOK 3   → NextStepsPresetBanner refactor (sorting + window + tooltip + empty state)
4. BLOK 4.1 → NextStepBanner refresh hint
5. BLOK 4.2 → NextStepsSection: dialog ilości dla pierwszego generowania
6. BLOK 5   → Diagnoza logów + lepszy catch w useFutureTimeline
7. BLOK 6/7/8 → dokumentacja (llm-context, llms.txt, mem)
```

Każdy krok niezależny, brak ryzyka regresji w silniku worksheet.
