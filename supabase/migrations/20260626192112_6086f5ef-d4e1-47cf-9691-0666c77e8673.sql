CREATE OR REPLACE FUNCTION public.apply_intake_extraction(p_student_id uuid, p_payload jsonb, p_includes jsonb, p_raw_text text, p_model text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_raw_type text;
  v_mapped_type text;
  v_promoted_main jsonb;
  v_conf_text text;
  v_conf numeric;
  v_date_text text;
  v_target_date date;
  v_update_count int := 0;
BEGIN
  IF v_teacher IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT teacher_id, english_level, main_goal, native_language, main_goal_target_date
    INTO v_owner, v_existing_level, v_existing_main_goal, v_existing_native, v_existing_target_date
    FROM public.students WHERE id = p_student_id;

  IF v_owner IS NULL OR v_owner <> v_teacher THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT count(*) INTO v_recent_count FROM public.student_intake_extractions
    WHERE student_id = p_student_id AND created_at > now() - interval '60 seconds';
  IF v_recent_count > 0 THEN RAISE EXCEPTION 'throttled'; END IF;

  v_snapshot := jsonb_build_object(
    'english_level', v_existing_level,
    'main_goal', v_existing_main_goal,
    'native_language', v_existing_native,
    'main_goal_target_date', to_jsonb(v_existing_target_date)
  );

  v_inc_signals := COALESCE(p_includes->'signals', '{}'::jsonb);
  v_inc_goals := COALESCE(p_includes->'goals', '{}'::jsonb);

  IF COALESCE((p_includes->>'notes')::boolean, true)
     AND COALESCE(length(p_payload->>'summary_notes'), 0) > 0 THEN
    INSERT INTO public.student_knowledge_entries(
      student_id, teacher_id, category, content, tags, entry_source,
      ai_classified, ai_confidence, metadata
    ) VALUES (
      p_student_id, v_teacher, 'Notes',
      p_payload->>'summary_notes', ARRAY['intake_paste'], 'ai-suggested',
      true, 0.9, jsonb_build_object('source','ai_paste_intake')
    ) RETURNING id INTO v_new_id;
    v_entry_ids := array_append(v_entry_ids, v_new_id);
  END IF;

  v_idx := 0;
  FOR v_signal IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'signals','[]'::jsonb))
  LOOP
    IF COALESCE((v_inc_signals->>v_idx::text)::boolean, true) THEN
      v_conf_text := v_signal->>'confidence';
      v_conf := CASE WHEN COALESCE(v_conf_text, '') ~ '^[0-9]+(\.[0-9]+)?$' THEN LEAST(1, GREATEST(0, v_conf_text::numeric)) ELSE 0.6 END;

      INSERT INTO public.student_knowledge_entries(
        student_id, teacher_id, category, content, tags, entry_source,
        ai_classified, ai_confidence, metadata
      ) VALUES (
        p_student_id, v_teacher,
        CASE WHEN v_signal->>'category' IN ('Personal','Skill Assessment') THEN v_signal->>'category' ELSE 'Personal' END,
        COALESCE(NULLIF(v_signal->>'text', ''), '(empty)'),
        ARRAY['intake_paste'], 'ai-suggested', true,
        v_conf,
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

  v_idx := 0;
  FOR v_goal IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'goals','[]'::jsonb))
  LOOP
    IF COALESCE((v_inc_goals->>v_idx::text)::boolean, true) THEN
      v_raw_type := lower(COALESCE(NULLIF(v_goal->>'goal_type',''), 'additional'));
      v_conf_text := v_goal->>'confidence';
      v_conf := CASE WHEN COALESCE(v_conf_text, '') ~ '^[0-9]+(\.[0-9]+)?$' THEN LEAST(1, GREATEST(0, v_conf_text::numeric)) ELSE 0.6 END;
      v_date_text := NULLIF(v_goal->>'target_date','');
      v_target_date := CASE WHEN COALESCE(v_date_text, '') ~ '^\d{4}-\d{2}-\d{2}$' THEN v_date_text::date ELSE NULL END;

      IF v_raw_type = 'main' THEN
        IF v_promoted_main IS NULL THEN v_promoted_main := v_goal; END IF;
      ELSE
        v_mapped_type := CASE WHEN v_raw_type IN ('supporting','additional') THEN v_raw_type ELSE 'supporting' END;
        INSERT INTO public.student_progress_goals(
          student_id, teacher_id, goal_type, title, description, target_date,
          source, accepted_at, metadata
        ) VALUES (
          p_student_id, v_teacher, v_mapped_type,
          COALESCE(NULLIF(v_goal->>'title',''), '(untitled goal)'),
          NULLIF(v_goal->>'description',''),
          v_target_date,
          'ai_paste_intake',
          CASE WHEN v_conf >= 0.75 THEN now() ELSE NULL END,
          jsonb_build_object(
            'evidence_quote', v_goal->>'evidence_quote',
            'confidence', v_conf
          )
        ) RETURNING id INTO v_new_id;
        v_goal_ids := array_append(v_goal_ids, v_new_id);
      END IF;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  IF p_payload ? 'english_level'
     AND COALESCE((p_includes->>'english_level')::boolean, true)
     AND NULLIF(p_payload->'english_level'->>'value','') IS NOT NULL THEN
    v_conf_text := p_payload->'english_level'->>'confidence';
    v_conf := CASE WHEN COALESCE(v_conf_text, '') ~ '^[0-9]+(\.[0-9]+)?$' THEN LEAST(1, GREATEST(0, v_conf_text::numeric)) ELSE 0.6 END;

    IF v_existing_level IS NULL AND v_conf >= 0.75 THEN
      UPDATE public.students SET english_level = p_payload->'english_level'->>'value' WHERE id = p_student_id;
      v_student_updates := v_student_updates || jsonb_build_object('english_level', p_payload->'english_level'->>'value');
      v_update_count := v_update_count + 1;
    ELSE
      INSERT INTO public.student_knowledge_entries(
        student_id, teacher_id, category, content, tags, entry_source,
        ai_classified, ai_confidence, metadata
      ) VALUES (
        p_student_id, v_teacher, 'Notes',
        format('Suggested level: %s', p_payload->'english_level'->>'value'),
        ARRAY['intake_paste','suggested_level'], 'ai-suggested', true,
        v_conf,
        jsonb_build_object('suggested_level', p_payload->'english_level'->>'value',
          'evidence_quote', p_payload->'english_level'->>'evidence_quote', 'source','ai_paste_intake')
      ) RETURNING id INTO v_new_id;
      v_entry_ids := array_append(v_entry_ids, v_new_id);
    END IF;
  END IF;

  IF COALESCE((p_includes->>'main_goal')::boolean, true) THEN
    DECLARE
      v_main_value text;
      v_main_target text;
      v_main_conf_text text;
      v_main_conf numeric := 0;
      v_main_quote text;
      v_main_target_date date;
    BEGIN
      IF p_payload ? 'main_goal' AND NULLIF(p_payload->'main_goal'->>'value','') IS NOT NULL THEN
        v_main_value := p_payload->'main_goal'->>'value';
        v_main_target := p_payload->'main_goal'->>'target_date';
        v_main_conf_text := p_payload->'main_goal'->>'confidence';
        v_main_quote := p_payload->'main_goal'->>'evidence_quote';
      ELSIF v_promoted_main IS NOT NULL THEN
        v_main_value := v_promoted_main->>'title';
        v_main_target := v_promoted_main->>'target_date';
        v_main_conf_text := v_promoted_main->>'confidence';
        v_main_quote := v_promoted_main->>'evidence_quote';
      END IF;

      v_main_conf := CASE WHEN COALESCE(v_main_conf_text, '') ~ '^[0-9]+(\.[0-9]+)?$' THEN LEAST(1, GREATEST(0, v_main_conf_text::numeric)) ELSE 0.6 END;
      v_main_target_date := CASE WHEN COALESCE(NULLIF(v_main_target,''), '') ~ '^\d{4}-\d{2}-\d{2}$' THEN v_main_target::date ELSE NULL END;

      IF v_main_value IS NOT NULL THEN
        IF v_existing_main_goal IS NULL AND v_main_conf >= 0.75 THEN
          UPDATE public.students
             SET main_goal = v_main_value,
                 main_goal_target_date = COALESCE(v_main_target_date, main_goal_target_date)
           WHERE id = p_student_id;
          v_student_updates := v_student_updates || jsonb_build_object(
            'main_goal', v_main_value, 'main_goal_target_date', v_main_target_date);
          v_update_count := v_update_count + 1;
        ELSE
          INSERT INTO public.student_knowledge_entries(
            student_id, teacher_id, category, content, tags, entry_source,
            ai_classified, ai_confidence, metadata
          ) VALUES (
            p_student_id, v_teacher, 'Goals', v_main_value,
            ARRAY['intake_paste','suggested_main_goal'], 'ai-suggested', true,
            v_main_conf,
            jsonb_build_object('suggested_main_goal', v_main_value,
              'evidence_quote', v_main_quote, 'source','ai_paste_intake')
          ) RETURNING id INTO v_new_id;
          v_entry_ids := array_append(v_entry_ids, v_new_id);
        END IF;
      END IF;
    END;
  END IF;

  IF p_payload ? 'native_language'
     AND COALESCE((p_includes->>'native_language')::boolean, true)
     AND NULLIF(p_payload->'native_language'->>'value','') IS NOT NULL THEN
    v_conf_text := p_payload->'native_language'->>'confidence';
    v_conf := CASE WHEN COALESCE(v_conf_text, '') ~ '^[0-9]+(\.[0-9]+)?$' THEN LEAST(1, GREATEST(0, v_conf_text::numeric)) ELSE 0.6 END;

    IF (v_existing_native IS NULL OR v_existing_native = 'Spanish') AND v_conf >= 0.8 THEN
      UPDATE public.students SET native_language = p_payload->'native_language'->>'value' WHERE id = p_student_id;
      v_student_updates := v_student_updates || jsonb_build_object('native_language', p_payload->'native_language'->>'value');
      v_update_count := v_update_count + 1;
    END IF;
  END IF;

  IF p_payload ? 'pacing'
     AND COALESCE((p_includes->>'pacing')::boolean, true)
     AND (p_payload->'pacing') IS NOT NULL THEN
    v_conf_text := p_payload->'pacing'->>'sessions_per_week';
    INSERT INTO public.pacing_proposals(
      student_id, teacher_id, trigger_type, trigger_details,
      current_pacing, proposed_pacing, reasoning, status
    ) VALUES (
      p_student_id, v_teacher, 'manual',
      jsonb_build_object('source','ai_paste_intake',
        'preferred_time', p_payload->'pacing'->>'preferred_time',
        'evidence_quote', p_payload->'pacing'->>'evidence_quote',
        'sessions_per_week', p_payload->'pacing'->>'sessions_per_week'),
      (SELECT COALESCE(dslm_pacing_mode, 30) FROM public.students WHERE id = p_student_id),
      GREATEST(7, LEAST(60, ROUND(30 / NULLIF(COALESCE(CASE WHEN COALESCE(v_conf_text, '') ~ '^[0-9]+(\.[0-9]+)?$' THEN v_conf_text::numeric ELSE 1 END, 1), 0))::int)),
      jsonb_build_array(COALESCE(p_payload->'pacing'->>'rationale','From intake notes')),
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
    'auto_count', COALESCE(array_length(v_entry_ids,1),0) + COALESCE(array_length(v_goal_ids,1),0) + v_update_count
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.apply_intake_extraction(uuid, jsonb, jsonb, text, text) TO authenticated;