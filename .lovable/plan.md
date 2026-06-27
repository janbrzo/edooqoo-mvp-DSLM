## Plan v6.9.76 — AI intake imię/email + reaktywne kropki + UX modala Add Student + P4/P5

Wszystkie zmiany są w UI/edge function/hook, bez dotykania Worksheet Generation Engine. Testy: ręcznie w modalu Add Student + na karcie DSLM po accept/reject pacing.

---

### Problem 1 — Analyze with AI nie czyta imienia i e-maila

**Dependency scan:** `supabase/functions/extract-student-profile/index.ts`, `src/components/dashboard/AddStudentDialog.tsx` (efekt mapujący ekstrakcję → formularz, linie 194‑241), `src/components/dashboard/PasteIntakeSection.tsx`.

**Root cause:**

1. `enforceEvidenceQuotes` kasuje `student_name`/`student_email`, jeśli AI zwróci nieco inny cytat niż w tekście (np. przetłumaczony lub bez wcięcia). Najpierw kasuje, dopiero potem uruchamia `enrichDeterministicIdentity`, więc fallback działa tylko jeśli AI w ogóle pominęło pole.
2. `enrichDeterministicIdentity` ma za wąskie regexy — wymagają etykiety `Name:` / `nazywa się`. W typowych notatkach typu „Maria Kowalska – Pani Maria, [maria@x.com](mailto:maria@x.com), B1, …" nic nie wpada.
3. W `AddStudentDialog` wymagamy `confidenceOf(sn) >= 0.55` zanim wypełnimy pole, ale gdy `enrich` ustawi fallbackiem confidence 0.9, wszystko ok — problem leży w tym, że fallback w ogóle nie odpalał.

**Solution options:**

- A) Wzmocnić tylko regexy `enrichDeterministicIdentity`. Niskie ryzyko, szybko, ale nadal psuje AI dla cytatów niemal dosłownych.
- B) Złagodzić `enforceEvidenceQuotes` dla `student_name`/`student_email` (porównanie po normalizacji whitespace + akcentów; e-mail traktowany jako evidence, gdy literalnie występuje w tekście) **oraz** rozszerzyć `enrichDeterministicIdentity` (kolejne 4 wzorce + heurystyka pierwszej linii nad/pod e-mailem) **oraz** dodać warstwę bezpieczeństwa w `AddStudentDialog` (`extractIdentityFallbackFromNotes` po analyze, gdy AI dalej nic nie zwróciło).
- C) Wymusić w prompt drugą turę „retry" przy braku name/email — kosztowne i powolne.

**Selected: B.** Trzy nakładające się warstwy (AI z luźniejszym evidence, regex enrich na serwerze, deterministyczny safety net w UI) eliminują regresję i działają nawet, gdy LLM zawiedzie.

**Impact analysis:** dotyka tylko ścieżki paste-intake. Inne pola (`english_level`, `main_goal`, `native_language`) zachowują surowe `enforceEvidenceQuotes`. Brak wpływu na Worksheet Engine, RPC `apply_intake_extraction` (sanityzer już clampuje wartości). Zero regresji w demo mode (Paste blokowany).

**Implementation (gotowy kod):**

`supabase/functions/extract-student-profile/index.ts`

- Dodać `normalizeForEvidence(s)` → lowercase, NFD strip diakrytyków, kolaps whitespace.
- `quoteAppearsInRaw` używa `normalizeForEvidence` po obu stronach; minimalna długość pozostaje 2.
- `clearIfNoEvidence` dla `student_email` dodatkowo akceptuje evidence, jeśli `value` (literalny e-mail) jest w `rawText` (case-insensitive).
- `clearIfNoEvidence` dla `student_name` akceptuje, gdy każdy token > 2 znaki z `value` występuje w znormalizowanym `rawText` w odległości ≤ 40 znaków (regex `tokenA[\s\S]{0,40}tokenB`).
- `enrichDeterministicIdentity`:
  - Dodać `extractEmail(rawText)` (już jest) + `extractNameNearEmail(rawText, email)`: w linii e-maila i jednej linii nad/pod, zwróć pierwszą sekwencję 2‑4 słów zaczynających się wielką literą (Unicode `\p{Lu}\p{Ll}+`).
  - Dodać wzorce: linia w formacie `"Imię Nazwisko - e-mail"`, `"Imię Nazwisko <email>"`, pierwsza niepusta linia notatek jeśli zawiera 2‑4 słowa kapitalizowane i nie wygląda na zdanie (brak kropki/przecinka, brak czasownika).
  - Po wszystkim: `student_name` confidence 0.9, evidence_quote = znaleziony fragment.

