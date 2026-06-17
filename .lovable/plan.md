
# Plan v6.9.62 — pełny (Problem 6 przeprojektowany dogłębnie)

> Problemy 1–5 i 7 niezmienione względem poprzedniego planu (powtarzam je w skrócie na końcu). Problem 6 dostaje pełną, dogłębną przebudowę.

---

## Problem 6 — Add Student: "Paste notes about student to set up profile" (v2, dogłębne)

### Cel produktowy (Martha-grade)
Nauczyciel wkleja dowolny strumień świadomości o uczniu — kawałek e-maila, intake form, notatki z rozmowy zaznajamiającej — a system **automatycznie zasiewa profil** w sposób który (a) nigdy nie psuje istniejących danych, (b) jest w 100% odwracalny, (c) jasno odróżnia "auto-applied" od "suggestion", (d) ma audyt trail kto/kiedy/skąd pochodzi każda informacja, (e) nigdy nie blokuje create-student gdy AI padnie.

### Dependency scan (głęboki)
- `src/components/dashboard/AddStudentDialog.tsx` — formularz + handleSubmit
- `src/hooks/useStudents.tsx` — `addStudent()` (zwraca `student.id`)
- `src/hooks/useStudentKnowledge.tsx` — wzorzec `entry_source='ai-suggested'`, `ai_classified`, `ai_confidence`, `archived_at`
- Tabela `student_knowledge_entries` (kategorie: Personal, Skill Assessment, Goals, Notes, Next Lesson Ideas; entry_source enum zawiera 'ai-suggested')
- Tabela `student_progress_goals` (pola `source`, `accepted_at` — idealne do "proposed/accepted")
- Tabela `pacing_proposals` (już istnieje pending→accepted/rejected; trigger_type `manual` — re-use)
- Tabela `students` — pola `english_level`, `main_goal`, `main_goal_target_date`, `dslm_pacing_mode`, `native_language`
- `supabase/functions/classify-knowledge-entry/index.ts` — wzorzec Gateway + tool-call + 429/402 + logModelFailure (kopiujemy strukturę)
- `src/pages/StudentPage.tsx` — strona, na której wyświetlimy review banner po przekierowaniu
- `mem/features/student-knowledge/quick-capture-and-ai-classify.md` — wzorzec do rozszerzenia
- Demo mode: `useDemoContext.isDemoMode` — paste-flow musi być zablokowany toastem

### Root cause / dlaczego nowe podejście
Pierwsza wersja proponowała nową tabelę `paste_extractions` + nowy `Review Sheet`. To dubluje istniejącą infrastrukturę (`student_knowledge_entries` z `ai-suggested`, `student_progress_goals` z `accepted_at`, `pacing_proposals` z pending/accepted/rejected). **Re-use zamiast nowych encji** = mniej regresji, automatyczna integracja z DSLM, istniejące widoki (Skill, Personal, Goals, Knowledge tabs) od razu pokażą wpisy z badge "AI suggested".

### Architektura (final)

#### A. Source-of-truth dla każdego ekstrahowanego pola
| Pole AI | Tabela docelowa | "Auto-applied" = | "Suggestion" = | "Discard" = |
| --- | --- | --- | --- | --- |
| Long notes | `student_knowledge_entries` (`category='Notes'`, `entry_source='ai-suggested'`, `ai_classified=true`, `ai_confidence`, `tags=['intake_paste']`) | wstawiony rekord widoczny w Knowledge | (n/a — notes są zawsze auto) | `archived_at = now()` |
| Signal (motivation/blocker/preference/interest/context) | `student_knowledge_entries` (`category='Personal'` lub `'Skill Assessment'` zależnie od typu, `metadata.sub_category` lub `skill_subtype/element_type`, `entry_source='ai-suggested'`) | wstawiony | (n/a) | `archived_at = now()` |
| Goal + deadline | `student_progress_goals` (`source='ai_paste_intake'`, `accepted_at = now()` jeśli confidence ≥ 0.75; `accepted_at = NULL` jeśli 0.55–0.75) | accepted_at != NULL | accepted_at = NULL (UI: "Suggested goal — Accept/Discard") | `archived_at = now()` |
| CEFR level | **Conditional**: jeżeli `students.english_level IS NULL` AND `confidence ≥ 0.75` → UPDATE `students.english_level = X`. W każdym innym przypadku (już ustawiony, lub confidence niższy) → insert do `student_knowledge_entries` (`category='Notes'`, `tags=['suggested_level', X]`, `metadata.suggested_level=X`, `entry_source='ai-suggested'`) | UPDATE students (gdy spełnione warunki) | Knowledge entry z badge "Suggested level" + Accept (= UPDATE students) | archive entry / discard suggestion |
| Pacing (sessions/week, preferred time) | `pacing_proposals` (`trigger_type='manual'`, `trigger_details={source:'ai_paste_intake', preferred_time, evidence}`, `proposed_pacing`, `status='pending'`) | (zawsze pending — pacing wymaga ludzkiej decyzji, wbrew tabeli powyżej) | status='pending' (UI: standard PacingProposalCard) | status='rejected' |
| Main goal (krótki label) | `students.main_goal` + `students.main_goal_target_date` | UPDATE gdy `students.main_goal IS NULL` AND confidence ≥ 0.75 | Knowledge entry `category='Goals'`, tag `suggested_main_goal` | archive entry |
| Native language | `students.native_language` | UPDATE jeśli w formularzu zostawiono default `Spanish` i confidence ≥ 0.8 | Knowledge entry tag `suggested_native_language` | archive entry |

