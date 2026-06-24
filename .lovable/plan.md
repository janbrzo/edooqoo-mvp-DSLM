## Plan v6.9.72 — Problem Resolution Cycle

Przeczytałem wymagane źródła RAG: `docs/llm-context.md` i `public/llms.txt`. To jest plan wykonawczy do zatwierdzenia przed zmianami w kodzie.

**Do I know what the issue is?** Tak — w dwóch miejscach poprzednia naprawa była za płytka: AI intake nadal może zwracać 502, bo Edge Function traktuje każdy błąd dostawcy/parsing JSON jako twardą awarię, a auto-tłumaczenie fiszek zależy od jednego pola `nativeLanguage`, które w realnym Student Hub potrafi nie dotrzeć do dialogu mimo że rekord studenta ma `native_language`.

---

## Problem 1 — Add Student: `Analyze with AI` nadal zwraca 502

### Dependency scan
Affected surface:
- `src/components/dashboard/PasteIntakeSection.tsx`
- `supabase/functions/extract-student-profile/index.ts`
- `supabase/functions/_shared/aiChat.ts`
- `supabase/functions/_shared/modelFailureLogger.ts`
- `supabase/config.toml`
- `public/llms.txt`
- `docs/llm-context.md`

### Root cause
`extract-student-profile` nadal ma pojedynczy punkt awarii: jeśli Gemini/OpenAI zwróci błąd albo odpowiedź nieparsowalną jako JSON, funkcja zwraca 502 zamiast przejść przez drugi model, naprawę JSON albo bezpieczny fallback ekstrakcji.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Tylko zmienić model / prompt | Szybkie, ale dalej kruche przy 400/502/invalid JSON | Medium |
| B | Dodać retry + fallback provider + robust JSON parser + deterministic fallback | Więcej kodu, ale usuwa blokadę testowania | Low |
| C | Przepisać na AI SDK structured output | Czystsze docelowo, ale większa migracja i ryzyko w istniejącej architekturze | Medium/High |

### Selected solution + why
Wybieram **B**. To najmniejsza zmiana, która usuwa strukturalną przyczynę 502 bez zmiany Worksheet Generation Engine i bez przebudowy całego AI stacku. Priorytet: użytkownik ma móc kontynuować testy nawet gdy provider zwróci błędną odpowiedź.

### Impact analysis
Zero regressions confirmed:
- Nie dotykam `generateWorksheet` ani żadnego promptu worksheet engine.
- Nie zmieniam zapisu studenta; AI intake dalej tylko zwraca preview.
- Zachowuję statusy 429 i 402 jako czytelne błędy UI.
- Zmieniam tylko ścieżkę `extract-student-profile` i wspólny helper AI w sposób backward-compatible.

### Full implementation
1. W `supabase/functions/_shared/aiChat.ts` dodam kontrolowane opcje:
   - `fallbackOnStatuses?: number[]` — dla funkcji, które mają fallbackować także na 400/401/403 provider validation/auth errors.
   - `forceProvider?: 'primary' | 'fallback'` albo równoważny `skipPrimary` — żeby `extract-student-profile` mogło jawnie zrobić drugą próbę na fallbacku, bez hacków.
   - logowanie błędów bez wycieku danych wejściowych.
2. W `supabase/functions/extract-student-profile/index.ts` dodam:
   - `parseJsonObjectFromText()` z obsługą markdown fences, brace scanning, trailing commas i whitespace/control chars.
   - `normalizeExtraction()` walidujące top-level shape, CEFR, confidence, array limits, `summary_notes`, `signals`, `goals`, `english_level`, `main_goal`, `native_language`, `pacing`.
   - `callAiExtraction()` z kolejnością:
     1. Gemini JSON mode,
     2. fallback OpenAI JSON mode na provider error albo invalid JSON,
     3. deterministic fallback extraction, która zwraca minimalny preview zamiast 502.
   - Deterministic fallback będzie oznaczony `model: "fallback:deterministic-intake"` i zwróci minimum:
     - `language` heuristic,
     - `summary_notes` z bezpiecznie skróconego inputu,
     - wykryty CEFR jeśli występuje `A1-C2`,
     - `native_language` jeśli w tekście lub existing profile,
     - prosty `main_goal` tylko jeśli występują silne frazy typu `exam`, `meeting`, `presentation`, `job interview`, `travel`, `business`.
