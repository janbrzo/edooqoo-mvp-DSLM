# Plan v6.9.12 — Fixy formularza generowania + dydaktyczna logika faz/kroków

## Kontekst dydaktyczny (najpierw teoria, potem kod)

### Dlaczego AI wygenerowało 5 faz × 4 tyg., a nie 1 fazę × 13 tyg. dla celu z deadline 90 dni?

To NIE jest błąd losowości — to świadomy projekt edge function `generate-curriculum-phases`, który:

1. Zawsze generuje **3-6 faz** (twardy zakres w prompcie). Liczbę dobiera AI na bazie liczby celów, ich deadline'ów oraz liczby aktywnych skill gaps.
2. Nie używa deadline jako sztywnego ogranicznika długości fazy. Deadline jest **horyzontem orientacyjnym** — fazy się "rozkładają" wewnątrz horyzontu.
3. Faza ≠ tydzień nauki. Faza to **blok andragogiczny** (zwykle 3-6 tyg.), w którym buduje się jedną kompetencję komunikacyjną. 1 cel × 90 dni = ~13 tyg. = naturalnie 3-5 faz po 3-4 tyg.

**Werdykt:** wynik 5 × 4 tyg. = 20 tyg. **jest prawidłowy dydaktycznie**, ale przekracza deadline (90 dni = 13 tyg.) o 7 tygodni — to **bug w prompcie**, który ignoruje deadline jako górną granicę.

**Decyzja:** to jest do naprawy w przyszłej iteracji silnika faz (poza zakresem tego planu — zgodnie z zasadą sanctity prompta nie modyfikujemy `generate-curriculum-phases` bez wyraźnej zgody). Tutaj **tylko dokumentujemy** logikę i **wyjaśniamy w UI** użytkownikowi (tooltip + tekst pomocy).

### Dlaczego "Generate next steps" rekomenduje 3, niezależnie od długości fazy?

Obecnie wszystkie miejsca generujące kroki używają domyślnie `count = 3` (`useState(3)` w `NextStepsSection.tsx` i `MacroTimeline.tsx`). To jest "rolling 3-lesson plan" — typowy horyzont planowania nauczyciela (widzi 3 najbliższe lekcje, dalsze planuje ad-hoc).

**Problem:** dla fazy 4-tygodniowej z lekcjami co tydzień powinno być **4 kroki** (1 step ≈ 1 lekcja ≈ 1 worksheet). Obecnie nauczyciel widzi 3 i musi domyślać się, że brakuje jednego.

**Rozwiązanie:** liczyć **rekomendowaną** liczbę kroków na fazę = `(estimated_weeks_end - estimated_weeks_start + 1)`, z ograniczeniem do 1-6 (technicznie API obsługuje 1-6). Dla "free next steps" (poza fazą) zostawiamy 3 jako domyślne.

---

## CZĘŚĆ A — Fixy w `NextStepsPresetBanner` (formularz generowania)

Plik: `src/components/WorksheetForm/NextStepsPresetBanner.tsx`

### A1. Etykiety chipów `#1` → `S1•P1`

W bloku renderowania chipów (obecnie `label = \`#${displayIndex} ${truncate(payload.topic, 32)}\``):

- Jeżeli sugestia jest powiązana z fazą (`phaseLabel` istnieje, np. "Phase 1") → `S{displayIndex}•P{phaseSeq} {topic}`
- Jeżeli sugestia jest "free" (legacy next_step bez fazy) → `S{displayIndex} {topic}` (bez P)

Pomocniczo dorzucamy `phaseSeq` do obiektu z `useMemo` (mamy już `phaseOrderById`).

Tooltip header zostaje bez zmian (`Step #N • Phase X / Free step`).

### A2. Przycisk "Edit" na chipie i w tooltipie

**Decyzja architektoniczna:** **NIE** otwieramy `SuggestionEditDialog` w samym formularzu generowania (banner musi pozostać "lekki" — nie zna logiki edycji DB i nie ma kontekstu phases/skills). Zamiast tego dodajemy przycisk **"Edit in plan"**, który:

1. Zapisuje `suggestionId` do `sessionStorage.editSuggestionOnOpen`.
2. Nawiguje do `/student/{studentId}?tab=dslm&view=pathway&editSuggestion={id}`.
3. `PathwayView` przy mounce sprawdza `searchParams.get('editSuggestion')` i jeśli jest ID — wywołuje `handleEditSuggestion(suggestion)` po załadowaniu sugestii. Po otwarciu czyści parametr URL.