**Uzasadnienie odstępstwa dla Pacing**: zmiana pacingu wpływa na cały plan nauki — ryzyko regresji za duże, by robić auto-apply. Trzymamy ludzki gate (zgodne z istniejącym `usePacingProposals`).

#### B. Audyt + idempotencja + undo-all (jedna nowa tabela)
Mała tabela log/audit (nie storage właściwych danych — tylko pivot dla "undo all from this paste"):
```sql
CREATE TABLE public.student_intake_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  extracted_json jsonb NOT NULL,
  model text NOT NULL,
  -- ID wszystkich rekordów stworzonych z tej ekstrakcji (do bulk-undo)
  created_entry_ids uuid[] NOT NULL DEFAULT '{}',
  created_goal_ids uuid[] NOT NULL DEFAULT '{}',
  created_pacing_proposal_id uuid,
  applied_student_updates jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- snapshot pól students PRZED auto-apply, do rollbacku
  pre_update_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'applied', -- applied | rolled_back
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.student_intake_extractions TO authenticated;
GRANT ALL ON public.student_intake_extractions TO service_role;
ALTER TABLE public.student_intake_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher_own_intake_extractions"
  ON public.student_intake_extractions FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
```
Plus indeks `(student_id, created_at DESC)`.

#### C. Edge Function: `extract-student-profile`
Re-use wzorca z `classify-knowledge-entry`:
- Endpoint POST, CORS jak we wzorcu.
- Auth: weryfikacja JWT (`supabase.auth.getUser()`). Brak auth → 401.
- Demo mode: brak rozróżnienia po stronie funkcji — to klient decyduje. Dodatkowo: walidacja `teacher_id !== '<demo-uuid>'`.
- Model: `google/gemini-2.5-flash` via Lovable Gateway (`LOVABLE_API_KEY`). Obsługa 429 (rate limit) i 402 (no credits) jak w istniejącym wzorcu.
- Walidacja inputu (zod-like, ręcznie): `raw_text` 40–4000 znaków, `student_id` UUID, `existing_profile` opcjonalny.
- `existing_profile` przekazywane do promptu (`english_level`, `main_goal`, `main_goal_target_date`, `native_language`, `mainGoalSet:boolean`) — AI dostaje kontekst, że poziom już jest, więc traktuje swój wynik jako "suggestion".
- **Limit defensywny**: max 1 ekstrakcja na ucznia / 60s (in-memory throttle w klient + sprawdzenie ostatniego `created_at` z `student_intake_extractions` w funkcji — odrzuca z 429 jeśli <60s).
- Strict tool-call schema:
```json
{
  "name":"extract_student_profile",
  "parameters":{"type":"object","additionalProperties":false,
    "required":["language","summary_notes","signals","goals"],
    "properties":{
      "language":{"type":"string","description":"BCP-47 of paste, e.g. en, pl"},
      "summary_notes":{"type":"string","maxLength":1200,
        "description":"3–6 sentence neutral summary in English"},
      "signals":{"type":"array","maxItems":12,"items":{"type":"object","required":["category","subtype","text","confidence","evidence_quote"],
        "properties":{
          "category":{"enum":["Personal","Skill Assessment"]},
          "subtype":{"type":"string"},
          "element_type":{"type":"string"},
          "text":{"type":"string","maxLength":280},
          "confidence":{"type":"number","minimum":0,"maximum":1},
          "evidence_quote":{"type":"string","maxLength":200}}}},
      "goals":{"type":"array","maxItems":5,"items":{"type":"object","required":["title","confidence","evidence_quote"],
        "properties":{
          "goal_type":{"enum":["main","supporting","additional"],"default":"additional"},
          "title":{"type":"string","maxLength":140},
          "description":{"type":"string","maxLength":400},
          "target_date":{"type":"string","format":"date"},
          "confidence":{"type":"number","minimum":0,"maximum":1},
          "evidence_quote":{"type":"string"}}}},
      "english_level":{"type":"object","properties":{
        "value":{"enum":["A1","A2","B1","B2","C1","C2"]},
        "confidence":{"type":"number"},
        "evidence_quote":{"type":"string"}}},
      "main_goal":{"type":"object","properties":{
        "value":{"type":"string","maxLength":120},
        "target_date":{"type":"string","format":"date"},
        "confidence":{"type":"number"},
        "evidence_quote":{"type":"string"}}},
      "native_language":{"type":"object","properties":{
        "value":{"type":"string","maxLength":40},
        "confidence":{"type":"number"},
        "evidence_quote":{"type":"string"}}},
      "pacing":{"type":"object","properties":{
        "sessions_per_week":{"type":"number","minimum":1,"maximum":7},
        "preferred_time":{"type":"string"},
        "rationale":{"type":"string"},
        "confidence":{"type":"number"},
        "evidence_quote":{"type":"string"}}}}}
}
```
- System prompt (skrót, w pełnej angielskiej formie w kodzie): „You receive raw teacher notes about a 1:1 adult English student. Extract ONLY what is clearly stated or strongly implied. NEVER invent facts. Each field MUST include `evidence_quote` copied verbatim from input. Set `confidence` 0.0–1.0 honestly (≥0.75 = direct statement; 0.55–0.74 = strong implication; <0.55 = guess — DO NOT include). Translate all output to English. If paste includes contradictions, prefer the most recent statement. If unsure, omit. Andragogy: signals must describe professional adult context, not classroom labels."
- Response → JSON dla klienta (BEZ insertowania do DB — funkcja jest pure-extract). Klient sam wykonuje upserts (umożliwia preview-before-commit).