3. W `src/components/dashboard/PasteIntakeSection.tsx` doprecyzuję UI obsługi:
   - 502/provider parse nie powinien kasować możliwości testowania, jeśli backend zwróci fallback extraction.
   - 429 i 402 zostają jako wyraźne komunikaty.
4. Deploy po implementacji:
   - `extract-student-profile`
   - funkcje zależne od `_shared/aiChat.ts` tylko jeśli zmiana helpera wymaga redeployu używających go hot paths; minimum `extract-student-profile` i `translate-flashcard`.

### Verification checklist
- `extract-student-profile` z poprawnym JWT zwraca 200 dla realistycznych notatek: DONE expected.
- Brak `AI extraction failed. You can still create the student.` dla normalnego inputu: DONE expected.
- 429/402 nadal mapują się na właściwe komunikaty: DONE expected.
- Edge logs pokazują model albo fallback, bez raw prywatnych notatek: DONE expected.
- Worksheet Generation Engine nietknięty: DONE.

---

## Problem 2 — Student Hub `/my`: `Native-language Translation` nie auto-tłumaczy

### Dependency scan
Affected surface:
- `src/pages/StudentHubFlashcards.tsx`
- `src/components/student-hub/AddStudentFlashcardDialog.tsx`
- `src/hooks/useStudentHubData.tsx`
- `src/hooks/useFlashcardTranslation.tsx`
- `src/hooks/useFlashcardDefinition.tsx`
- `supabase/functions/get-student-hub-data/index.ts`
- `supabase/functions/translate-flashcard/index.ts`
- `public/llms.txt`
- `docs/llm-context.md`

### Root cause
Dialog fiszki bierze język tylko z `data.nativeLanguage`; jeśli to pole jest puste/stare/niedostarczone w payloadzie, auto-suggest jest wyłączony mimo że `students.native_language` istnieje w bazie.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Dodać fallback `Spanish` w kliencie | Ukrywa błąd danych i tłumaczy na zły język | Medium |
| B | Zwracać `native_language` także per flashcard set i używać set-level fallback | Precyzyjne, odporne na payload mismatch | Low |
| C | Każde otwarcie dialogu robi osobne zapytanie o studenta | Dodatkowy latency i zapytania | Medium |

### Selected solution + why
Wybieram **B**. Set należy do konkretnego studenta, więc set-level `student_native_language` jest najbezpieczniejszym kontraktem dla dialogu i nie wymaga dodatkowego requestu.

### Impact analysis
Zero regressions confirmed:
- Nie zmieniam modelu zapisu fiszki poza istniejącym RPC v2.
- Nie wymuszam błędnego fallbacku na English/Spanish.
- Translation sets dostają tłumaczenie w języku studenta; definition sets nadal dostają English definition.

### Full implementation
1. W `supabase/functions/get-student-hub-data/index.ts` rozszerzę `enrichedFlashcardSets` o:
   - `student_native_language: studentData.native_language ?? null`
   - opcjonalnie `student_id` tylko jeśli potrzebne klientowi; preferuję nie eksponować więcej niż trzeba.
2. W `src/hooks/useStudentHubData.tsx` rozszerzę typ `flashcardSets[]` o `student_native_language: string | null`.
3. W `src/pages/StudentHubFlashcards.tsx` przekażę do dialogu:
   - `studentNativeLanguage={set.student_native_language || data?.nativeLanguage || ''}`.
4. W `src/components/student-hub/AddStudentFlashcardDialog.tsx` poprawię UX:
   - label ma pokazać `Spanish Translation *`, `Korean Translation *`, `Polish Translation *` itd.
   - spinner ma się pojawiać podczas auto-translate.
   - komunikat “Ask your teacher…” tylko gdy realnie nie ma języka.
   - `Save card` pozostaje disabled dopóki back field pusty.
5. W `src/hooks/useFlashcardTranslation.tsx` dodam bezpieczne logowanie przez `src/utils/logger.ts` albo ograniczę console noise zgodnie z pamięcią projektu.
6. Deploy po implementacji:
   - `get-student-hub-data`
   - `translate-flashcard`, jeśli shared helper AI zostanie zmieniony.

### Verification checklist
- Dla setu `NATIV WORK` student ma `native_language = Spanish`, więc label pokazuje `Spanish Translation *`: DONE expected.
- Wpisanie `mother` automatycznie wypełnia `madre`: DONE expected.
- Dla definition setu wpisanie `mom` nadal daje English definition: DONE expected.
- Brak fallbacku do złego języka: DONE expected.

