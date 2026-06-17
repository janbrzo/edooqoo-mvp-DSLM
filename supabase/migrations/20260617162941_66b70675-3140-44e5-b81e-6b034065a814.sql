-- v6.9.62 P6 — student_intake_extractions table for audit + bulk-undo of paste intake
CREATE TABLE public.student_intake_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  extracted_json jsonb NOT NULL,
  model text NOT NULL,
  created_entry_ids uuid[] NOT NULL DEFAULT '{}',
  created_goal_ids uuid[] NOT NULL DEFAULT '{}',
  created_pacing_proposal_id uuid,
  applied_student_updates jsonb NOT NULL DEFAULT '{}'::jsonb,
  pre_update_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'applied',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.student_intake_extractions TO authenticated;
GRANT ALL ON public.student_intake_extractions TO service_role;

ALTER TABLE public.student_intake_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_own_intake_extractions"
  ON public.student_intake_extractions FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE INDEX idx_student_intake_extractions_student
  ON public.student_intake_extractions (student_id, created_at DESC);

CREATE INDEX idx_student_intake_extractions_teacher
  ON public.student_intake_extractions (teacher_id, created_at DESC);

-- ============== APPLY RPC ==============
CREATE OR REPLACE FUNCTION public.apply_intake_extraction(
  p_student_id uuid,
  p_payload jsonb,
  p_includes jsonb,
  p_raw_text text,
  p_model text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_owner uuid;
  v_snapshot jsonb;
  v_entry_ids uuid[] := ARRAY[]::uuid[];
  v_goal_ids uuid[] := ARRAY[]::uuid[];
  v_pacing_id uuid;
  v_student_updates jsonb := '{}'::jsonb;
  v_extraction_id uuid;
  v_existing_level text;
  v_existing_main_goal text;
  v_existing_native text;
  v_existing_target_date date;
  v_signal jsonb;
  v_goal jsonb;
  v_new_id uuid;
  v_recent_count int;
  v_idx int;
  v_inc_signals jsonb;
  v_inc_goals jsonb;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT teacher_id, english_level, main_goal, native_language, main_goal_target_date
    INTO v_owner, v_existing_level, v_existing_main_goal, v_existing_native, v_existing_target_date
    FROM public.students
    WHERE id = p_student_id;

  IF v_owner IS NULL OR v_owner <> v_teacher THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 60s throttle per student
  SELECT count(*) INTO v_recent_count
    FROM public.student_intake_extractions
    WHERE student_id = p_student_id
      AND created_at > now() - interval '60 seconds';
  IF v_recent_count > 0 THEN
    RAISE EXCEPTION 'throttled';
  END IF;

  v_snapshot := jsonb_build_object(
    'english_level', v_existing_level,
    'main_goal', v_existing_main_goal,
    'native_language', v_existing_native,
    'main_goal_target_date', to_jsonb(v_existing_target_date)
  );

  v_inc_signals := COALESCE(p_includes->'signals', '{}'::jsonb);
  v_inc_goals := COALESCE(p_includes->'goals', '{}'::jsonb);

  -- Notes
  IF COALESCE((p_includes->>'notes')::boolean, true)
     AND COALESCE(length(p_payload->>'summary_notes'), 0) > 0 THEN
    INSERT INTO public.student_knowledge_entries(
      student_id, teacher_id, category, content, tags, entry_source,
      ai_classified, ai_confidence, metadata
    ) VALUES (
      p_student_id, v_teacher, 'Notes',
      p_payload->>'summary_notes',
      ARRAY['intake_paste'], 'ai-suggested',
      true, 0.9,
      jsonb_build_object('source','ai_paste_intake')
    ) RETURNING id INTO v_new_id;
    v_entry_ids := array_append(v_entry_ids, v_new_id);
  END IF;

  -- Signals
  v_idx := 0;
  FOR v_signal IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'signals','[]'::jsonb))
  LOOP
    IF COALESCE((v_inc_signals->>v_idx::text)::boolean, true) THEN
      INSERT INTO public.student_knowledge_entries(
        student_id, teacher_id, category, content, tags, entry_source,
        ai_classified, ai_confidence, metadata
      ) VALUES (
        p_student_id, v_teacher,
        COALESCE(NULLIF(v_signal->>'category',''), 'Personal'),
        COALESCE(v_signal->>'text', '(empty)'),
        ARRAY['intake_paste'],
        'ai-suggested',
        true,
        COALESCE((v_signal->>'confidence')::numeric, 0.6),
        jsonb_build_object(
          'source','ai_paste_intake',
          'evidence_quote', v_signal->>'evidence_quote',
          'sub_category', NULLIF(v_signal->>'subtype',''),
          'element_type', NULLIF(v_signal->>'element_type','')
        )
      ) RETURNING id INTO v_new_id;
      v_entry_ids := array_append(v_entry_ids, v_new_id);
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  -- Goals
  v_idx := 0;
  FOR v_goal IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'goals','[]'::jsonb))
  LOOP
    IF COALESCE((v_inc_goals->>v_idx::text)::boolean, true) THEN
      INSERT INTO public.student_progress_goals(
        student_id, teacher_id, goal_type, title, description, target_date,
        source, accepted_at, metadata
      ) VALUES (
        p_student_id, v_teacher,
        COALESCE(NULLIF(v_goal->>'goal_type',''), 'additional'),
        COALESCE(v_goal->>'title', '(untitled goal)'),
        NULLIF(v_goal->>'description',''),
        CASE WHEN NULLIF(v_goal->>'target_date','') IS NOT NULL
             THEN (v_goal->>'target_date')::date ELSE NULL END,
        'ai_paste_intake',
        CASE WHEN COALESCE((v_goal->>'confidence')::numeric, 0) >= 0.75
             THEN now() ELSE NULL END,
        jsonb_build_object(
          'evidence_quote', v_goal->>'evidence_quote',
          'confidence', COALESCE((v_goal->>'confidence')::numeric, 0)
        )
      ) RETURNING id INTO v_new_id;
      v_goal_ids := array_append(v_goal_ids, v_new_id);
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  -- English level
  IF p_payload ? 'english_level'
     AND COALESCE((p_includes->>'english_level')::boolean, true)
     AND NULLIF(p_payload->'english_level'->>'value','') IS NOT NULL THEN
    IF v_existing_level IS NULL
       AND COALESCE((p_payload->'english_level'->>'confidence')::numeric, 0) >= 0.75 THEN
      UPDATE public.students SET english_level = p_payload->'english_level'->>'value'
        WHERE id = p_student_id;
      v_student_updates := v_student_updates
        || jsonb_build_object('english_level', p_payload->'english_level'->>'value');
    ELSE
      INSERT INTO public.student_knowledge_entries(
        student_id, teacher_id, category, content, tags, entry_source,
        ai_classified, ai_confidence, metadata
      ) VALUES (
        p_student_id, v_teacher, 'Notes',
        format('Suggested level: %s', p_payload->'english_level'->>'value'),
        ARRAY['intake_paste','suggested_level'], 'ai-suggested',
        true,
        COALESCE((p_payload->'english_level'->>'confidence')::numeric, 0.6),
        jsonb_build_object(
          'suggested_level', p_payload->'english_level'->>'value',
          'evidence_quote', p_payload->'english_level'->>'evidence_quote',
          'source','ai_paste_intake'
        )
      ) RETURNING id INTO v_new_id;
      v_entry_ids := array_append(v_entry_ids, v_new_id);
    END IF;
  END IF;

  -- Main goal
  IF p_payload ? 'main_goal'
     AND COALESCE((p_includes->>'main_goal')::boolean, true)
     AND NULLIF(p_payload->'main_goal'->>'value','') IS NOT NULL THEN
    IF v_existing_main_goal IS NULL
       AND COALESCE((p_payload->'main_goal'->>'confidence')::numeric, 0) >= 0.75 THEN
      UPDATE public.students
         SET main_goal = p_payload->'main_goal'->>'value',
             main_goal_target_date = CASE
               WHEN NULLIF(p_payload->'main_goal'->>'target_date','') IS NOT NULL
               THEN (p_payload->'main_goal'->>'target_date')::date
               ELSE main_goal_target_date END
        WHERE id = p_student_id;
      v_student_updates := v_student_updates || jsonb_build_object(
        'main_goal', p_payload->'main_goal'->>'value',
        'main_goal_target_date', p_payload->'main_goal'->>'target_date'
      );
    ELSE
      INSERT INTO public.student_knowledge_entries(
        student_id, teacher_id, category, content, tags, entry_source,
        ai_classified, ai_confidence, metadata
      ) VALUES (
        p_student_id, v_teacher, 'Goals',
        p_payload->'main_goal'->>'value',
        ARRAY['intake_paste','suggested_main_goal'], 'ai-suggested',
        true,
        COALESCE((p_payload->'main_goal'->>'confidence')::numeric, 0.6),
        jsonb_build_object(
          'suggested_main_goal', p_payload->'main_goal'->>'value',
          'evidence_quote', p_payload->'main_goal'->>'evidence_quote',
          'source','ai_paste_intake'
        )
      ) RETURNING id INTO v_new_id;
      v_entry_ids := array_append(v_entry_ids, v_new_id);
    END IF;
  END IF;

  -- Native language
  IF p_payload ? 'native_language'
     AND COALESCE((p_includes->>'native_language')::boolean, true)
     AND NULLIF(p_payload->'native_language'->>'value','') IS NOT NULL THEN
    IF (v_existing_native IS NULL OR v_existing_native = 'Spanish')
       AND COALESCE((p_payload->'native_language'->>'confidence')::numeric, 0) >= 0.8 THEN
      UPDATE public.students
         SET native_language = p_payload->'native_language'->>'value'
        WHERE id = p_student_id;
      v_student_updates := v_student_updates
        || jsonb_build_object('native_language', p_payload->'native_language'->>'value');
    END IF;
  END IF;

  -- Pacing
  IF p_payload ? 'pacing'
     AND COALESCE((p_includes->>'pacing')::boolean, true)
     AND (p_payload->'pacing') IS NOT NULL THEN
    INSERT INTO public.pacing_proposals(
      student_id, teacher_id, trigger_type, trigger_details,
      current_pacing, proposed_pacing, reasoning, status
    ) VALUES (
      p_student_id, v_teacher, 'manual',
      jsonb_build_object(
        'source','ai_paste_intake',
        'preferred_time', p_payload->'pacing'->>'preferred_time',
        'evidence_quote', p_payload->'pacing'->>'evidence_quote',
        'sessions_per_week', p_payload->'pacing'->>'sessions_per_week'
      ),
      (SELECT COALESCE(dslm_pacing_mode, 30) FROM public.students WHERE id = p_student_id),
      GREATEST(7, LEAST(60, ROUND(30 / NULLIF(COALESCE((p_payload->'pacing'->>'sessions_per_week')::numeric, 1), 0))::int)),
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
    'entry_ids', v_entry_ids,
    'goal_ids', v_goal_ids,
    'pacing_proposal_id', v_pacing_id,
    'student_updates', v_student_updates,
    'auto_count', array_length(v_entry_ids,1) + array_length(v_goal_ids,1)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.apply_intake_extraction(uuid, jsonb, jsonb, text, text) TO authenticated;

-- ============== ROLLBACK RPC ==============
CREATE OR REPLACE FUNCTION public.rollback_intake_extraction(p_extraction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.student_intake_extractions WHERE id = p_extraction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF r.status = 'rolled_back' THEN RETURN; END IF;

  UPDATE public.student_knowledge_entries
     SET archived_at = now()
   WHERE id = ANY(r.created_entry_ids) AND archived_at IS NULL;

  UPDATE public.student_progress_goals
     SET archived_at = now()
   WHERE id = ANY(r.created_goal_ids) AND archived_at IS NULL;

  IF r.created_pacing_proposal_id IS NOT NULL THEN
    UPDATE public.pacing_proposals
       SET status = 'rejected', decided_at = now()
     WHERE id = r.created_pacing_proposal_id AND status = 'pending';
  END IF;

  IF r.applied_student_updates ? 'english_level'
     OR r.applied_student_updates ? 'main_goal'
     OR r.applied_student_updates ? 'main_goal_target_date'
     OR r.applied_student_updates ? 'native_language' THEN
    UPDATE public.students s SET
      english_level = CASE WHEN r.applied_student_updates ? 'english_level'
                           THEN NULLIF(r.pre_update_snapshot->>'english_level','')
                           ELSE s.english_level END,
      main_goal = CASE WHEN r.applied_student_updates ? 'main_goal'
                       THEN NULLIF(r.pre_update_snapshot->>'main_goal','')
                       ELSE s.main_goal END,
      main_goal_target_date = CASE WHEN r.applied_student_updates ? 'main_goal_target_date'
                                   THEN NULLIF(r.pre_update_snapshot->>'main_goal_target_date','')::date
                                   ELSE s.main_goal_target_date END,
      native_language = CASE WHEN r.applied_student_updates ? 'native_language'
                             THEN NULLIF(r.pre_update_snapshot->>'native_language','')
                             ELSE s.native_language END
    WHERE s.id = r.student_id;
  END IF;

  UPDATE public.student_intake_extractions SET status = 'rolled_back' WHERE id = p_extraction_id;
END $$;

GRANT EXECUTE ON FUNCTION public.rollback_intake_extraction(uuid) TO authenticated;