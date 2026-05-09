
# Plan v6.9.13 (rev. 2) — Prompt-level deadline cap + Form-local Edit + Smart phase target + DSLM sub-nav + Nav student switcher + Add Note quick modal

## CZĘŚĆ A — Deadline cap w PROMPCIE `generate-curriculum-phases` (zaktualizowana zgodnie z decyzją usera)

### A0. Stan początkowy i ryzyko

Źródło edge function `generate-curriculum-phases` **nie znajduje się w lokalnym repo** (`supabase/functions/` zawiera tylko `classify-knowledge-entry`, `format-worksheet-prompt`, `send-welcome-email`). Funkcja jest zdeployowana w projekcie Supabase (Lovable Cloud) i wywoływana z hooka `useCurriculumPhases.generatePhases` przez `supabase.functions.invoke('generate-curriculum-phases', { body: { studentId, teacherId, mode, count, teacherComment } })`.

Aby zmodyfikować prompt, w kroku implementacji należy:

1. **Pobrać aktualne źródło funkcji** — w trybie build agent ma dostęp do plików projektu Supabase. Pierwszą operacją MUSI być stworzenie pliku lokalnego `supabase/functions/generate-curriculum-phases/index.ts` z aktualną zawartością wdrożoną. Dopuszczalne źródła w kolejności preferencji:
   - odczyt z metadanych projektu Lovable Cloud (jeśli dostępne),
   - wywołanie `supabase--curl_edge_functions` z trybem `OPTIONS` lub testowym body, aby zweryfikować deployment + odczyt logów (`supabase--edge_function_logs`) z ostatnich uruchomień, w których typowo widać schema response,
   - jeśli powyższe zawiedzie — agent **NIE rekonstruuje funkcji od zera**, tylko wraca do usera z prośbą o wklejenie źródła. Sanctity działającej funkcji ma priorytet.

2. **Dodać `[functions.generate-curriculum-phases]` z `verify_jwt = false`** do `supabase/config.toml`, jeśli nie istnieje (w pozostałych funkcjach jest tak ustawione — aktualnie wszystkie używają in-code auth).

3. **Wdrożyć przez `supabase--deploy_edge_functions`** po edycji.

### A1. Body wysyłane z klienta — nowe pole `targetWeeks`

W `src/hooks/dslm/useCurriculumPhases.tsx`:

```ts
const generatePhases = async (
  mode: 'replace' | 'add' = 'replace',
  opts: { count?: number; teacherComment?: string; targetWeeks?: number | null } = {}
): Promise<boolean> => {
  ...
  body: {
    studentId, teacherId, mode,
    count: opts.count,
    teacherComment: opts.teacherComment ?? '',
    targetWeeks: opts.targetWeeks ?? null,   // ← NOWE: liczba tygodni do najwcześniejszego deadline'u
    targetWeeksSource: opts.targetWeeks ? 'main_goal_or_nearest' : null, // do logów/debug
  }
  ...
}
```

`MacroTimeline` oblicza `targetWeeks` z propsów `mainGoalTargetDate` i `nearestGoalDeadlineDate` (oba propagowane z `DSLMTab` → `PathwayView` → `MacroTimeline`):

```ts
const deadlineISO = mainGoalTargetDate || nearestGoalDeadlineDate || null;
const targetWeeks = deadlineISO
  ? Math.max(2, Math.ceil((+new Date(deadlineISO) - Date.now()) / (7 * 86400 * 1000)))
  : null;
```

Jeśli `targetWeeks === null` → AI zachowuje stare zachowanie (3-6 faz po 3-6 tyg.).

### A2. Modyfikacja PROMPTU `generate-curriculum-phases`

Po pobraniu aktualnego pliku `supabase/functions/generate-curriculum-phases/index.ts` należy zlokalizować blok `SYSTEM_PROMPT` (lub równoważny `messages[0].content` typu `system`) i wprowadzić następujące **dodatki bez usuwania istniejących reguł**:

#### A2.1. Nowa sekcja w prompcie (wstawiana na samej górze SYSTEM_PROMPT, BEFORE existing rules)

```text
═══════════════════════════════════════════════════════════════════
HARD CONSTRAINT — DEADLINE FIT (added v6.9.13)
═══════════════════════════════════════════════════════════════════
The user input includes `targetWeeks` (integer) representing the number of
weeks until the student's nearest goal deadline. When `targetWeeks` is
provided (not null):

1. The SUM of (estimated_weeks_end − estimated_weeks_start + 1) across ALL
   generated phases MUST be ≤ targetWeeks. This is a HARD UPPER BOUND, not
   a suggestion.
2. The number of phases (3–6) is still chosen by you, but the per-phase
   length MUST be reduced so the total fits. Minimum 1 week per phase;
   prefer 2 weeks per phase when targetWeeks allows.
3. Distribution rule:
   - If targetWeeks ≥ 12 → use 3–4 phases of 3–4 weeks each.
   - If 8 ≤ targetWeeks < 12 → use 3 phases (≈ targetWeeks/3 each, rounded).
   - If 4 ≤ targetWeeks < 8 → use 2–3 phases of 1–3 weeks each (override
     normal 3-phase minimum if needed; absolute minimum 2 phases).
   - If targetWeeks < 4 → use 1–2 sprint phases of 1–2 weeks each.
4. Phases MUST be contiguous and non-overlapping:
   estimated_weeks_start[i] = estimated_weeks_end[i−1] + 1, and
   estimated_weeks_start[0] = 1.
5. Last phase ends EXACTLY at targetWeeks (estimated_weeks_end[last] === targetWeeks).
6. If teacher_comment requests a different cadence, deadline still wins.
   Acknowledge the deadline in `rationale` of the last phase, e.g.:
   "Compressed to fit the {targetWeeks}-week deadline."

When `targetWeeks` is null, keep the previous behavior (3–6 phases of 3–6
weeks each, no upper bound).
═══════════════════════════════════════════════════════════════════
```

