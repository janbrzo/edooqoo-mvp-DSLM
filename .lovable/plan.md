# P1 — Trwałość edycji, dostęp ucznia, media i nagrywanie

Zanim cokolwiek zmienimy: poniżej fakty potwierdzone w kodzie (file:line), potem naprawy. Nic nie ruszamy w silniku generowania worksheetów (prompty, pipeline) — wszystkie zmiany są poza `generateWorksheet/prompts/**`.

> Uwaga: z pierwotnego P0 nadal otwarte są dwa punkty — higiena eksportu PDF (`data-no-pdf`) i multi-voice TTS. Nie wchodzą do tego planu; zrobimy je osobno.

---

## P1.4 — Trwałość edycji worksheetu i świeżość tego, co widzi uczeń

**Co jest faktycznie:**
- `editableWorksheet` żyje w pamięci Reacta (`useWorksheetState.tsx:9`) i jest kopiowany do `sessionStorage` (`:108-117`) — nigdy automatycznie do bazy.
- Zapis do bazy tylko po kliknięciu **Save**: `WorksheetDisplay.tsx:601` → `updateWorksheetAPI` (`updateService.ts:7-93`), które zapisuje `ai_response` **i** przegenerowany `html_content`.
- Edycje tekstowe (tytuł, gramatyka, słownictwo, warm-up, treść ćwiczeń) wołają wyłącznie `setEditableWorksheet` — zero zapisu (`GrammarRules.tsx:46`, `WarmupSection.tsx:132`, `VocabularySheet.tsx:149/169`, `WorksheetContent.tsx:224/244/264/280`).
- **Ale** przesuwanie/usuwanie ćwiczeń zapisuje natychmiast (`WorksheetContent.tsx:229/249/269/285` → `saveWorksheetChanges`). Stąd wrażenie „część zmian zostaje, część znika”.
- Eksport PDF/HTML robi zrzut DOM (`pdfUtils.ts:6`, `#worksheet-content` w `WorksheetContent.tsx:294`) — czyli **zawsze** oddaje stan z pamięci, także niezapisany.
- Uczeń czyta **wyłącznie z bazy**: `SharedWorksheet.tsx:189-238` (RPC `get_worksheet_by_share_token` → `ai_response`), fallback `html_content` (`SharedWorksheetContent.tsx:195-226`).
- Druga, rozjeżdżająca się ścieżka zapisu: tryb edycji na stronie share (`SharedWorksheet.tsx:283-300`) aktualizuje **tylko** `ai_response`, bez `html_content`.

**Root cause:** brak jednego kontraktu zapisu. Stan edycji jest lokalny, zapis ręczny i niekompletny, a odbiorca (uczeń, PDF) czyta z dwóch różnych źródeł prawdy.

**Naprawa:**
1. Nowy hook `src/hooks/useWorksheetAutosave.ts`: debounce 2,5 s na zmianę `editableWorksheet`, wywołuje `updateWorksheetAPI`. Warunki blokujące (early return): brak `worksheetId`, brak `userId` (anonim), demo mode. Guard `isSavingRef` + kolejka „ostatni wygrywa”, żeby nie ścigać żądań.
2. Wskaźnik stanu w `WorksheetToolbar`: `Saved • HH:MM` / `Saving…` / `Unsaved changes` (retry). Przycisk Save zostaje jako wymuszenie zapisu — nie usuwamy go.
3. `SharedWorksheet.tsx:283-300` przechodzi na `updateWorksheetAPI` zamiast surowego `.update({ai_response})` — jedno źródło zapisu, `html_content` przestaje się rozjeżdżać.
4. Anonim: zamiast mylącego „saved locally” pokazujemy „Not saved — sign in to keep this worksheet” z CTA do logowania (`WorksheetDisplay.tsx:585-593`).
5. Ostrzeżenie `beforeunload`, gdy są niezapisane zmiany i użytkownik jest zalogowany, a autosave nie zdążył.
6. Blokada wysyłki share, gdy istnieją niezapisane zmiany: w `ShareWorksheetModal` wymuszamy `flushSave()` przed wygenerowaniem/wysłaniem linku. To bezpośrednio likwiduje „uczeń dostał starą wersję”.

---

## P1.5 — Generowanie z obrazkiem i ćwiczenia słownikowe

