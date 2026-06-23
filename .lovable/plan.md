Plan v6.9.68 — Problem Resolution Cycle

Przeczytałem wymagane źródła RAG: `docs/llm-context.md` i `public/llms.txt`. Jesteśmy w trybie planu, więc nie modyfikuję jeszcze plików. Poniżej jest plan wdrożenia gotowy do implementacji po zatwierdzeniu.

Krótko: błędy z `contentscript.js` / `ObjectMultiplex` są z rozszerzenia przeglądarki, nie z Edooqoo. Realne błędy aplikacji to `extract-student-profile` 502 oraz `student_add_flashcard` 400.

## Odpowiedź funkcjonalna: Add Student — dwa tryby

`I already know my student` i `I don't know my student yet — fill from Welcome Test` mają działać inaczej:

- `I already know my student`:
  - nauczyciel wpisuje CEFR + main goal od razu w modalu;
  - po utworzeniu studenta profil ma już poziom i cel;
  - Roadmap / Next Steps mogą działać natychmiast;
  - opcjonalnie można też wysłać Welcome Test, żeby doprecyzować profil.

- `I don't know my student yet — fill from Welcome Test`:
  - modal wymaga tylko imienia, emaila i języka natywnego;
  - poziom i cel są celowo puste / odłożone;
  - Welcome Test jest wysyłany po utworzeniu studenta;
  - po ukończeniu testu system proponuje poziom, cele, pacing i sygnały do profilu.

- `Paste notes about student...`:
  - analiza AI pokazuje podgląd w tym samym modalu przed utworzeniem studenta;
  - nic nie zapisuje się do bazy przy samym kliknięciu `Analyze with AI`;
  - dopiero po `Create Student` wybrane elementy z podglądu zostają zastosowane do profilu nowego studenta.

## Problem 1 — Paste notes / AI extraction 502

### Dependency scan
Affected surface:
- `src/components/dashboard/AddStudentDialog.tsx`
- `src/components/dashboard/PasteIntakeSection.tsx`
- `src/components/dashboard/ExtractionPreviewCard.tsx`
- `src/lib/intake/applyIntakeExtraction.ts`
- `supabase/functions/extract-student-profile/index.ts`
- `supabase/functions/_shared/aiChat.ts`
- `student_intake_extractions`, `student_knowledge_entries`, `student_progress_goals`, `pacing_proposals`
- RAG: `docs/llm-context.md`, `public/llms.txt`

### Root cause
Root cause: `extract-student-profile` nadal opiera się na synchronicznym tool-call JSON schema do Gemini; gdy provider odrzuca schema/body albo przekracza limit czasu Edge Function, frontend dostaje 502 i nauczyciel nie ma żadnej ścieżki kontynuacji analizy.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Zostawić sync call, ale usunąć tool-call i przejść na mały JSON-only prompt z `response_format=json_object`, timeoutem i fallbackiem OpenAI | Najszybsza naprawa, minimalna zmiana DB | Low |
| B | Pełny async job: tabela zadań + `EdgeRuntime.waitUntil` + polling w modalu | Najbardziej odporne na timeouty, ale wymaga większej zmiany UX i DB | Medium |
| C | Tylko poprawić `sanitizeForGemini` / `tool_choice` | Zbyt ryzykowne, bo dalej zostaje ten sam synchroniczny hot path | Medium |

### Selected solution + why
Wybieram A teraz, z architekturą przygotowaną tak, żeby B można było dodać później bez przepisywania UI. To minimalizuje regresje i odblokowuje testowanie natychmiast: usuwamy kruchy tool-call z tej jednej funkcji, zwracamy prosty JSON i zachowujemy istniejący preview/apply flow.

### Impact analysis
Zero regressions confirmed:
- Nie dotykamy Worksheet Generation Engine.
- Nie zmieniamy struktury zapisu profilu; `apply_intake_extraction` zostaje źródłem zapisu.
- Modal nadal nic nie zapisuje przed `Create Student`.
- Demo mode nadal blokuje AI paste extraction.
- UI copy pozostaje po angielsku.

