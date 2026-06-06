# Plan v6.9.40 — Welcome Test retake loop, auto-apply repair, readiness guidance, guided roadmap generation

## Decyzja strategiczna na start
Nie dotykamy Worksheet Generation Engine. Zmiany dotyczą wyłącznie Welcome Test, DSLM/Pathway, Learning Roadmap, UI statusów i dokumentacji RAG.

---

## Problem 1 — Wyjaśnienie wcześniejszych “out of scope” punktów

### Dependency scan
Affected surface:
- `src/components/dslm/StudentNavBadges.tsx`
- `src/components/dslm/GoalsView.tsx`
- `src/components/dslm/MacroTimeline.tsx`
- `src/components/dslm/PathwayView.tsx`
- `supabase/functions/process-welcome-test/index.ts`
- `docs/llm-context.md`
- `public/llms.txt`
- pre-existing Supabase security linter findings

### Root cause
W poprzednim raporcie zmieszałem trzy różne kategorie: realny brak danych produktowych, pre-existing security backlog oraz niespójność dokumentacyjną — dlatego brzmiało to jak jedna lista rzeczy do natychmiastowego zrobienia.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A | Dodać `target_level` na roadmap phases i przywrócić `B1 → B2` | Za wcześnie; nie mamy jeszcze pewnego źródła target level | High |
| B | Nie dodawać fake target_level; naprawić realny Welcome Test level/goals flow i dokumentację numeracji | Usuwa przyczynę obecnych problemów bez tworzenia sztucznego sygnału | Low |
| C | Rozwiązać 197 linter findings teraz | Ogromny scope, ryzyko naruszenia RLS i regresji | High |

### Selected solution + why
Wybieram B. `B1 → B2` wróci dopiero, gdy będziemy mieli evidence-based target signal, np. z zaakceptowanej sugestii poziomu, celu egzaminacyjnego albo explicit `target_level`. Linter 197 zostaje jako oddzielny security-hardening cycle, bo mieszanie go z Welcome Test naprawą byłoby nieodpowiedzialne.

### Impact analysis
Zero regressions confirmed:
- Nie przywracamy fake progression badge.
- Nie modyfikujemy RLS w tym cyklu.
- Konsolidujemy tylko dokumentację release/RAG, żeby przyszłe agenty nie powielały chaosu numeracji.

### Full implementation
- W finalnym raporcie oznaczę:
  - `target_level`: not implemented now; blocked until real evidence source exists.
  - `197 linter warnings`: separate security cycle, not this product fix.
  - `llms.txt v6.9.39 mismatch`: fix documentation section during RAG injection.

### Verification checklist
- [ ] Raport końcowy rozdziela backlog od realnych bugów.
- [ ] `docs/llm-context.md` i `public/llms.txt` opisują v6.9.40, nie mylą go z v6.9.39.

---

## Problem 2 — Retake Test: nowe karty, modal guard, retake labels

### Dependency scan
Affected surface:
- `src/components/student-tests/StudentTestsTab.tsx`
- `src/components/student-tests/TestDetailsView.tsx`
- `src/components/welcome-test/WelcomeTestActionsPanel.tsx`
- `src/components/dashboard/WelcomeTestSuggestion.tsx`
- `src/hooks/useStudentTests.tsx`
- `src/types/studentTests.ts`
- `student_tests`: `attempt_number`, `previous_attempt_id`, `status`, `share_token`, `completed_at`, `reviewed_at`

Live DB fact for the reported student:
- Attempt #1 reviewed.
- Attempt #2 assigned.
- Attempt #3 assigned.
- Attempt #4 reviewed.
- Tests tab did not show new retake cards because UI filters welcome tests out of the list and renders only one special card.

### Root cause
Retake rows are being created, but `StudentTestsTab` collapses all Welcome Test attempts into one “welcomeTest” card and explicitly filters `test_type === 'welcome'` out of the normal test list.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A | Keep one Welcome card and add a dropdown history | Compact, but user explicitly asked for cards | Medium |
| B | Render every Welcome Test attempt as its own card, labelled Initial / Retake 1 / Retake 2 | Directly matches teacher expectation | Low |
| C | Create a separate Retake tab | More UI, unnecessary | Medium |

### Selected solution + why
Wybieram B. Każdy attempt będzie widoczny jako osobna karta, więc nauczyciel natychmiast widzi, ile testów istnieje i który jest aktywny. To eliminuje strukturalnie problem “retake istnieje w DB, ale UI udaje, że go nie ma”.