#### A2.2. Modyfikacja USER_PROMPT (lub user message)

W miejscu, gdzie do user prompta dorzucane są dane studenta, dopisać:

```ts
const deadlineLine = targetWeeks
  ? `\nDEADLINE WINDOW: ${targetWeeks} weeks total (HARD UPPER BOUND for sum of phase lengths).`
  : '\nDEADLINE WINDOW: not specified — use natural 3–6 phase × 3–6 week layout.';
```

I wstrzyknąć `deadlineLine` przed sekcją z `teacherComment`.

#### A2.3. Walidacja serwerowa (defense-in-depth)

W kodzie funkcji, **po** otrzymaniu odpowiedzi z modelu i **przed** UPSERT do `dslm_curriculum_phases`, dodać blok walidacyjny:

```ts
// v6.9.13: server-side enforcement — even if model violates, we clip.
if (typeof targetWeeks === 'number' && targetWeeks > 0 && Array.isArray(phases) && phases.length) {
  // Sort by suggested sequence_number (model should already do this).
  phases.sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0));
  // Compute total span; if > targetWeeks, scale proportionally then make contiguous.
  let total = 0;
  for (const p of phases) {
    const len = (p.estimated_weeks_end ?? 0) - (p.estimated_weeks_start ?? 0) + 1;
    total += Math.max(1, len);
  }
  if (total > targetWeeks) {
    const scale = targetWeeks / total;
    let cursor = 1;
    const minPerPhase = Math.max(1, Math.floor(targetWeeks / phases.length));
    for (let i = 0; i < phases.length; i++) {
      const origLen = Math.max(1, (phases[i].estimated_weeks_end ?? 0) - (phases[i].estimated_weeks_start ?? 0) + 1);
      let len = Math.max(minPerPhase, Math.round(origLen * scale));
      // Last phase: snap to deadline.
      if (i === phases.length - 1) len = Math.max(1, targetWeeks - cursor + 1);
      phases[i].estimated_weeks_start = cursor;
      phases[i].estimated_weeks_end = cursor + len - 1;
      cursor += len;
    }
    // Append a marker to last phase rationale.
    const last = phases[phases.length - 1];
    last.rationale = (last.rationale ? last.rationale + ' ' : '') +
      `[Auto-fitted to ${targetWeeks}-week deadline by server validator.]`;
  }
}
```

To jest **redundantna obrona**, NIE zastępuje promptu — gwarantuje, że nawet jeśli model nie posłucha, wynik będzie zgodny z deadline. Sanctity engine'u zachowana, bo działa po wygenerowaniu i tylko w jednym scenariuszu (`targetWeeks` provided AND violated).

### A3. UI — badge "Fit to deadline"

W `MacroTimeline.tsx` w nagłówku roadmapy: jeśli istnieje `targetWeeks` ORAZ `Σ phaseWeeks(phases) === targetWeeks` → drobny `<Badge variant="outline" className="text-[10px]">Fit to {targetWeeks}w deadline</Badge>` obok tytułu sekcji. Info-only, niefunkcjonalny.

### A4. Test akceptacyjny (do uruchomienia po deployu)

Wywołać `supabase--curl_edge_functions` z body:
```json
{ "studentId":"<uuid>", "teacherId":"<uuid>", "mode":"replace", "targetWeeks": 13 }
```
Oczekiwany wynik: `phases.length ∈ [3,4]`, `Σ (end-start+1) === 13`, `phases[last].estimated_weeks_end === 13`.

---

## CZĘŚĆ B — Edit suggestion lokalnie w formularzu (BEZ ZMIAN, powtórzenie)

**Plik:** `src/components/WorksheetForm/NextStepsPresetBanner.tsx`

### B1. Nowy stan i import dialogu

```tsx
import { SuggestionEditDialog, type SuggestionEditValue } from '@/components/dslm/SuggestionEditDialog';
const EMPTY_EDIT: SuggestionEditValue = { topic:'', goal:'', additionalInfo:'', grammarFocus:'', exercises:[], exerciseFocusMap:{} };
const [editingId, setEditingId] = useState<string | null>(null);
const [editValue, setEditValue] = useState<SuggestionEditValue>(EMPTY_EDIT);
```

`useFutureTimeline` już zwraca `updateSuggestion` — destrukturyzujemy go z hooka.

### B2. Nowy handler `openEdit`

```tsx
const openEdit = (s: any) => {
  setEditingId(s.id);
  setEditValue({
    topic: s.suggested_topic || '',
    goal: s.suggested_goal || '',
    additionalInfo: s.suggested_additional_info || '',
    grammarFocus: s.suggested_grammar_focus || '',
    exercises: Array.isArray(s.suggested_exercises) ? [...s.suggested_exercises] : [],
    exerciseFocusMap: s.suggested_exercise_focus_map ? { ...s.suggested_exercise_focus_map } : {},
  });
};
const saveEdit = async () => {
  if (!editingId || !editValue.topic.trim()) return;
  await updateSuggestion(
    editingId, editValue.topic, editValue.goal,
    editValue.additionalInfo, editValue.grammarFocus,
    editValue.exercises, editValue.exerciseFocusMap,
  );
  setEditingId(null);
};
```