**Co jest faktycznie:**
- Obraz jest **globalny**, nie per-ćwiczenie: `generateWorksheet/index.ts:1235-1241` zapisuje `selected_image` na worksheecie; `validators.ts:325-334` wprost mówi, że `image_url` w ćwiczeniu jest opcjonalny.
- `MediaSection.tsx:83` renderuje **audio ALBO obraz** — gałąź audio robi wczesny return, więc worksheet z audio + obrazem gubi obraz.
- Tryb batch (regeneracja ćwiczeń, homework) **zeruje obraz**: `generateWorksheet/index.ts:463,468` (`selectedImage: null`) mimo że typy `-picture` są w `targetExerciseTypes`. `HomeworkExerciseRenderer.tsx` nie renderuje żadnego `<img>`/`MediaSection`.
- Słownictwo: walidator akceptuje `exercise.pairs` jako równoważne `items` (`validators.ts:257-274`), ale **nie przepisuje** ich na `items`; renderer wymaga wyłącznie `items` (`ExerciseSection.tsx:894`, `:1219`) → puste ćwiczenie bez błędu.
- `categorize` nie ma realnej walidacji (`validators.ts:88-91`), a wszystkie te typy są w `NEW_EXERCISE_TYPES`, więc błąd walidacji jest degradowany do `console.warn` i wadliwe ćwiczenie i tak trafia do bazy (`validators.ts:128-136`).
- `error_logs` z 90 dni: jeden wpis (`validation`, za długi prompt). Awarie nie były więc twarde — to ciche puste sekcje.

**Naprawa (bez dotykania promptu):**
1. **Normalizator kształtu po stronie odbioru** — nowy `src/lib/worksheet/normalizeExercise.ts`: `items ??= pairs ?? words ?? []`, spójne pola `left/right`, `word/definition`. Wołany w jednym miejscu przy hydratacji worksheetu (parsowanie `ai_response`) oraz w `HomeworkExerciseRenderer`. To naprawia puste `matching`/`synonyms`/`antonyms` bez zmiany generatora.
2. `MediaSection.tsx`: renderuje **oba** media (najpierw obraz, potem audio) zamiast `return` w gałęzi audio.
3. Batch/homework: przepuszczamy `selectedImage` gdy `targetExerciseTypes` zawiera typ `-picture` (`generateWorksheet/index.ts:463,468` — zmiana warunku, nie promptu), a `HomeworkExerciseRenderer` dostaje `MediaSection` z `originalFormData.selectedImage`.
4. **Fallback zamiast cichej pustki:** gdy ćwiczenie typu `-picture` nie ma dostępnego obrazu, renderujemy widoczny placeholder „Picture missing — regenerate or attach an image” zamiast instrukcji odsyłającej do nieistniejącego obrazka. To samo dla pustego `items` — komunikat + przycisk Regenerate.
5. Logowanie do `error_logs` (severity `warning`, `error_code: exercise_shape`) przy każdym ćwiczeniu, które po normalizacji nadal jest puste — żebyśmy mieli dane, a nie domysły.

---

## P1.6 + P1.7 — Dostęp ucznia (`/my`) i domyślna wersja share

**Co jest faktycznie:**
- `/my` **nie ma prawdziwego auth**: guard to `localStorage['student_hub_email']` (TTL 30 dni, `useStudentHubData.tsx:4-20`), powtórzony w każdej podstronie (`StudentHubDashboard.tsx:15-19` itd.). Google Sign-In tylko **wypełnia pole e-mail** (`HubGoogleSignInButton.tsx:67-76`) — nie tworzy sesji.
- Ślepe zaułki: teacher bez `hub_token` → „No teachers found” (`find-teachers-by-student-email/index.ts:52-53`); e-mail Google ≠ `students.student_email` → „No teachers found” / „email not authorized” (`SharedWorksheetEmailVerification.tsx:43`); worksheet bez `student_id` → twarda ściana „Student Not Assigned” (`SharedWorksheet.tsx:208-209,364-381`).
- Brak jakiegokolwiek mostu z `/shared/:token` do `/my` — uczeń nigdy nie odkrywa Huba.
- **Wersja ucznia JEST domyślna** przy share: odpowiedzi pokazują się dopiero po `isSubmittedForReview` (`SharedWorksheet.tsx:616,662`). Ten zarzut nie jest bugiem — nic tu nie zmieniamy poza komunikacją.

**Naprawa:**
1. Zamiana wszystkich ślepych „No teachers found” na diagnostyczne komunikaty: (a) e-mail nierozpoznany → „We couldn't find this email in your teacher's student list. Ask your teacher to check the email address they registered.”; (b) nauczyciel bez `hub_token` → osobny kod odpowiedzi z edge function + komunikat „Your teacher hasn't enabled the Student Hub yet.”
2. Auto-provisioning `hub_token`: przy pierwszym `find-teachers-by-student-email` dla nauczyciela bez tokenu generujemy go (service role) zamiast ukrywać nauczyciela. Likwiduje najczęstszy ślepy zaułek.
3. Most `/shared/:token` → `/my`: po weryfikacji e-maila w shared worksheet zapisujemy ten e-mail do `student_hub_email` i pokazujemy baner „See all your materials in your Student Hub” z linkiem do `/my`.
4. „Student Not Assigned”: zamiast ściany — jeśli `share_recipient_email` pasuje do zweryfikowanego e-maila, pozwalamy czytać worksheet read-only i pokazujemy nauczycielowi ostrzeżenie w `ShareWorksheetModal`, że worksheet nie jest przypisany do ucznia.
5. Mail przy przypisaniu jest dziś w pełni ręczny (`CreateHomeworkModal.tsx:372-379`, `ShareWorksheetModal.tsx:129-171`). W tym sprincie **nie** włączamy automatu (to P2), ale dodajemy w modalu Create Homework domyślnie zaznaczony checkbox „Notify student by email”, który po utworzeniu wywołuje istniejący `send-homework-email`.