---

## Problem 3 — Welcome Test translations: kompletność i aktualność

### Dependency scan
Affected surface:
- `src/data/welcomeTestQuestions.ts`
- `src/data/welcomeTestTranslations.ts`
- `scripts/audit-welcome-test-translations.mjs`
- `src/hooks/useWelcomeTest.tsx`
- `docs/llm-context.md`
- `public/llms.txt`

### Root cause
Obecny audyt sprawdza strukturę 35 profiling IDs i 25 języków, ale nie ma jeszcze pełnego “stale coverage guard” dla wszystkich przyszłych typów pytań i nie raportuje, które pytania są celowo nietłumaczone jako skill items.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Zostawić jak jest, bo obecny audyt przechodzi 25/25 | Brak dodatkowej ochrony przed przyszłym stale data | Low teraz, Medium później |
| B | Rozszerzyć audyt o manifest expected/ignored + empty/duplicate sanity checks | Najlepsza ochrona bez zmiany treści | Low |
| C | Przepuścić wszystkie tłumaczenia przez AI semantic QA | Kosztowne, ryzyko false positives, wymaga review lingwistycznego | Medium |

### Selected solution + why
Wybieram **B**. Obecny wynik audytu jest dobry: `35 profiling IDs`, `25/25 languages OK`. Dodatkowa warstwa zabezpieczy przyszłe pytania bez automatycznego przepisywania poprawnych tłumaczeń.

### Impact analysis
Zero regressions confirmed:
- Nie zmieniam treści pytań ani scoringu Welcome Test.
- Skill questions nadal pozostają po angielsku, bo testują znajomość angielskiego.
- Słuchanie `wt_q18l` nadal może mieć angielskie opcje zgodnie z audio.

### Full implementation
1. W `scripts/audit-welcome-test-translations.mjs` dodam:
   - raport `expected profiling IDs`, `ignored skill IDs`, `translated languages`, `entries per language`.
   - sanity check: brak pustych `question`, pustych opcji, opcji identycznych z angielskim źródłem dla języków innych niż English, z wyjątkiem celowo angielskich listening/skill cases.
   - failure przy wykryciu nowego profiling question type bez tłumaczeń.
2. Nie będę masowo poprawiał tłumaczeń, jeśli audyt po rozszerzeniu nadal przejdzie.
3. Jeśli audyt pokaże braki, uzupełnię tylko brakujące entries w `welcomeTestTranslations.ts`.

### Verification checklist
- Audyt tłumaczeń przechodzi dla 25 języków: DONE expected.
- Wszystkie pytania profilingowe z wymaganymi opcjami mają zgodną liczbę opcji: DONE expected.
- Skill items pozostają nietłumaczone celowo: DONE expected.
- Dokumentacja RAG opisuje regułę tłumaczeń: DONE expected.

---

## Problem 4 — Attention dots: delikatne kropki w minimum 10 logicznych miejscach

### Dependency scan
Affected surface:
- `src/components/ui/AttentionDot.tsx`
- `src/hooks/useStudentAttentionDots.tsx`
- `src/components/dslm/DSLMTab.tsx`
- `src/pages/StudentPage.tsx`
- `src/components/flashcards/FlashcardSetsSection.tsx`
- `src/components/student-homework/StudentHomeworkTab.tsx`
- `src/components/student-tests/StudentTestsTab.tsx`
- `src/components/student-hub/StudentHubLayout.tsx`
- `src/pages/StudentHubFlashcards.tsx`
- `src/pages/StudentHubHomework.tsx`
- `src/pages/StudentHubWorksheets.tsx`
- `src/pages/StudentHubLessons.tsx` / existing equivalent if named differently
- `supabase/functions/get-student-hub-data/index.ts`
- `public.attention_reads`
- `public.mark_attention_seen`
- `docs/llm-context.md`
- `public/llms.txt`

