# v6.9.95 — Faza E (filtry error_logs) + degradacja `validation` do błędu formularza

## Diagnoza (zweryfikowana w kodzie)

Mail z 18.08 06:55 UTC to ten sam przypadek co wcześniej (opis świec wklejony w „Lesson focus”), ale pokazuje lukę, której Faza A nie zamknęła:

1. `supabase/functions/generateWorksheet/index.ts:373-391` — po nieudanym `validatePrompt()` funkcja woła `notifyGenerationFailure('validation', ...)`. Backend nadal traktuje błąd wypełnienia formularza jak awarię aplikacji: mail + (po Fazie D) wiersz w `error_logs` z `severity: 'error'`.
2. Guard w `src/components/WorksheetForm/index.tsx:498-513` liczy tylko `PROMPT_SCAFFOLD_RESERVE (2600) + długości pól`. To szacunek — realny prompt składa `format-worksheet-prompt` i bywa dłuższy (lista ćwiczeń, drabinki CEFR/style). Przy 4900 znaków szacunku i 5100 realnych request i tak wystartuje.
3. `src/hooks/useWorksheetGeneration.tsx:326` wysyła do `generateWorksheet` **dokładny** `fullPrompt` zwrócony przez `format-worksheet-prompt` — czyli mamy w kliencie punkt, w którym znamy prawdziwą długość jeszcze przed startem generowania. Dziś nie jest sprawdzany.
4. `src/pages/AdminErrorLogsPage.tsx` ma filtry `severity`, `component`, `showResolved`, `search` — brak filtra po `error_code` i brak licznika 7-dniowego (Faza E planu v6.9.94).

## Zakres zmian

### 1. `validation` przestaje być incydentem aplikacji (backend)

`supabase/functions/generateWorksheet/index.ts`:
- Usunąć wywołanie `notifyGenerationFailure('validation', ...)` z bloku `!promptValidation.isValid`. Zostaje `console.warn` z tymi samymi polami diagnostycznymi (długość promptu, userId) oraz odpowiedź `400` z komunikatem user-facing — bez maila i bez wiersza w `error_logs`.

`supabase/functions/notify-generation-failure/index.ts` (obrona w głąb — gdyby inny wywołujący przysłał ten typ):
- Nowy zbiór `CLIENT_INPUT_TYPES = new Set(['validation'])`.
- Gdy `errorType` należy do tego zbioru: brak zapisu do `error_logs`, brak maila, zwrot `200 { skipped: true, reason: 'client_input_error' }` i `console.log`. Check jako pierwszy w handlerze, przed `logError`.

Efekt: „Your lesson details are too long…” nigdy nie generuje maila ani wpisu error.

### 2. Twardy pre-flight w kliencie (generowanie w ogóle nie startuje)

`src/hooks/useWorksheetGeneration.tsx`, tuż po otrzymaniu `fullPrompt` z `format-worksheet-prompt`, a przed `streamWorksheetGeneration`:
- Jeśli `fullPrompt.length > PROMPT_HARD_LIMIT` (5000):
  - nie ustawiać `streamingStarted`, nie tworzyć 4-minutowego timeoutu, nie wywoływać edge function,
  - `setIsGenerating(false)`, `setStreamProgress(null)`,
  - `setGenerationError('Your lesson details are too long (X characters, limit 5000). Please shorten the lesson focus or additional information.')`,
  - `return`.
- Limit importowany jako `PROMPT_HARD_LIMIT` z `src/components/WorksheetForm/constants.ts` (jedno źródło prawdy, już istnieje).

`src/components/WorksheetForm/index.tsx`:
- Guard szacunkowy zostaje bez zmian (łapie oczywiste przypadki jeszcze przed requestem do `format-worksheet-prompt`).

### 3. Faza E — filtry w `/admin/error-logs`

`src/pages/AdminErrorLogsPage.tsx`:
- Nowy stan `errorCode` (domyślnie `'all'`) + `<Select>` obok filtrów severity/component. Opcje: `all` + kody obecne w pobranych logach (`Array.from(new Set(logs.map(l => l.error_code).filter(Boolean))).sort()`).
- `filteredLogs` rozszerzone o `if (errorCode !== 'all' && l.error_code !== errorCode) return false;`.
- Nad listą pasek „Last 7 days”: liczba logów z `created_at >= now-7d` w rozbiciu `error/fatal` vs `warning` oraz top 3 `error_code` z licznikami (`<Badge>`, klik ustawia filtr `errorCode`).
- Bez zmian w zapytaniu (nadal `limit(200)`), bez nowych tabel i migracji.

## Poza zakresem
- Silnik generowania arkuszy i treść promptu — nietykane.
- Zmiana limitu 5000 w `generateWorksheet/security.ts` (pozostaje).
- Historyczne wiersze `validation` w `error_logs` — nie kasujemy.

## Weryfikacja
- Wklejenie ~6000 znaków rozbitych na kilka pól: request do `generateWorksheet` nie wychodzi (Network), modal pokazuje czytelny komunikat, brak maila.
- Ręczny POST do `notify-generation-failure` z `errorType: 'validation'`: odpowiedź `skipped: client_input_error`, brak przyrostu w `error_logs`.
- `/admin/error-logs`: filtr po kodzie zwęża listę, pasek 7-dniowy zgadza się z liczbą wierszy.
- Typecheck projektu.
- Aktualizacja `docs/llm-context.md` + `public/llms.txt` (taksonomia: `validation` = client input error, nie incydent) i rekord `mem://features/worksheet-generation/failure-alert-taxonomy`.