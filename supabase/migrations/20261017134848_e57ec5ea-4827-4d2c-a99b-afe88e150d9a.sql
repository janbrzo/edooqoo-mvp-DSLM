CREATE OR REPLACE FUNCTION public.dslm_effective_mastery(p_mastery numeric, p_last_event_at timestamptz, p_now timestamptz)
RETURNS numeric LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = public
AS $function$
  SELECT CASE
    WHEN p_mastery IS NULL OR p_mastery::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric
    WHEN p_last_event_at IS NULL OR extract(epoch FROM (p_now - p_last_event_at)) <= 14 * 86400 THEN p_mastery
    ELSE greatest(0::numeric, least(p_mastery,
      round(p_mastery * (0.5 + 0.5 * power(0.5::numeric,
        (extract(epoch FROM (p_now - p_last_event_at)) / 86400.0 - 14) / 60)), 1)))
  END;
$function$;
REVOKE ALL ON FUNCTION public.dslm_effective_mastery(numeric, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dslm_effective_mastery(numeric, timestamptz, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_student_dslm_state_vector(p_student_id uuid, p_teacher_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $function$
DECLARE
  v_now timestamptz := statement_timestamp();
  v_result jsonb;
BEGIN
  IF p_student_id IS NULL OR p_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Student and teacher are required' USING ERRCODE = '22023';
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM p_teacher_id THEN
    RAISE EXCEPTION 'Student state access denied' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.students s
    WHERE s.id = p_student_id AND s.teacher_id = p_teacher_id AND s.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Student state access denied' USING ERRCODE = '42501';
  END IF;
  WITH skills AS MATERIALIZED (
    SELECT m.skill_name, m.skill_category,
      CASE WHEN m.micro_skill IS NULL OR m.micro_skill IN ('', 'other', 'flashcard')
        THEN m.skill_category ELSE m.micro_skill END AS micro_skill,
      m.current_mastery AS raw_mastery,
      public.dslm_effective_mastery(m.current_mastery, m.last_event_at, v_now) AS effective_mastery,
      m.trend, m.total_events, m.last_event_at
    FROM public.student_skill_metrics m
    WHERE m.student_id = p_student_id AND m.teacher_id = p_teacher_id
      AND m.skill_name NOT LIKE 'flashcard:%'
      AND m.current_mastery BETWEEN 0 AND 100 AND m.total_events > 0
  ), groups AS MATERIALIZED (
    SELECT skill_category, micro_skill,
      round(avg(effective_mastery), 1) AS effective_mastery,
      round(avg(raw_mastery), 1) AS raw_mastery,
      count(*) AS nano_skill_count, sum(total_events) AS skill_observation_count,
      max(last_event_at) AS last_event_at,
      bool_or(trend = 'declining' AND total_events >= 4) AS declining
    FROM skills GROUP BY skill_category, micro_skill
  ), strongest AS (
    SELECT * FROM groups WHERE effective_mastery > 80
    ORDER BY effective_mastery DESC, skill_category, micro_skill LIMIT 5
  ), gaps AS (
    SELECT * FROM groups WHERE effective_mastery < 50 OR declining
      OR (raw_mastery > 80 AND effective_mastery <= 80)
    ORDER BY effective_mastery, skill_category, micro_skill LIMIT 5
  ), decaying AS (
    SELECT * FROM groups WHERE raw_mastery > 80
      AND extract(epoch FROM (v_now - last_event_at)) > 30 * 86400
    ORDER BY effective_mastery, skill_category, micro_skill LIMIT 5
  ), focus AS (
    SELECT s.*, CASE WHEN EXISTS (SELECT 1 FROM gaps g
      WHERE g.skill_category = s.skill_category AND g.micro_skill = s.micro_skill)
      THEN 'critical_gap' ELSE 'spaced_review' END AS reason
    FROM skills s
    WHERE EXISTS (SELECT 1 FROM gaps g WHERE g.skill_category = s.skill_category AND g.micro_skill = s.micro_skill)
      OR EXISTS (SELECT 1 FROM decaying d WHERE d.skill_category = s.skill_category AND d.micro_skill = s.micro_skill)
    ORDER BY CASE WHEN EXISTS (SELECT 1 FROM gaps g WHERE g.skill_category = s.skill_category AND g.micro_skill = s.micro_skill) THEN 0 ELSE 1 END,
      s.effective_mastery, s.skill_name LIMIT 1
  )
  SELECT jsonb_build_object(
    'version', 1, 'student_id', p_student_id, 'teacher_id', p_teacher_id, 'as_of', v_now,
    'skill_count', (SELECT count(*) FROM skills),
    'strongest_skills', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.effective_mastery DESC, s.skill_category, s.micro_skill) FROM strongest s), '[]'::jsonb),
    'critical_gaps', coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.effective_mastery, g.skill_category, g.micro_skill) FROM gaps g), '[]'::jsonb),
    'decaying_skills', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.effective_mastery, d.skill_category, d.micro_skill) FROM decaying d), '[]'::jsonb),
    'recommended_focus', (SELECT to_jsonb(f) FROM focus f)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_student_dslm_state_vector(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_dslm_state_vector(uuid, uuid) TO authenticated, service_role;