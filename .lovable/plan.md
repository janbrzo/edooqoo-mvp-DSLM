## Odpowiedź krótko

Tak, to była **realna, nieudana generacja** (nie fałszywy alarm). Sprawdziłem bazę: w oknie 08:50–09:20 UTC 29.07 **nie zapisał się żaden worksheet**. Dopiero o 11:11 ten sam nauczyciel (`38a9fae8…`) ma zapisany worksheet „Presenting Luxury Spa Products at a Trade Fair” — czyli ponowił próbę i wtedy się udało.

Powaga: **średnia**. Nie jest to awaria systemu — to pojedynczy przypadek uszkodzonego JSON-a od modelu. Ale użytkownik stracił ~2 minuty i musiał powtórzyć generację, a alert mailowy podał mylącą przyczynę.

## Root cause (łańcuch zdarzeń)

1. `gemini-2.5-flash` zwrócił 61 269 znaków JSON z **błędem składni na pozycji 28356** (`Expected ',' or '}' after property value`) — typowo niezescape'owany cudzysłów w środku wartości tekstowej albo brak przecinka między polami.
2. `parseAIResponse` → `repairJSONStringDeterministic` (`supabase/functions/generateWorksheet/helpers.ts`) **nie ma reguły na ten przypadek**. Obecne reguły naprawiają: trailing commas, brakujące przecinki między obiektami/tablicami, brakujące dwukropki, niezbilansowane nawiasy. Nie naprawiają niezescape'owanego `"` wewnątrz stringa ani brakującego przecinka między `"a": "x"` a `"b": "y"`.
3. Odpalił się AI-REPAIR pass (10–30 s ciszy przy 61 KB wejścia). W tym czasie klientowi urwał się strumień SSE (EOF przy 8/8, phase `repairing`, 93–96%).
4. Frontend (`useWorksheetGeneration.tsx`, `onStreamEndedWithoutTerminalEvent`) poprawnie przekazał sprawę do pollingu DB i wysłał alert `client_stream_lost_pending_db_reconciliation`. Backend jednak nigdy nic nie zapisał, bo AI-REPAIR też nie dowiózł poprawnego JSON-a.

**Zdanie kluczowe:** alert jest o objawie transportowym, a prawdziwą przyczyną jest luka w deterministycznej naprawie JSON + zbyt długi, ryzykowny AI-repair na dużym wejściu.

## Zakres naprawy (proponowany)

### 1. `supabase/functions/generateWorksheet/helpers.ts` — mocniejszy repair
- Dodać **Layer 2.5: character-level JSON scanner** (bez regexów): przejście znak po znaku ze śledzeniem stanu `inString` / `escaped`; kiedy wewnątrz stringa napotka `"` po którym **nie** następuje `,`, `}`, `]`, `:` ani whitespace+jeden z nich → zescape'uje go jako `\"`. To dokładnie klasa błędu z pozycji 28356.
- Dodać regułę: brakujący przecinek między dwiema właściwościami (`"…"\s*\n\s*"key"\s*:` → wstaw `,`).
- Dodać **Layer 2.6: truncate-to-last-valid-exercise** — jeśli mimo wszystko nie da się sparsować, odciąć JSON do ostatniego kompletnego elementu tablicy `exercises` i domknąć strukturę. Lepiej oddać 7/8 ćwiczeń niż zero.
- Logować, która warstwa naprawiła (`json_repair_layer: "escape-scan" | "comma-fix" | "truncate"`) — do audytu skuteczności.

### 2. `supabase/functions/generateWorksheet/index.ts` — AI-REPAIR bez utraty klienta
- Przed AI-repair wysłać SSE `progress` z `phase: "repairing"` i **keepalive co 3 s** (dziś jest komentarz o keepalive przy linii ~719 — zweryfikować, że faktycznie tyka w całym oknie repair).
- Ograniczyć wejście AI-repair: zamiast wysyłać 61 KB, wysyłać **tylko uszkodzony fragment** (±3000 znaków wokół pozycji błędu zgłoszonej przez `JSON.parse`) z prośbą o zwrot samego naprawionego fragmentu. Skraca to repair z ~25 s do ~3 s i drastycznie zmniejsza szansę na EOF.

### 3. `supabase/functions/notify-generation-failure` — czytelniejszy alert
- Dla `errorType: client_stream_lost_pending_db_reconciliation` dodać **opóźnioną weryfikację**: sprawdzić po fakcie, czy dla `clientGenerationId` istnieje wiersz w `worksheets`. Jeśli tak → nie wysyłać maila (odzyskane). Jeśli nie → wysłać z typem `generation_lost_confirmed` i sensowną sekcją „Proposed Solution” (dziś: „Unknown error”).

### 4. RAG
- `docs/llm-context.md` + `public/llms.txt`: wpis PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS dla warstwy odporności JSON.

## Uwaga o zakresie (Sanctity Rule)

Wszystkie zmiany dotyczą **parsowania i transportu odpowiedzi**, nie promptu generującego worksheety. Prompt Worksheet Generation Engine pozostaje nietknięty.

## Ryzyko regresji

Niskie. Nowy scanner escape'ujący działa wyłącznie na ścieżce, która dziś i tak rzuca wyjątkiem (po nieudanym `JSON.parse` + nieudanym repair deterministycznym). Poprawne odpowiedzi parsują się w Attempt 1 i nie dotykają nowego kodu.

## Czy trzeba naprawiać teraz?

Nie jest to pożar — retry działa. Ale ta klasa błędu będzie wracać przy długich worksheetach (8 ćwiczeń, >60 KB), więc rekomenduję zrobić punkty 1 i 2 w tym sprincie, a 3 jako drobny follow-up (przestanie Ci przychodzić mail o „awarii”, która się sama naprawiła).
