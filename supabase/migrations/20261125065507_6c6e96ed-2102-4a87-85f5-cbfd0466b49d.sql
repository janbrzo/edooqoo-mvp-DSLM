ALTER TABLE public.public_placement_reports ADD COLUMN IF NOT EXISTS placement_next_steps JSONB;

CREATE OR REPLACE FUNCTION public.reserve_placement_next_steps(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.public_placement_reports%ROWTYPE; v_lease UUID := gen_random_uuid(); v_attempts INTEGER;
BEGIN
  SELECT * INTO r FROM public.public_placement_reports WHERE report_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  IF r.expires_at <= now() THEN RETURN jsonb_build_object('status','expired'); END IF;
  IF r.placement_next_steps->>'status' IN ('ready','running') THEN RETURN r.placement_next_steps; END IF;
  IF r.claimed_by IS NOT NULL THEN RETURN jsonb_build_object('status','claimed'); END IF;
  IF r.unclaimed_student_id IS NULL OR r.unclaimed_test_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.student_tests t JOIN public.student_learning_profiles lp ON lp.welcome_test_id = t.id AND lp.student_id = t.student_id
    JOIN public.students s ON s.id = t.student_id
    WHERE t.id = r.unclaimed_test_id AND t.student_id = r.unclaimed_student_id AND t.status = 'reviewed'
      AND s.teacher_id = '00000000-0000-0000-0000-000000000000' AND s.deleted_at IS NULL
  ) THEN RETURN jsonb_build_object('status','not_ready'); END IF;
  v_attempts := COALESCE((r.placement_next_steps->>'attempts')::INTEGER,0);
  IF r.placement_next_steps->>'terminal' = 'true' OR v_attempts >= 2 THEN RETURN r.placement_next_steps; END IF;
  UPDATE public.public_placement_reports SET placement_next_steps = jsonb_build_object('status','running','lease',v_lease,'attempts',v_attempts+1), updated_at = now() WHERE id = r.id;
  RETURN jsonb_build_object('status','reserved','lease',v_lease,'studentId',r.unclaimed_student_id,'testId',r.unclaimed_test_id);
END $$;
REVOKE ALL ON FUNCTION public.reserve_placement_next_steps(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_placement_next_steps(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_placement_next_steps(p_token TEXT, p_lease UUID, p_suggestions JSONB, p_context JSONB DEFAULT '{}'::JSONB, p_error TEXT DEFAULT NULL, p_terminal BOOLEAN DEFAULT FALSE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.public_placement_reports%ROWTYPE; s public.students%ROWTYPE; item JSONB; saved JSONB := '[]'::JSONB; sid UUID; seq INTEGER; state JSONB;
BEGIN
  SELECT * INTO r FROM public.public_placement_reports WHERE report_token = p_token FOR UPDATE;
  IF NOT FOUND OR r.placement_next_steps->>'status' <> 'running' OR r.placement_next_steps->>'lease' IS DISTINCT FROM p_lease::TEXT THEN RAISE EXCEPTION 'Generation reservation unavailable'; END IF;
  IF p_error IS NOT NULL THEN
    state := jsonb_build_object('status','failed','error',left(p_error,500),'terminal',p_terminal,'attempts',r.placement_next_steps->'attempts');
  ELSE
    IF jsonb_typeof(p_suggestions) <> 'array' OR jsonb_array_length(p_suggestions) <> 3 THEN RAISE EXCEPTION 'Exactly three proposals required'; END IF;
    SELECT * INTO s FROM public.students WHERE id = r.unclaimed_student_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND OR (s.teacher_id <> '00000000-0000-0000-0000-000000000000' AND s.teacher_id IS DISTINCT FROM r.claimed_by) THEN RAISE EXCEPTION 'Placement learner unavailable'; END IF;
    SELECT COALESCE(MAX(sequence_number),0) INTO seq FROM public.future_worksheet_suggestions WHERE student_id = s.id AND suggestion_kind = 'next_step' AND deleted_at IS NULL;
    FOR item IN SELECT value FROM jsonb_array_elements(p_suggestions) LOOP
      IF length(trim(item->>'topic')) < 1 OR item->>'difficulty' NOT IN ('A1','A2','B1','B2','C1','C2') THEN RAISE EXCEPTION 'Invalid lesson proposal'; END IF;
      seq := seq + 1;
      INSERT INTO public.future_worksheet_suggestions(student_id,teacher_id,sequence_number,suggested_topic,suggested_goal,suggested_additional_info,suggested_grammar_focus,suggested_exercises,suggested_exercise_focus_map,rationale,source,suggestion_kind,focus_skill_names,difficulty_level,estimated_impact,generation_context)
      VALUES(s.id,s.teacher_id,seq,item->>'topic',item->>'goal',item->>'additionalInfo',item->>'grammarFocus',ARRAY(SELECT jsonb_array_elements_text(item->'exercises')),item->'exerciseFocusMap',item->>'rationale','ai_generated','next_step',ARRAY(SELECT jsonb_array_elements_text(item->'focusSkills')),item->>'difficulty',item->'estimatedImpact',COALESCE(p_context,'{}'::JSONB) || jsonb_build_object('source','public_placement','report_id',r.id,'test_id',r.unclaimed_test_id,'focus_skill_keys',item->'focusSkillKeys')) RETURNING id INTO sid;
      saved := saved || jsonb_build_array(item || jsonb_build_object('id',sid));
    END LOOP;
    state := jsonb_build_object('status','ready','suggestions',saved,'attempts',r.placement_next_steps->'attempts');
  END IF;
  UPDATE public.public_placement_reports SET placement_next_steps = state, updated_at = now() WHERE id = r.id;
  RETURN state;
END $$;
REVOKE ALL ON FUNCTION public.finish_placement_next_steps(TEXT,UUID,JSONB,JSONB,TEXT,BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_placement_next_steps(TEXT,UUID,JSONB,JSONB,TEXT,BOOLEAN) TO service_role;