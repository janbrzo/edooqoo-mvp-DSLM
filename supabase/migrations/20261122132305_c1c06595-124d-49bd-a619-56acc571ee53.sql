CREATE OR REPLACE FUNCTION public.delete_mark_done_evaluation(p_student_id uuid, p_worksheet_id uuid, p_exercise_index integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher_id uuid := auth.uid();
  v_deleted integer;
  v_ans record;
  v_dates jsonb;
BEGIN
  IF v_teacher_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.teacher_id = v_teacher_id
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.worksheets w WHERE w.id = p_worksheet_id AND w.teacher_id = v_teacher_id
     ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.student_events se
  WHERE se.student_id = p_student_id AND se.teacher_id = v_teacher_id
    AND se.source_id IS NOT DISTINCT FROM p_worksheet_id AND se.event_type = 'mark_done_evaluation'
    AND (se.event_payload->>'exercise_index')::int = p_exercise_index;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- The answer no longer carries the mark_done label once its evaluation is undone.
  FOR v_ans IN
    SELECT wsa.id
    FROM public.worksheet_student_answers wsa
    JOIN public.students s ON s.id = p_student_id AND lower(s.student_email) = lower(wsa.student_email)
    JOIN public.worksheets w ON w.id = wsa.worksheet_id AND w.teacher_id = v_teacher_id
    WHERE wsa.worksheet_id = p_worksheet_id
      AND wsa.exercise_index = p_exercise_index
      AND wsa.eval_trigger = 'mark_done'
  LOOP
    SELECT coalesce(jsonb_object_agg(rt, ts), '{}'::jsonb) INTO v_dates
    FROM (
      SELECT e.event_payload->>'response_type' AS rt, min(e.created_at) AS ts
      FROM public.student_events e
      WHERE e.event_source = 'worksheet' AND e.event_payload->>'answer_id' = v_ans.id::text
        AND e.event_payload->>'response_type' IS NOT NULL
      GROUP BY 1
    ) d;

    UPDATE public.worksheet_student_answers SET eval_trigger = NULL WHERE id = v_ans.id;

    -- The answer trigger rebuilt the events: give them their original dates back.
    UPDATE public.student_events e
       SET created_at = (v_dates->>(e.event_payload->>'response_type'))::timestamptz
     WHERE e.event_source = 'worksheet'
       AND e.event_payload->>'answer_id' = v_ans.id::text
       AND v_dates ? (e.event_payload->>'response_type')
       AND e.created_at > (v_dates->>(e.event_payload->>'response_type'))::timestamptz;
  END LOOP;

  RETURN v_deleted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_test_context_by_share_token(p_share_token text)
 RETURNS TABLE(id uuid, student_id uuid, teacher_id uuid, generation_params jsonb, student_native_language text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.id, t.student_id, t.teacher_id, t.generation_params, s.native_language
  FROM public.student_tests t
  LEFT JOIN public.students s ON s.id = t.student_id
  WHERE p_share_token IS NOT NULL
    AND length(p_share_token) >= 8
    AND t.share_token = p_share_token
    AND t.deleted_at IS NULL
    AND (t.share_expires_at IS NULL OR t.share_expires_at > now())
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_test_questions_by_share_token(p_share_token text)
 RETURNS SETOF student_test_questions
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- The answer key stays on the server.
  SELECT (jsonb_populate_record(q, jsonb_build_object('correct_answer', NULL))).*
  FROM public.student_test_questions q
  JOIN public.student_tests t ON t.id = q.test_id
  WHERE p_share_token IS NOT NULL
    AND length(p_share_token) >= 8
    AND t.share_token = p_share_token
    AND t.deleted_at IS NULL
    AND (t.share_expires_at IS NULL OR t.share_expires_at > now())
  ORDER BY q.question_index ASC;
$function$;