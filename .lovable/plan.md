# Plan v6.9.39 — Welcome Test, DSLM Pathway & Public Nav fixes

Wszystkie zmiany operują na warstwie prezentacji + DSLM/Welcome Test bez dotykania Worksheet Generation Engine. Każdy fix ma określony root cause, wybrane rozwiązanie i pliki.

---

## P1 — Duplikat banera Welcome Test w Pathway (zakładka `?tab=dslm`)

**Root cause.** Na ekranie `1 MINUTE` baner pojawia się dwa razy: górny renderuje `DSLMTab` (`surface="oneMinute"`), a drugi wmontowany jest u góry `PathwayView` (`src/components/dslm/PathwayView.tsx:247-253`, `surface="oneMinute"` z `compact`). Dodano go w v6.9.33 jako kotwicę dla Onboarding Spotlight, ale teraz duplikuje informację.

**Decyzja.** Usunąć drugą instancję wewnątrz `PathwayView`. Spotlight i tak celuje w górny baner (ten sam `data-spotlight="send-welcome-test"`).

**Implementacja.** W `src/components/dslm/PathwayView.tsx`:
- usunąć blok `<WelcomeTestSuggestion ... compact />` (linie ok. 244-253),
- usunąć import `WelcomeTestSuggestion` (linia 31).

**Weryfikacja.** Na `/student/:id?tab=dslm` widoczny tylko 1 baner u góry. Spotlight dalej znajduje element po `data-spotlight`.

---

## P2 — Retake test: znika po refresh, brak nowej karty w Tests, brak guardu przy nieukończonym teście

**Root cause.** `handleRetake` w `WelcomeTestSuggestion.tsx` (linie 336-387) tworzy nowy `student_tests` row, ale lokalnie ustawia `setStatus('pending')` i `setTestId(newTest.id)` — po reloadzie `checkWelcomeTest` (linie 82-128) preferuje `completed/reviewed > in_progress > others`, więc cofa się do starego ukończonego attemptu zamiast pokazać nowy `assigned/pending`. Po drugie: `StudentTestsTab` używa własnego strumienia (`useStudentTests`), ale w niektórych przypadkach lista nie odświeża się natychmiast — guard. Po trzecie: brak modala potwierdzenia, gdy ostatni test nie jest ukończony, co prowadzi do mnożenia attemptów.

**Decyzja.**
1. Zmienić logikę priorytetu w `checkWelcomeTest`: gdy najnowszy attempt ma `attempt_number > 1` i status w (`assigned`, `pending`, `in_progress`), traktować go jako aktywny zamiast spadać do starego completed. Reguła: **najnowszy attempt zawsze wygrywa, jeżeli nie jest `cancelled`/`deleted`** — completed pokazujemy tylko gdy nie ma nowszego niewykonanego.
2. W `WelcomeTestSuggestion` przed `handleRetake` sprawdzić, czy istnieje attempt o statusie nie-completed/nie-reviewed; jeżeli tak, pokazać `AlertDialog` z komunikatem: *"Last attempt is not completed yet. Re-take usually makes sense ~30 days after the previous test is completed. Create another one anyway?"* (próg 30 dni przyjęty na bazie standardów ESL re-assessment cycle — krótko uzasadnione w treści). CTA: `Cancel` / `Create new attempt`.
3. Po `handleRetake` wywołać `window.dispatchEvent(new CustomEvent('student-tests:refresh', { detail: { studentId } }))` i nasłuchać tego w `StudentTestsTab` aby wymusić re-fetch listy (idempotentne, dodaje brakującą kartę bez czekania na poll).
4. W `StudentTestsTab` po `handleRetake` (linie 162+) dodać ten sam event dispatch i ten sam guard modal — to zsynchronizuje obie ścieżki (z baneru i z `TestDetailsView`/`StudentTestsTab`).

