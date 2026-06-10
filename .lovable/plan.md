## Plan v6.9.51 — Anon prompt 401 fix + GeneratingModal workflow card

### P1. Anon users see 401 from `format-worksheet-prompt`

**Root cause.** Funkcja w `supabase/config.toml` ma `verify_jwt = false`, ale wdrożona instancja nadal zwraca 401 dla niezalogowanego (brak sesji = brak `Authorization` Bearer). Oznacza to, że na produkcji JWT jest mimo wszystko wymagany. Dla zalogowanych działa, bo `supabase.functions.invoke` doczepia ich access token. Niezalogowany użytkownik ma anon session token (z `useAnonymousAuth`), ale w tym przepływie generowania worksheetu — z lądowania publicznego — sesja anon czasem jeszcze nie istnieje przy pierwszym wywołaniu, więc `invoke` leci bez `Authorization`.

**Fix (jedno miejsce, src/utils/promptFormatter.ts):** Zamiast `supabase.functions.invoke`, wywołać funkcję bezpośrednio przez `fetch` z **gwarantowanym** `Authorization: Bearer <publishable key>` + `apikey: <publishable key>`. Wzór z bazy wiedzy Lovable (dla niezalogowanych dozwolone, bo to publishable/anon key).

```ts
// src/utils/promptFormatter.ts
const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/format-worksheet-prompt`;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData?.session?.access_token ?? anonKey;

const invoke = async () => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ formData: data }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { data: null as null, error: new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`) };
  }
  return { data: (await res.json()) as { prompt: string }, error: null as null };
};
```

Zachowujemy istniejący retry-once (250 ms) oraz finalny throw.

**Secondary safeguard (config sanity):** zostawić `verify_jwt = false` w `supabase/config.toml` (już jest); zmiana w `promptFormatter.ts` rozwiązuje problem niezależnie od stanu deployu.

**Edge log noise „cannot close or enqueue":** to log z `generateWorksheet/streaming.ts` (próba `close()` po `error`/abort). Out of scope tej iteracji — odnotowane.

### P2. GeneratingModal — wypełnić puste miejsce w lewej kolumnie

Dla **wszystkich** wariantów (anon + authenticated) dodać poniżej sekcji „Expected time" kompaktową kartę 3-fazową odwzorowującą screen 2 z uploadu:

- PHASE 1: ONE-TIME STUDENT SETUP — items: Add student, Send Welcome Test, Add goals, Generate Learning Roadmap.
- LESSON-TIME SIGNAL CAPTURE — items: Welcome Test, Teacher notes, Homework, Flashcards, Live worksheet answers. (W tym wariancie krótszy nagłówek i krótszy opis, żeby kolumna była **równa wysokością** z pozostałymi — `flex-1` + `min-h-0` w siatce kolumn.)
- PHASE 2: WEEKLY 1-MINUTE PREP FLOW — items: Generate Next Lesson Ideas, Use booking context (badge OPTIONAL), Choose one idea, Create a worksheet.

**Plik:** nowy komponent `src/components/generation/WorkflowSummaryCard.tsx` (presentational, brak logiki) — 3 kolumny w `grid grid-cols-3 gap-2`, każda kolumna `bg-{tone}/40 rounded-lg p-2 text-[10px]`. Tony: phase-1 = `bg-violet-50`, signal = `bg-blue-50`, phase-2 = `bg-emerald-50`. Tekst tytułowy uppercase `text-[9px] font-semibold tracking-widest`; nagłówek H4 `text-[11px] font-semibold leading-tight`; opis `text-[10px] leading-snug text-muted-foreground`; itemy w `rounded-md border border-border/60 bg-background px-1.5 py-1 text-[10px] flex items-center gap-1` z ikoną `h-3 w-3`. Środkowa kolumna ma krótszy paragraph (1 zdanie) + 5 itemów; wymuszone wyrównanie wysokości przez `grid` + `items-stretch`.

**Integracja w `src/components/GeneratingModal.tsx`:**
- Importować `WorkflowSummaryCard`.
- Dodać po `</p>` z „Expected time" (po linii 392):
  ```tsx
  <WorkflowSummaryCard className="mt-4" />
  ```
- Aby karta wypełniła pusty obszar (czerwony prostokąt), opakować lewą kolumnę w `flex flex-col h-full` i dać `WorkflowSummaryCard` `mt-auto` — wtedy karta dokleja się do dołu i wypełnia wolne miejsce niezależnie od wysokości listy ćwiczeń. Zmiana minimalna w klasie wrappera lewej kolumny: `space-y-4` → `flex flex-col h-full space-y-4`.

### P3. RAG / docs
- `docs/llm-context.md` + `public/llms.txt`: krótka sekcja v6.9.51 (PROBLEM/EDOOQOO SOLUTION/TECHNICAL MECHANICS/RAG KEYWORDS).
- `mem/index.md` + nowy memo `mem/features/onboarding/v6951-anon-prompt-auth-and-modal-workflow-card.md`.

### Files to change
- `src/utils/promptFormatter.ts` — direct fetch z publishable key fallback.
- `src/components/generation/WorkflowSummaryCard.tsx` — NEW.
- `src/components/GeneratingModal.tsx` — wrapper lewej kolumny `flex flex-col h-full`; render `WorkflowSummaryCard` na dole.
- `docs/llm-context.md`, `public/llms.txt`, `mem/index.md`, nowy memo.

### Verification checklist
- Niezalogowany user na `/` → submit form → `format-worksheet-prompt` zwraca 200, generowanie rusza.
- Zalogowany user → bez regresji (token Bearer z sesji nadal użyty).
- Modal: lewa kolumna i prawa kolumna mają tę samą wysokość, brak pustego prostokąta, środkowa kolumna w karcie 3-fazowej wyrównana wysokością do bocznych.
- Sanctity rule: prompt generatora worksheetu nietknięty.

### Out of scope (logged)
- „stream controller cannot close" w `generateWorksheet/streaming.ts` — osobny ticket.