### B3. Zamiana `navigate(editHref)` → `openEdit(p)`

W obu miejscach (przycisk Edit2 na chipie ORAZ w tooltipie) — usunąć `editHref` i `navigate(...)`, zamiast tego `onClick={(e)=>{ e.stopPropagation(); openEdit(p); }}`.

### B4. Render dialogu

Tuż przed `</TooltipProvider>` w returnie:

```tsx
<SuggestionEditDialog
  open={!!editingId}
  value={editValue}
  onChange={(u) => setEditValue(prev => ({ ...prev, ...u }))}
  onSave={saveEdit}
  onCancel={() => setEditingId(null)}
/>
```

### B5. Konsekwencja dla PathwayView

W `PathwayView.tsx` zostawiamy mechanizm `?editSuggestion=` (backward compat — ktoś może mieć link), ALE on nie będzie już używany przez banner. Brak zmian.

---

## CZĘŚĆ C — Smart phase targeting dla "Generate next steps" (BEZ ZMIAN, powtórzenie)

### C1. Helper w `PathwayView.tsx`

```ts
import { recommendedStepsForPhase } from './MacroTimeline'; // wystawimy export
function pickBestTargetPhase(phases, phaseSteps): string | null {
  const counts: Record<string, number> = {};
  for (const s of phaseSteps) if (s.phase_id) counts[s.phase_id] = (counts[s.phase_id]||0)+1;
  // Order: in_progress, then planned (by sequence_number ASC).
  const ordered = [
    ...phases.filter(p => p.status === 'in_progress'),
    ...phases.filter(p => p.status === 'planned'),
  ].sort((a,b) => a.sequence_number - b.sequence_number);
  for (const p of ordered) {
    const have = counts[p.id] || 0;
    const need = recommendedStepsForPhase(p);
    if (have < need) return p.id;
  }
  return null; // wszystkie pełne — sugeruj free
}
```

`recommendedStepsForPhase` w `MacroTimeline.tsx` → dodać `export function recommendedStepsForPhase(...)`.

### C2. PathwayView — przekazanie informacji o fazach do `NextStepsSection`

Zamiast dotychczasowego `targetPhaseId = currentPhase?.id ?? null`, oblicz:

```ts
const recommendedTargetPhaseId = useMemo(
  () => useRoadmap ? pickBestTargetPhase(phases, phaseSteps) : null,
  [useRoadmap, phases, phaseSteps]
);
```

Rozszerz interfejs `NextStepsSectionProps`:

```ts
phaseOptions: Array<{ id: string; label: string; sequence: number;
  status: PhaseStatus; have: number; need: number; weeks: number | null }>;
defaultTargetPhaseId: string | null;          // null = free
useRoadmap: boolean;                          // żeby ukryć selector, jeśli wyłączony
onGenerateMore: (count: number, excludeIds: string[], phaseId: string | null) => Promise<boolean> | boolean;
```

Zbuduj `phaseOptions` w PathwayView i przekaż. Zmień handler:

```ts
onGenerateMore={(count, excludeIds, phaseId) =>
  generateNextSteps({
    mode: excludeIds.length > 0 ? 'add' : 'replace',
    count, excludeIds,
    phaseId: useRoadmap ? phaseId : null,
  })
}
```

### C3. NextStepsSection — selector w dwóch dialogach

Oba dialogi (`firstGenDialogOpen` empty-state ORAZ `DropdownMenu` "Generate more") dostają **ten sam blok UI**:

1. Nowy stan `const [targetPhaseId, setTargetPhaseId] = useState<string | null>(defaultTargetPhaseId);` — sync z propa przy każdym otwarciu (`useEffect` przy `open`).
2. `Select`:
   - Etykieta: `Target phase`
   - Pierwsza opcja: `🎯 Recommended: {recommendedLabel}` — value = `defaultTargetPhaseId` (lub `__free__` jeśli null) — domyślnie zaznaczona.
   - Pozostałe: każda faza w `phaseOptions` jako `Phase {seq}: {label} — {have}/{need} steps ({weeks ? weeks+'w' : '—'})`.
   - Ostatnia: `Free step (no phase)` — value `__free__`.
3. Helper text pod selectem (warunkowe):
   - jeżeli wybrana faza ma `have >= need`: `⚠ Already at recommended count ({have}/{need}). Adding more is OK but the rolling plan stays at {need} per week-block.`
   - jeżeli faza ma `have < need`: `Phase has {have}/{need} steps. Recommended add: {need-have}.` — i auto-presetuj input `count = max(1, need - have)` (tylko gdy user nie zmienił ręcznie — proste: zrób to przy zmianie selectu).
   - jeżeli `__free__`: `Free step — not bound to any phase. Use only after current phase is complete or for ad-hoc topics.`
4. `count` clamp pozostaje 1-6.
5. Przycisk submit przekazuje `phaseId = targetPhaseId === '__free__' ? null : targetPhaseId`.

`currentPhaseLabel` (badge przy "Next Steps") **zostaje** jako informacja "który phase jest in_progress" (orientacja), ale nie służy już jako sztywny target.

### C4. Refaktor — wspólny komponent `GenerateStepsDialog`