#### D. UX flow (precyzyjnie)
1. **Toggle „Paste notes about student to set up profile (AI, optional)"** — `Switch`, **nie radio**, dodany pod istniejącym `RadioGroup`. Niezależny od trybu `know`/`defer`.
2. Po włączeniu rozwija się sekcja:
   - `Textarea` (min 100 px wys., max 4000 znaków, live counter).
   - Przycisk `Analyze with AI` (disabled gdy `<40` znaków lub `analyzing`).
   - Po kliknięciu: `analyzing=true`, wywołanie `extract-student-profile` z `existing_profile` zawierającym aktualne wartości z formularza (`englishLevel`, `mainGoal`, `mainGoalDeadline`, `nativeLanguage`, mode).
3. **Stan po sukcesie**: pod przyciskiem renderuje się `<ExtractionPreviewCard/>` — collapsible accordion 6 sekcji (Notes, Signals, Goals, Level, Main Goal, Pacing). Każde pole z:
   - Badge `Auto-apply` (zielony, gdy confidence i warunki spełnione) **lub** `Suggestion` (żółty).
   - Tekst + collapsible `evidence: "…"`.
   - Per-pole `Switch` „Include" (default ON; wyłączenie = nie wstawiamy w ogóle do DB).
   - Stopka karty: "5 will be auto-applied · 2 will become suggestions · 1 skipped".
4. **Submit (`handleSubmit`)**:
   1. Tworzy ucznia (`useStudents.addStudent`) jak dziś. Otrzymuje `studentId`.
   2. Jeżeli `extraction` istnieje i `Include` ≥ 1: wywołuje nowy helper `applyIntakeExtraction(studentId, extraction, includes, existingProfile)` (czysto klient-side TS). Helper:
      - Robi snapshot `students` przed updatem (`SELECT english_level, main_goal, main_goal_target_date, native_language`).
      - Wykonuje wszystkie inserty/updates **transakcyjnie** przez **jeden RPC** `apply_intake_extraction(p_student_id uuid, p_payload jsonb, p_includes jsonb)` (SECURITY DEFINER, walidacja `teacher_id = auth.uid()` i `students.teacher_id = auth.uid()`).
      - RPC zwraca `student_intake_extractions.id`, listy wstawionych ID + snapshot.
   3. **Failure-tolerant**: jeżeli RPC zwróci błąd, uczeń już istnieje — toast: "Student created, but intake suggestions failed to apply. Retry from student page." (przycisk Retry w toast → ponawia tylko RPC).
   4. Toast sukcesu z linkiem: `Open profile`.
