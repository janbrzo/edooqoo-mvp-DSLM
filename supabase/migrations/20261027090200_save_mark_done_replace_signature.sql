-- Iteration 10: Mark done keeps the teacher decision context.
-- save_mark_done_evaluation gets an optional trailing p_prior_verdict jsonb. It is stored only as
-- event_payload.prior_verdict (key verdict, AI score, source, value before the change) and never
-- changes ratings or mastery; compute_skill_metric does not read it.
--
-- Adding an argument would leave two overloads and PostgREST could not choose between them for a
-- 6 argument call, so the old signature is removed in the same statement batch. This file is the
-- only one that needs the removal keyword; run it in the SQL Editor after 20261027090000 and
-- deploy the client that sends p_prior_verdict only afterwards (see
-- docs/operational/iteration-10-rollout.md). Old 6 argument calls keep working.

DROP FUNCTION IF EXISTS public.save_mark_done_evaluation(uuid, uuid, integer, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.save_mark_done_evaluation(
  p_student_id uuid,
  p_worksheet_id uuid,
  p_exercise_index integer,
  p_element_type text,
  p_exercise_title text,
  p_ratings jsonb,
  p_prior_verdict jsonb DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher_id uuid := auth.uid();
  v_event_id uuid;
  v_payload jsonb;
  v_old_prior jsonb;
  v_skill_ids text[];
  v_mastery numeric;
BEGIN
  IF v_teacher_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.teacher_id = v_teacher_id
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_ratings) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_ratings must be an array' USING ERRCODE = '22023';
  END IF;
  IF p_prior_verdict IS NOT NULL AND (
    jsonb_typeof(p_prior_verdict) IS DISTINCT FROM 'object' OR octet_length(p_prior_verdict::text) > 8192
  ) THEN
    RAISE EXCEPTION 'p_prior_verdict must be a small object' USING ERRCODE = '22023';
  END IF;

  v_payload := jsonb_build_object(
    'exercise_index', p_exercise_index,
    'exercise_title', p_exercise_title,
    'nano_skill_ratings', p_ratings
  );
  SELECT array_agg(elem->>'name') INTO v_skill_ids
  FROM jsonb_array_elements(p_ratings) AS elem WHERE elem->>'name' IS NOT NULL;
  SELECT ROUND(AVG((elem->>'mastery')::numeric)) INTO v_mastery
  FROM jsonb_array_elements(p_ratings) AS elem
  -- Same rule as add_student_event and the metric trigger: only rated items count.
  WHERE elem->>'mastery' IS NOT NULL AND (elem->>'mastery')::numeric >= 0
    AND (elem ? 'hasValue' AND (elem->>'hasValue')::boolean = true);

  SELECT se.id, se.event_payload->'prior_verdict' INTO v_event_id, v_old_prior
  FROM public.student_events se
  WHERE se.student_id = p_student_id AND se.teacher_id = v_teacher_id
    AND se.source_id IS NOT DISTINCT FROM p_worksheet_id AND se.event_type = 'mark_done_evaluation'
    AND (se.event_payload->>'exercise_index')::int = p_exercise_index
  ORDER BY se.created_at DESC
  LIMIT 1;

  -- A new verdict replaces the stored one; a call without it keeps the first one recorded.
  IF p_prior_verdict IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('prior_verdict', p_prior_verdict);
  ELSIF v_old_prior IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('prior_verdict', v_old_prior);
  END IF;

  IF v_event_id IS NOT NULL THEN
    UPDATE public.student_events
       SET event_payload = v_payload, skill_ids = v_skill_ids, mastery = v_mastery, element_type = p_element_type
     WHERE id = v_event_id;
    RETURN v_event_id;
  END IF;

  RETURN public.add_student_event_internal(
    p_student_id, v_teacher_id, 'mark_done_evaluation', 'teacher', p_worksheet_id,
    v_payload, v_skill_ids, p_element_type, NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_mark_done_evaluation(uuid, uuid, integer, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_mark_done_evaluation(uuid, uuid, integer, text, text, jsonb, jsonb) TO authenticated, service_role;
