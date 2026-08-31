# P2 — Higiena eksportu PDF/HTML, multi-voice TTS, auto-maile przy przypisaniu

Najpierw fakty potwierdzone w kodzie (file:line), potem naprawy. Silnik generowania worksheetów (prompty, pipeline `generateWorksheet/prompts/**`) pozostaje nietknięty.

---

## P2.1 — Higiena eksportu PDF / HTML (`data-no-pdf`)

**Co jest faktycznie (zweryfikowane):**
- Eksport bierze zrzut DOM kontenera `#worksheet-content` (`WorksheetContent.tsx:294`), przez `generatePDF` (`pdfUtils.ts:6`, druga ścieżka `:182`) i `htmlExport.ts:25/444`.
- Czyszczenie polega wyłącznie na usunięciu `[data-no-pdf="true"]` (`pdfUtils.ts:18/29/416/427`, `htmlExport.ts:454`).
- Atrybut `data-no-pdf` występuje dziś w **6 miejscach**: `TeacherTipBox.tsx:20`, `TeacherTipSection.tsx:24`, `TeacherNotes.tsx:6`, `RatingSection.tsx:32/61`, `FeedbackDialog.tsx:29`, `WorksheetRating.tsx:32`.
- **Nie mają go** komponenty, które leżą wewnątrz `#worksheet-content` i są czysto interaktywne:
  - `ExerciseNavSidebar.tsx` (22 wystąpienia `Button`) — renderowany wewnątrz kontenera (`WorksheetContent.tsx:316-338`),
  - `ExerciseHeader.tsx` (11 `Button`: regenerate/delete/collapse),
  - `MediaSection.tsx` (13 `Button`: Collapse/Expand, Pin, Expand image),
  - `AudioPlayer.tsx` (7 `Button`: play/pause/seek/speed),
  - `NanoSkillBadge.tsx` (7 `Button`), `AnswerStatusBadge.tsx`,
  - baner Live Session (`WorksheetContent.tsx:296-313`),
  - link „Create your own at edooqoo.com” (`WorksheetContent.tsx:349-358`) — ten **zostawiamy** świadomie (branding).
- Reguła CSS ukrywająca te elementy działa tylko w `@media print` (`index.css:313`), a html2pdf renderuje przez canvas w trybie `screen` → w PDF-ie i tak lądują przyciski.

**Root cause:** nie ma jednego kontraktu „co jest treścią, a co narzędziem nauczyciela”. Znacznik `data-no-pdf` był dodawany ad hoc do pojedynczych komponentów, więc każdy nowy element UI domyślnie trafia do eksportu.

**Naprawa (odwracalna, bez zmian logiki):**
1. Nowy plik `src/lib/worksheet/exportHygiene.ts` z jedną eksportowaną stałą:
   ```ts
   export const NO_EXPORT = { "data-no-pdf": "true" } as const;
   ```
   Używana jako `{...NO_EXPORT}` — dzięki temu wszystkie przyszłe elementy oznaczamy jednym importem, a nie stringiem.
2. Oznaczenie `data-no-pdf="true"` (tylko atrybut na wrapperze, zero zmian w logice/renderze):
   - `ExerciseNavSidebar.tsx` — root sidebaru + przycisk menu + numerowane przyciski,
   - `ExerciseHeader.tsx` — wyłącznie kontener przycisków akcji (regenerate/delete/collapse), nagłówek i tytuł zostają,
   - `MediaSection.tsx` — przyciski Collapse/Expand, Pin, Expand image (obraz i podpis zostają; audio player zostaje w wersji nauczycielskiej — patrz punkt 4),
   - `AudioPlayer.tsx` — pasek kontrolek transportu; transkrypcja zostaje (jest treścią lekcji),
   - `NanoSkillBadge.tsx` / `NanoSkillMasteryModal` trigger — cały badge,
   - `AnswerStatusBadge.tsx` — badge werdyktu (correct/review/wrong to sygnał aplikacyjny, nie treść arkusza),
   - baner Live Session `WorksheetContent.tsx:296-313`,
   - `SelectWordMode.tsx`, `LiveSessionQuickNotes.tsx`, `AddExerciseModal`/`ExerciseRegenerateModal`/`SectionRegenerateModal` triggery.
3. Twardy fallback w obu eksporterach (na wypadek nowego, nieoznaczonego UI) — dodać w `pdfUtils.ts` (obie ścieżki: linia ~18/29 i ~416/427) i `htmlExport.ts:454` usuwanie po selektorze strukturalnym:
   ```ts
   const INTERACTIVE = 'button, [role="button"], [role="dialog"], [role="tooltip"], .nav-sidebar, .nav-menu-button, .scroll-up-button';
   ```
   Zasada: usuwamy tylko elementy, które **nie** mają `data-keep-in-export="true"`. Dzięki temu jeden atrybut pozwala uratować wyjątek, gdyby jakiś przycisk był realnie potrzebny w HTML-u interaktywnym.