5. **Po przekierowaniu na `/student/:id?intake={extractionId}`**:
   - Banner u góry profilu: "Profile seeded from your notes — N auto-applied, M suggestions. View details · Undo all".
   - Kliknięcie "Undo all" → RPC `rollback_intake_extraction(extraction_id)` (SECURITY DEFINER) który: archiwizuje wszystkie `student_knowledge_entries` z `created_entry_ids`, soft-deletuje (`archived_at`) goals, ustawia pacing_proposal `status='rejected'`, przywraca pola `students` z `pre_update_snapshot`. Ustawia `student_intake_extractions.status='rolled_back'`.

#### E. RPC SQL (kompletne)
```sql
-- 1) APPLY
CREATE OR REPLACE FUNCTION public.apply_intake_extraction(
  p_student_id uuid, p_payload jsonb, p_includes jsonb, p_raw_text text, p_model text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_owner uuid;
  v_snapshot jsonb;
  v_entry_ids uuid[] := '{}';
  v_goal_ids uuid[] := '{}';
  v_pacing_id uuid;
  v_student_updates jsonb := '{}'::jsonb;
  v_extraction_id uuid;
  v_existing_level text;
  v_existing_main_goal text;
  v_existing_native text;
  v_rec record;
  v_signal jsonb;
  v_goal jsonb;
  v_new_id uuid;
BEGIN
  IF v_teacher IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT teacher_id, english_level, main_goal, native_language
    INTO v_owner, v_existing_level, v_existing_main_goal, v_existing_native
    FROM public.students WHERE id = p_student_id;
  IF v_owner IS NULL OR v_owner <> v_teacher THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- snapshot for rollback
  v_snapshot := jsonb_build_object(
    'english_level', v_existing_level,
    'main_goal', v_existing_main_goal,
    'native_language', v_existing_native,
    'main_goal_target_date', (SELECT main_goal_target_date FROM public.students WHERE id=p_student_id)
  );

  -- Notes (always auto-applied if included)
  IF (p_includes->>'notes')::boolean THEN
    INSERT INTO public.student_knowledge_entries(student_id, teacher_id, category, content, tags, entry_source, ai_classified, ai_confidence, metadata)
    VALUES (p_student_id, v_teacher, 'Notes',
            COALESCE(p_payload->>'summary_notes','(empty)'),
            ARRAY['intake_paste'], 'ai-suggested', true,
            COALESCE((p_payload->'summary_notes_conf')::numeric, 0.9),
            jsonb_build_object('source','ai_paste_intake'))
    RETURNING id INTO v_new_id;
    v_entry_ids := array_append(v_entry_ids, v_new_id);
  END IF;

  -- Signals
  FOR v_signal IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'signals','[]'::jsonb))
  LOOP
    CONTINUE WHEN NOT COALESCE(((p_includes->'signals')->>(v_signal->>'idx'))::boolean, true);
    INSERT INTO public.student_knowledge_entries(student_id, teacher_id, category, content, tags, entry_source, ai_classified, ai_confidence, metadata)
    VALUES (
      p_student_id, v_teacher,
      COALESCE(v_signal->>'category','Personal'),
      v_signal->>'text',
      ARRAY['intake_paste'],
      'ai-suggested', true,
      COALESCE((v_signal->>'confidence')::numeric, 0.6),
      jsonb_build_object(
        'source','ai_paste_intake',
        'evidence_quote', v_signal->>'evidence_quote',
        'sub_category', NULLIF(v_signal->>'subtype',''),
        'element_type', NULLIF(v_signal->>'element_type','')
      )
    ) RETURNING id INTO v_new_id;
    v_entry_ids := array_append(v_entry_ids, v_new_id);
  END LOOP;

  -- Goals
  FOR v_goal IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'goals','[]'::jsonb))
  LOOP
    CONTINUE WHEN NOT COALESCE(((p_includes->'goals')->>(v_goal->>'idx'))::boolean, true);
    INSERT INTO public.student_progress_goals(
      student_id, teacher_id, goal_type, title, description, target_date,
      source, accepted_at, metadata
    ) VALUES (
      p_student_id, v_teacher,
      COALESCE(v_goal->>'goal_type','additional'),
      v_goal->>'title',
      NULLIF(v_goal->>'description',''),
      NULLIF(v_goal->>'target_date','')::date,
      'ai_paste_intake',
      CASE WHEN (v_goal->>'confidence')::numeric >= 0.75 THEN now() ELSE NULL END,
      jsonb_build_object('evidence_quote', v_goal->>'evidence_quote',
                         'confidence',(v_goal->>'confidence')::numeric)
    ) RETURNING id INTO v_new_id;
    v_goal_ids := array_append(v_goal_ids, v_new_id);
  END LOOP;

  -- English level (auto only when null & high conf, else knowledge entry)
  IF p_payload ? 'english_level' AND COALESCE((p_includes->>'english_level')::boolean,true) THEN
    IF v_existing_level IS NULL AND ((p_payload->'english_level'->>'confidence')::numeric) >= 0.75 THEN
      UPDATE public.students SET english_level = p_payload->'english_level'->>'value' WHERE id = p_student_id;
      v_student_updates := v_student_updates || jsonb_build_object('english_level', p_payload->'english_level'->>'value');
    ELSE
      INSERT INTO public.student_knowledge_entries(student_id, teacher_id, category, content, tags, entry_source, ai_classified, ai_confidence, metadata)
      VALUES (p_student_id, v_teacher, 'Notes',
              format('Suggested level: %s', p_payload->'english_level'->>'value'),
              ARRAY['intake_paste','suggested_level'], 'ai-suggested', true,
              (p_payload->'english_level'->>'confidence')::numeric,
              jsonb_build_object('suggested_level', p_payload->'english_level'->>'value',
                                 'evidence_quote', p_payload->'english_level'->>'evidence_quote'))
      RETURNING id INTO v_new_id;
      v_entry_ids := array_append(v_entry_ids, v_new_id);
    END IF;
  END IF;

  -- Main goal (similar logic for students.main_goal & main_goal_target_date)
  IF p_payload ? 'main_goal' AND COALESCE((p_includes->>'main_goal')::boolean,true) THEN
    IF v_existing_main_goal IS NULL AND ((p_payload->'main_goal'->>'confidence')::numeric) >= 0.75 THEN
      UPDATE public.students
         SET main_goal = p_payload->'main_goal'->>'value',
             main_goal_target_date = NULLIF(p_payload->'main_goal'->>'target_date','')::date
       WHERE id = p_student_id;
      v_student_updates := v_student_updates || jsonb_build_object(
        'main_goal', p_payload->'main_goal'->>'value',
        'main_goal_target_date', p_payload->'main_goal'->>'target_date');
    ELSE
      INSERT INTO public.student_knowledge_entries(student_id, teacher_id, category, content, tags, entry_source, ai_classified, ai_confidence, metadata)
      VALUES (p_student_id, v_teacher, 'Goals',
              p_payload->'main_goal'->>'value',
              ARRAY['intake_paste','suggested_main_goal'], 'ai-suggested', true,
              (p_payload->'main_goal'->>'confidence')::numeric,
              jsonb_build_object('suggested_main_goal', p_payload->'main_goal'->>'value',
                                 'evidence_quote', p_payload->'main_goal'->>'evidence_quote'))
      RETURNING id INTO v_new_id;
      v_entry_ids := array_append(v_entry_ids, v_new_id);
    END IF;
  END IF;

  -- Native language (auto only when default 'Spanish' kept and high conf)
  IF p_payload ? 'native_language' AND COALESCE((p_includes->>'native_language')::boolean,true) THEN
    IF (v_existing_native IS NULL OR v_existing_native = 'Spanish')
       AND ((p_payload->'native_language'->>'confidence')::numeric) >= 0.8 THEN
      UPDATE public.students SET native_language = p_payload->'native_language'->>'value' WHERE id = p_student_id;
      v_student_updates := v_student_updates || jsonb_build_object('native_language', p_payload->'native_language'->>'value');
    END IF;
  END IF;

  -- Pacing → pacing_proposals (ALWAYS pending; needs human accept)
  IF p_payload ? 'pacing' AND COALESCE((p_includes->>'pacing')::boolean,true) THEN
    INSERT INTO public.pacing_proposals(
      student_id, teacher_id, trigger_type, trigger_details,
      current_pacing, proposed_pacing, reasoning, status
    ) VALUES (
      p_student_id, v_teacher, 'manual',
      jsonb_build_object('source','ai_paste_intake',
                         'preferred_time', p_payload->'pacing'->>'preferred_time',
                         'evidence_quote', p_payload->'pacing'->>'evidence_quote'),
      (SELECT COALESCE(dslm_pacing_mode,30) FROM public.students WHERE id=p_student_id),
      GREATEST(7, LEAST(60, ROUND(30 * COALESCE((p_payload->'pacing'->>'sessions_per_week')::numeric,1))::int)),
      ARRAY[COALESCE(p_payload->'pacing'->>'rationale','From intake notes')],
      'pending'
    ) RETURNING id INTO v_pacing_id;
  END IF;

  INSERT INTO public.student_intake_extractions(
    teacher_id, student_id, raw_text, extracted_json, model,
    created_entry_ids, created_goal_ids, created_pacing_proposal_id,
    applied_student_updates, pre_update_snapshot
  ) VALUES (
    v_teacher, p_student_id, p_raw_text, p_payload, p_model,
    v_entry_ids, v_goal_ids, v_pacing_id, v_student_updates, v_snapshot
  ) RETURNING id INTO v_extraction_id;

  RETURN jsonb_build_object(
    'extraction_id', v_extraction_id,
    'entries', v_entry_ids,
    'goals', v_goal_ids,
    'pacing_proposal_id', v_pacing_id,
    'student_updates', v_student_updates
  );
END $$;
GRANT EXECUTE ON FUNCTION public.apply_intake_extraction(uuid,jsonb,jsonb,text,text) TO authenticated;

-- 2) ROLLBACK
CREATE OR REPLACE FUNCTION public.rollback_intake_extraction(p_extraction_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.student_intake_extractions WHERE id = p_extraction_id;
  IF NOT FOUND OR r.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF r.status = 'rolled_back' THEN RETURN; END IF;
  -- archive entries
  UPDATE public.student_knowledge_entries SET archived_at = now()
    WHERE id = ANY(r.created_entry_ids) AND archived_at IS NULL;
  -- archive goals
  UPDATE public.student_progress_goals SET archived_at = now()
    WHERE id = ANY(r.created_goal_ids) AND archived_at IS NULL;
  -- reject pacing proposal if still pending
  IF r.created_pacing_proposal_id IS NOT NULL THEN
    UPDATE public.pacing_proposals SET status='rejected', decided_at=now()
      WHERE id = r.created_pacing_proposal_id AND status='pending';
  END IF;
  -- restore students fields from snapshot
  UPDATE public.students s SET
    english_level = COALESCE(r.pre_update_snapshot->>'english_level', s.english_level),
    main_goal     = COALESCE(r.pre_update_snapshot->>'main_goal', s.main_goal),
    main_goal_target_date = COALESCE(NULLIF(r.pre_update_snapshot->>'main_goal_target_date','')::date, s.main_goal_target_date),
    native_language = COALESCE(r.pre_update_snapshot->>'native_language', s.native_language)
   WHERE s.id = r.student_id
     -- only restore the keys we actually changed
     AND (r.applied_student_updates ? 'english_level'
       OR r.applied_student_updates ? 'main_goal'
       OR r.applied_student_updates ? 'main_goal_target_date'
       OR r.applied_student_updates ? 'native_language');
  UPDATE public.student_intake_extractions SET status='rolled_back' WHERE id = p_extraction_id;
END $$;
GRANT EXECUTE ON FUNCTION public.rollback_intake_extraction(uuid) TO authenticated;
```