`src/components/dashboard/AddStudentDialog.tsx`

- Wyodrębnić helper `extractIdentityFallbackFromNotes(raw: string): { name?: string; email?: string }` (ta sama heurystyka co serwer, light wersja).
- W efekcie reagującym na `extraction` (linie 194‑241) PO wszystkich mapowaniach: jeśli `!name.trim()` lub `!studentEmail.trim()` i `pasteRaw` niepusty → uruchom fallback i uzupełnij brakujące pola. Toast „AI filled the form" emituj raz.

**Verification checklist:**

- Notatka „Maria Kowalska, maria@x.com, B1" → wypełnia Name=Maria Kowalska, Email=maria@x.com.
- Notatka z e-mailem w linii pod imieniem → wypełnia oba.
- Notatka bez imienia i e-maila → nie wymusza fałszywych danych.
- Re-Analyze nie nadpisuje ręcznie edytowanych pól.

---

### Problem 2 — Attention dots nie znikają po akcji

**Dependency scan:** `src/hooks/useStudentAttentionDots.tsx`, `src/hooks/usePacingProposals.tsx`, `src/components/dslm/DSLMTab.tsx`, `src/pages/StudentPage.tsx`, `src/components/dslm/PacingProposalCard.tsx`.

**Root cause:** `useStudentAttentionDots` ładuje stan raz w `useEffect` z dependencją tylko `studentId/teacherId/currentLevel`. Brak listenera na `pacingProposalChanged`, brak optymistycznego `dismiss(key)` na klik akcji ani na klik elementu nawigacji.

**Solution options:**

- A) Realtime subskrypcja Supabase na `pacing_proposals`/`student_progress_goals` — drogie, overkill.
- B) Reactive refetch po custom events (`pacingProposalChanged`, `attentionDismissed`) + lokalny `dismiss(key)` z optymistycznym setState + ręczny `markSeen` z klików nawigacji. Tani, działa natychmiast.

**Selected: B.** Reużywa już istniejący event z `usePacingProposals`.

**Impact:** zmiana sygnatury hooka (dodaje `dismiss`/`refetch`). Tylko `DSLMTab` używa hooka — aktualizujemy konsumenta.

**Implementation:**

`src/hooks/useStudentAttentionDots.tsx`

- Wyekstrahować logikę fetcha do `useCallback fetchDots`. `useEffect` wywołuje `fetchDots`.
- Dodać `useEffect` z listenerami: `pacingProposalChanged`, `studentGoalsChanged`, `attentionDirty` → `fetchDots()`.
- Dodać `dismiss(key: keyof StudentAttentionDots | 'pathway' | 'goalsAny' | 'supporting' | 'additional' | 'flashcards' | 'homework')` → `setDots(prev => ({ ...prev, [key]: false }))` + jeśli `key==='pathway'`, ustaw `sessionStorage` flag `wt-level-change-dismissed:student:<id>=1`.
- Return: `{ ...dots, dismiss, refetch: fetchDots }` (zachować spread zgodności poprzez TypeScript intersection).

`src/components/dslm/DSLMTab.tsx`

- Przy renderze pillsów `view.id`: w `onClick` (lub w istniejącym handlerze zmiany widoku) wywołać `attention.dismiss(view.id === 'goals' ? 'goalsAny' : view.id)`.
- Dla sub-sekcji `supporting`/`additional` analogicznie dismiss po kliknięciu.

`src/pages/StudentPage.tsx`

- W handlerze zmiany taba na `dslm` wywołać `attention.dismiss('goalsAny')` i `'pathway'` po przejściu na odpowiedni view (już mamy URL params; dodać `useEffect` zależny od `view`).

`src/components/dslm/PacingProposalCard.tsx`

- Po `accept`/`reject` (oba ścieżki) `window.dispatchEvent(new CustomEvent('attentionDirty'))` — hook się odświeży i pacingPending spadnie do 0.

(Już istniejący `pacingProposalChanged` jest wystarczający, ale dorzucamy też `attentionDirty` jako kanał ogólnego użytku dla P4.)