### Impact analysis
Zero regressions confirmed:
- Existing non-welcome tests still render normally.
- Compare attempts still counts only completed/reviewed attempts.
- Share/copy/preview actions remain on Welcome Test attempts.
- No deletion of existing duplicate attempts; history remains auditable.

### Full implementation
1. `StudentTestsTab.tsx`
   - Replace current single Welcome Test card with `welcomeAttempts = tests.filter(test_type === 'welcome').sort(created_at desc)`.
   - Render all `welcomeAttempts` as cards.
   - Label rules:
     - `attempt_number <= 1`: `Initial Welcome Test`.
     - `attempt_number > 1`: `Retake {attempt_number - 1}`.
   - Card title examples:
     - `Initial Welcome Test — 58 questions`
     - `Retake 1 — 58 questions`
     - `Retake 3 — 58 questions`
   - Latest attempt receives the full `WelcomeTestActionsPanel`; older attempts receive view/open actions only.
   - `welcomeTest` selection changes from “completed first” to “latest authoritative attempt” for retake and banner logic.
   - Fix `nextAttempt` calculation to use max attempt number across all welcome rows, not the currently displayed completed row.

2. `WelcomeTestActionsPanel.tsx`
   - Allow `Re-take Test` to be visible for any existing attempt when `onRetake` is provided, not only when state is completed.
   - Keep `Send/Re-send Email` available for pending/in-progress.

3. `StudentTestsTab.tsx` and `WelcomeTestSuggestion.tsx`
   - Guard modal opens whenever the latest attempt is not `completed` or `reviewed`.
   - Modal copy:
     - Title: `Create another Welcome Test retake?`
     - Body: `The latest attempt is still open. Retakes are usually useful after 8–12 weeks of lessons or after a clear learning block has finished. Creating another one now will leave multiple unfinished links active and can confuse the student.`
   - Confirm button: `Create retake anyway`.
   - Cancel button: `Keep current attempt`.

4. Retake naming
   - DB `attempt_number` remains 1, 2, 3, 4.
   - UI displays retake count as `attempt_number - 1`.
   - New retake title becomes `Welcome Test - {Student} (Retake {nextAttempt - 1})`.
   - Toast becomes `Retake {nextAttempt - 1} created. Send the new link to the student.`

5. `WelcomeTestSuggestion.tsx`
   - Store `attemptNumber` in state from selected/latest test row.
   - Pending banner copy:
     - initial: `Welcome (placement) Test sent`
     - retake: `Welcome Test retake {attemptNumber - 1} sent`
   - In-progress copy:
     - initial: `Student is taking the test`
     - retake: `Student is taking retake {attemptNumber - 1}`
   - Completed copy:
     - initial: `Welcome (placement) Test completed!`
     - retake: `Welcome Test retake {attemptNumber - 1} completed!`

### Verification checklist
- [ ] Creating retake creates a new visible card in Tests.
- [ ] Card label says Retake 1 / Retake 2 / Retake 3 based on `attempt_number - 1`.
- [ ] Clicking retake while latest attempt is open shows confirmation modal.
- [ ] Clicking retake after completed attempt still warns about recommended 8–12 week interval in copy/context.
- [ ] Overview and 1 MINUTE banners mention retake number when active attempt is retake.

---

## Problem 3 — “Auto-apply did not complete” and wrong “automatically” after manual apply

### Dependency scan
Affected surface:
- `supabase/functions/process-welcome-test/index.ts`
- `src/hooks/useStudentTests.tsx`
- `src/components/student-tests/TestDetailsView.tsx`
- `student_tests`
- `test_skill_results`
- `student_learning_profiles`
- `student_learning_elements`

Confirmed schema fact:
- `test_skill_results` has column `test_id`.
- Current repo code in `process-welcome-test` queries `.eq('student_test_id', test_id)`, which is wrong.

### Root cause
Auto-apply backend uses a non-existent column name (`student_test_id`) while the table and UI use `test_id`, and the Edge Function deployment must be refreshed after the fix.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A | Only hide the warning in UI | Masks bug; data remains wrong | Medium |
| B | Fix backend query to `test_id`, deploy function, and make manual UI copy source-aware | Fixes root cause and misleading copy | Low |
| C | Add new audit table for apply source | Strong but too much scope | Medium |

### Selected solution + why
Wybieram B. Backend must process future tests correctly; UI copy must stop implying automatic apply after a teacher manually clicked the fallback button.

### Impact analysis
Zero regressions confirmed:
- Existing manual Apply button remains as fallback.
- `student_learning_profiles` still stores per-skill results even when no learning elements exist.
- No worksheet generation logic touched.