**Implementacja — pliki.**
- `src/components/dashboard/WelcomeTestSuggestion.tsx`
  - zmodyfikować `checkWelcomeTest`: liczyć najnowszy non-cancelled rekord; gdy `status in ('assigned','pending','in_progress')` traktować jako aktywny (nie spadać do completed).
  - dodać stan `confirmRetakeOpen` + `AlertDialog` (re-używamy `@/components/ui/alert-dialog`).
  - W `handleRetake` na początku: jeżeli `status === 'completed' || 'reviewed'` → kontynuuj normalnie; w przeciwnym razie → otwórz modal. Faktyczny insert wykonać dopiero po potwierdzeniu (split na `confirmAndRetake`).
  - Po sukcesie: `window.dispatchEvent(new CustomEvent('student-tests:refresh'))`.
- `src/components/student-tests/StudentTestsTab.tsx`
  - dodać `useEffect` z listenerem `student-tests:refresh` → wywołać istniejący `fetchTests` (lub odpowiednik z `useStudentTests`).
  - dodać ten sam AlertDialog dla retake (linie 162+).
- `src/components/student-tests/TestDetailsView.tsx`
  - w `handleRetake` dispatch tego samego eventu po sukcesie, by lista odświeżyła się po `onBack()`.

**Weryfikacja.** Klik retake → modal jeśli stary niewykończony → po confirm: toast `Attempt #N created`, w Tests pojawia się nowa karta, po refresh strony nadal widać nowy attempt jako aktywny baner.

---

## P3 — Po retake fallback "Welcome Placement Test not completed" w `No curriculum plan yet`

**Root cause.** `MacroTimeline.tsx:249-255` warunkuje komunikat na fladze `!wtCompleted`. Po retake mamy 1 ukończony + 1 pending, więc `wtCompleted` może być wyliczane na podstawie *najnowszego* attemptu (pending) zamiast *jakiegokolwiek* ukończonego.

**Decyzja.** Zmienić semantykę `wtCompleted` na: *czy istnieje JAKIKOLWIEK welcome test ze statusem `completed` lub `reviewed` (deleted_at IS NULL)*. Jeżeli tak → ukryć całe `<li>` z "Send test" (linie 249-256), nawet jeśli istnieje nowszy pending retake.

**Implementacja.** Znaleźć źródło `wtCompleted` (propaguje do `MacroTimeline` z `DSLMTab` / hooka). 
- W `src/components/dslm/DSLMTab.tsx` (lub miejsce, gdzie liczymy `wtCompleted` przekazywane do `MacroTimeline`): zmienić zapytanie na `.eq('test_type','welcome').in('status', ['completed','reviewed']).is('deleted_at', null).limit(1)` — `wtCompleted = (count ?? 0) > 0`.
- W `MacroTimeline.tsx` zachować obecny render warunkowy (już poprawny). Dodać `data-testid="welcome-test-suggestion-line"` dla łatwego QA.

**Weryfikacja.** Po retake na widoku `No curriculum plan yet` linia "Welcome Placement Test not completed" nie pojawia się.

---

## P4 — Auto-apply nie zadziałał (baner "Apply to Progress" zamiast `reviewed`)

**Root cause.** `supabase/functions/process-welcome-test/index.ts:634-661` próbuje wczytać `test_skill_results` z polem `applied_to_element_id`/`suggested_rating`, ale w nowym flow (po dodaniu pytań do 58) `calculate_test_results` / pipeline AI może NIE generować `applied_to_element_id` dla pytań speaking/listening/open. Jeśli `r.applied_to_element_id` jest `null` dla wszystkich rekordów, pętla nic nie zapisuje i `status` zostaje na `completed`. Brakuje też fallbacku: kiedy `applied_to_element_id` jest puste, należy zmapować po `element_type` ze `student_learning_elements` per student.

**Decyzja.**
1. W edge function dodać **fallback mapping**: dla każdego `test_skill_results` bez `applied_to_element_id` wyszukać `student_learning_elements` po `(student_id, element_type)` i użyć pierwszego trafionego. Jeśli nie ma elementu — utworzyć go (`upsert` z `current_rating = suggested_rating`).
2. Po procesie zawsze ustawić `status = 'reviewed'`, jeżeli liczba zaaplikowanych skill_results > 0. Jeżeli faktycznie 0 wyników (brak skill_results w ogóle), zostawić `completed` i zapisać do `error_logs` z konkretnym powodem (`no_skill_results`, `no_matching_elements`), aby diagnostyka była jednoznaczna.
3. Dodatkowo: na froncie w `TestDetailsView` przycisk `Apply to Progress` zostaje jako *manualny fallback* (idempotentny) — bez zmian.