4. Rozróżnienie PDF vs HTML: eksport HTML (`htmlExport.ts`) ma własny, wstrzykiwany nawigator (`:505-691`) i jest interaktywny — tam usuwamy przyciski aplikacyjne, ale **zachowujemy** `<audio>` / player. W PDF usuwamy player w całości i zostawiamy transkrypcję + link do audio (tekst „Audio: <URL>”), bo w druku odtwarzacz jest bezużyteczny.
5. Weryfikacja: skrypt QA `scripts/qa/export-hygiene.mjs` — po eksporcie HTML sprawdza, że w wynikowym pliku nie ma `data-no-pdf`, ani `<button>` bez `data-keep-in-export`. Do PDF-a: `pdftoppm -jpeg -r 150` + wizualny przegląd stron (obowiązkowo, zgodnie ze standardem QA).

**Ryzyko regresji: niskie.** Zmiany to wyłącznie atrybuty + selektor usuwania w klonie DOM (oryginalny DOM nietknięty). Ryzyko punktowe: nadgorliwe usunięcie `button` wewnątrz ćwiczenia interaktywnego w eksporcie HTML — dlatego wyjątek `data-keep-in-export`.

---

## P2.2 — Multi-voice TTS

**Co jest faktycznie (zweryfikowane):**
- `generate-audio/index.ts:33-34` losuje **jeden** głos z 6 (`alloy…shimmer`) i syntetyzuje nim **cały** transkrypt (`:106-143`), łącznie z dialogami — prompt wprost dopuszcza „Conversations, dialogues” (`:50`).
- Zwracany obiekt ma jedno pole `voice` (`:202`), zapisywane jako `worksheets.audio_voice` (`WorksheetDisplay.tsx:233-234`, `types.ts:3421`).
- Fallback modeli: `gpt-4o-mini-tts` → `tts-1` (`:135-143`), upload do R2 (`:164-191`), base64 jako awaryjny fallback.
- `generate-welcome-test-audio` używa stałego `tts-1` + `nova` — **poza zakresem**, welcome test wymaga jednego, przewidywalnego głosu.

**Root cause:** pipeline traktuje transkrypt jako jeden monolityczny string; nie ma warstwy segmentacji ról, więc dialog dwóch osób brzmi jak monolog.

**Naprawa (dodatek, stara ścieżka zostaje jako fallback):**
1. Nowy moduł `supabase/functions/_shared/ttsSegmenter.ts`:
   - `parseSpeakers(transcript)` → wykrywa linie w formacie `Name:` / `A:` / `Speaker 1:` na początku linii (regex `^\s*([A-Z][\w .'-]{0,20}):\s`),
   - zwraca `{ multiSpeaker: boolean, segments: Array<{ speaker: string; text: string }> }`,
   - `multiSpeaker = true` tylko gdy są **co najmniej 2 różne** etykiety i **co najmniej 4** segmenty (próg chroni przed fałszywym trafieniem typu „Note:”).
2. `generate-audio/index.ts`:
   - Po wygenerowaniu transkryptu wołamy `parseSpeakers`.
   - Jeśli `multiSpeaker === false` → **dokładnie dzisiejsza ścieżka** (zero zmian zachowania).
   - Jeśli `true` → deterministyczne przypisanie głosów: pierwszy mówca dostaje losowy głos, kolejni — kolejne z rotacji `['alloy','nova','onyx','shimmer','echo','fable']` (nigdy dwóch tych samych obok siebie; przypisanie stabilne per etykieta).
   - TTS per segment, sekwencyjnie z limitem współbieżności 3 (`Promise` z prostym semaforem) — chroni przed rate-limitem OpenAI.
   - Sklejanie: konkatenacja bufferów MP3 (`Uint8Array`), co jest poprawne dla MPEG frame stream produkowanego przez `/v1/audio/speech` z `response_format: "mp3"`. Między segmentami wstawiamy ~350 ms ciszy z pliku stałego (stała base64 z jednym ramką ciszy, `_shared/silence-350ms.ts`) — inaczej repliki zlewają się w jedno zdanie.
   - Etykiety `Name:` **usuwamy z tekstu wysyłanego do TTS** (lektor nie ma ich czytać), ale zostają w transkrypcie zwracanym do klienta.
3. Kontrakt odpowiedzi rozszerzony o pola **dodatkowe** (żadne istniejące nie znika):
   ```json
   { "voice": "<pierwszy głos>", "voices": [{"speaker":"Anna","voice":"nova"}], "multi_voice": true, "segments": 8 }
   ```
   `voice` nadal ustawiane (kompatybilność z `audio_voice`, `MediaSection.tsx:333`).