### Full implementation
1. `process-welcome-test/index.ts`
   - Change auto-apply query from `.eq('student_test_id', test_id)` to `.eq('test_id', test_id)`.
   - Keep fallback behavior:
     - If matching `student_learning_elements` exists, update rating and backfill `applied_to_element_id`.
     - If no element exists, mark `test_skill_results.applied_at` so the warning does not keep reappearing.
   - Keep status promotion to `reviewed` after profile upsert and skill result processing.

2. Deploy Edge Function
   - Deploy `process-welcome-test` after code change.
   - Check recent function logs for new test processing errors.

3. `TestDetailsView.tsx`
   - Add local state `manualApplyCompleted`.
   - In `handleApplyResults`, after success set `manualApplyCompleted=true`.
   - Reviewed card copy:
     - If `manualApplyCompleted`: `Results manually applied to student's skill ratings.`
     - Else: `Results applied to student's skill ratings.` or `Results automatically applied...` only when auto source is trustworthy.
   - This directly fixes the user-facing moment after clicking `Apply to Progress`.

4. Limited data repair for reported test
   - For `test_id=94c76ba5-7cc0-47d7-be04-832f1207dafa`, skill rows already have `applied_at`, so no destructive change is needed.
   - Do not delete or recreate skill rows.

### Verification checklist
- [ ] Edge Function uses `test_id` everywhere for `test_skill_results`.
- [ ] New completed Welcome Test moves to reviewed when processing succeeds.
- [ ] Manual fallback shows manually-applied wording after click.
- [ ] No “Auto-apply did not complete” banner appears after successful auto processing.

---

## Problem 4 — Welcome Test should fill/suggest level and goals

### Dependency scan
Affected surface:
- `supabase/functions/process-welcome-test/index.ts`
- `src/components/dslm/GoalsView.tsx`
- `src/pages/StudentPage.tsx`
- `src/hooks/useStudent.tsx`
- `src/hooks/useStudentProgress.tsx`
- `src/constants/studentGoals.ts`
- `students.english_level`
- `students.main_goal`
- `student_learning_profiles`
- `student_progress_goals`

Live DB fact for reported student:
- `students.english_level` is still `null`.
- `students.main_goal` is still `null`.
- `student_progress_goals` has no active suggestions.
- latest profile says `estimated_level=A1`, strongest=`reading`, weakest=`writing`, interests=`Travel & Culture`, `Health & Lifestyle`.

### Root cause
The current auto-fill path is too narrow and likely not deployed; it only handles missing level/goals partially, does not handle `unknown`, does not assign `main_goal`, and only inserts goal suggestions when active goal count is zero.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A | Only auto-fill when no level and no goals | Simple but fails existing-student suggestion requirement | Medium |
| B | Auto-fill missing fields; if fields exist, create teacher-review suggestions | Matches requested behavior | Low |
| C | Auto-overwrite existing level/goals | Faster but dangerous | High |

### Selected solution + why
Wybieram B. Edooqoo should be useful without silently overwriting teacher decisions. Missing data can be filled; existing data gets a clear suggestion.

### Impact analysis
Zero regressions confirmed:
- Existing teacher-set level/main goal will not be overwritten automatically.
- Suggestions remain teacher-reviewable.
- Existing `GoalsView` suggestion banner pattern is reused.

### Full implementation
1. `process-welcome-test/index.ts`
   - Treat level as missing if `null`, empty string, or `unknown`.
   - If missing: update `students.english_level = estimatedLevel`.
   - Derive `suggestedMainGoal` from answers/profile:
     - exam motivation -> `exam`
     - work/career/professional usage -> `work`
     - travel interest/usage -> `travel`
     - academic signals -> `academic`
     - social conversation -> `social-conversation`
     - otherwise -> `general`
   - If `students.main_goal` is missing/null/empty/custom unknown: update it.
   - Always create 2–3 `student_progress_goals` suggestions from Welcome Test if no identical suggestion exists for the same `test_id`:
     - supporting: weakest skill, e.g. `Improve writing fluency`
     - supporting: strongest skill as confidence anchor, e.g. `Use reading comprehension as a confidence anchor`
     - additional: first interest topic, e.g. `Practice English around Travel & Culture`
   - Store metadata:
     - `from: welcome_test`
     - `test_id`
     - `signal`
     - `estimated_level`
     - `suggested_main_goal`
   - Keep `source='welcome_test_auto'`, `accepted_at=null`.

2. `GoalsView.tsx`
   - Existing `Suggested from Welcome Test` banner remains.
   - Add a compact “Welcome Test profile update” banner when latest profile suggests level/main goal different from current props:
     - `Welcome Test suggests level A1` with Accept action.
     - `Welcome Test suggests main goal Travel` with Accept action.
   - Accept level updates `students.english_level`.
   - Accept main goal calls existing `onMainGoalChange`.
   - Dismiss uses localStorage keyed by `studentId + welcome_test_id` to avoid repeated nagging.

