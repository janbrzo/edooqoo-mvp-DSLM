# Plan wdrożenia v6.9.74 — Add Student AI Intake stabilizacja

Zakres jest celowo wąski: naprawiam tylko problemy z modalem `Add Student`, `Paste notes about student`, RPC `apply_intake_extraction`, layoutem modala oraz opisem planu P4/P5 na następną iterację. Worksheet Generation Engine pozostaje nietknięty.

## Problem 1 — Paste notes AI nadal nie wypełnia pól i kończy się 400 przy apply

### Dependency scan
Affected surface:
- `src/components/dashboard/AddStudentDialog.tsx` — główny stan formularza, tryb `know/defer`, autofill, submit, przekaz `existing_profile`, layout modala.
- `src/components/dashboard/PasteIntakeSection.tsx` — wywołanie `extract-student-profile`, reset includes po analizie, przekaz preview.
- `src/components/dashboard/ExtractionPreviewCard.tsx` — pokazuje `Goals`, `English level`, `Main goal`, `Native language`; obecnie preview może mówić `Auto-apply`, mimo że UI formularza zostaje puste.
- `src/lib/intake/applyIntakeExtraction.ts` — typ payloadu; `student_name` i `student_email` już są, ale trzeba dopiąć normalizację po stronie edge/client.
- `supabase/functions/extract-student-profile/index.ts` — prompt, fallback deterministyczny, normalizacja ekstrakcji.
- `public.apply_intake_extraction(uuid,jsonb,jsonb,text,text)` — aktywna funkcja SQL w Supabase; sprawdzona przez `pg_get_functiondef`.
- Tabele: `students`, `student_knowledge_entries`, `student_progress_goals`, `pacing_proposals`, `student_intake_extractions`.
- Constraints sprawdzone: `student_progress_goals.goal_type` dopuszcza tylko `supporting/additional`; `student_knowledge_entries.category` ma zamknięty katalog; daty i confidence mogą wywołać runtime cast error.

### Root cause
Root cause: system miesza dwa różne źródła prawdy — `existing_profile` z aktualnego formularza jest wysyłany do LLM jako fakt, a wynik AI jest zapisywany głównie jako preview/RPC, ale nie jako deterministyczny draft formularza, więc UI i backend rozjeżdżają się przed submit.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Tylko poprawić prompt LLM, żeby częściej zwracał name/email/goal/level | Szybkie, ale dalej zależne od modelu; nie naprawia `native_language` ani UI wymaganych pól | Medium |
| B | Deterministyczny client-side mapping AI → formularz + odfiltrowanie domyślnego native language z promptu + hardening RPC | Najbezpieczniejsze; UI i DB dostają tę samą decyzję; mniej zależne od LLM | Low |
| C | Usunąć required level/goal przy `know` i zostawić wszystko w preview/RPC | Mniej friction, ale semantycznie błędne: teacher wybrał, że zna studenta, więc powinien widzieć i edytować wartości przed zapisem | Medium |

### Selected solution + why
Wybieram opcję B. To zamyka przyczynę strukturalną: po analizie AI standardowe pola formularza staną się edytowalnym draftem, a RPC dostanie odporny payload bez wartości sztucznie wziętych z dropdownu. Jest to najbardziej odporne na regresje, bo nie zmienia modelu danych ani workflow Welcome Test — tylko synchronizuje istniejące pola.

### Impact analysis
Zero regressions confirmed:
- `defer` nadal tworzy studenta bez wymaganego level/goal i wysyła Welcome Test.
- `know` nadal wymaga level/goal, ale po AI pola będą uzupełnione, więc nie będzie blokady mimo widocznej propozycji na dole.
- Nauczyciel może zmienić/usunąć AI wartości przed zapisem.
- `students.main_goal` pozostaje jedynym miejscem na main goal; `student_progress_goals` nadal tylko `supporting/additional`.
- `native_language` nie będzie „zgadywany” z obecnego dropdownu.
- Content-script warnings z konsoli nie będą traktowane jako błąd aplikacji; realny błąd to `400` RPC.