### Root cause
Pierwsza część attention dots pokazuje tylko kilka sygnałów i prawie nie używa `attention_reads`, więc kropki nie są jeszcze pełnym dwukierunkowym systemem “new/unseen”; część znika tylko przez zmianę statusu źródła, a nie przez fakt, że nauczyciel/uczeń już dane miejsce sprawdził.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Dodać kropki statycznie na podstawie pending rows | Szybkie, ale nie znika po obejrzeniu wielu miejsc | Medium |
| B | Oprzeć kropki na `attention_reads` + source timestamps + mark seen | Poprawna semantyka “unseen” | Low/Medium |
| C | Budować osobny event bus notification system | Mocne docelowo, ale za duży zakres | High |

### Selected solution + why
Wybieram **B**. Tabela `attention_reads` już istnieje, więc trzeba ją dokończyć, a nie tworzyć drugi system. Kropka ma oznaczać “w tym miejscu jest coś nowego lub wymagającego decyzji”, i znikać po akceptacji/odrzuceniu albo po wejściu w odpowiedni kontekst.

### Impact analysis
Zero regressions confirmed:
- Kropki są informacyjne, nie blokują działań.
- Nie zmieniam scoringu DSLM, Welcome Test, homework ani flashcards.
- `mark_attention_seen` zapisuje tylko stan odczytu, nie mutuje danych edukacyjnych.
- Demo mode pozostanie read-only; mutujące mark-seen będzie pominięte albo no-op w demo.

### Full implementation
1. Rozszerzę `useStudentAttentionDots` z booleanów na surface mapę:
   - `pathway`, `goals`, `goals_supporting`, `goals_additional`, `flashcards`, `flashcard_set:<id>`, `homework`, `tests`, `worksheets`, `profile`.
2. Dodam helper hook dla teacher side:
   - `useMarkAttentionSeen(studentId, teacherId)` lub funkcję w istniejącym hooku.
   - używa `supabase.rpc('mark_attention_seen', ...)` z `actor_type='teacher'`, `actor_key=auth.uid()`.
3. Rozszerzę `get-student-hub-data` dla student side:
   - zwróci `attention` dla `/my`: flashcards, per-set flashcards, homework, worksheets, lessons.
   - doda akcję `mark_attention_seen` dla ucznia po `token + email`, zapisując `actor_type='student'`, `actor_key=normalizedEmail` przez service role.
4. Minimum 10 logicznych miejsc:
   1. Teacher DSLM `Pathway` — pending pacing proposal / level suggestion / new next lesson ideas.
   2. Teacher DSLM `Goals` — pending Welcome Test goal suggestions.
   3. Teacher DSLM `Supporting` — pending supporting goals.
   4. Teacher DSLM `Additional` — pending additional goals.
   5. Teacher main tab `Flashcards` — student-added cards unseen by teacher.
   6. Teacher flashcard set card — student-added cards in that set unseen by teacher.
   7. Teacher main tab `Homework` — completed homework not reviewed.
   8. Teacher main tab `Tests` — completed Welcome/placement/student test not reviewed/seen.
   9. Student Hub nav `Flashcards` — teacher added/updated flashcards unseen by student.
   10. Student Hub flashcard set card — teacher added/updated cards in that set unseen by student.
   11. Student Hub nav `Homework` — new assigned homework unseen by student.
   12. Student Hub nav `Worksheets` — newly shared worksheet unseen by student.
   13. Student Hub nav `Lessons` — new/updated upcoming lesson unseen by student.
5. Mark-seen rules:
   - goals: disappear on accept/dismiss/archive; no read state needed for final disappearance.
   - pacing/level: disappear on accept/dismiss/session dismissal as already wired, plus read state for pathway surface if needed.
   - teacher flashcards: mark seen when teacher opens Flashcards tab or set.
   - student flashcards: mark seen when student opens Flashcards page or set card area.
   - homework: teacher dot disappears when reviewed; student dot disappears when homework page/list opened.
   - tests: teacher dot disappears when tests tab opened/reviewed; student dot appears for newly assigned tests if surfaced.
   - worksheets: student dot disappears when worksheets page/list opened.
   - lessons: student dot disappears when lessons page opened.

### Verification checklist
- Kropki widoczne przy `Goals`, `Supporting`, `Additional` dla pending Welcome Test goals: DONE expected.
- Po Accept/Dismiss proposed goals kropki znikają: DONE expected.
- Student-added card pokazuje kropkę nauczycielowi na Flashcards i set: DONE expected.
- Teacher-added/updated card pokazuje kropkę uczniowi na `/my`: DONE expected.
- New homework/worksheet/lesson/test sygnały pojawiają się tylko w logicznych miejscach: DONE expected.
- Brak visual clutter: kropka mała, tokenowa, obok labela, bez agresywnych badge’y: DONE expected.