3. `useStudent.tsx`
   - Add listener for a custom `student:refresh` event to refetch current student query.
   - `GoalsView` dispatches it after accepting level/main-goal suggestion.

4. Backfill for reported student
   - Set `students.english_level = 'A1'`.
   - Set `students.main_goal = 'travel'` based on `Travel & Culture` and missing main goal.
   - Insert Welcome Test suggested goals:
     - supporting: `Improve writing fluency`
     - supporting: `Build confidence from reading comprehension`
     - additional: `Practice English around Travel & Culture`
   - Mark them as `source='welcome_test_auto'`, `accepted_at=null`, metadata referencing test `94c76ba5-7cc0-47d7-be04-832f1207dafa`.

### Verification checklist
- [ ] New tests auto-fill missing level.
- [ ] New tests auto-fill missing main goal.
- [ ] New tests create supporting/additional goal suggestions.
- [ ] Existing level/main goal receives suggestion, not silent overwrite.
- [ ] Reported student receives A1 + travel + three suggested goals.

---

## Problem 5 — Add readiness guidance to 1-Minute Prep suggestions

### Dependency scan
Affected surface:
- `src/components/dslm/PathwayView.tsx`
- `src/components/dslm/NextStepsSection.tsx`
- `src/components/dslm/NextStepBanner.tsx`
- `src/components/dslm/MacroTimeline.tsx`
- `src/hooks/useWelcomeTestActions.ts`
- `student_progress_goals`
- `student_tests`
- `dslm_curriculum_phases`

### Root cause
Readiness warnings exist only inside the Learning Roadmap empty state, while 1-Minute Prep suggestions has a much weaker empty state and does not explain missing goals/test/roadmap context.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A | Duplicate the roadmap warning component manually | Fast but duplicates logic | Medium |
| B | Move readiness signals to `PathwayView` and pass them into both sections | Shared source, less drift | Low |
| C | Add global onboarding banner | Too broad and noisy | Medium |

### Selected solution + why
Wybieram B. Readiness is Pathway-level context, not Roadmap-only context.

### Impact analysis
Zero regressions confirmed:
- Existing “Generate 1-Minute Prep suggestions” action remains.
- Roadmap still optional; copy says strongly recommended, not mandatory.
- Add goal and send test actions reuse existing handlers.

### Full implementation
1. `PathwayView.tsx`
   - Compute:
     - `hasGoals`
     - `hasPhases`
     - `wtCompleted` using the same count-query semantics as MacroTimeline: any completed/reviewed attempt counts.
   - Provide actions:
     - `onAddGoal`: dispatch `dslm:addGoal`.
     - `onSendWelcomeTest`: call `useWelcomeTestActions.send()`.
     - `onScrollToRoadmap`: open roadmap collapsible, then scroll to `#pathway-roadmap` / empty roadmap card.

2. `NextStepsSection.tsx` / `NextStepBanner.tsx`
   - Empty state gets readiness panel:
     - Header: `For sharper 1-Minute Prep suggestions, add this first`
     - `No learning goals set — AI will infer from main goal only.` + Add goal button
     - `Welcome Placement Test not completed — level signals are weaker.` + Send test button
     - `No curriculum plan yet — optional, but strongly recommended for recurring students.` + Go to roadmap button
   - Button `Go to roadmap` scrolls to the “No curriculum plan yet” section and opens the roadmap collapsible.

### Verification checklist
- [ ] 1-Minute Prep empty state shows goals/test/roadmap readiness info.
- [ ] Add goal opens the same Goals modal.
- [ ] Send test uses existing Welcome Test flow.
- [ ] Go to roadmap scrolls to Learning Roadmap empty state.

---

## Problem 6 — Guided “Generate Learning Roadmap” modal

### Dependency scan
Affected surface:
- `src/components/dslm/MacroTimeline.tsx`
- `src/hooks/dslm/useCurriculumPhases.tsx`
- `supabase/functions/generate-curriculum-phases/index.ts`
- `student_progress_goals`
- `dslm_curriculum_phases`

### Root cause
`Generate Learning Roadmap` currently sends generation immediately, so teachers cannot guide phase count, duration, priority goals, or hidden context before the AI builds the macro plan.

### Solution options
| Option | Approach | Tradeoff | Regression risk |
|---|---|---|---|
| A | Add only a comment textarea | Minimal, but misses requested controls | Low |
| B | Add full guided modal with auto/manual controls | Matches request; moderate UI/backend work | Medium-low |
| C | Build a multi-step wizard | Too heavy for this workflow | Medium |