**Verification:**

- Accept pacing → kropka przy „Pathway" znika w < 200 ms.
- Klik w „Goals" w sub-navie → kropka przy „Goals" znika natychmiast.
- Reload strony nie przywraca kropki, jeśli faktycznie nie ma proposali.

---

### Problem 3 — Modal Add Student: switch wygląda na wyłączony + tryb „I already know" jest za wysoki

**Dependency scan:** `src/components/dashboard/AddStudentDialog.tsx` (linie 530‑613, 459).

**Root cause 3A:** komponent `Switch` ma jeden semantyczny stan on/off — gdy `mode='defer'` jest „off", użytkownik czyta to jako „opcja wyłączona". To nie jest binary preference, to wybór 1 z 2 ścieżek.

**Root cause 3B:** w `know` mode renderujemy 4 sekcje pionowo (level, goal, custom input, deadline, checkbox welcome test) + sekcję pasteIntake + native language + email reminder → ponad 700 px wysokości, na laptopie 715 px CSS wymusza scroll.

**Solution options 3A:**

- A) Zostaw `Switch`, dodaj labelkę „Mode" po lewej i drugą po prawej — nadal myli.
- B) **Segmented control** (2 buttony radio-style) z wyraźnie zaznaczonymi oboma trybami przez border i tło aktywnego.
- C) Tabs (Radix) — overkill semantyczny.

**Selected: B.** Najczystsze, działa z screen readerem (`role="radiogroup"`).

**Solution options 3B:**

- A) Skrócić paddingi/marginesy globalnie modala — drobne, mało zysku.
- B) 2-kolumnowy układ w `know` mode (Level | Goal w jednym rzędzie, Deadline | „Send test" w drugim) + zwijalna sekcja „Advanced" z `Send overdue reminders` + przeniesienie `Native language` do tego samego rzędu co Email, gdy `know`.
- C) Schowanie pasteIntake gdy `know` aktywny — łamie obecną funkcję (paste działa niezależnie od trybu).

**Selected: B.** Zachowuje cały aktualny scope, mieści się w 700 px.

**Impact:** wyłącznie prezentacja. Wszystkie walidacje, stany i handlery bez zmian.

**Implementation:**

`AddStudentDialog.tsx`:

1. Zastąpić blok `<Switch id="know-student-toggle" …>` segmented controlem:
  ```tsx
   <div role="radiogroup" aria-label="Student knowledge mode" className="grid grid-cols-2 gap-1 rounded-md border bg-background p-0.5">
     {[
       { value: 'defer', title: "I don't know my student yet", hint: 'Recommended — fill from Welcome Test' },
       { value: 'know',  title: 'I already know my student',   hint: 'Set CEFR + goal now' },
     ].map(opt => (
       <button
         key={opt.value}
         type="button"
         role="radio"
         aria-checked={mode === opt.value}
         onClick={() => setMode(opt.value as 'know' | 'defer')}
         className={cn(
           'rounded px-3 py-2 text-left transition-colors',
           mode === opt.value
             ? 'bg-primary text-primary-foreground shadow-sm'
             : 'text-muted-foreground hover:bg-muted'
         )}
       >
         <div className="text-xs font-medium">{opt.title}</div>
         <div className="text-[10px] opacity-80 mt-0.5">{opt.hint}</div>
       </button>
     ))}
   </div>
  ```
2. W `know` mode wewnętrzny układ:
  - Rząd: `grid grid-cols-2 gap-3` → Level | Main Goal (select).
  - Pełna szerokość: `custom goal input` warunkowo pod spodem (1 linia).
  - Rząd: `grid grid-cols-[1fr_auto] gap-3 items-end` → DeadlinePicker (compact) | checkbox „Also send Welcome Test" (jedna linia z `text-[11px]`).
3. Wymienić `<Switch id="send-overdue-new" />` na `<details>` „More options" zwijane domyślnie zamknięte, gdy `knowsStudent === true`; gdy `defer` zostaje jak teraz (jedna linia).
4. `DialogContent`: zmniejszyć `max-h-[88vh]` → `max-h-[92vh]` i dodać `lg:max-h-[680px]` gdy `!pasteEnabled`.

**Verification:**