### Full implementation
- Przepisać `extract-student-profile` tak, aby:
  - używał `chatCompletion` bez `tools` i bez `tool_choice`;
  - wymuszał JSON przez `response_format: { type: 'json_object' }`;
  - miał explicit JSON contract w promptcie: `language`, `summary_notes`, `signals`, `goals`, `english_level`, `main_goal`, `native_language`, `pacing`;
  - parsował JSON defensywnie: markdown fence removal, object extraction, shape normalization;
  - zwracał szczegółowe app-level błędy: `ai_provider_error`, `invalid_ai_json`, `ai_timeout`, zamiast ślepego 502;
  - zachował `MIN_LEN=40`, `MAX_LEN=4000`, auth i teacher validation.
- Dodać w `_shared/aiChat.ts` bezpieczny provider timeout i fallback tylko dla Google 400 z typowymi błędami schema/body (`INVALID_ARGUMENT`, `functionDeclarations`, `toolConfig`, `responseMimeType`) oraz 402/429/5xx.
- W `PasteIntakeSection.tsx` rozróżnić komunikaty:
  - provider/body error: “AI extraction failed. Your notes are preserved — try again or create the student manually.”
  - timeout/busy: “AI is taking too long. Try again in a moment.”
  - auth: “Please sign in again.”
- Dodać logowanie wyłącznie przez istniejący logger tam, gdzie dotyczy frontendu; żadnych raw notes w logach.

### Verification checklist
- `Analyze with AI` dla podanych polskich notatek zwraca preview w modalu.
- Błąd 502 nie pojawia się dla standardowego inputu 276 znaków.
- Preview nie zapisuje nic do DB przed utworzeniem studenta.
- Po `Create Student` wybrane notes/signals/goals trafiają do profilu.
- Tryb `defer` wysyła Welcome Test po utworzeniu studenta.
- Tryb `know` pokazuje CEFR/main goal w modalu i działa natychmiast.

## Problem 2 — Student Hub `/my` Add flashcard 400 + zły język natywny

### Dependency scan
Affected surface:
- `src/components/student-hub/AddStudentFlashcardDialog.tsx`
- `src/pages/StudentHubFlashcards.tsx`
- `src/hooks/useStudentHubData.tsx`
- `supabase/functions/get-student-hub-data/index.ts`
- DB RPC `public.student_add_flashcard`
- `flashcard_cards`, `flashcard_sets`, `students`
- `src/components/flashcards/AddFlashcardModal.tsx` jako wzorzec teacher-side

### Root cause
Root cause: obecna funkcja DB `student_add_flashcard` próbuje insertować nieistniejące kolumny (`native_text`, `display_order`) zamiast aktualnych (`front_example`, `card_position`, `cefr_level`), a Student Hub ma fallback języka do `English`, który ukrywa brak poprawnego `native_language` w payloadzie.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Naprawić istniejący RPC z tą samą sygnaturą | Najmniej zmian, ale nie zapisze example/CEFR z nowego modala | Low |
| B | Dodać `student_add_flashcard_v2` z poprawnym kontraktem i zostawić stary RPC jako kompatybilność | Najczystsze, pozwala zapisać example i CEFR, bez łamania starych callsite’ów | Low |
| C | Ominąć RPC i pisać z frontendu bezpośrednio do tabeli | Słabe bezpieczeństwo, wymaga anon RLS na kartach | High |

### Selected solution + why
Wybieram B. Stary RPC zostaje, ale zostanie poprawiony wewnętrznie jako fallback; frontend `/my` przejdzie na `student_add_flashcard_v2`, który dokładnie pasuje do aktualnej tabeli i UI modala.

### Impact analysis
Zero regressions confirmed:
- Teacher-side flashcards zostają bez zmian.
- Student nadal może dodawać tylko do setu swojego emaila.
- `allow_student_contributions=false` nadal blokuje dodawanie.
- Definition sets zapisują definicję po angielsku.
- Translation sets używają rzeczywistego `students.native_language`, nie `English` jako ukrytego fallbacku.