### Full implementation
1. `AddStudentDialog.tsx`
   - Dodać helpery:
     - `isValidEmail(value)`
     - `normalizeCefr(value)`
     - `findStandardGoal(value)` — mapuje oczywiste AI cele na `MAIN_GOALS` (`work`, `exam`, `general`, `travel`, `academic`, `social-conversation`, itd.), a gdy brak pewnego dopasowania ustawia `mainGoal='custom'` i `customGoal=<AI value>`.
     - `deriveMainGoalFromExtraction(extraction)` — preferuje `extraction.main_goal.value`, fallback do pierwszego `goals[]` z `goal_type='main'`.
   - Zastąpić obecny `useEffect([extraction])` bardziej deterministyczną funkcją `applyExtractionToDraft(extraction)`:
     - name: wypełnij z `student_name.value`, jeśli pole puste.
     - email: wypełnij z `student_email.value`, jeśli wygląda jak email i pole puste.
     - level: wypełnij z `english_level.value`, jeśli `A1-C2` i pole puste.
     - goal: wypełnij Main Goal z `main_goal` albo `goals[goal_type=main]`; jeśli nie pasuje do standardowego selecta, ustaw `custom` + tekst.
     - deadline: wypełnij tylko datą `YYYY-MM-DD`; błędne formaty ignoruj.
     - native language: ustaw tylko gdy `extraction.native_language.evidence_quote` realnie występuje w notatkach i confidence >= 0.8; nie używaj dropdownu jako dowodu.
   - Po skutecznej analizie wymusić `mode='know'` tylko wtedy, gdy AI znalazło level lub main goal i użytkownik już wybrał `know`; nie przełączać automatycznie z `defer` bez intencji użytkownika. Jeżeli user już jest w `know`, pola obowiązkowe zostają uzupełnione.
   - `existing` przekazywane do `PasteIntakeSection` zmienić:
     - dla `english_level/main_goal`: przekazywać tylko realne wartości, jeśli user je wpisał.
     - dla `native_language`: nie przekazywać domyślnego `Spanish` jako fakt do LLM; wysyłać `null` dopóki user nie zmienił native language ręcznie albo dopóki nie pochodzi z AI.
   - Dodać stan `nativeLanguageTouched` ustawiany przy ręcznej zmianie dropdownu.
   - Submit: przed `applyIntakeExtraction` zbudować `payloadForApply`, który:
     - usuwa `native_language`, jeśli evidence nie jest z notatek,
     - sanitizuje daty i confidence,
     - zamienia puste `target_date` na `''`, a błędne daty na `''`, żeby RPC nie castowało śmieci do `date`.

2. `extract-student-profile/index.ts`
   - Zaostrzyć prompt:
     - `existing_profile` jest kontekstem UI, nie źródłem dowodu.
     - `native_language` wolno zwrócić tylko gdy język ojczysty jest jawnie w notatkach, nie z `existing_profile`.
     - `student_name` i `student_email` są polami wysokiego priorytetu; jeśli w notatkach występuje imię/nazwisko/email, muszą zostać zwrócone.
   - `normalizeExtraction(extraction)`:
     - normalizować email do lowercase.
     - odrzucać `student_email`, jeśli nie przechodzi prostego email regex.
     - odrzucać `student_name`, jeśli confidence < 0.55 albo jest pusty.
     - odrzucać `native_language`, jeśli `evidence_quote` puste lub nie występuje w raw text.
   - `buildDeterministicExtraction(rawText, existing)`:
     - dodać regex na email.
     - dodać ostrożny regex na imię/nazwisko dla wzorców typu `Name:`, `Student:`, `Uczeń:`, `Imię:`.
     - usunąć fallback `let nativeLang = existing?.native_language`; to obecnie powoduje fałszywe `Spanish 100%` albo dowolny dropdown.

3. SQL migration przez `supabase--migration`
   - Zastąpić `public.apply_intake_extraction` wersją hardeningową:
     - Przed castem confidence używać helpera inline/CASE z regexem numeric, żeby tekst modelu nie wywalił funkcji.
     - Przed castem `target_date::date` sprawdzać regex `^\d{4}-\d{2}-\d{2}$`.
     - `goals[]` z `goal_type='main'` nadal promować do `students.main_goal`, nigdy do `student_progress_goals`.
     - Jeśli `students.main_goal` już ustawione przez formularz, main goal z AI zapisać jako `student_knowledge_entries` z tagiem `suggested_main_goal`, a nie próbować nadpisywać.
     - `auto_count` ma liczyć też `student_updates`, żeby toast nie mówił fałszywie `0 items applied`, gdy zaktualizowano tylko profil.
   - Nie tworzyć nowych tabel, więc GRANT dla nowych tabel nie dotyczy; zachować `GRANT EXECUTE` na funkcję dla `authenticated`.