---

## P1.8 — Nagrywanie

**Co jest faktycznie:**
- `SpeakingRecorder.tsx:184` i `HomeworkSpeakingRecorder.tsx:85` wołają `navigator.mediaDevices.getUserMedia` **bez guardu istnienia** — na insecure origin / starszej przeglądarce leci `TypeError` pokazywany jako mylące „Could not access microphone”.
- **Fałszywy sukces:** przy błędzie uploadu `SpeakingRecorder.tsx:302-307` zapisuje atrapę `recording_${Date.now()}_${seconds}s` i pokazuje „Recording saved locally”. Do bazy trafia string, który nie jest URL-em. `HomeworkSpeakingRecorder.tsx:167-169` zachowuje się inaczej (pokazuje błąd) — dwie niespójne implementacje.
- Upload idzie do Cloudflare R2 przez `upload-to-r2`, które zwraca 500 przy braku któregokolwiek z `R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT / R2_BUCKET_NAME` (`upload-to-r2/index.ts:143-149`). Konfiguracji sekretów tego projektu nie mogę odczytać z tego poziomu — **pierwszy krok wdrożenia to sprawdzenie logów `upload-to-r2`**, żeby ustalić, czy realna przyczyna to brak kluczy, czy coś innego.

**Naprawa:**
1. Wspólny moduł `src/lib/audio/recorder.ts`: `assertRecordingSupported()` (sprawdza `window.isSecureContext`, `navigator.mediaDevices`, `MediaRecorder`) z konkretnymi komunikatami: „Recording requires HTTPS”, „Your browser doesn't support recording — try Chrome or Safari”, „Microphone permission denied — enable it in your browser settings”. Rozróżnienie po `err.name` (`NotAllowedError`, `NotFoundError`, `NotReadableError`).
2. **Koniec fałszywego sukcesu:** `SpeakingRecorder` przestaje generować atrapę. Przy błędzie uploadu: status `error`, blob trzymany w pamięci, przycisk „Retry upload” (3 próby z backoffem), toast błędu. Obie implementacje zachowują się identycznie.
3. Retry uploadu: 3 próby (0,5 s / 2 s / 5 s) w `uploadBlobToR2`, potem twardy błąd + wpis do `error_logs` (`error_code: recording_upload_failed`).
4. Migracja danych: zapytanie diagnostyczne wyszukujące odpowiedzi zaczynające się od `recording_` (atrapy) — raport dla nauczycieli, które nagrania w rzeczywistości nie istnieją. Bez automatycznego kasowania.

---

## Kolejność wdrożenia

1. **P1.8** (nagrywanie) — najpierw diagnostyka logów `upload-to-r2`, potem guardy i koniec fałszywego sukcesu. Najmniejsze ryzyko, największy zysk zaufania.
2. **P1.4** (autosave + jedno źródło zapisu + flush przed share).
3. **P1.5** (normalizator kształtu ćwiczeń, media, batch-image).
4. **P1.6/P1.7** (komunikaty, auto `hub_token`, most do Huba, checkbox powiadomienia).

## Pliki

**Nowe:** `src/hooks/useWorksheetAutosave.ts`, `src/lib/worksheet/normalizeExercise.ts`, `src/lib/audio/recorder.ts`

**Modyfikowane:** `WorksheetDisplay.tsx`, `WorksheetToolbar.tsx`, `WorksheetContent.tsx`, `SharedWorksheet.tsx`, `ShareWorksheetModal.tsx`, `MediaSection.tsx`, `HomeworkExerciseRenderer.tsx`, `CreateHomeworkModal.tsx`, `StudentHubLanding.tsx`, `SharedWorksheetEmailVerification.tsx`, `SpeakingRecorder.tsx`, `HomeworkSpeakingRecorder.tsx`, `supabase/functions/find-teachers-by-student-email/index.ts`, `supabase/functions/generateWorksheet/index.ts` (tylko warunek przekazania obrazu w batch — **bez zmian w prompcie**)

**Nietykane:** prompty i pipeline generowania, `matchAnswer.ts`, RLS/schema

## Weryfikacja przed zamknięciem

1. Edycja tytułu → odczekanie 3 s → reload → zmiana obecna w bazie i u ucznia przez link share.
2. Worksheet z audio **i** obrazem → oba widoczne.
3. Homework z ćwiczeniem `-picture` → obraz widoczny albo jawny placeholder.
4. Ćwiczenie `matching` z polem `pairs` → renderuje się poprawnie.
5. Nagranie przy zablokowanym mikrofonie → konkretny komunikat, zero „saved”.
6. Nagranie przy zepsutym uploadzie → status error + Retry, brak atrapy w bazie.
7. Uczeń z e-mailem spoza listy → komunikat diagnostyczny, nie „No teachers found”.