Aby uniknąć duplikacji, wyciąg do nowego pliku `src/components/dslm/GenerateStepsDialog.tsx`:
- props: `{ open, mode: 'first'|'more', defaultCount, defaultTargetPhaseId, phaseOptions, generating, onCancel, onConfirm(count, phaseId) }`
- środek = Input number + Select + helpery z C3.
- `NextStepsSection` używa go dwukrotnie (zamiast dwóch lokalnych dialogów).
- `MacroTimeline` może opcjonalnie też z niego skorzystać w przyszłości — w tej iteracji NIE ruszamy MacroTimeline (sanctity zakresu).

---

## CZĘŚĆ D — Pełne podsekcje w nawigacji DSLM (BEZ ZMIAN, powtórzenie)

**Pliki:** `DSLMTab.tsx`, `CollapsibleSection.tsx`, `PathwayView.tsx`.

### D1. Mechanizm "scroll + open" przez window event

W `CollapsibleSection.tsx`:

```tsx
interface CollapsibleSectionProps { id?: string; ... }

export const CollapsibleSection = ({ id, ..., defaultOpen=false, ... }) => {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (!id) return;
    const handler = (e: Event) => {
      const target = (e as CustomEvent).detail?.id;
      if (target === id) setOpen(true);
    };
    window.addEventListener('dslm:openSubsection', handler as EventListener);
    return () => window.removeEventListener('dslm:openSubsection', handler as EventListener);
  }, [id]);
  return <Card id={id} ...>...</Card>;
};
```

(`id` na `<Card>` daje natywny anchor dla `scrollIntoView`.)

### D2. Mapa subsekcji w DSLMTab

Tuż obok `VIEWS` dodaj:

```ts
const SUBSECTIONS: Record<ViewId, Array<{ id: string; label: string }>> = {
  pathway: [
    { id: 'sub-pathway-next-steps', label: 'Next Steps' },
    { id: 'sub-pathway-roadmap',    label: 'Learning Roadmap' },
    { id: 'sub-pathway-notes',      label: 'Next Lesson Ideas' },
  ],
  goals: [
    { id: 'sub-goals-main',       label: 'Main Goal' },
    { id: 'sub-goals-supporting', label: 'Supporting Goals' },
    { id: 'sub-goals-additional', label: 'Additional Goals' },
    { id: 'sub-goals-achieved',   label: 'Achieved Goals' },
    { id: 'sub-goals-archived',   label: 'Archived Goals' },
    { id: 'sub-goals-notes',      label: 'Goal Notes' },
  ],
  skills: [
    { id: 'sub-skills-heatmap',    label: 'Skills Heat Map' },
    { id: 'sub-skills-micro',      label: 'Micro Skills' },
    { id: 'sub-skills-notes',      label: 'Skill Assessment Notes' },
  ],
  profile: [
    { id: 'sub-profile-summary',     label: 'AI Summary' },
    { id: 'sub-profile-psych',       label: 'Psychological Profile' },
    { id: 'sub-profile-behavior',    label: 'Behavioral Stats' },
    { id: 'sub-profile-personal',    label: 'Personal Notes' },
    { id: 'sub-profile-allnotes',    label: 'All Notes' },
    { id: 'sub-profile-debug',       label: 'Debug: Event Log' },
  ],
};
```

### D3. Handler `handleScrollToSub`

```ts
const handleScrollToSub = useCallback((view: ViewId, subId: string) => {
  setActiveSection(view);
  setSearchParams({ tab: 'dslm', view, section: subId });
  // Open + scroll z drobnym delay, żeby IntersectionObserver się ustabilizował
  window.dispatchEvent(new CustomEvent('dslm:openSubsection', { detail: { id: subId } }));
  setTimeout(() => {
    const el = document.getElementById(subId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}, [setSearchParams]);
```

Plus na mount: jeśli `searchParams.get('section')` istnieje → wywołaj `handleScrollToSub(view, sectionId)` z większym timeoutem (300ms) żeby `LazySection` zdążył zhydrować Goals/Skills/Profile.

### D4. UI nawigacji desktop

Pod każdym button widoku w `<nav>` dodać (gdy `activeSection === view.id`) zwijany blok:

```tsx
{activeSection === view.id && SUBSECTIONS[view.id].length > 0 && (
  <div className="ml-6 space-y-0.5 mt-0.5">
    {SUBSECTIONS[view.id].map(sub => (
      <button
        key={sub.id}
        onClick={() => handleScrollToSub(view.id, sub.id)}
        className="w-full text-left text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        {sub.label}
      </button>
    ))}
  </div>
)}
```

Dla mobile: pod paskiem widoków render drugi rząd subsekcji (chip-style, scroll-x), tylko gdy `activeSection` to view, który ma >0 subsekcji.

### D5. Przypisanie `id` do `CollapsibleSection`

- `GoalsView.tsx`: 6 sekcji — dopisz `id="sub-goals-..."` po kolei zgodnie z mapą D2. Sekcja Main Goal jest renderowana inline (bez CollapsibleSection) — opakuj jej zewnętrzny `<Card>` (jeśli istnieje) w `<div id="sub-goals-main">` lub dodaj `id` na pierwszej `<Card>` rezygnując z CollapsibleSection.
- `SkillsView.tsx`: 3 sekcje — dopisz id.
- `ProfileView.tsx`: 6 sekcji — dopisz id.
- `PathwayView.tsx`: 3 sekcje — żadna nie używa CollapsibleSection. Owijamy każdą w `<div id="sub-pathway-...">`:
  - Next Steps section → wokół `<NextStepsSection ... />`.
  - Roadmap → wokół `<Collapsible open={roadmapOpen} ...>`.
  - Next Lesson Ideas → wokół `<Collapsible open={notesOpen} ...>`.
  - Dodajemy także obsługę window event `dslm:openSubsection` w PathwayView, aby otwierał roadmap/notes Collapsible (jednolinijkowy `useEffect`).