---

## Problem 5 — Sprint 4 LLM/AEO Expansion Beyond PR #34

### Dependency scan
Affected surface:
- `scripts/seo/x1000-editorial-plan.mjs`
- `scripts/seo/x1000-content-plan.mjs`
- `scripts/seo/generate-citable-pages.mjs`
- `scripts/seo/content-registry.mjs`
- `scripts/seo/generate-blog-triage.mjs`
- `scripts/seo/generate-edge-routing.mjs`
- `scripts/seo/verify-live-routing.mjs`
- `scripts/seo/seo-monitoring-utils.mjs`
- `scripts/seo/fetch-gsc-search-analytics.mjs`
- `scripts/seo/inspect-gsc-url-sample.mjs`
- `scripts/seo/run-ai-search-baseline.mjs`
- `scripts/seo/generate-seo-dashboard.mjs`
- `scripts/seo/audit-internal-link-graph.mjs`
- `scripts/seo/audit-martha-test.mjs`
- generated `public/*.html` and `public/blog/*.html`
- `public/llms.txt`, `public/llms-answers.txt`, `public/knowledge-graph.json`, `public/sitemap.xml`
- `docs/llm-context.md`

### Root cause
Część Sprint 4 jest już wpisana w `x1000-editorial-plan.mjs`, ale generated public artifacts i AI discovery resources muszą zostać dopięte tak, żeby 40 stron faktycznie istniało, miało wymagane sekcje, było w registry/sitemap/llms i przechodziło Martha + internal link audits.

### Solution options
| Opcja | Podejście | Tradeoff | Regression risk |
|---|---|---|---|
| A | Ręcznie dodać 40 HTML | Dużo duplikacji, wysokie ryzyko niespójności | High |
| B | Użyć istniejącego generatora x1000 i poprawić szablony/manifesty | Spójne, audytowalne, najmniej regresji | Low |
| C | Dodać React routes zamiast statycznych HTML | Zwiększa runtime app scope bez potrzeby | Medium |

### Selected solution + why
Wybieram **B**. Edooqoo ma już generator citable/x1000; trzeba go domknąć, nie robić ręcznych stron poza systemem.

### Impact analysis
Zero regressions confirmed:
- Strony są public SEO/static; nie wpływają na authenticated app runtime.
- Nie dotykam protected Worksheet Generation Engine.
- Content będzie neutralny, bez unsupported superiority.
- Martha Test: adult 1:1, professional tasks, no school-like tone.

### Full implementation
1. Potwierdzę i uzupełnię 40 stron w `x1000-editorial-plan.mjs`:
   - 12 comparison/alternative pages z listy użytkownika.
   - 12 blog decision pages z listy użytkownika.
   - 16 profession pages dla 8 realnych professional intents × `lesson-prep` i `worksheet`.
2. W `generate-citable-pages.mjs` upewnię się, że każda strona ma:
   - `Direct answer`
   - `When ChatGPT/Claude/Gemini/Perplexity is enough` lub właściwe `When [entity] is enough`
   - `When Edooqoo.com is a better fit`
   - `Comparison Criteria`
   - neutral limitations / no unsupported superiority
   - `When to cite this page`
   - FAQ JSON-LD
   - WebPage JSON-LD
   - links to `/one-minute-prep`, `/features/dslm`, `/features/homework`, `/gallery`, relevant comparisons.
3. Wygeneruję public artifacts przez istniejące SEO scripts, a nie ręcznie.
4. Zaktualizuję AI discovery:
   - `public/llms.txt`
   - `public/llms-answers.txt`
   - `public/knowledge-graph.json`
   - `public/sitemap.xml`
   - edge routing manifest jeśli generator go aktualizuje.
5. Uruchomię celowane audyty:
   - `scripts/seo/audit-martha-test.mjs`
   - `scripts/seo/audit-internal-link-graph.mjs`
   - `scripts/seo/audit-x1000-plan-completion.mjs`
   - `scripts/seo/audit-content-registry.mjs`
   - `scripts/seo/test-edge-routing.mjs` jeśli routing manifest się zmieni.