Dlaczego: jedno źródło prawdy dla edycji (już istnieje `SuggestionEditDialog` w PathwayView z pełną walidacją). Banner ma być tylko "shortcutem" do gotowych planów.

**UI:**
- Na chipie: drobny przycisk `<Edit2 className="h-3 w-3" />` po prawej stronie chipa (osobny `<Button>`, nie zagnieżdżony — chip pozostaje klikalny dla `applyPreset`).
- W tooltipie: pełny przycisk `Edit suggestion` (`variant="outline"`, size="sm") na dole.

### A3. Link "View plan" → `?tab=dslm&view=pathway`

Obecnie: `navigate(\`/student/${studentId}?tab=progress\`)` (działa przez redirect, ale brzydki URL).

Zmiana w **dwóch miejscach** w pliku:
- Header banera (`View plan ↗`)
- Empty state (`Open Learning Plan`)

Nowy URL: `/student/${studentId}?tab=dslm&view=pathway`

---

## CZĘŚĆ B — Inteligentna domyślna liczba kroków per faza

Plik: `src/components/dslm/MacroTimeline.tsx`

### B1. Helper `recommendedStepsForPhase(phase)`

```ts
function recommendedStepsForPhase(phase: CurriculumPhase): number {
  const start = phase.estimated_weeks_start;
  const end = phase.estimated_weeks_end;
  if (!start || !end || end < start) return 3;
  const weeks = end - start + 1;
  return Math.max(1, Math.min(6, weeks)); // 1 step per week, clamped 1–6
}
```

### B2. Użycie helpera

Obecnie `phaseQuickCount` to jeden wspólny stan (`useState(3)` w `MacroTimeline`). Trzeba zmienić na **mapę per-phase** z domyślnym fallbackiem:

```ts
const [phaseQuickCounts, setPhaseQuickCounts] = useState<Record<string, number>>({});
const getPhaseQuickCount = (phaseId: string) => {
  if (phaseQuickCounts[phaseId] !== undefined) return phaseQuickCounts[phaseId];
  const phase = phases.find(p => p.id === phaseId);
  return phase ? recommendedStepsForPhase(phase) : 3;
};
const setPhaseQuickCountFor = (phaseId: string, n: number) => 
  setPhaseQuickCounts(prev => ({ ...prev, [phaseId]: n }));
```

(Nazwy `getPhaseQuickCount` / `setPhaseQuickCountFor` są już używane w pliku — sprawdzić, czy nie kolidują, ewentualnie zamienić istniejącą implementację.)

### B3. Tekst pomocniczy w dropdownie

Pod inputem dodajemy wiersz `<p className="text-[10px] text-muted-foreground">Suggested: {recommended} (one per week of {weeks}-week phase)</p>` jeśli `weeks` jest dostępne.

### B4. Phase-comment dialog (`phaseCommentCount`)

Też inicjalizować z `recommendedStepsForPhase(currentEditPhase)` przy otwarciu dialogu (zamiast sztywnego `useState(3)`).

---

## CZĘŚĆ C — Fix domyślnej liczby kroków w `NextStepsSection`

Plik: `src/components/dslm/NextStepsSection.tsx`

Tu **NIE zmieniamy** domyślnego `3`, bo to są "free next steps" (poza fazą = brak długości tygodniowej do oparcia się). Tylko **lepszy copy** w dialogu:

> "Recommended: 3 (rolling 3-lesson plan). For phase-bound steps, the recommendation matches the phase length (1 step ≈ 1 week)."

To wyjaśnia, dlaczego per-phase są inne wartości.

---

## CZĘŚĆ D — Obsługa `?editSuggestion={id}` w PathwayView

Plik: `src/components/dslm/PathwayView.tsx`

```ts
const [searchParams, setSearchParams] = useSearchParams();
useEffect(() => {
  const editId = searchParams.get('editSuggestion');
  if (!editId) return;
  const all = [...phaseSteps, ...nextSteps];
  const target = all.find(s => s.id === editId);
  if (target) {
    handleEditSuggestion(target);
    // czyścimy parametr żeby nie re-triggerować
    const next = new URLSearchParams(searchParams);
    next.delete('editSuggestion');
    setSearchParams(next, { replace: true });
  }
}, [searchParams, phaseSteps, nextSteps]);
```