#### F. Edge-case handling (zaopiekowane)
1. **AI down / timeout** → toast "AI is busy, you can still create the student"; przycisk `Create student without paste` zostaje aktywny.
2. **Paste w innym języku** → AI promptowane do tłumaczenia output na EN; `language` w odpowiedzi zapisany w `extracted_json`.
3. **Duplikat paste (idempotencja)** — przed RPC liczymy `sha256(raw_text)`; sprawdzamy `student_intake_extractions` (last 5 min, same student) → blokujemy z toastem.
4. **Bardzo długi paste (>4000)** — `maxLength` w textarea + walidacja klient + server (zwraca 400).
5. **Pusty/śmieciowy paste** — AI zwraca `signals:[], goals:[]` itd. → UI: "We couldn't extract anything actionable. Try adding more context." Brak insertów.
6. **Konflikt z trybem `know`** — gdy tryb `know` ustawi level=B2, a AI sugeruje C1 z conf 0.9 → C1 ląduje jako Suggestion (nie nadpisuje). Banner: "Conflict: your input B2 was kept; AI suggested C1 (suggestion saved)."
7. **Demo mode** → przycisk `Analyze` blokuje `showDemoBlockedToast('AI paste extraction')`.
8. **Rate limit / 402** → toast: "AI credits exhausted — add credits in workspace settings". Brak insertów.
9. **Half-success** (RPC ok, ale część rekordów się nie wstawiła) — RPC jest jedną transakcją → all-or-nothing; nie ma "half".
10. **Rollback po częściowym Accept** — Undo all to **soft delete** (`archived_at`), więc dane są nadal w DB do audytu; pojawi się w `student_intake_extractions.status='rolled_back'`.
11. **Race**: dwa pastes pod rząd — frontend disabluje `Analyze` aż do odpowiedzi; serwer 60s throttle.
12. **PII concerns** — `raw_text` zapisany w DB (RLS only-owner). Wyraźna informacja pod textarea: "Stored only on your account, used to seed the profile."
13. **Brak `student_id` przed `addStudent`** — paste-flow działa **po** utworzeniu studenta (apply jest atomowe po stronie RPC). UI: textarea i Analyze są dostępne PRZED submitem (preview tylko), insert dopiero po utworzeniu studenta. Pozwala to nauczycielowi zobaczyć co AI proponuje przed kliknięciem Add.
14. **Anulowanie** — Cancel w dialogu kasuje `extraction` z lokalnego state; nic nie zostaje w DB.
15. **Sub-category enum** — gdy AI zwróci `subtype` poza enum → wstawiamy do `metadata.subtype_raw` i nie wypełniamy kolumny typu; UI nadal pokazuje.
16. **`evidence_quote` po polsku** w pastę EN UI → trzymamy oryginał (nie tłumaczymy quotes) — wzmacnia "fidelity".