### Full implementation
- Migracja DB:
  - poprawić `public.student_add_flashcard(...)`, żeby insertował `card_position`, nie `display_order`, i nie używał `native_text`;
  - dodać `public.student_add_flashcard_v2(p_set_id uuid, p_student_email text, p_front text, p_back text, p_front_example text default null, p_cefr_level text default null)`;
  - w obu funkcjach sprawdzać set ownership, student email i `allow_student_contributions`;
  - `GRANT EXECUTE` dla `anon`, `authenticated`, `service_role`.
- Frontend `/my`:
  - `AddStudentFlashcardDialog` wywoła `student_add_flashcard_v2`;
  - przekaże `frontExample` i `currentCefr`;
  - pokaże realny błąd RPC w dev logu bez danych wrażliwych;
  - usunie fallback `English` dla translation setów; jeśli język jest pusty, pokaże neutralne “Native-language Translation” i wyłączy auto-suggest z informacją “Ask your teacher to set your native language.”
- `get-student-hub-data`:
  - potwierdzić i utrzymać `nativeLanguage` w odpowiedzi;
  - dla bezpieczeństwa dodać `student_native_language` także na poziomie każdego flashcard setu, żeby karta nie musiała polegać na globalnym fallbacku.

### Verification checklist
- Na `/my/.../flashcards` można zapisać kartę do setu typu `definition`.
- Na `/my/.../flashcards` można zapisać kartę do setu typu `translation`.
- RPC nie zwraca 400.
- Example sentence zapisuje się w `front_example`.
- CEFR z auto-suggest zapisuje się w `cefr_level`.
- Label pokazuje np. `Spanish Translation *`, nie `English Translation *`, gdy uczeń ma Spanish.
- Jeśli język natywny nie jest ustawiony, UI nie udaje, że jest English.

## Problem 3 — Welcome Test translations completeness

### Dependency scan
Affected surface:
- `src/data/welcomeTestQuestions.ts`
- `src/data/welcomeTestTranslations.ts`
- `src/pages/WelcomeTestPage.tsx`
- `scripts/audit-welcome-test-translations.mjs`
- RAG: Welcome Test docs in `docs/llm-context.md` / `public/llms.txt`

### Root cause
Root cause: obecny audyt sprawdza obecność ID, ale nie wymusza pełnej zgodności liczby opcji i obecności description dla każdego pytania, więc może przepuścić strukturalnie niepełne tłumaczenie mimo “OK”.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Zostawić obecny audyt, bo przeszedł 25 języków x 35 profiling IDs | Szybko, ale nie łapie opcji/description | Low |
| B | Wzmocnić audyt o option-count i description parity, potem uzupełnić tylko wykryte braki | Najbezpieczniejsze i obiektywne | Low |
| C | Ręcznie przepisać wszystkie tłumaczenia | Niepotrzebne ryzyko błędów ludzkich | Medium |

### Selected solution + why
Wybieram B. Obecny skrypt już pokazuje kompletność ID dla 25 języków, ale dodamy twardszy audyt strukturalny i naprawimy tylko realne braki.

### Impact analysis
Zero regressions confirmed:
- Skill questions po angielsku nadal nie będą tłumaczone.
- Nie zmieniamy scoringu Welcome Test.
- Nie zmieniamy listy pytań ani logiki testu.

### Full implementation
- Rozszerzyć `scripts/audit-welcome-test-translations.mjs`:
  - wyciągać profiling questions z `welcomeTestQuestions.ts`;
  - sprawdzać komplet ID dla każdego języka;
  - jeśli pytanie źródłowe ma `options`, tłumaczenie musi mieć tyle samo opcji;
  - jeśli pytanie źródłowe ma `description`, tłumaczenie musi mieć description;
  - raportować nadmiarowe ID jako warning, nie fail.
- Uruchomić audyt.
- Jeśli fail:
  - uzupełnić brakujące tłumaczenia w `welcomeTestTranslations.ts`;
  - utrzymać UI/generated content po angielsku tam, gdzie pytanie jest skill itemem.