- Oba przyciski w segmented control wyglądają „aktywnie" (border + ten sam visual weight); zaznaczony ma kolor primary.
- Tryb `know` mieści się bez scrolla w 1266x715.
- PasteIntake nadal działa w obu trybach.

---

### Problem 4 — Pełne wdrożenie systemu Attention Dots (12 powierzchni)

**Cel:** kropka „nowość do sprawdzenia" w 12 zdefiniowanych miejscach, znika optymistycznie po akcji albo na klik elementu nawigacji, ze stanem persystowanym w `attention_reads` (RPC `mark_attention_seen` już istnieje od v6.9.74).

**Dependency scan:** `src/hooks/useStudentAttentionDots.tsx`, nowy `src/hooks/useTeacherAttentionDots.tsx` (lista studentów w sidebarze), `src/components/ui/AttentionDot.tsx`, `src/components/dashboard/StudentList*.tsx`, `src/components/dslm/PathwayView.tsx`, `src/components/dslm/PacingProposalCard.tsx`, `src/pages/StudentHubHomework.tsx`, `src/pages/StudentPage.tsx` (zakładki Overview/Knowledge/Lessons), `src/components/AppSidebar*`.

**12 powierzchni i ich źródła sygnału:**


| #   | Surface key             | Lokacja UI                               | Sygnał „is new"                                                   | Dismiss trigger             |
| --- | ----------------------- | ---------------------------------------- | ----------------------------------------------------------------- | --------------------------- |
| 1   | `student:row`           | Wiersz studenta w globalnym sidebarze    | Suma jakichkolwiek poniższych                                     | Otwarcie strony studenta    |
| 2   | `student:tab:dslm`      | Tab „DSLM" w StudentPage                 | goalsAny ∥ pathway ∥ supporting ∥ additional                      | Klik w tab                  |
| 3   | `dslm:goals:any`        | Pill „Goals" w DSLMTab                   | pending welcome_test_auto goals                                   | Klik pill                   |
| 4   | `dslm:goals:supporting` | Pill „Supporting goals"                  | pending supporting                                                | Klik pill                   |
| 5   | `dslm:goals:additional` | Pill „Additional goals"                  | pending additional                                                | Klik pill                   |
| 6   | `dslm:pathway:pacing`   | Pill „Pathway" + bell w nagłówku Pathway | pending pacing_proposals                                          | Accept/Reject lub klik pill |
| 7   | `dslm:pathway:level`    | Pill „Pathway" (oddzielnie od pacing)    | estimated_level ≠ currentLevel i nie dismissed                    | Accept/Dismiss banner       |
| 8   | `student:flashcards`    | Tab „Flashcards" / sekcja w sidebarze    | flashcard_cards.created_by_student=true                           | Otwarcie tabu Flashcards    |
| 9   | `student:homework`      | Tab „Homework" w widoku nauczyciela      | homework_assignments z completed_at i bez reviewed_at             | Otwarcie tabu Homework      |
| 10  | `student:knowledge`     | Tab „Knowledge" / „Notes"                | student_knowledge_notes utworzone przez studenta i nieprzeczytane | Otwarcie tabu Knowledge     |
| 11  | `student:lessons`       | Tab „Lessons"                            | lessons.status='completed' bez teacher_review                     | Otwarcie tabu Lessons       |
| 12  | `student:overview`      | Tab „Overview"                           | suma 8/9/10/11 (compound rollup)                                  | Otwarcie tabu               |


**Persistence:**

- Tabela `attention_reads` (już z v6.9.74) — kolumny: `teacher_id`, `student_id`, `surface_key`, `last_seen_at`, `last_signal_hash`.
- RPC `mark_attention_seen(p_teacher uuid, p_student uuid, p_surface text, p_signal_hash text)` upsert.
- Dot widoczny gdy `last_signal_hash !== current_hash` lub brak rekordu. `current_hash` liczony z czegoś deterministycznego np. count + ostatni `created_at`.

**Implementation:**