#### G. UI komponenty (nowe pliki)
- `src/components/dashboard/PasteIntakeSection.tsx` — toggle + textarea + Analyze + preview card. Eksportuje propy: `value, onChange, extraction, setExtraction, existingProfile, onAnalyzeError`. Internalnie call do edge function.
- `src/components/dashboard/ExtractionPreviewCard.tsx` — accordion 6 sekcji z per-pole `Switch Include`. Liczy summary "X auto / Y suggestions / Z skipped".
- `src/components/student/IntakeExtractionBanner.tsx` — banner widoczny na `/student/:id` gdy `?intake=ID`; "View details" → expandable list, "Undo all" → confirm dialog + RPC.
- `src/lib/intake/applyIntakeExtraction.ts` — thin TS wrapper wokół RPC (zbiera `includes` z UI state, woła `supabase.rpc('apply_intake_extraction', ...)`).

#### H. Verification checklist
- [ ] Toggle Paste niezależny od `know`/`defer` (oba tryby działają z paste włączonym).
- [ ] AI timeout → student się tworzy, toast informuje.
- [ ] Notes auto-applied gdy Include = ON.
- [ ] Signal confidence 0.50 → odfiltrowany (nie pokazuje się w UI).
- [ ] Signal confidence 0.60 → pojawia się jako `Suggestion`.
- [ ] Goal confidence 0.85 → `accepted_at = now()`.
- [ ] Level NULL + confidence 0.80 → UPDATE students.english_level.
- [ ] Level B2 already set + AI C1 0.90 → knowledge entry `suggested_level` (NO update).
- [ ] Pacing zawsze ląduje jako `pacing_proposals.status='pending'` (klik PacingBell pokazuje).
- [ ] `Undo all` przywraca pre_update_snapshot i archiwizuje wszystkie wpisy.
- [ ] Re-paste tego samego tekstu <60s → 429 z toastem.
- [ ] Demo mode → toast blokujący, brak wywołań.
- [ ] RLS: drugi nauczyciel nie widzi `student_intake_extractions` cudzego ucznia.
- [ ] Linter `supabase--linter` po migracji: zero nowych warningów.