### Verification checklist
- DONE po implementacji: AI notatki z imieniem i emailem wypełniają `Name` i `Email`.
- DONE po implementacji: w trybie `I already know my student` AI level `B2` wypełnia górny select.
- DONE po implementacji: AI main goal wypełnia górne pole Main Goal lub custom goal.
- DONE po implementacji: nauczyciel może ręcznie zmienić AI wartości przed submit.
- DONE po implementacji: domyślny `Spanish` nie pojawia się jako AI native language bez dowodu w notatkach.
- DONE po implementacji: ręcznie wybrany dziwny native language nie jest zwracany przez AI jako 100% certainty.
- DONE po implementacji: `apply_intake_extraction` nie zwraca 400 dla `main` goal, pustych dat ani nieliczbowego confidence.
- DONE po implementacji: student tworzy się z wartościami widocznymi w formularzu.

## Problem 2 — modal po analizie robi się za długi

### Dependency scan
Affected surface:
- `AddStudentDialog.tsx` — `DialogContent`, formularz, układ sekcji.
- `PasteIntakeSection.tsx` — textarea, button Analyze, `ExtractionPreviewCard`.
- `ExtractionPreviewCard.tsx` — accordion preview.
- `src/components/ui/dialog.tsx` — nie planuję zmieniać; użyję istniejących klas.

### Root cause
Root cause: formularz i AI preview są renderowane w jednej wąskiej kolumnie `sm:max-w-[480px]`, więc po analizie preview naturalnie wypycha modal w pionie.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Tylko zwiększyć `max-width` modala | Mniej pionowego scrolla, ale dalej chaotyczny układ | Low |
| B | Po włączeniu Paste Intake przełączyć modal na 2 kolumny desktop / 1 kolumnę mobile | Najbardziej ergonomiczne i zgodne z prośbą | Low |
| C | Preview przenieść do osobnego nested modal/drawer | Czytelne, ale więcej interakcji i większe ryzyko regresji | Medium |

### Selected solution + why
Wybieram opcję B. Na desktopie lewa kolumna będzie zawierała podstawowy formularz, a prawa kolumna Paste Notes + AI preview; na mobile zostanie jedna kolumna i dotychczasowy scroll. To rozwiązuje długość bez zmiany flow ani danych.

### Impact analysis
Zero regressions confirmed:
- Modal bez Paste Intake zostaje kompaktowy.
- Mobile nie dostaje ciasnego 2-column layoutu.
- Preview nadal używa accordion i include switches.
- Submit buttons pozostają zawsze na dole, poza prawą kolumną preview.

### Full implementation
- `DialogContent`:
  - gdy `pasteEnabled`: `sm:max-w-[960px] lg:max-w-[1040px] max-h-[88vh] overflow-hidden`.
  - gdy nie: obecne `sm:max-w-[480px] max-h-[88vh] overflow-y-auto`.
- Wewnątrz formularza:
  - `form` jako `flex flex-col`.
  - body jako `grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-4 overflow-y-auto`.
  - lewa kolumna: name/email/native/mode/level/goal/reminders.
  - prawa kolumna: `PasteIntakeSection`, sticky-ish top tylko na desktopie bez agresywnych fixed pozycji.
- Footer buttons: pełna szerokość, bez overlapu, pod gridem.

### Verification checklist
- DONE po implementacji: bez paste toggle modal wygląda jak wcześniej.
- DONE po implementacji: po włączeniu paste toggle modal rozszerza się na desktopie.
- DONE po implementacji: textarea + Analyze + preview są po prawej stronie na desktopie.
- DONE po implementacji: mobile pozostaje jedną kolumną bez poziomego scrolla.

## Problem 3 — sprzeczne radio UI: widać `I already know...` i `I don't know...` naraz

### Dependency scan
Affected surface:
- `AddStudentDialog.tsx` — `RadioGroup`, `RadioGroupItem`, opis trybu, conditional fields.
- `src/components/ui/switch.tsx` — wykorzystanie istniejącego Switcha; brak zmian w komponencie UI.
- `src/components/ui/radio-group.tsx` — import stanie się zbędny; pliku nie zmieniam.