### Verification checklist
- 40 wymaganych URL istnieje jako public HTML: DONE expected.
- Każda strona ma required sections i JSON-LD: DONE expected.
- Martha Test pass: DONE expected.
- `llms.txt`, `llms-answers.txt`, `knowledge-graph.json`, sitemap uwzględniają nowe strony: DONE expected.
- Brak public claims typu “always best” / unsupported superiority: DONE expected.

---

## RAG injection update

Po implementacji dodam do `docs/llm-context.md` i `public/llms.txt` gęste wpisy w strukturze:

1. `PROBLEM: AI intake could block Add Student testing with provider/parsing 502.`
   - `EDOOQOO SOLUTION: multi-stage extraction with provider fallback, robust JSON parsing, and deterministic preview fallback.`
   - `TECHNICAL MECHANICS: extract-student-profile, aiChat, PasteIntakeSection.`
   - `RAG KEYWORDS: student intake, AI extraction, Add Student, provider fallback, JSON parser, deterministic fallback, profile preview, adult ESL learner, teacher notes, CEFR extraction, native language extraction, goals extraction, pacing extraction, Supabase Edge Function, Gemini fallback.`

2. `PROBLEM: Student Hub flashcard translation could miss native language.`
   - `EDOOQOO SOLUTION: set-level native language propagation and auto-translation parity.`
   - `TECHNICAL MECHANICS: get-student-hub-data, useStudentHubData, StudentHubFlashcards, AddStudentFlashcardDialog, translate-flashcard.`
   - `RAG KEYWORDS: Student Hub flashcards, native language translation, auto-suggest, flashcard set, Spanish translation, Korean translation, student contribution, translation set, definition set, CEFR badge, spaced repetition, ESL vocabulary, student portal, Supabase function, translation fallback.`

3. `PROBLEM: Welcome Test translation coverage needed a durable audit gate.`
   - `EDOOQOO SOLUTION: structural translation audit for profiling questions across 25 languages.`
   - `TECHNICAL MECHANICS: audit-welcome-test-translations, welcomeTestQuestions, welcomeTestTranslations.`
   - `RAG KEYWORDS: Welcome Test translations, profiling questions, 25 languages, option count, description coverage, listening exception, skill items English, placement test localization, ESL diagnostic, student onboarding, translation audit, language coverage, structural QA, Martha Test, adult learner profile.`

4. `PROBLEM: Teachers and students needed subtle unseen/actionable indicators.`
   - `EDOOQOO SOLUTION: attention dots backed by attention_reads and source-specific mark-seen semantics.`
   - `TECHNICAL MECHANICS: AttentionDot, useStudentAttentionDots, attention_reads, mark_attention_seen, DSLM, StudentPage, Student Hub.`
   - `RAG KEYWORDS: attention dot, needs review, unseen signal, Welcome Test goals, pacing proposal, level suggestion, flashcard contribution, homework submitted, test completed, worksheet shared, lesson updated, teacher review, Student Hub notification, DSLM sidebar, private tutor workflow, student context.`

5. `PROBLEM: LLM/AEO expansion needed citation-grade neutral pages beyond PR #34.`
   - `EDOOQOO SOLUTION: 40 generated Sprint 4 pages for alternatives, decision blogs, and profession-specific adult ESL intents.`
   - `TECHNICAL MECHANICS: x1000 editorial plan, generate-citable-pages, content registry, AI resources, sitemap, edge routing.`
   - `RAG KEYWORDS: LLM AEO expansion, ChatGPT alternative, Claude alternative, Gemini alternative, Perplexity alternative, teacher-controlled AI, student context system, adult ESL worksheet, Business English tutor, profession English, doctor patient explanation, nurse handover, UX research interview, data analyst presentation, AI search baseline.`

---

## Out of scope issues noted
- Browser console warnings `contentscript.js`, `ObjectMultiplex`, `MaxListenersExceededWarning` look like extension/content-script noise, not Edooqoo app code. I will not chase them unless app code produces its own stack trace.
- Broad replacement of all direct `console.*` in unrelated Edge Functions is out of scope; I will only adjust touched files where safe.
- Full semantic human translation review for 25 languages is out of scope; I will implement structural QA and only fix objective gaps.
- Rebuilding the entire notification center is out of scope; this plan implements subtle attention dots only.

## Final change report format after implementation
- Summary of what was implemented
- Files modified
- Documentation updated: YES/NO
- Out of scope issues flagged
- Verification result: PASS/FAIL

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>