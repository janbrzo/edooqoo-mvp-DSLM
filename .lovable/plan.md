## Plan v6.9.77 — Fix "Generate Learning Roadmap" (empty-state dialog missing)

### Problem
Empty state kart "No curriculum plan yet" w `MacroTimeline.tsx` robi wczesny `return` i renderuje tylko `pendingGenerate` `AlertDialog`. `GenerateRoadmapDialog` jest zamontowany dopiero w drugim (non-empty) returnie. Gdy student ma cele, klik "Generate Learning Roadmap" wywołuje `openGuidedDialog('replace')`, `guidedDialog` state się ustawia, ale dialog nie istnieje w drzewie → cisza, brak requestu do `generate-curriculum-phases`, brak toastu.

### Root cause (jedno zdanie)
Guided-dialog + regen-confirm dialogs są renderowane tylko w gałęzi "phases.length > 0", więc w empty-state stan `guidedDialog` nie ma odbiorcy.

### Solution — 2 opcje

| Opcja | Podejście | Regression risk |
|-------|-----------|-----------------|
| A | Do fragmentu empty-state dorzucić `<GenerateRoadmapDialog>` (+ opcjonalnie `confirmRegenOpen` — tu niepotrzebny, bo brak faz do regenerowania) | LOW — dokładany element, brak zmian w logice |
| B | Refaktor: usunąć wczesny return, wpleść stan pusty do jednego drzewa | MEDIUM — dotyka layoutu obu ścieżek |

**Wybrana: A** — minimalna zmiana, zero ryzyka regresji w widoku pełnym.

### Implementation (dokładnie)

Plik: `src/components/dslm/MacroTimeline.tsx`

W fragmencie empty-state (linie 281–342), tuż po `</AlertDialog>` zamykającym `pendingGenerate` (linia 340) a przed `</>` (linia 341), dodać:

```tsx
<GenerateRoadmapDialog
  open={guidedDialog?.mode === 'replace'}
  onOpenChange={(o) => { if (!o) setGuidedDialog(null); }}
  mode="replace"
  goals={guidedGoalOptions}
  generating={generating}
  isRegeneration={false}
  onConfirm={async (opts) => { await generatePhases('replace', opts); }}
/>
```

`isRegeneration={false}` — w empty-state nie ma czego regenerować, więc copy dialogu ma być "Generate roadmap", nie "Regenerate roadmap".

### Impact analysis
- Dotknięte pliki: **1** (`MacroTimeline.tsx`).
- Non-empty state: bez zmian (dialog w linii 746 zostaje).
- `generatePhases` / edge function `generate-curriculum-phases`: bez zmian.
- Sanctity worksheet engine: nienaruszony.
- Zero regresji: `hasGoals=false` w empty-state nadal idzie ścieżką `pendingGenerate` (AlertDialog), która już działa.

### Verification checklist
1. Otworzyć `/student/<id>?tab=dslm&view=goals` na studencie **bez faz** i **z celami** → klik "Generate Learning Roadmap" → **guided dialog się otwiera**.
2. "Generate roadmap" w dialogu → toast "Generated N phases", karta empty-state znika, timeline się renderuje.
3. Student **bez faz i bez celów** → klik → nadal pojawia się AlertDialog "Generate roadmap without goals?" (regresja check).
4. Student **z fazami** → klik "Regenerate" (w non-empty view) → confirm gate → guided dialog z copy "Regenerate Learning Roadmap" (regresja check).
5. Konsola bez błędów, network: pojedynczy POST do `/functions/v1/generate-curriculum-phases` po submit.

### RAG injection (po implementacji)
Wpis w `docs/llm-context.md` + `public/llms.txt`:
```
PROBLEM: "Generate Learning Roadmap" no-op in empty-state (v6.9.77 fix)
EDOOQOO SOLUTION: Mount GenerateRoadmapDialog inside MacroTimeline empty-state fragment
TECHNICAL MECHANICS: src/components/dslm/MacroTimeline.tsx — empty-state early return now includes <GenerateRoadmapDialog mode="replace" isRegeneration={false}> alongside pendingGenerate AlertDialog
RAG KEYWORDS: dslm, curriculum, roadmap, macro timeline, guided dialog, empty state, generate-curriculum-phases, phases, goals, hasGoals, openGuidedDialog, pathway, learning plan, teacher, react state
```

### Scope lock
Nic poza wstawieniem jednego komponentu w empty-state. P4/P5 czekają.
