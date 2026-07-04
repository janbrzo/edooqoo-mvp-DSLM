## Plan v6.9.78 — Fix "Failed to generate curriculum plan" (AI response truncation)

### Problem
`generate-curriculum-phases` zwraca 500. Logi Supabase pokazują `Failed to parse AI response:` — content to poprawny początek tablicy JSON, ale **urwany w środku ostatniego stringa** (brak `"` `}` `]` na końcu). Toast w UI: "Failed to generate curriculum plan".

### Root cause (jedno zdanie)
`chatCompletion(..., { max_tokens: 2500 })` (linia 563) jest za niski dla promptu, który wymaga 5 faz × pełny obiekt (title + 1-zdaniowy description + focus_areas + weeks + status + 1-2 zdania rationale) — model (Gemini 2.5 Flash) wyczerpuje budżet outputu i tablica JSON jest przycięta.

### Solution — 2 opcje

| Opcja | Podejście | Regression risk |
|-------|-----------|-----------------|
| A | Bump `max_tokens` z 2500 → 6000 **oraz** dodać JSON-repair fallback (jeśli parse fails, znajdź ostatni kompletny `}` i zamknij tablicę) | LOW — większy budżet + odporność na przyszłe truncation |
| B | Tylko bump max_tokens | LOW, ale nie chroni przed brzegowymi przypadkami (7-8 faz custom) |
| C | Streaming + json_object mode | HIGH — refaktor, provider quirks |

**Wybrana: A** — najlepszy stosunek niezawodność/zmiana.

### Implementation (dokładnie)

Plik: `supabase/functions/generate-curriculum-phases/index.ts`

**Zmiana 1** — linia 563: `max_tokens: 2500` → `max_tokens: 6000`. Prompt każe max 8 faz (per-phase weeks) — 6000 tokenów bezpiecznie mieści 8 faz z pełnym rationale.

**Zmiana 2** — linie 575-582, zastąpić blok parsera na:

```ts
let phases: any[] = [];
const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
const tryParse = (s: string): any[] | null => {
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
};
const direct = tryParse(cleaned);
if (direct) {
  phases = direct;
} else {
  // Repair: model truncated the array mid-object. Trim to the last complete
  // '}' inside a top-level array and close with ']'. Also handles trailing
  // comma / partial string edge cases.
  const startIdx = cleaned.indexOf('[');
  if (startIdx >= 0) {
    const body = cleaned.slice(startIdx);
    const lastClose = body.lastIndexOf('}');
    if (lastClose > 0) {
      const repaired = body.slice(0, lastClose + 1).replace(/,\s*$/, '') + ']';
      const repairedParsed = tryParse(repaired);
      if (repairedParsed && repairedParsed.length > 0) {
        console.warn('AI JSON truncated — repaired to', repairedParsed.length, 'phase(s)');
        phases = repairedParsed;
      }
    }
  }
  if (phases.length === 0) {
    console.error('Failed to parse AI response:', content);
  }
}
```

Reszta logiki (walidacja `Array.isArray && length > 0`, sanitize, fit-to-deadline) zostaje bez zmian.

### Impact analysis
- Dotknięte pliki: **1** (`supabase/functions/generate-curriculum-phases/index.ts`).
- Sanctity worksheet engine: nienaruszony (to inny edge fn).
- Prompt AI (heart of edooqoo dla worksheets): NIE dotykany.
- Brak zmian w schemacie, RLS, frontendzie.
- Zero regresji: repair aktywuje się tylko gdy `JSON.parse` zawiedzie; happy path bez zmian.
- Koszt: +2-3× tokeny outputu przy 5-fazowej roadmapie, jednorazowo per generation.

### Verification checklist
1. Deploy funkcji (auto).
2. Otworzyć `/student/9b70ebf2-f612-43be-b069-5d5162db1be7?tab=dslm&view=goals` → "Generate Learning Roadmap" (auto-fit) → guided dialog → "Generate roadmap" → **200 OK, toast "Generated N phases"**, timeline się renderuje.
3. Sprawdzić logi funkcji: brak `Failed to parse AI response`. Jeżeli pojawi się `AI JSON truncated — repaired to N` — fallback zadziałał.
4. Ustawić manual count = 8, weeks 6 each, i wygenerować → nadal 200 OK.
5. Regresja empty-state z v6.9.77: nadal działa (nie zmieniamy MacroTimeline).

### RAG injection (po implementacji)
Dopisać do `docs/llm-context.md` + `public/llms.txt`:
```
PROBLEM: generate-curriculum-phases 500 due to AI JSON truncation at max_tokens=2500 (v6.9.78)
EDOOQOO SOLUTION: Raise max_tokens to 6000 and add tolerant JSON-array repair (last '}' + ']')
TECHNICAL MECHANICS: supabase/functions/generate-curriculum-phases/index.ts — chatCompletion max_tokens 2500→6000; new tryParse+repair block replaces bare JSON.parse; logs "AI JSON truncated — repaired to N phase(s)" when fallback triggers
RAG KEYWORDS: dslm, curriculum, phases, roadmap, edge function, gemini 2.5 flash, max_tokens, truncation, json parse, repair, ai gateway, chat completion, generate-curriculum-phases, 500 error, JSON.parse
```

### Scope lock
Tylko fix truncation w tej jednej funkcji. Bez zmian promptu edukacyjnego, bez zmian modelu, bez refaktorów wywołań frontendu. P4/P5 nadal czekają.