### D6. Backward compat URL

`?tab=dslm&view=pathway` (bez `section`) działa jak dotąd. Stare `?tab=progress` redirect (StudentPage.tsx) zostawiamy.

---

## CZĘŚĆ E — Student switcher na pasku nawigacji (NOWY)

**Plik:** `src/components/landing/StickyNav.tsx`, opcjonalnie nowy `src/components/landing/NavStudentSwitcher.tsx`.

### E1. Kontekst

Obecny `StudentSwitcherPopover` (`src/components/StudentSwitcherPopover.tsx`) wyświetla scrollowalną listę studentów z sortowaniem `updated_at DESC`, ale jest renderowany tylko na stronie studenta (StudentPage). Brakuje go w globalnym `StickyNav` na innych stronach (`/calendar`, `/all-worksheets`, `/student/:id`, `/homework/:id`, etc.).

### E2. Nowy komponent `NavStudentSwitcher`

Plik: `src/components/landing/NavStudentSwitcher.tsx` (mały wrapper żeby nie zaśmiecać StickyNav):

```tsx
import { useNavigate, useLocation } from 'react-router-dom';
import { useStudents } from '@/hooks/useStudents';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, ChevronDown } from 'lucide-react';
import React from 'react';

export const NavStudentSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { students = [], loading } = useStudents();
  const [open, setOpen] = React.useState(false);

  const sorted = React.useMemo(
    () => [...students].sort((a: any, b: any) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [students]
  );

  const goTo = (id: string, newTab: boolean) => {
    const url = `/student/${id}`;
    if (newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url);
      setOpen(false);
    }
  };

  // Middle-click + Ctrl/Cmd-click handler — opens new tab
  const handleClickWithModifier = (e: React.MouseEvent, id: string) => {
    if (e.button === 1 || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      goTo(id, true);
      return;
    }
    goTo(id, false);
  };
  const handleAuxClick = (e: React.MouseEvent, id: string) => {
    if (e.button === 1) { e.preventDefault(); goTo(id, true); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Users className="h-4 w-4" />
          Students
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Switch to student
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {loading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>}
          {!loading && sorted.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No students yet.</div>
          )}
          {!loading && sorted.map((s: any) => (
            <a
              key={s.id}
              href={`/student/${s.id}`}
              onClick={(e) => { e.preventDefault(); handleClickWithModifier(e, s.id); }}
              onAuxClick={(e) => handleAuxClick(e, s.id)}
              className="block px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
              title="Click to open · Middle/Ctrl-click for new tab"
            >
              <div className="font-medium truncate">{s.name}</div>
              <div className="text-[11px] text-muted-foreground">{s.english_level}</div>
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
```

**Kluczowe**: użycie `<a href="...">` zamiast `<button>` automatycznie aktywuje natywne zachowanie przeglądarki dla middle-click i Ctrl/Cmd-click ("Open in new tab"). `e.preventDefault()` w `onClick` blokuje normalną nawigację, ale pozostawia natywne otwieranie w nowej karcie aktywne (bo `auxclick` / modifier-click są przetwarzane wcześniej).

### E3. Integracja w `StickyNav.tsx`

W gałęzi `isRegisteredUser` (zarówno mobile, jak i desktop) — przed przyciskiem Calendar/Generate:

```tsx
import { NavStudentSwitcher } from './NavStudentSwitcher';
...
{!isDashboard && !isProfile && <NavStudentSwitcher />}
```

Mobile: powyżej menu sheet, w głównym pasku (po prawej stronie obok `Generate`). Sheet w mobile pozostaje bez zmian (stara nawigacja Dashboard/Profile).

Warunek `!isDashboard && !isProfile` — zgodnie z wymaganiem usera ("poza /dashboard i /profile").

---

## CZĘŚĆ F — Middle/Ctrl-click open-in-new-tab dla Calendar i Generate Worksheet (NOWY)

**Plik:** `src/components/landing/StickyNav.tsx`.

### F1. Problem

Aktualnie `Generate Worksheet` i (jeśli istnieje) Calendar są przyciskami `<button onClick={...}>`, które wykonują `navigate(...)` lub callback JS. Middle-click i Ctrl/Cmd-click są ignorowane → brak natywnej obsługi otwierania w nowej karcie.

### F2. Audyt obecnego stanu

- `onGenerateWorksheet` jest **callbackiem** — nie navigatem. Najczęściej w aplikacji ten przycisk otwiera modal/dialog generacji. **Sprawdź w implementacji**, czy w dashboardzie i innych miejscach `onGenerateWorksheet` faktycznie ostatecznie navigates do `/dashboard?action=generate` lub do innego adresu. Jeśli tak — wystaw `<a href>` z `onClick` preventem (jak w E2).
- Calendar — w obecnym `StickyNav` brak przycisku Calendar. Najprawdopodobniej user mówi o przycisku Calendar w `Sidebar`/dashboard nav lub planuje go DODAĆ. **Decyzja:** dodajemy przycisk Calendar do StickyNav (registered, desktop+mobile) jako brakujący, oraz konwertujemy oba (Calendar + Generate Worksheet) do anchor pattern.

### F3. Konwersja na anchor pattern (Calendar)