**Implementacja.**
- `supabase/functions/process-welcome-test/index.ts` (sekcja v6.9.29 auto-apply, linie ~634-675):
```ts
const { data: skillResults } = await supabase
  .from('test_skill_results')
  .select('id, element_type, applied_to_element_id, suggested_rating')
  .eq('student_test_id', test_id)
  .is('applied_at', null);

const applied: string[] = [];
if (skillResults?.length) {
  for (const r of skillResults) {
    if (r.suggested_rating == null) continue;
    let elementId = r.applied_to_element_id;
    if (!elementId && r.element_type) {
      const { data: existingEl } = await supabase
        .from('student_learning_elements')
        .select('id')
        .eq('student_id', student_id)
        .eq('element_type', r.element_type)
        .maybeSingle();
      if (existingEl) {
        elementId = existingEl.id;
      } else {
        const { data: inserted } = await supabase
          .from('student_learning_elements')
          .insert({ student_id, element_type: r.element_type, current_rating: r.suggested_rating })
          .select('id').single();
        elementId = inserted?.id ?? null;
      }
    }
    if (!elementId) continue;
    await supabase.from('student_learning_elements')
      .update({ current_rating: r.suggested_rating, last_rated_at: new Date().toISOString() })
      .eq('id', elementId);
    await supabase.from('test_skill_results')
      .update({ applied_at: new Date().toISOString(), applied_to_element_id: elementId })
      .eq('id', r.id);
    applied.push(r.id);
  }
}
if (applied.length > 0) {
  await supabase.from('student_tests')
    .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
    .eq('id', test_id);
}
```

**Weryfikacja.** Po `process-welcome-test` dla nowego ucznia `status = 'reviewed'`, baner "Auto-apply did not complete" znika, `student_learning_elements` dostają ratingi.

---

## P5 — Brak auto-przypisania level/goals po teście (flow „I don't know my student yet")

**Root cause.** `process-welcome-test` tworzy `student_learning_profiles`, ale nie zapisuje wynikowego CEFR do `students.english_level` ani nie tworzy/sugeruje rekordów `student_goals`. UI nie pokazuje też propozycji.

**Decyzja.** Dwie ścieżki:
- **Auto-apply level** gdy `students.english_level` jest `NULL` lub puste → wpisać CEFR wyznaczony przez Learning Path Score (zmienna `learningPathResult` już istnieje w funkcji, linie ~1247-1255). Gdy poziom już istnieje i się różni → utworzyć rekord `pacing_proposals` typu `level_change` lub miękką notyfikację (NIE nadpisywać).
- **Auto-create suggested goals**: jeżeli student ma 0 aktywnych `student_goals` (poza main goal), wziąć `recommended_focus_areas` z `student_learning_profiles` (już generowane przez AI summary, pole istnieje) i wstawić 1× `main` (jeśli brak), 2× `supporting`, 1× `additional`. Każdy goal w statusie `suggested` (nowa wartość enum, OR użyć `is_ai_suggested = true`), tak by UI pokazał je jako *do akceptacji*. Jeżeli enum nie wspiera — fallback: zwykłe `active` z flagą `source = 'welcome_test_auto'` w `metadata`.
- **UI sugestii** w `GoalsView.tsx`: gdy istnieją goals z `metadata.source = 'welcome_test_auto'` i `accepted_at IS NULL`, renderować nad listą banner *"Suggested from Welcome Test"* z przyciskami `Accept all` / `Edit` / `Dismiss`.