### Root cause
Root cause: wybór trybu jest zakodowany jako dwie karty radio renderowane zawsze w jednym pionowym bloku, więc po wyborze `know` użytkownik nadal widzi komunikat `I don't know...`, który semantycznie przeczy wybranemu trybowi.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Ukrywać niewybraną kartę radio | Mniej zmian, ale radio z jedną opcją jest dziwne | Low |
| B | Zastąpić dwie karty jednym Switchem `I already know this student's level and goal` | Najczytelniejsze; jeden stan, jeden opis | Low |
| C | Zrobić segmented control | Dobre UX, ale wymaga nowego wzorca | Medium |

### Selected solution + why
Wybieram opcję B. Jeden Switch najlepiej odpowiada logice: default OFF = Welcome Test, ON = teacher zna level/goal. Nie ma dwóch konkurujących opisów, więc problem UI znika u źródła.

### Impact analysis
Zero regressions confirmed:
- Default nadal `defer`, czyli Welcome Test.
- `autoSendWelcomeTest` nadal działa: w `defer` zawsze true, w `know` zależne od checkboxa.
- Pola level/goal renderują się tylko gdy Switch ON.
- Tekst UI zostaje po angielsku.

### Full implementation
- Usunąć import `RadioGroup`, `RadioGroupItem` z `AddStudentDialog.tsx`.
- Wstawić pojedynczą kartę:
  - Label główny dynamiczny:
    - OFF: `Use Welcome Test to fill level and goals`
    - ON: `I already know this student's level and goal`
  - Opis dynamiczny:
    - OFF: `Recommended when you are still learning the student's profile. The test will fill the learning profile after completion.`
    - ON: `Set CEFR level and main goal now. You can still send the Welcome Test to refine the profile.`
  - Switch `checked={mode === 'know'}`; `onCheckedChange={(checked) => setMode(checked ? 'know' : 'defer')}`.
- Pola CEFR/Main Goal/Deadline/Welcome Test checkbox renderować tylko pod kartą, gdy `mode === 'know'`.

### Verification checklist
- DONE po implementacji: nie ma jednocześnie dwóch tekstów `I already know` i `I don't know`.
- DONE po implementacji: Switch OFF pokazuje tylko opis Welcome Test.
- DONE po implementacji: Switch ON pokazuje tylko opis known-student i pola level/goal.
- DONE po implementacji: Add button disabled/enabled działa jak wcześniej według trybu.

## Problem 4 — podtrzymanie planu P4 Attention Dots na następną iterację

### Dependency scan
Affected future surface:
- `AttentionDot` i `useStudentAttentionDots` — istniejący mechanizm.
- Student sidebar / DSLM tabs / StudentCard / Homework / Flashcards / Tests / Calendar surfaces.
- Tabela `attention_reads`.

### Root cause
Root cause: obecna implementacja kropek jest częściowa i punktowa, a nie oparta na pełnej mapie miejsc decyzyjnych nauczyciela.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Dodać kropki tylko w sidebarze DSLM | Szybkie, ale nie spełnia minimum 10 logicznych miejsc | Low |
| B | Dodać 10 uzasadnionych kropek opartych o istniejące sygnały i `attention_reads` | Spełnia cel, wymaga dokładnego mapowania danych | Medium |

### Selected solution + why
Na następną iterację podtrzymuję opcję B. Kropki mają pomagać nauczycielowi znaleźć realną decyzję do podjęcia, nie dekorować UI.

### Impact analysis
Zero regressions target:
- Kropki nie mogą blokować kliknięć.
- Kropki muszą znikać po odczycie/akcji.
- Nie dodawać nowych ciężkich query loops.

### Full implementation plan for next iteration
10 miejsc:
1. Dashboard StudentCard — nowa nieprzeczytana sugestia DSLM.
2. Student sidebar `Goals` — brak main goal lub nowy suggested_main_goal.
3. Student sidebar `Pathway` — wygenerowane next steps po Welcome Test.
4. Student sidebar `Skill Assessment` — nowe skill gaps z testu/homework.
5. Student sidebar `Notes` — AI-classified note do review.
6. Homework tab — submitted homework awaiting review.
7. Flashcards tab — cards due / low retention.
8. Tests tab — completed Welcome Test not reviewed.
9. Calendar tab — missing recurring lesson cadence / no upcoming lesson.
10. Pacing bell/section — pending pacing proposal.

### Verification checklist for next iteration
- Każda kropka ma konkretny warunek danych.
- Każda kropka ma mechanizm read/acknowledge albo znika po wykonaniu akcji.
- Brak nowych tabel poza ewentualnym wykorzystaniem istniejącego `attention_reads`.