```tsx
import { Calendar } from 'lucide-react';
const isCalendar = location.pathname === '/calendar';
...
{!isCalendar && (
  <Button asChild variant="outline" size="sm">
    <a
      href="/calendar"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.button === 1) return; // let native handle
        e.preventDefault();
        navigate('/calendar');
      }}
      onAuxClick={(e) => { /* native handles middle */ }}
    >
      <Calendar className="h-4 w-4 mr-2" />Calendar
    </a>
  </Button>
)}
```

`Button asChild` z `<a>` w środku jest standardowym wzorcem shadcn — zachowuje style i daje natywne zachowanie przeglądarki dla modyfikatorów.

Analogicznie dla `Dashboard`/`Profile` (już używają `Button asChild` + `<Link>` — `<Link>` z react-router NIE obsługuje natywnie middle-click→new-tab dla zewnętrznych przeglądarek; faktycznie `<Link>` renderuje `<a href>`, więc działa OK z modyfikatorami. **Nie zmieniamy Dashboard/Profile.**)

### F4. Konwersja `Generate Worksheet`

Generate Worksheet to akcja, nie route, ale wymaganie user'a sugeruje, że ma być nawigacyjne. **Decyzja:** `Generate Worksheet` przy obecnej architekturze:

- **na innych stronach niż `/dashboard`** → zamień na `<a href="/dashboard?action=generate">` (anchor + onClick navigate). Nowa karta: otwiera dashboard z auto-otwartym formularzem (dashboard już obsługuje `?action=add-student` analogicznie — dodajemy obsługę `?action=generate` w `Dashboard.tsx`: `useEffect` sprawdza param i otwiera/scrolluje do formularza).
- **na `/dashboard`** → tak jak teraz, callback `onGenerateWorksheet` (otwiera/scrolluje do formularza inline). Anchor pattern niepotrzebny — i tak jesteś już na dashboard.

```tsx
{onGenerateWorksheet && !isDashboard && (
  <Button asChild size="sm">
    <a
      href="/dashboard?action=generate"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.button === 1) return;
        e.preventDefault();
        navigate('/dashboard?action=generate');
      }}
    >
      <Plus className="h-4 w-4 mr-2" />Generate Worksheet
    </a>
  </Button>
)}
{onGenerateWorksheet && isDashboard && (
  <Button size="sm" onClick={onGenerateWorksheet}>
    <Plus className="h-4 w-4 mr-2" />Generate Worksheet
  </Button>
)}
```

### F5. Obsługa `?action=generate` w `Dashboard.tsx`

W istniejącym `useEffect` reagującym na `searchParams` (już obsługuje `action=add-student`) dodać:

```ts
if (searchParams.get('action') === 'generate') {
  // scroll do formularza i/lub otworzyć go
  document.getElementById('worksheet-generation-form')?.scrollIntoView({ behavior: 'smooth' });
  // czyszczenie param
  searchParams.delete('action'); setSearchParams(searchParams, { replace: true });
}
```

(Dokładny anchor — sprawdzić ID `WorksheetForm` rootu w `Dashboard.tsx`; jeśli go nie ma — dodać `<div id="worksheet-generation-form" />` jako anchor.)

---

## CZĘŚĆ G — Add Note z tab=overview otwiera Quick Add modal (NOWY)

**Pliki:** `src/pages/StudentPage.tsx`, `src/components/student-knowledge/StudentKnowledgeQuickAddModal.tsx` (już istnieje).

### G1. Problem

W `StudentPage.tsx:732` przycisk **Add Note** w sekcji Recent Notes (tab `overview`) wywołuje `handleTabChange('knowledge')`, co przez `redirectMap` (linia 271) przenosi na `?tab=dslm&view=profile`. PathwayView/ProfileView NIE otwiera żadnego modalu dodawania notki — efekt: nawigacja, brak akcji.

`StudentKnowledgeQuickAddModal` istnieje (`src/components/student-knowledge/StudentKnowledgeQuickAddModal.tsx`) i jest niezaimportowany w StudentPage.

### G2. Rozwiązanie: lokalny modal w StudentPage, bez nawigacji

W `StudentPage.tsx`:

1. Import + state:

```tsx
import { StudentKnowledgeQuickAddModal } from '@/components/student-knowledge/StudentKnowledgeQuickAddModal';
const [quickAddOpen, setQuickAddOpen] = useState(false);
```

2. Zamiana onClick obu przycisków "Add Note" (overview tab + każde inne miejsce w pliku gdzie jest CTA "Add Note" prowadzące do `handleTabChange('knowledge')` z intencją dodawania):

```tsx
<Button size="sm" onClick={() => setQuickAddOpen(true)} className="flex-1">
  <Plus className="h-4 w-4 mr-1" /> Add Note
</Button>
```

Przycisk **View All** zostawiamy z `handleTabChange('knowledge')` (intencją jest nawigacja, nie dodawanie).

3. Render modalu na końcu komponentu (przy innych dialogach):

```tsx
<StudentKnowledgeQuickAddModal
  open={quickAddOpen}
  onClose={() => setQuickAddOpen(false)}
  studentId={id!}
  teacherId={teacherId}
  studentName={student?.name || ''}
  onAdded={() => {
    studentKnowledge.refetch?.();
    setQuickAddOpen(false);
  }}
/>
```

(Sprawdzić w implementacji dokładny props signature `StudentKnowledgeQuickAddModal` — zaadaptować nazwy callbacków. Plik istnieje, zaczyta się przed implementacją.)

