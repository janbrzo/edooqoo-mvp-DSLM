# v6.9.94 — Worksheet generation reliability & alert truthfulness

## Co się faktycznie stało (zweryfikowane)

Sprawdziłem kod, tabelę `worksheets`, `error_logs` i logi edge functions. Trzy różne problemy zostały wrzucone do jednego worka „błędy generowania”:

1. **`validation` — "Prompt must be less than 5000 characters" (3 maile, 17.08)**
   To NIE jest bug backendu. Użytkownik wkleił w pole „Lesson focus / lessonGoal” pełny opis produktu (świece, kilka akapitów). Zweryfikowane fakty:
   - `supabase/functions/format-worksheet-prompt/index.ts` skleja prompt z pól formularza **plus** ok. 1,5–2,5 tys. znaków stałych wytycznych (language style ladder + CEFR ladder). Sam scaffolding zjada połowę budżetu.
   - `supabase/functions/generateWorksheet/security.ts:32` odrzuca prompt dłuższy niż 5000 znaków (HTTP 400).
   - W formularzu (`src/components/WorksheetForm/FormField.tsx`) **nie ma żadnego `maxLength`** ani licznika znaków — nic nie powstrzymuje wklejenia 6 tys. znaków.
   - `src/services/worksheetStreamService.ts` przy `!response.ok` rzuca `HTTP 400:` — **bez treści błędu z serwera**, więc nauczyciel widzi generyczny komunikat i próbuje ponownie (stąd 3 identyczne maile w 7 minut).
   Root cause: brak budżetu znaków w UI + brak propagacji komunikatu 400.

2. **`client_stream_lost_pending_db_reconciliation` (16.08, 22:32)**
   Alert mówi „Stream EOF after 8/8”. W bazie NIE ma arkusza „pet peeves” z 20:32 UTC — jest dopiero z 22:37 (ponowna próba, udana, 128 s). Czyli to była realna utrata, ale alert wysyłany jest **natychmiast**, zanim poller DB (`useActiveWorksheetGenerationJob`, co 5 s) zdąży ustalić, czy arkusz się zapisał. Dziś z maila nie da się odróżnić „user stracił tylko podgląd” od „user stracił arkusz”.
   Kontekst: EOF nastąpił po fazie streamowania, w oknie repair/save — repair keepalive leci co 5 s, klient ma watchdog 45 s, więc to nie timeout klienta, tylko zerwanie połączenia / restart workera.

3. **`parse_recovered` (16.08, 22:37)** — to **nie jest awaria**. Arkusz zapisał się poprawnie (`worksheets` 22:37:53, 43 577 znaków `ai_response`), Gemini zwrócił uszkodzony JSON, pipeline naprawił go AI-fallbackiem. Alert idzie z tym samym czerwonym nagłówkiem „Worksheet Generation Failed” co realne awarie. To sygnał jakości, nie incydent.

4. **`error_logs` jest puste** (0 wierszy z ostatnich 4 dni), mimo że mail linkuje do `/admin/error-logs`. Powód: `notify-generation-failure` tylko wysyła e-mail przez Resend — **nigdy nie zapisuje wiersza** do `error_logs` (helper `supabase/functions/_shared/logError.ts` istnieje, ale nie jest tu użyty). Efekt: brak historii, brak trendów, przycisk w mailu prowadzi na pustą stronę.

## Co zrobimy (5 zmian, bez dotykania silnika generacji arkuszy)

Silnik promptu worksheeta (`composeSystemMessage`, treść promptu) pozostaje nietknięty.

### A. Budżet znaków w formularzu (usuwa błędy `validation`)
- `src/components/WorksheetForm/FormField.tsx`: dodać opcjonalne propsy `maxLength?: number` i `showCounter?: boolean`; gdy podane — atrybut `maxLength` na polu + licznik `123 / 500` pod polem (`text-muted-foreground`, powyżej 90% limitu `text-destructive`).
- `src/components/WorksheetForm/index.tsx`: limity spójne z `src/utils/securityUtils.ts:332-337`, wyeksportowane jako `FIELD_LIMITS` w `src/components/WorksheetForm/constants.ts`: `lessonTopic 200`, `lessonGoal 500`, `grammarFocus 1000`, `additionalInformation 1000`.
- Guard przed submitem: szacowana długość promptu (suma pól + `PROMPT_SCAFFOLD_RESERVE = 2600`); powyżej 5000 → toast „Your lesson details are too long (≈X characters). Please shorten the lesson focus.” i brak wysyłki (oraz brak alertu e-mail).