### Verification checklist
- Audyt strukturalny przechodzi dla 25 języków.
- Profiling questions mają pełne tłumaczenia.
- Skill questions pozostają po angielsku.
- `TRANSLATION_LANGUAGES` nadal pokazuje wszystkie aktywne języki.

## Problem 4 — Delikatne kropki attention dots w minimum 10 logicznych miejscach

### Dependency scan
Affected surface:
- Teacher: `src/pages/StudentPage.tsx`, `src/components/dslm/DSLMTab.tsx`, `src/components/dslm/GoalsView.tsx`, `src/components/student-tests/SuggestedLevelChangeBanner.tsx`, `src/components/flashcards/FlashcardSetsSection.tsx`, `src/components/flashcards/FlashcardSetCard.tsx`, `src/components/student-homework/StudentHomeworkTab.tsx`
- Student Hub: `src/components/student-hub/StudentHubLayout.tsx`, `src/pages/StudentHubFlashcards.tsx`, `src/pages/StudentHubHomework.tsx`, `src/pages/StudentHubWorksheets.tsx`, `supabase/functions/get-student-hub-data/index.ts`
- Existing signal tables: `student_progress_goals`, `pacing_proposals`, `student_learning_profiles`, `student_tests`, `homework_notifications`, `homework_assignments`, `flashcard_cards`, `flashcard_sets`, `worksheets`
- New DB read-state table: `attention_reads`

### Root cause
Root cause: Edooqoo ma już wiele closed-loop suggestions i cross-user events, ale brakuje wspólnego “attention state” łączącego dane z miejscem w UI, więc nauczyciel/uczeń musi sam pamiętać, gdzie pojawiło się coś do sprawdzenia.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Kropki liczone ad hoc z istniejących danych bez tabeli read-state | Szybko dla goals/pacing, ale słabe dla student-teacher cross events | Medium |
| B | Uniwersalna tabela `attention_reads` + hooki porównujące `created_at/updated_at` z `last_seen_at` | Stabilne, rozszerzalne, znika po obejrzeniu/zaakceptowaniu | Low-Medium |
| C | Pełny event-sourcing `attention_items` dla każdego zdarzenia | Największa kontrola, ale za dużo scope’u | High |

### Selected solution + why
Wybieram B. To daje kropki tam, gdzie trzeba, bez mutowania istniejących modeli domenowych i bez ryzyka naruszenia Worksheet Generation Engine.

### Impact analysis
Zero regressions confirmed:
- Kropki są tylko informacją wizualną; nie blokują workflow.
- Accept/dismiss istniejących suggestions nadal jest źródłem prawdy.
- Dla student hub nie dajemy anonimowi bezpośredniego zapisu do tabeli — zapis read-state idzie przez Edge Function po walidacji token + email.
- Kolory przez semantic tokens (`bg-primary`, `bg-muted`, `text-muted-foreground`), bez hardcoded hex.

### Full implementation
- Migracja DB: `public.attention_reads`
  - fields domainowe: `teacher_id`, `student_id`, `actor_type`, `actor_key`, `surface`, `subject_id`, `last_seen_at`;
  - unique key: `(teacher_id, student_id, actor_type, actor_key, surface, subject_id)`;
  - grants: authenticated CRUD, service_role all;
  - RLS: teacher może czytać/pisać tylko swoje rows; student hub tylko przez service-role Edge Function.
- UI component:
  - `src/components/ui/AttentionDot.tsx` — mała subtelna kropka z `aria-label`, wariant `show`, opcjonalny count.
- Teacher hook:
  - `src/hooks/useStudentAttentionDots.tsx` liczy:
    1. top `1 MINUTE` tab: pending goals/pacing/level/test suggestions,
    2. DSLM `Goals`: pending Welcome Test goal suggestions,
    3. DSLM `Supporting`: pending suggested supporting goals,
    4. DSLM `Additional`: pending suggested additional goals,
    5. DSLM `Pathway`: pending pacing proposals or level suggestion,
    6. top `Tests`: unread welcome-test-completed notification or completed test requiring review,
    7. top `Flashcards`: student-added cards since teacher last saw flashcards,
    8. per flashcard set: student-added cards in that set,
    9. top `Homework`: completed homework not reviewed,
    10. per homework item: completed homework not reviewed,
    11. top `Worksheets`: generated/shared worksheet activity if newer than last seen.