**Implementacja.**
- Migration: dodać kolumnę `student_goals.metadata jsonb default '{}'::jsonb` jeżeli nie istnieje, oraz `accepted_at timestamptz` (nullable). Zachowuje wstecz-kompatybilność. GRANTy bez zmian (tabela istniejąca).
- Edge function `process-welcome-test/index.ts`: dodać sekcję `auto-apply level + suggest goals` PO sekcji auto-apply skill_results.
  - Odczyt `students.english_level`; jeżeli puste → update.
  - Odczyt aktywnych goals; jeżeli 0 → insert 4 sugerowane na bazie `recommended_focus_areas` + main goal z testu.
- Front `src/components/dslm/GoalsView.tsx`: dodać sekcję `SuggestedGoalsBanner` z 3 akcjami.
- Front `WelcomeTestSuggestion.tsx` (status `completed`): dodać krótki tekst *"Level + goal suggestions applied"* z linkiem do `?tab=dslm&focus=goals`.

**Weryfikacja.** Nowy uczeń kończy test → na DSLM widoczne sugerowane goals + ustawiony poziom + (gdy poziom różny) badge propozycji zmiany.

---

## P6 — Skąd "B1 → B2" na nagłówku ucznia?

**Root cause.** `src/components/dslm/StudentNavBadges.tsx:14-35` zawiera twardo zakodowaną mapę `LEVEL_PROGRESSION = {A1:'A2', ...}` i ZAWSZE pokazuje strzałkę do następnego CEFR, nawet bez jakichkolwiek sygnałów postępu. To wprowadza w błąd — wygląda jak rzeczywista predykcja modelu.

**Decyzja.** Pokazywać `current → next` TYLKO wtedy, gdy istnieje realny sygnał: aktywny `pacing_proposal` typu `level_change` lub aktywna faza w `curriculum_phases` z `target_level` różnym od aktualnego. W każdym innym przypadku — sam `current`.

**Implementacja.**
- `src/components/dslm/StudentNavBadges.tsx`: przyjąć nowy prop `targetLevel?: string | null`. Render: `englishLevel === targetLevel || !targetLevel` → tylko `englishLevel`; inaczej `englishLevel → targetLevel`. Dodać `<Tooltip>` wyjaśniający źródło ("Inferred from current learning roadmap phase" / "Suggested by pacing proposal").
- Wywołanie w `StudentPage.tsx` (lub gdziekolwiek mount): wyliczyć `targetLevel` z `useCurriculumPhases` (faza in_progress → `target_level`) lub `usePacingProposals` (typ `level_change` → `proposed_level`). Usunąć `LEVEL_PROGRESSION` jako *fallback* (nigdy nie używać auto-następnego CEFR bez evidence).

**Weryfikacja.** Johny Bravo (B1, brak fazy / propozycji) → widoczne tylko `B1`. Po wygenerowaniu roadmapy z `target_level=B2` → `B1 → B2` z tooltipem.

---

## P7 — Brakuje "Where this feature fits in Edooqoo" na `/one-minute-prep` i `/`

**Root cause.** Komponent `FeatureWorkflowMap` jest renderowany na podstronach feature (`/features/*`), ale nie na `/one-minute-prep` (`src/pages/OneMinutePrep.tsx`) ani na landingu (`src/pages/Index.tsx`).

**Decyzja.** Wmontować `<FeatureWorkflowMap />` (bez `activeKey` — wersja "ogólna") na:
1. `/one-minute-prep` — pomiędzy hero a `OneMinutePrepProofSection` (przed linią 239) z `activeKey="one-minute-prep"` (lub bez activeKey, jeżeli feature key nie istnieje w mapie — sprawdzić `PUBLIC_FEATURE_WORKFLOW` w `src/constants/publicFeatureWorkflow.ts`).
2. `/` — w `src/pages/Index.tsx` wewnątrz dolnej sekcji marketingowej dla zalogowanych użytkowników anonimowych (po hero, przed sekcjami feature pills). Wersja bez `activeKey` — neutralna.