### B. Prawdziwy komunikat błędu z backendu do UI
- `src/services/worksheetStreamService.ts`, blok `if (!response.ok)`: odczytać body (`await response.json().catch(() => null)`) i rzucić `new Error(body?.error || 'HTTP ' + status)`. Nauczyciel widzi realną przyczynę zamiast „HTTP 400”.
- `supabase/functions/generateWorksheet/security.ts`: komunikat user-facing „Your lesson details are too long. Please shorten the lesson focus and try again.” (limit pozostaje 5000).

### C. Alerty mówiące prawdę (koniec fałszywych „FAILED”)
- `src/hooks/useWorksheetGeneration.tsx` (~403): **nie wysyłać** alertu `client_stream_lost_pending_db_reconciliation` od razu. Zapisać `pendingStreamLossAlert` w job registry; alert wysyła poller (`src/hooks/useActiveWorksheetGenerationJob.tsx`) po 60 s i tylko jeśli arkusz NIE został znaleziony — wtedy typ `client_stream_lost_no_saved_worksheet` (już obsłużony w `notify-generation-failure`). Jeśli arkusz się odnajdzie: zero maila, wpis w `error_logs` jako `severity: 'warning'`.
- `supabase/functions/notify-generation-failure/index.ts`: rozdzielić dwie klasy:
  - `SEVERITY_INFO = ['parse_recovered']` → żółty nagłówek „Worksheet saved with AI repair (quality signal)”, temat `Quality signal: parse_recovered — <teacher>`, bez słowa „Failed”.
  - reszta → obecny czerwony szablon „Worksheet Generation Failed”.
- Deduplikacja: mapa w module (`${errorType}|${userId}` → timestamp), okno 10 minut — identyczny typ dla tego samego usera nie generuje drugiego maila, zamiast tego inkrementuje `occurrences` w `error_logs`. To rozwiązuje serię 3 maili o świecach.

### D. Zapis do `error_logs` (mail przestaje linkować w pustkę)
- `notify-generation-failure` importuje `logError` z `_shared/logError.ts` i przed wysyłką maila wstawia wiersz: `source_name: 'generateWorksheet'`, `component: 'worksheets'`, `error_code: errorType`, `severity`: `warning` dla `parse_recovered` i `client_stream_lost_pending_db_reconciliation`, `error` dla reszty, `context: { model, promptPreview, clientGenerationId, teacherEmail }`, `user_id: userId`.
- Zapis wykonujemy **zawsze**, także gdy brak `RESEND_API_KEY` lub gdy dedup blokuje mail.

### E. Widoczność jakości (bez nowych tabel)
- `src/pages/AdminErrorLogsPage.tsx`: filtr po `error_code` z presetami `validation`, `parse_recovered`, `client_stream_lost_*`, `quota`, `timeout` oraz licznik „ostatnie 7 dni” nad listą.

## Kolejność wdrożenia
1. A + B (frontend — natychmiast kasuje najczęstszy błąd i mylący komunikat)
2. D (`logError` w `notify-generation-failure`) → deploy
3. C (rozdzielenie severity + dedup + odroczony alert stream-loss) → deploy
4. E (filtr w adminie)
5. Aktualizacja `docs/llm-context.md` + `public/llms.txt` (sekcja „Worksheet generation failure taxonomy”: validation / parse_recovered / client_stream_lost_* — definicje i który jest realną awarią) + rekord `mem://features/worksheet-generation/failure-alert-taxonomy`.

## Weryfikacja (checklist po wdrożeniu)
- Wklejenie 6000 znaków w „Lesson focus”: pole ucina na 500, licznik czerwony, brak requestu do edge function, brak maila.
- Sztuczne 400 z backendu: modal pokazuje treść z serwera, nie „HTTP 400”.
- Symulacja `parse_recovered`: mail żółty „quality signal”, wiersz w `error_logs` z `severity=warning`.
- Symulacja utraty streamu z zapisanym arkuszem: brak maila, wiersz warning, arkusz dociąga się przez poller.
- `select error_code, count(*) from error_logs group by 1` zwraca dane (dziś: 0 wierszy).

## Poza zakresem (zanotowane, nie ruszam)
- Przyczyna EOF po stronie edge runtime (możliwy limit czasu workera przy generacjach powyżej 120 s) — wymaga osobnego pomiaru p95 czasu generacji.
- `parse_recovered` przy Gemini: obniżenie temperatury / wymuszenie JSON mode dotyka silnika generacji arkuszy — objęte regułą świętości promptu, tylko za wyraźną zgodą.