`useSearchParams` trzeba zaimportować z `react-router-dom` (sprawdzić czy nie jest już zaimportowane).

---

## CZĘŚĆ E — Dokumentacja

### E1. `docs/llm-context.md` + `llms.txt`

Dodać nową sekcję v6.9.12:

```
## v6.9.12 — Worksheet form preset polish + phase-aware step counts

### Problem 1: Banner chips showed `#N topic` — no phase context.
Edooqoo.com Solution: Chip label = `S{seq}•P{phaseSeq} topic` for phase-bound steps, `S{seq} topic` for free steps. Tooltip unchanged.
Technical Mechanics: NextStepsPresetBanner reads phaseOrderById from useCurriculumPhases, builds label inline.

### Problem 2: Tooltip truncated rationale + no edit affordance.
Solution: Added "Edit in plan" button on chip and full button in tooltip. Click navigates to /student/{id}?tab=dslm&view=pathway&editSuggestion={suggId}. PathwayView mounts → reads searchParam → opens shared SuggestionEditDialog → strips param. Single source of truth for edits.

### Problem 3: View Plan / Open Learning Plan linked to deprecated ?tab=progress.
Solution: Both links now navigate to ?tab=dslm&view=pathway. Backward-compat redirect in StudentPage.tsx kept for legacy URLs.

### Problem 4: "Generate steps for this phase" defaulted to 3 regardless of phase length.
Edooqoo.com Solution: Recommendation = (estimated_weeks_end - estimated_weeks_start + 1), clamped 1–6 (1 step ≈ 1 weekly lesson). Free next-steps stay at 3 (rolling lesson plan).
Technical Mechanics: recommendedStepsForPhase() helper in MacroTimeline.tsx; phaseQuickCounts map keyed by phase.id; teacher override preserved per-phase.

### Phase count rationale (3-6 phases hard-coded in generate-curriculum-phases prompt)
- 3 phases ≈ quarter, 6 phases ≈ semester (12-36 weeks).
- AI picks within range based on goal count, deadlines, skill gap breadth — NOT random.
- KNOWN LIMITATION: prompt does not enforce deadline as upper bound on total weeks. Goal with 90-day deadline can yield 5×4w = 20w plan. Acceptable as didactic horizon (buffer beyond deadline), but flagged for future engine update. Sanctity rule prevents prompt edits without explicit user approval.

### RAG Keywords
phase length, weeks per phase, recommended steps, rolling lesson plan, edit suggestion, next steps preset, S•P label, learning plan link, pathway tab
```

### E2. `mem/features/worksheet-form/next-step-preset.md`

Dodać sekcję v6.9.12:
- Etykieta `S{seq}•P{phaseSeq}` — fallback `S{seq}` dla free steps.
- Edit deferred do PathwayView via URL param `editSuggestion`.
- Linki "View plan" / "Open Learning Plan" → `?tab=dslm&view=pathway`.

---

## Sekcja techniczna (zmienione pliki)

| Plik | Zmiany |
|---|---|
| `src/components/WorksheetForm/NextStepsPresetBanner.tsx` | A1 (label), A2 (Edit btn), A3 (URL × 2), import `Edit2` z `lucide-react` |
| `src/components/dslm/PathwayView.tsx` | D (useEffect + useSearchParams) |
| `src/components/dslm/MacroTimeline.tsx` | B1, B2, B3, B4 |
| `src/components/dslm/NextStepsSection.tsx` | C (sam tekst pomocy w dialogu) |
| `docs/llm-context.md` | E1 (sekcja v6.9.12) |
| `llms.txt` | E1 |
| `mem/features/worksheet-form/next-step-preset.md` | E2 |

## Co NIE jest zmieniane (sanctity)

- Edge function `generate-curriculum-phases` — pozostaje 3-6 faz.
- Edge function `generate-timeline` — pozostaje wsparcie dla `count` 1-6.
- `normalizeSuggestionPrefill` — bez zmian.
- Schema DB — bez zmian.
- Prompt generowania worksheetów — bez zmian.

## Kompatybilność wsteczna

- Stare linki `?tab=progress` nadal działają (redirect w `StudentPage.tsx` linia 269-280).
- Brak zmian w API edge functions.
- `phaseQuickCount` → `phaseQuickCounts` (mapa) zachowuje to samo zachowanie domyślne dla istniejących nauczycieli (default = recommended dla fazy).
