ALTER TABLE public.public_placement_reports ADD COLUMN IF NOT EXISTS placement_learning_path JSONB;

CREATE OR REPLACE FUNCTION public.reserve_placement_learning_path(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.public_placement_reports%ROWTYPE;
  v_lease UUID := gen_random_uuid();
  v_attempts INTEGER;
BEGIN
  SELECT * INTO r FROM public.public_placement_reports WHERE report_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  IF r.expires_at <= now() THEN RETURN jsonb_build_object('status','expired'); END IF;
  IF r.placement_learning_path->>'status' IN ('ready','running') THEN RETURN r.placement_learning_path; END IF;
  IF r.claimed_by IS NOT NULL THEN RETURN jsonb_build_object('status','claimed'); END IF;
  IF r.unclaimed_student_id IS NULL OR r.unclaimed_test_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.student_tests t
    JOIN public.student_learning_profiles lp ON lp.welcome_test_id = t.id AND lp.student_id = t.student_id
    JOIN public.students s ON s.id = t.student_id
    WHERE t.id = r.unclaimed_test_id AND t.student_id = r.unclaimed_student_id AND t.status = 'reviewed'
      AND s.teacher_id = '00000000-0000-0000-0000-000000000000' AND s.deleted_at IS NULL
  ) THEN RETURN jsonb_build_object('status','not_ready'); END IF;
  v_attempts := COALESCE((r.placement_learning_path->>'attempts')::INTEGER, 0);
  IF r.placement_learning_path->>'terminal' = 'true' OR v_attempts >= 2 THEN RETURN r.placement_learning_path; END IF;
  UPDATE public.public_placement_reports
  SET placement_learning_path = jsonb_build_object('status','running','lease',v_lease,'attempts',v_attempts+1), updated_at = now()
  WHERE id = r.id;
  RETURN jsonb_build_object('status','reserved','lease',v_lease,'studentId',r.unclaimed_student_id,'testId',r.unclaimed_test_id);
END $$;
REVOKE ALL ON FUNCTION public.reserve_placement_learning_path(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_placement_learning_path(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_placement_learning_path(
  p_token TEXT,
  p_lease UUID,
  p_phases JSONB,
  p_context JSONB DEFAULT '{}'::JSONB,
  p_error TEXT DEFAULT NULL,
  p_terminal BOOLEAN DEFAULT FALSE
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.public_placement_reports%ROWTYPE;
  s public.students%ROWTYPE;
  item JSONB;
  saved JSONB := '[]'::JSONB;
  pid UUID;
  seq INTEGER;
  w_start INTEGER;
  w_end INTEGER;
  prev_end INTEGER := 0;
  state JSONB;
BEGIN
  SELECT * INTO r FROM public.public_placement_reports WHERE report_token = p_token FOR UPDATE;
  IF NOT FOUND OR r.placement_learning_path->>'status' <> 'running' OR r.placement_learning_path->>'lease' IS DISTINCT FROM p_lease::TEXT THEN
    RAISE EXCEPTION 'Generation reservation unavailable';
  END IF;
  IF p_error IS NOT NULL THEN
    state := jsonb_build_object('status','failed','error',left(p_error,500),'terminal',p_terminal,'attempts',r.placement_learning_path->'attempts');
  ELSE
    IF jsonb_typeof(p_phases) <> 'array' OR jsonb_array_length(p_phases) < 3 OR jsonb_array_length(p_phases) > 5 THEN
      RAISE EXCEPTION 'Between three and five phases required';
    END IF;
    SELECT * INTO s FROM public.students WHERE id = r.unclaimed_student_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND OR (s.teacher_id <> '00000000-0000-0000-0000-000000000000' AND s.teacher_id IS DISTINCT FROM r.claimed_by) THEN
      RAISE EXCEPTION 'Placement learner unavailable';
    END IF;
    SELECT COALESCE(MAX(sequence_number), 0) INTO seq FROM public.dslm_curriculum_phases WHERE student_id = s.id AND deleted_at IS NULL;
    FOR item IN SELECT value FROM jsonb_array_elements(p_phases) LOOP
      w_start := (item->>'estimatedWeeksStart')::INTEGER;
      w_end := (item->>'estimatedWeeksEnd')::INTEGER;
      IF length(trim(COALESCE(item->>'title',''))) < 1 OR w_start IS NULL OR w_end IS NULL OR w_start < 1 OR w_end < w_start OR (prev_end > 0 AND w_start <> prev_end + 1) THEN
        RAISE EXCEPTION 'Invalid learning phase';
      END IF;
      prev_end := w_end;
      seq := seq + 1;
      INSERT INTO public.dslm_curriculum_phases(
        student_id, teacher_id, sequence_number, title, description, focus_areas,
        estimated_weeks_start, estimated_weeks_end, status, rationale, generation_context
      )
      VALUES(
        s.id, s.teacher_id, seq, item->>'title', item->>'description',
        ARRAY(SELECT jsonb_array_elements_text(item->'focusAreas')),
        w_start, w_end, 'planned', item->>'rationale',
        COALESCE(p_context,'{}'::JSONB) || jsonb_build_object('source','public_placement','report_id',r.id,'test_id',r.unclaimed_test_id)
      ) RETURNING id INTO pid;
      saved := saved || jsonb_build_array(item || jsonb_build_object('id', pid, 'sequenceNumber', seq));
    END LOOP;
    state := jsonb_build_object('status','ready','phases',saved,'attempts',r.placement_learning_path->'attempts');
  END IF;
  UPDATE public.public_placement_reports SET placement_learning_path = state, updated_at = now() WHERE id = r.id;
  RETURN state;
END $$;
REVOKE ALL ON FUNCTION public.finish_placement_learning_path(TEXT,UUID,JSONB,JSONB,TEXT,BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_placement_learning_path(TEXT,UUID,JSONB,JSONB,TEXT,BOOLEAN) TO service_role;