#### I. RAG injection (Problem 6)
Wpis do `mem/features/onboarding/v6962-paste-intake.md`:
- PROBLEM: nauczyciel nie ma kanału na bulk-onboarding studenta z istniejących notatek.
- EDOOQOO SOLUTION: opt-in toggle „Paste notes…" → AI ekstrakcja → atomic RPC apply → reuse istniejących encji (student_knowledge_entries / student_progress_goals / pacing_proposals / students) + audyt w `student_intake_extractions` + 1-klik Undo all.
- TECHNICAL MECHANICS: lista wszystkich plików + RPC.
- RAG KEYWORDS: paste intake, AI extraction, evidence-quote, confidence threshold 0.55/0.75, idempotent intake, intake rollback, pacing proposal manual, suggested_level, suggested_main_goal, accepted_at NULL goals.

---

# Reszta planu (Problemy 1–5, 7) — niezmieniona, w skrócie

## P1 — Multi-job switcher
W `GlobalGeneratingModal.tsx` filtr: `(j.originTabId == null || j.originTabId === tabId)`. W `generationJobRegistry.startGenerationJob` default `originTabId = getTabId()`.

## P2 — Vertex 404
`supabase/functions/generate-image/index.ts`: `PRIMARY_MODEL = Deno.env.get('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image'`; fallback chain → `gemini-2.5-flash-image` przy 404. `MediaSection.tsx` credit → "Google Gemini Image (Vertex AI)".