**Implementacja.**
- W `src/pages/OneMinutePrep.tsx` dodać import + `<FeatureWorkflowMap activeKey="one-minute-prep" />` (jeżeli klucz nie istnieje, dodać go do `publicFeatureWorkflow.ts` z poprawnym labelem i ścieżką).
- W `src/pages/Index.tsx` dodać `<FeatureWorkflowMap />` w wybranym miejscu (między hero a Feature Pills) — sekcja widoczna tylko dla anon (warunek `!isRegisteredUser` jeśli komponent landingowy go ma; inaczej zawsze).

**Weryfikacja.** Obie strony renderują sekcję; linki w mapie kierują do `/features/*`.

---

## P8 — Sticky nav ściśnięty na `/features/*` i `/one-minute-prep`; przenieść pills w lewo

**Root cause.** W `StickyNav.tsx` (linia 253 i sąsiednie) dla wariantu zalogowanego/anonimowego renderujemy `<FeatureNavPills />` w bloku po prawej. Pills mają `className="hidden items-center gap-1 lg:flex"` (FeatureNavPills.tsx:85) i są wpychane między logo a prawe akcje, co powoduje ścisk.

**Decyzja.** Przenieść `FeatureNavPills` do lewego bloku (obok logo), tak samo jak na `/`. Konkretnie: w gałęzi anon desktop (linie 253+) struktura już ma `flex items-center justify-between` — wystarczy umieścić `<FeatureNavPills />` wewnątrz lewego `<div>` z logo, NIE prawego.

**Implementacja.**
- W `src/components/landing/StickyNav.tsx`:
  - W każdym desktopowym renderze nav (anon i zalogowany) upewnić się, że `<FeatureNavPills />` znajduje się w lewym kontenerze obok `<Logo />`. Usunąć z prawego.
  - Dla mobilnego (sheet) — bez zmian (już stacked w drawerze).

**Weryfikacja.** Na `/`, `/features/*`, `/one-minute-prep` pills są wyrównane do lewej, prawa strona ma tylko CTA + login.

---

## Po implementacji — RAG injection + change report

1. Aktualizacja `docs/llm-context.md` i `public/llms.txt` z sekcją v6.9.39:
   - PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS / RAG KEYWORDS (po 1 bloku na P1..P8 lub zbiorczo).
2. Nowy plik memory `mem/features/onboarding/v6939-welcome-test-and-nav.md` (typ feature) + wpis w `mem/index.md` (Memories).
3. Final change report: lista zmienionych plików, status weryfikacji per problem, lista *out of scope* (jeśli się pojawi cokolwiek), informacja że Worksheet Generation Engine nie został tknięty.

---

## Pliki które zostaną zmienione (skrót)

- `src/components/dslm/PathwayView.tsx` (P1)
- `src/components/dashboard/WelcomeTestSuggestion.tsx` (P2, P5)
- `src/components/student-tests/StudentTestsTab.tsx` (P2)
- `src/components/student-tests/TestDetailsView.tsx` (P2)
- `src/components/dslm/MacroTimeline.tsx` + `DSLMTab.tsx` (P3)
- `supabase/functions/process-welcome-test/index.ts` (P4, P5)
- `supabase/migrations/<timestamp>_welcome_test_suggested_goals.sql` (P5)
- `src/components/dslm/GoalsView.tsx` (P5)
- `src/components/dslm/StudentNavBadges.tsx` + `StudentPage.tsx` (P6)
- `src/pages/OneMinutePrep.tsx`, `src/pages/Index.tsx`, `src/constants/publicFeatureWorkflow.ts` (P7)
- `src/components/landing/StickyNav.tsx` (P8)
- `docs/llm-context.md`, `public/llms.txt`, `mem/index.md`, `mem/features/onboarding/v6939-welcome-test-and-nav.md` (RAG + memory)

Zero dotknięć: `generate-worksheet*`, prompty, `useWorksheetGenerationTracking`, kalkulatory, RLS poza dodaniem kolumn `metadata`/`accepted_at` w `student_goals`.

## Wymagana decyzja

Zatwierdzasz Plan v6.9.39 do wdrożenia? Po zatwierdzeniu wykonuję wszystkie 8 napraw w jednej iteracji, kończąc raportem zmian.