### G3. Konsekwencja

- Brak zmian w `redirectMap` (zostaje dla starych deep-linków).
- Brak zmian w DSLMTab/ProfileView.
- Quick Add zachowuje się identycznie jak na innych ekranach (zgodnie z v6.9.8 quick-capture flow: zapis jako `category='Notes'`, AI klasyfikuje w tle).

---

## CZĘŚĆ H — Dokumentacja (RAG)

### H1. `docs/llm-context.md` + `llms.txt` — sekcja v6.9.13

```markdown
## v6.9.13 — Deadline-aware phase prompt + form-local Edit + smart phase target + DSLM sub-nav + nav student switcher + Add Note quick modal

### Problem 1: generate-curriculum-phases ignored goal deadline (5×4w = 20w plan for 90-day goal).
Edooqoo.com Solution: SYSTEM_PROMPT extended with HARD CONSTRAINT "DEADLINE FIT" requiring Σ phase weeks ≤ targetWeeks. Server-side validator clips overruns as defense-in-depth. Client passes targetWeeks computed from main_goal_target_date or nearest goal deadline.
Technical Mechanics: useCurriculumPhases.generatePhases body adds {targetWeeks}. Edge function generate-curriculum-phases prompt prepended with "HARD CONSTRAINT — DEADLINE FIT" block (rules 1-6 incl. distribution table, contiguity, last-phase snap). Post-AI validator scales+snaps phases when total > targetWeeks. UI: "Fit to {N}w deadline" badge in MacroTimeline header.

### Problem 2: Edit suggestion in WorksheetForm forced navigation away.
Solution: SuggestionEditDialog reused inline in NextStepsPresetBanner. updateSuggestion called via useFutureTimeline. PathwayView ?editSuggestion= path kept for backward compat.
Technical Mechanics: Banner owns editingId/editValue; saveEdit invokes hook mutation; banner refetches via hook subscription.

### Problem 3: "Generate next steps" hard-coded current in_progress phase, no override.
Solution: pickBestTargetPhase() = first in_progress with have<need, else first planned with have<need, else null. Recommendation surfaced as default in shared GenerateStepsDialog with phase Select (incl. "Free step"). count auto-presets to need-have.
Technical Mechanics: PathwayView computes phaseOptions[{id,label,sequence,status,have,need,weeks}] and defaultTargetPhaseId. NextStepsSection renders shared GenerateStepsDialog for both first-time and "more" flows.

### Problem 4: DSLM left-nav showed only top-level views; subsections undiscoverable.
Solution: SUBSECTIONS map in DSLMTab; nested nav under active view. handleScrollToSub() dispatches window event 'dslm:openSubsection' + scrollIntoView.
Technical Mechanics: CollapsibleSection accepts id, listens to event, force-opens when id matches; root <Card> gets DOM id. PathwayView panels wrapped in <div id="sub-pathway-*"> with mirrored event listener for its Collapsibles. URL: ?tab=dslm&view=X&section=sub-...

### Problem 5: No global student switcher in nav (outside dashboard/profile).
Solution: NavStudentSwitcher in StickyNav for registered users when !isDashboard && !isProfile. Popover with scrollable list sorted by updated_at DESC. Anchor-based items support middle/Ctrl-click for new-tab.
Technical Mechanics: <a href="/student/{id}"> with onClick preventDefault for normal nav, native handling for modifier+aux clicks. Reuses useStudents hook.

### Problem 6: Calendar / Generate Worksheet didn't support open-in-new-tab via middle/Ctrl-click.
Solution: Convert to <Button asChild><a href="..." onClick={modifier-aware navigate}> pattern. Generate Worksheet on non-dashboard pages anchors to /dashboard?action=generate; Dashboard.tsx handles ?action=generate by scrolling to #worksheet-generation-form anchor.
Technical Mechanics: onClick checks metaKey/ctrlKey/button===1 → returns (native opens new tab); else preventDefault + navigate.

### Problem 7: tab=overview "Add Note" navigated to dslm/profile but no modal opened.
Solution: Local StudentKnowledgeQuickAddModal in StudentPage. Add Note button in Recent Notes section opens local modal; "View All" still navigates to dslm/profile.
Technical Mechanics: import + state quickAddOpen; render <StudentKnowledgeQuickAddModal> at page footer with onAdded → studentKnowledge.refetch.

### RAG Keywords
deadline cap phases, hard constraint deadline fit, server-side phase validator, targetWeeks, generate-curriculum-phases prompt v6.9.13, in-form edit suggestion, suggestion edit modal worksheet form, smart phase target, recommended target phase, phase coverage have need, free step option, dslm sub-nav, subsection navigation, openSubsection event, learning plan deadline fit, nav student switcher, NavStudentSwitcher, middle click open new tab, ctrl click new tab, generate worksheet anchor, action=generate, add note modal, StudentKnowledgeQuickAddModal in StudentPage
```

### H2. `mem/features/worksheet-form/next-step-preset.md` — dopisek v6.9.13

- Edit modal teraz lokalny w bannerze (SuggestionEditDialog).
- Brak nawigacji do PathwayView dla edycji.
- updateSuggestion via useFutureTimeline.

### H3. Nowy plik `mem/features/dslm/sub-navigation.md`

Mapa sekcji + mechanizm window event `dslm:openSubsection`. Aktualizacja `mem/index.md`.

### H4. Nowy plik `mem/features/dslm/curriculum-phases-deadline-fit.md`