## P3 — Imię w bannerze "Generation resumed" jako link
W `GeneratingModal.tsx` (linia ~558) imię z `studentId` → `<a target="_blank" href="/student/:id">`.

## P4 — Default Background = Waves dla zalogowanych
W `AppBackground.tsx` + `BackgroundPatternSwitcher.tsx` nowy `MIGRATION_KEY = 'edooqoo-bg-pattern-migrated-v2'`. W `useEffect` po `supabase.auth.getSession()`: auth → `waves`, anon → `particles`. Po migracji klucz oznaczany; ręczny wybór respektowany.

## P5 — Mini-panel: time/%/bar; duży modal: topic preview
- `ActiveGenerationMiniPanel.tsx::MiniPanelCard`: live elapsed (interval 1s) + `0:42 · 38%` + cienki `<Progress h-1>`.
- `GeneratingModal.tsx`: pod studentName 1-linia truncated topic `“…”`; kompensacja w `max-h-[42vh]` listy sekcji.

## P7 — Student dodaje flashcards na `/my`
Migracja: `flashcard_sets.allow_student_contributions boolean DEFAULT true` + SECURITY DEFINER RPC `student_add_flashcard(p_set_id, p_student_email, p_front, p_back, p_native)`. W `StudentHubFlashcards.tsx` przycisk `➕ Add card` → dialog → `supabase.rpc(...)` → refetch.

---

# RAG combined + Final report (po wdrożeniu)
Wpis v6.9.62 do `docs/llm-context.md` i `public/llms.txt` obejmie wszystkie 7 problemów.

**Pliki zmieniane (full list):**
- src/components/generation/GlobalGeneratingModal.tsx
- src/lib/worksheet/generationJobRegistry.ts
- src/components/generation/ActiveGenerationMiniPanel.tsx
- src/components/GeneratingModal.tsx
- src/components/ui/AppBackground.tsx
- src/components/ui/BackgroundPatternSwitcher.tsx
- src/components/dashboard/AddStudentDialog.tsx
- src/components/dashboard/PasteIntakeSection.tsx (new)
- src/components/dashboard/ExtractionPreviewCard.tsx (new)
- src/components/student/IntakeExtractionBanner.tsx (new)
- src/pages/StudentPage.tsx (banner mount)
- src/lib/intake/applyIntakeExtraction.ts (new)
- src/pages/StudentHubFlashcards.tsx
- src/components/student-hub/AddStudentFlashcardDialog.tsx (new)
- src/components/worksheet/MediaSection.tsx
- supabase/functions/generate-image/index.ts
- supabase/functions/extract-student-profile/index.ts (new)
- migracje (3): `student_intake_extractions` + `apply_intake_extraction` + `rollback_intake_extraction`; `flashcard_sets.allow_student_contributions` + `student_add_flashcard`
- docs/llm-context.md, public/llms.txt, mem/index.md, mem/features/onboarding/v6962-*.md, mem/features/onboarding/v6962-paste-intake.md

WORKSHEET GENERATION ENGINE: nietknięty.

Czekam na "OK" aby przejść do build mode i wdrożyć w jednym przebiegu.