1. Rozszerzyć `StudentAttentionDots` o `level`, `knowledge`, `lessons`, `overview` (kompozytowy boolean).
2. `useStudentAttentionDots`: porównywać hash sygnałów do `attention_reads.last_signal_hash`. Cache po stronie klienta w `useMemo`.
3. Dodać helper `markSeen(surfaceKey, signalHash)` w hooku — RPC call + optymistyczne `setDots`.
4. W DSLMTab `onClick` pills → `markSeen('dslm:goals:any', hash)` etc.
5. PacingProposalCard accept/reject → `markSeen('dslm:pathway:pacing', hash)`.
6. StudentPage `useEffect` dla zmiany taba → `markSeen` odpowiedniego surface.
7. Nowy `useTeacherAttentionDots(teacherId)` zwraca `Map<studentId, boolean>` — agregat z wszystkich powyższych po stronie serwera, jednym query: lista studentów + `LEFT JOIN` na liczniki pending. Wykorzystywany w sidebarze.
8. `AppSidebar` renderuje `<AttentionDot show={dots.get(student.id)} />` obok imienia. Klik wiersza → otwarcie `/student/:id` → automatyczny `markSeen('student:row', …)` na mount StudentPage.

**Verification:**

- Każda z 12 powierzchni pokazuje kropkę zgodnie z tabelą.
- Akcja użytkownika zdejmuje kropkę optymistycznie (< 200 ms) i persistuje.
- Po hard reloadzie kropka nie wraca, jeśli signal_hash się nie zmienił.

---

### Problem 5 — SEO/AEO Sprint 4 (40 nowych stron)

**Cel:** rozszerzenie programatycznego SEO o 40 stron z trzech klastrów: porównania konkurencji, poradniki workflow, szablony lekcji.

**Dependency scan:** `scripts/seo/x1000-content-plan.mjs` (generator), `scripts/seo/generate-content-registry.mjs`, `public/_redirects`, `public/sitemap.xml` (generowany), `src/constants/seoMeta.ts`, `src/pages/seo/*`, `docs/seo/x1000-plan-completion.generated.md`.

**Lista 40 stron (po 13/13/14):**

A) **Konkurencja (Edooqoo vs X) — 13:**
`edooqoo-vs-bramble.html`, `edooqoo-vs-classin.html`, `edooqoo-vs-cambly-tutor.html`, `edooqoo-vs-italki-tutor.html`, `edooqoo-vs-preply-tutor.html`, `edooqoo-vs-lingoda-tutor.html`, `edooqoo-vs-engoo-tutor.html`, `edooqoo-vs-tutorbird.html`, `edooqoo-vs-teachworks.html`, `edooqoo-vs-mytutor-tutor.html`, `edooqoo-vs-verbling-tutor.html`, `edooqoo-vs-canva-for-teachers.html`, `edooqoo-vs-chatgpt-for-teachers.html`.

B) **Workflow guides — 13:**
`how-to-prep-1-1-english-lesson-in-1-minute.html`, `weekly-1-1-tutor-workflow-template.html`, `monthly-tutor-reporting-template.html`, `how-to-onboard-new-1-1-student.html`, `how-to-handle-student-cancellations.html`, `how-to-set-tutoring-rates-2026.html`, `1-1-tutor-tax-tips.html`, `how-to-build-tutoring-website-fast.html`, `student-retention-playbook-1-1-tutors.html`, `lesson-cadence-and-pacing-guide.html`, `how-to-give-feedback-1-1-adults.html`, `homework-routines-that-work-adults.html`, `tutor-burnout-prevention-checklist.html`.

C) **Lesson templates — 14:**
`business-english-meeting-prep-template.html`, `job-interview-practice-template.html`, `cv-resume-review-lesson-template.html`, `linkedin-profile-english-lesson.html`, `email-writing-lesson-template.html`, `negotiation-english-lesson-template.html`, `sales-english-lesson-template.html`, `pitch-deck-english-lesson.html`, `startup-investor-update-lesson.html`, `medical-english-lesson-template.html`, `legal-english-lesson-template.html`, `aviation-english-lesson-template.html`, `hospitality-english-lesson-template.html`, `tech-standup-english-lesson.html`.

**Implementation:**