- Prompt-level rule "HARD CONSTRAINT — DEADLINE FIT" — dokładny tekst i logika rozkładu długości.
- Server-side validator jako defense-in-depth.
- Sanctity rule: prompt można edytować tylko po wyraźnej zgodzie usera (jak tutaj v6.9.13).

### H5. Nowy plik `mem/features/navigation/nav-student-switcher.md`

- Kiedy pokazany (registered, !dashboard, !profile).
- Anchor pattern dla nowej karty.
- Sortowanie updated_at DESC.

### H6. Nowy plik `mem/features/navigation/middle-click-anchor-pattern.md`

- Zasada: każdy nawigacyjny przycisk w globalnym nav używa `<Button asChild><a href onClick={...}>`.
- onClick guard: `if (metaKey||ctrlKey||button===1) return`.
- Generate Worksheet → `?action=generate` na Dashboard.

### H7. Nowy plik `mem/features/student-page/quick-add-note-from-overview.md`

- Add Note z overview otwiera lokalny QuickAdd modal, nie nawiguje.
- View All zostaje navigacją do dslm/profile.

### H8. Aktualizacja `mem/index.md`

Dopisanie 5 nowych pozycji w sekcji `## Memories`.

---

## Zmienione pliki (lista do implementacji)

| Plik | Zakres |
|---|---|
| `supabase/functions/generate-curriculum-phases/index.ts` | **NOWY w repo** — pobrać aktualny deploy, dodać HARD CONSTRAINT block do SYSTEM_PROMPT, dorzucić line w user prompt, dodać server-side validator (A2.1, A2.2, A2.3) |
| `supabase/config.toml` | Dodać `[functions.generate-curriculum-phases] verify_jwt = false` jeśli brakuje |
| `src/hooks/dslm/useCurriculumPhases.tsx` | A1 — `targetWeeks` w body |
| `src/components/dslm/MacroTimeline.tsx` | A3 (przekazanie targetWeeks z propsów do generatePhases), A4 (badge), `export recommendedStepsForPhase` |
| `src/components/dslm/PathwayView.tsx` | C1, C2, D5 (3 wrappery + listener), przekazanie deadline'ów do MacroTimeline |
| `src/components/dslm/DSLMTab.tsx` | przekazanie `mainGoalTargetDate` + `nearestGoalDeadlineDate` do PathwayView; D2, D3, D4 (subsekcje) |
| `src/components/dslm/NextStepsSection.tsx` | C3, C4 (refaktor do GenerateStepsDialog) |
| `src/components/dslm/GenerateStepsDialog.tsx` | **NOWY** — wspólny dialog z Select fazy |
| `src/components/dslm/CollapsibleSection.tsx` | D1 (id + event listener) |
| `src/components/dslm/GoalsView.tsx` | D5 (id na 6 sekcjach) |
| `src/components/dslm/SkillsView.tsx` | D5 (id na 3 sekcjach) |
| `src/components/dslm/ProfileView.tsx` | D5 (id na 6 sekcjach) |
| `src/components/WorksheetForm/NextStepsPresetBanner.tsx` | B1-B4 (lokalny edit modal) |
| `src/components/landing/StickyNav.tsx` | E3 (NavStudentSwitcher), F3 (Calendar anchor), F4 (Generate Worksheet anchor) |
| `src/components/landing/NavStudentSwitcher.tsx` | **NOWY** — komponent E2 |
| `src/pages/Dashboard.tsx` | F5 (?action=generate handling + anchor #worksheet-generation-form) |
| `src/pages/StudentPage.tsx` | G2 (Quick Add modal lokalnie, zamiana onClick "Add Note") |
| `docs/llm-context.md` | H1 |
| `llms.txt` | H1 |
| `mem/features/worksheet-form/next-step-preset.md` | H2 |
| `mem/features/dslm/sub-navigation.md` | **NOWY** H3 |
| `mem/features/dslm/curriculum-phases-deadline-fit.md` | **NOWY** H4 |
| `mem/features/navigation/nav-student-switcher.md` | **NOWY** H5 |
| `mem/features/navigation/middle-click-anchor-pattern.md` | **NOWY** H6 |
| `mem/features/student-page/quick-add-note-from-overview.md` | **NOWY** H7 |
| `mem/index.md` | H8 (5 nowych pozycji) |

## Sanctity — nietknięte

- Edge functions `generate-timeline`, `format-worksheet-prompt`, `classify-knowledge-entry`, `send-welcome-email` (oraz prompt worksheet engine).
- Schema DB (zero migracji).
- `normalizeSuggestionPrefill`.
- `MacroTimeline` per-phase quick-generate (B/C dotyczy tylko Next Steps section).
- `Dashboard` "Generate Worksheet" zachowanie inline (zmiana tylko dla wywołań spoza Dashboardu).

## Backward compatibility

- Stary URL `?tab=progress` → istniejący redirect.
- `?editSuggestion=` w PathwayView nadal działa.
- `useCurriculumPhases.generatePhases` — `opts.targetWeeks` opcjonalny, brak = stare zachowanie.
- `onGenerateMore` w `NextStepsSection` — sygnatura rośnie o 3-ci argument; jedyny caller (`PathwayView`) zaktualizowany.
- `StickyNav` — `NavStudentSwitcher` ukryty, gdy `students.length === 0` lub na dashboard/profile.
- `redirectMap` w StudentPage zostaje (deep-linki).
- Generate Worksheet anchor pattern działa wstecznie — `onGenerateWorksheet` callback nadal jest używany na `/dashboard`.