4. Awaryjność: jeśli którykolwiek segment padnie po retry (1 ponowienie), **cała** synteza wraca do trybu single-voice na pełnym transkrypcie. Zdarzenie logujemy przez `logModelFailure` z `error_code` `model_failure` — brak cichej degradacji.
5. UI (minimalne): w `AudioPlayer.tsx` pod transkryptem pokazujemy listę „Voices: Anna (nova), Mark (onyx)” gdy `multi_voice` — element oznaczony `data-no-pdf="true"` (spójność z P2.1). Zero zmian w formularzu generowania.

**Ryzyko regresji: średnie → ograniczone przez feature flag.** Dodajemy sekret `TTS_MULTI_VOICE_ENABLED` (domyślnie `true`, ale możliwy natychmiastowy rollback bez deployu kodu). Ścieżka single-voice pozostaje bit-w-bit taka jak dziś.

---

## P2.3 — Automatyczne maile przy przypisaniu

**Co jest faktycznie (zweryfikowane):**
- `CreateHomeworkModal.tsx` ma już (z P1.6) switch „Notify student by email” domyślnie włączony → `send-homework-email`.
- Share worksheet jest **w pełni ręczny**: `ShareWorksheetModal.tsx:129-171` — nauczyciel musi wpisać e-mail i kliknąć Send; jeśli tylko skopiuje link, uczeń nie dostaje nic, a `share_recipient_email` bywa puste (ustawiane dopiero w `send-worksheet-email/index.ts:120-136`).
- Efekt zgłaszany przez nauczycieli („uczeń nie wie, że coś dostał”) bierze się z tej ręcznej ścieżki, nie z awarii wysyłki.

**Naprawa:**
1. `ShareWorksheetModal`: gdy worksheet ma przypisanego studenta z e-mailem, pole odbiorcy jest **prefill** tym adresem, a nad przyciskami pojawia się switch **„Email this worksheet to <imię>”** (domyślnie włączony). Kliknięcie „Copy link” przy włączonym switchu wysyła też maila (jednorazowo, guard `sentRef`), z jasnym toastem „Link copied + email sent to …”.
2. Brak przypisanego studenta → switch ukryty, zachowanie bez zmian (dziś działa i nie ruszamy).
3. Deduplikacja: przed wysyłką sprawdzamy `worksheets.share_recipient_email` i `last_shared_at`; jeśli ten sam adres dostał ten sam worksheet w ciągu 10 minut — nie wysyłamy drugiego maila, tylko toast „Already sent 3 min ago”. (Nowa kolumna `last_shared_at timestamptz` w `public.worksheets` — migracja z `GRANT`-ami bez zmian, kolumna dziedziczy istniejące polityki tabeli.)
4. Log wysyłek: przy błędzie Resend (`send-worksheet-email/index.ts:167`) piszemy do `public.error_logs` (`error_code: 'email_delivery'`, severity `warning`) — dziś jest tylko `console.error`, więc nie wiemy, ile maili faktycznie nie doszło.
5. `send-worksheet-email` zwraca `{ sent: true, recipient }`, żeby UI mógł pokazać prawdę zamiast optymistycznego toastu.

**Ryzyko regresji: niskie**, ale to jedyny punkt, który wysyła maile automatycznie — stąd domyślne włączenie tylko przy jawnie przypisanym uczniu + deduplikacja czasowa.

---

## Kolejność wdrożenia

1. **P2.1** (higiena eksportu) — czysto prezentacyjne, najniższe ryzyko, natychmiastowy efekt dla nauczycieli drukujących arkusze.
2. **P2.3** (auto-maile) — mała powierzchnia, wymaga jednej migracji.
3. **P2.2** (multi-voice TTS) — największa zmiana pipeline'u, wchodzi ostatnia, za flagą.

## Zakres wykluczony

- Prompt i pipeline `generateWorksheet/**` — nietykalne.
- `generate-welcome-test-audio` — zostaje single-voice `tts-1`/`nova`.
- Zmiana dostawcy TTS (ElevenLabs) — nie w tym sprincie.

## Weryfikacja przed zamknięciem

- PDF: eksport wersji student i teacher, `pdftoppm` + wizualny przegląd wszystkich stron (brak przycisków, brak sidebaru, tipy tylko w wersji teacher).
- HTML: `scripts/qa/export-hygiene.mjs` przechodzi; nawigacja wstrzykiwana nadal działa.
- TTS: dialog dwuosobowy → 2 różne głosy, brak zlewania replik; monolog → identyczny wynik jak dziś; wymuszony błąd segmentu → fallback single-voice + wpis w `error_logs`.
- Mail: share do przypisanego ucznia wysyła raz; drugi klik w 10 min nie wysyła; błąd Resend widoczny w `/admin/error-logs`.
- `docs/llm-context.md` + `public/llms.txt` zaktualizowane (PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS).