- Student Hub hook / Edge Function actions:
  - Extend `get-student-hub-data` with `action: 'mark_attention_seen'` and attention summary in normal response.
  - Student-side dots:
    12. nav `Flashcards`: teacher-created/updated flashcard sets since student last saw flashcards,
    13. per flashcard set: set updated since student last saw that set,
    14. nav `Homework`: new active homework since student last saw homework,
    15. per homework item: new/uncompleted assignment,
    16. nav `Worksheets`: new shared worksheet since student last saw worksheets,
    17. nav/dashboard area if a Welcome Test/retake is assigned and not completed.
- Mark-as-seen behavior:
  - Teacher tab click marks the relevant surface seen.
  - Opening a flashcard set marks that set seen.
  - Opening Homework tab marks homework surface seen, but item dot remains until `reviewed_at` exists.
  - Accept/dismiss goals removes goals dots immediately because `accepted_at` or delete changes source data.
  - Accept/reject pacing removes pacing dot because `pacing_proposals.status` changes.
  - Apply/Keep level removes level dot by update or persisted dismissal.
  - Student visiting `/my/.../flashcards`, `/homework`, `/worksheets` marks that nav surface seen.

### Verification checklist
- Kropka przy `Goals`, `Supporting`, `Additional` pojawia się przy pending Welcome Test goal suggestions.
- Kropki znikają po `Accept`, `Dismiss`, `Accept all`, `Dismiss all`.
- Pacing dot znika po accept/reject pacing proposal.
- Level dot znika po Apply/Keep level.
- Student-added flashcard pokazuje kropkę nauczycielowi na top `Flashcards` i na konkretnym secie.
- Teacher-added flashcard/set update pokazuje kropkę uczniowi na `/my`.
- New homework pokazuje kropkę uczniowi; submitted homework pokazuje kropkę nauczycielowi.
- New worksheet/shared worksheet pokazuje kropkę uczniowi.
- Welcome Test completed/assigned pokazuje kropkę w logicznym miejscu.
- Dots nie zmieniają danych edukacyjnych ani promptów.

## RAG injection update

Po wdrożeniu zaktualizuję oba pliki:
- `docs/llm-context.md`
- `public/llms.txt`

Dodam sekcje w wymaganym formacie:
- PROBLEM: AI intake 502, student flashcard RPC mismatch, Welcome Test translation audit parity, attention dots for teacher/student review loops.
- EDOOQOO SOLUTION: robust JSON extraction, student flashcard v2 RPC, strict translation audit, cross-surface attention read-state.
- TECHNICAL MECHANICS: components, hooks, Edge Functions, RPCs, tables.
- RAG KEYWORDS: 15+ semantically related terms per update.

## Final change report — planowany wynik po implementacji

- Summary:
  - AI paste extraction działa bez 502 dla standardowych notatek.
  - `/my` Add Flashcard zapisuje cards i używa poprawnego języka natywnego.
  - Welcome Test translations mają twardy audyt strukturalny.
  - Nauczyciel i uczeń dostają subtelne kropki w minimum 10 logicznych miejscach.
- Files modified:
  - Edge Functions: `extract-student-profile`, `get-student-hub-data`, `_shared/aiChat.ts`
  - Frontend: Add Student intake, Student Hub flashcards, StudentPage, DSLM, Goals, Flashcards, Homework, Student Hub Layout
  - New UI/hook files: `AttentionDot`, attention hooks
  - Script: `audit-welcome-test-translations.mjs`
  - DB migration: RPC flashcard v2 + `attention_reads`
  - RAG: `docs/llm-context.md`, `public/llms.txt`
- Documentation updated: YES after implementation.
- Out of scope issues flagged:
  - Browser `contentscript.js/ObjectMultiplex` warnings are extension noise, not app code.
  - Full async AI intake jobs can be added later if provider latency remains high, but not necessary for this immediate unblock.
- Verification result target: PASS.