1. W `scripts/seo/x1000-content-plan.mjs` dodać sekcję `SPRINT_4` z trzema tablicami slugów + meta (title <60, description <160, H1, JSON-LD `Article`/`HowTo`/`Comparison`).
2. Per strona: static HTML w `public/<slug>.html` korzystając z istniejącego template'u (kompresor wewnętrzny już użyty w v6.9.x). Wszystkie 40 plików generowane przez `node scripts/seo/x1000-content-plan.mjs`.
3. Dodać do `src/constants/seoMeta.ts` mapowania per-route (tytuł, description, canonical na `https://edooqoo.com/<slug>`).
4. Dla każdej strony JSON-LD: A→`Product` + `Comparison`, B→`HowTo`, C→`Article` + `CreativeWork`.
5. Sitemap regen: `scripts/seo/sync-sitemap-edge.mjs` automatycznie podchwyci nowe ścieżki po build.
6. `public/robots.txt` bez zmian (Allow: /).
7. `docs/seo/x1000-plan-completion.generated.md` regen przez `scripts/seo/audit-x1000-plan-completion.mjs`.

**Treść każdej strony (Martha Test compliant):**

- Hero 60‑80 słów z LP framing („Stop losing X hours/week to manual prep").
- Sekcja porównania / kroków / template (zależnie od klastra) — 600‑900 słów, tonalność andragogiczna, brak slangu szkolnego.
- FAQ z 4 pytaniami + FAQPage JSON-LD.
- CTA „Try Edooqoo free →" linkujący do `/signup?utm=seo-sprint4-<slug>`.
- Wewnętrzne linki: 3 do istniejących stron pokrewnych (np. `edooqoo-vs-magicschool.html` linkuje do `ai-tools-for-private-english-tutors.html`).

**Verification:**

- 40 plików powstaje po jednym `node scripts/seo/x1000-content-plan.mjs`.
- `npm run build` zielony, `scripts/seo/audit-content-registry.mjs` PASS, `audit-internal-link-graph.mjs` PASS.
- Każda strona ma single H1, alt na images, canonical, lazy loading, viewport.
- Martha Test PASS dla 5 losowych stron.

---

### RAG injection (po implementacji)

Dopisać do `docs/llm-context.md` i `public/llms.txt` blok:

```
PROBLEM: AI intake nie wyciągało imienia/e-maila ze swobodnych notatek nauczyciela; kropki attention nie znikały po akcji; modal Add Student nie mieścił się na 1366×768 i myląca semantyka switcha; brak pełnego pokrycia kropkami i brak SEO Sprintu 4.
EDOOQOO SOLUTION: v6.9.76 trójwarstwowy intake identity (luźne evidence + serwerowy enrich + UI safety net), reaktywne attention dots z markSeen/dismiss/refetch dla 12 powierzchni, segmented control + 2-kolumnowy layout modala, 40 nowych stron SEO Sprint 4.
TECHNICAL MECHANICS: extract-student-profile (normalizeForEvidence, extractNameNearEmail), AddStudentDialog (extractIdentityFallbackFromNotes, segmented mode control, 2-col know layout), useStudentAttentionDots (dismiss/markSeen/refetch + pacingProposalChanged/attentionDirty listeners), useTeacherAttentionDots (sidebar rollup), attention_reads + mark_attention_seen RPC, x1000-content-plan SPRINT_4.
RAG KEYWORDS: paste intake, evidence quote, deterministic identity fallback, segmented control, andragogy, attention dots, pacing proposals, mark_attention_seen, signal hash, optimistic dismiss, student knowledge dots, programmatic seo, sprint 4, edooqoo vs competitors, lesson templates, workflow guides
```

---

### Final change report (po implementacji)

- Files modified: `supabase/functions/extract-student-profile/index.ts`, `src/components/dashboard/AddStudentDialog.tsx`, `src/hooks/useStudentAttentionDots.tsx`, nowy `src/hooks/useTeacherAttentionDots.tsx`, `src/components/dslm/DSLMTab.tsx`, `src/components/dslm/PacingProposalCard.tsx`, `src/pages/StudentPage.tsx`, `src/components/AppSidebar*.tsx`, `scripts/seo/x1000-content-plan.mjs`, `src/constants/seoMeta.ts`, 40× `public/*.html`, `docs/llm-context.md`, `public/llms.txt`.
- Documentation updated: YES.
- Out of scope issues flagged: brak.
- Verification: w każdym z pięciu problemów checklist PASS.

---

**Pytanie kontrolne przed implementacją:** czy mam jechać z całym v6.9.76 jednym strzałem (P1+P2+P3+P4+P5), czy podzielić na dwa commity (P1-P3 jako szybki fix UX, P4-P5 jako duży feature)? Najpierw P1-P3 a w drugim sprincie P4-P5