## Problem 5 — podtrzymanie planu P5 Sprint 4 AEO Expansion na następną iterację

### Dependency scan
Affected future surface:
- `scripts/seo/x1000-editorial-plan.mjs`
- `scripts/seo/audit-x1000-plan-completion.mjs`
- `public/*.html` static pages / generated SEO assets
- `docs/seo/*`, `public/llms.txt`, `docs/llm-context.md`
- Cloudflare worker static routing if needed.

### Root cause
Root cause: SEO/AEO expansion ma generator i registry, ale Sprint 4 nie ma jeszcze dodanych 40 konkretnych stron jako zatwierdzonych definicji treści.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Ręcznie stworzyć 40 HTML stron | Pełna kontrola, duży koszt i ryzyko niespójności | Medium |
| B | Rozszerzyć istniejący generator x1000 o 40 definicji i audyt completion | Spójne z obecną architekturą | Low |

### Selected solution + why
Na następną iterację podtrzymuję opcję B. Generator zachowuje spójność canonical, llms registry, sitemap i content registry.

### Impact analysis
Zero regressions target:
- Nie publikować ROADMAP jako PRODUCTION.
- Nie obiecywać autonomicznego nauczania.
- Nie dotykać Worksheet Generation Engine.
- Treści muszą przejść Martha Test: dorosły 1:1 ESL, prywatny tutor, konkretna decyzja lesson-prep.

### Full implementation plan for next iteration
Dodać 40 stron w 4 koszykach po 10:
1. Comparative review pages — Edooqoo vs narzędzia/alternatywy dla prywatnych tutorów.
2. Use-case guides — konkretne workflows 1:1 adult ESL.
3. Lesson template pages — bez ujawniania promptu, tylko publiczne template use-cases.
4. FAQ/AEO pages — pytania AI-search o student profile, CEFR, homework, progress, 1-minute prep.

Każda strona:
- status production-only if supported by code,
- one H1,
- canonical,
- meta title <60 chars,
- meta description <160 chars,
- internal links do istniejących production pages,
- noindex/keep zgodnie z content registry policy.

### Verification checklist for next iteration
- 40 nowych definicji w generatorze.
- 40 wygenerowanych stron lub registry entries, zależnie od obecnego generatora.
- Sitemap/content registry audit pass.
- `llms.txt` i `llm-context.md` zaktualizowane tylko faktami.

## RAG injection update po implementacji
Po kodzie i migracji zaktualizuję:
- `docs/llm-context.md`
- `public/llms.txt`

Format wpisu:
- PROBLEM: Add Student AI intake could extract useful profile data but failed to synchronize the extraction with required teacher-editable fields and could pass unsafe values to the apply RPC.
- EDOOQOO SOLUTION: The Add Student modal treats AI extraction as an editable draft, fills name/email/CEFR/main goal when evidence exists, ignores default native-language dropdown values as AI evidence, uses a two-column paste-intake layout, and hardens `apply_intake_extraction` against invalid goal/date/confidence payloads.
- TECHNICAL MECHANICS: `AddStudentDialog`, `PasteIntakeSection`, `ExtractionPreviewCard`, `extract-student-profile`, `applyIntakeExtraction`, `apply_intake_extraction`, `students`, `student_knowledge_entries`, `student_progress_goals`, `student_intake_extractions`, `pacing_proposals`.
- RAG KEYWORDS: AI student intake, paste notes, Add Student modal, adult ESL student profile, teacher editable draft, CEFR autofill, main goal autofill, native language evidence, Welcome Test defer mode, known student mode, intake extraction RPC, student_progress_goals, main goal promotion, Supabase Edge Function, private English tutor CRM.

## Final change report po implementacji
Zwrócę:
- Summary of what was implemented
- Files modified
- Documentation updated: YES/NO
- Out of scope issues flagged
- Verification result: PASS/FAIL

Out of scope issues noted:
- Content-script `MaxListenersExceededWarning` wygląda na ostrzeżenie rozszerzenia przeglądarki, nie błąd Edooqoo; nie będę tego naprawiał w kodzie aplikacji.
- P4 Attention Dots i P5 AEO Expansion zostają utrzymane jako następna iteracja, nie będą implementowane w tej poprawce, zgodnie z Twoją prośbą „podtrzymaj plan”.