### Selected solution + why
Wybieram B. Roadmap generation is a high-leverage planning moment; one modal with sensible defaults gives control without slowing the default path.

### Impact analysis
Zero regressions confirmed:
- Default path remains identical: auto phase count, auto weeks, auto goals, empty comment.
- Existing `generatePhases('replace')` behavior remains available under the modal’s Generate button.
- Edge function gets additive payload fields only.

### Full implementation
1. `MacroTimeline.tsx`
   - Replace direct `Generate Learning Roadmap` click with `setRoadmapDialogOpen(true)`.
   - Add `GenerateRoadmapDialog` inside same file or new component if cleaner.
   - Modal sections:
     1. Phase count
        - Toggle: `Auto-fit phase count` default ON.
        - Explanation: macro phases are 2–6 larger learning blocks, not individual lessons.
        - If OFF: numeric input 1–8.
        - Suggestion helper: based on deadline, goals, and current pacing.
     2. Weeks per phase
        - Toggle: `Auto-fit timing` default ON.
        - If OFF: numeric average weeks per phase.
        - If phase count manual: optional `Customize each phase` reveals per-phase week inputs.
     3. Priority goals
        - Toggle: `Let AI balance goals` default ON.
        - If OFF: checkbox list of active goals.
     4. Teacher guidance
        - Textarea default empty.
        - Placeholder: `e.g., Prioritize client meetings first. Avoid exam-style grammar drills. Student has a conference in March.`
   - Generate button sends options into `generatePhases`.

2. `useCurriculumPhases.tsx`
   - Extend `generatePhases(mode, opts)` with:
     - `count?: number`
     - `teacherComment?: string`
     - `weeksPerPhase?: number`
     - `phaseWeekTargets?: number[]`
     - `focusedGoalIds?: string[]`
   - Preserve current behavior when opts are empty.

3. `generate-curriculum-phases/index.ts`
   - Parse additive fields.
   - Fetch goal `id` along with title/description/type/date.
   - If `focusedGoalIds` present, add `TEACHER-PRIORITIZED GOALS` block.
   - If manual phase count present, use it exactly within 1–8.
   - If `weeksPerPhase` present and no hard deadline conflict, set `totalWeeks = phaseCount * weeksPerPhase`.
   - If `phaseWeekTargets` present, instruct and sanitize output to those durations where possible.
   - If deadline exists, deadline remains hard wall; manual weeks are clipped/scaled if they exceed deadline.
   - Store new values in `generation_context`.

### Verification checklist
- [ ] Clicking Generate Learning Roadmap opens modal, not immediate generation.
- [ ] Default Generate produces same behavior as before.
- [ ] Manual phase count is reflected in generated phase count.
- [ ] Manual weeks influence `estimated_weeks_start/end` and `generation_context`.
- [ ] Selected goals appear in Edge Function context and generation context.
- [ ] Teacher comment is passed to prompt.

---

## RAG injection update
Files:
- `docs/llm-context.md`
- `public/llms.txt`
- new memory file: `mem/features/onboarding/v6940-welcome-test-retake-roadmap.md`
- `mem/index.md`

Documentation block format:
- PROBLEM: Welcome Test retakes were collapsed into one UI card; auto-apply used wrong skill-results column; missing Welcome Test level/goals did not reliably fill or suggest; 1-Minute Prep lacked readiness guidance; roadmap generation lacked teacher control.
- EDOOQOO SOLUTION: visible retake cards, noncompleted retake guard, retake-aware banners, fixed auto-apply, auto/suggested level+goals, 1-Minute Prep readiness panel, guided roadmap generation modal.
- TECHNICAL MECHANICS: list exact components/hooks/functions/tables.
- RAG KEYWORDS: Welcome Test retake, retake card, attempt_number, previous_attempt_id, test_id, auto apply, manual apply, student level suggestion, main goal suggestion, student_progress_goals, 1-Minute Prep readiness, Learning Roadmap modal, guided curriculum phases, focused goals, weeks per phase.

---

## Final change report format after implementation
- Summary of what was implemented
- Files modified
- Database changes/data repair performed
- Edge functions deployed: YES/NO
- Documentation updated: YES/NO
- Out of scope issues flagged
- Verification result: PASS/FAIL

## Out of scope issues noted
- Full security linter backlog remains separate.
- Evidence-based `target_level`/`current → target` progression remains separate until a real target signal is designed.
- No cleanup/deletion of already-created duplicate incomplete retakes unless explicitly requested.