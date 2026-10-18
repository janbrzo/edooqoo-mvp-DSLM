-- calculate_test_results: owner or service role only (closes the transitional hole).
-- 20261017100000 still let anyone who knew a test UUID complete an in-progress test,
-- because the previous student client called this function at completion. The
-- current client no longer does (process-welcome-test computes the results with the
-- service role), and the old client ignores the refusal.
-- Anonymous callers lose EXECUTE altogether.

CREATE OR REPLACE FUNCTION public.calculate_test_results(p_test_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total INTEGER;
  v_correct INTEGER;
  v_score NUMERIC(5,2);
  v_time INTEGER;
  v_student_id UUID;
  v_current_status TEXT;
  v_teacher_id UUID;
  v_scored INTEGER;
  v_role TEXT := auth.role();
BEGIN
  SELECT st.teacher_id, st.status INTO v_teacher_id, v_current_status
  FROM public.student_tests st WHERE st.id = p_test_id AND st.deleted_at IS NULL;
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Test not found' USING ERRCODE = 'P0002';
  END IF;
  -- Service role and direct SQL (no JWT), or the owning teacher. Students never call
  -- this: process-welcome-test computes the results with the service role.
  IF v_role IS NOT NULL AND v_role <> 'service_role'
     AND auth.uid() IS DISTINCT FROM v_teacher_id THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT st.student_id, st.status,
         COUNT(*)::INTEGER,
         COALESCE(SUM(CASE WHEN stq.is_correct THEN 1 ELSE 0 END), 0)::INTEGER,
         COALESCE(SUM(GREATEST(stq.time_spent_seconds, 0)), 0)::INTEGER,
         COUNT(stq.is_correct)::INTEGER
  INTO v_student_id, v_current_status, v_total, v_correct, v_time, v_scored
  FROM public.student_tests st
  LEFT JOIN public.student_test_questions stq ON stq.test_id = st.id
  WHERE st.id = p_test_id
  GROUP BY st.student_id, st.status;

  -- Score over scored items only (is_correct not null: keyed answers, I don't know
  -- included); skipped and open items without a verdict are not wrong answers.
  v_score := CASE WHEN v_scored > 0 THEN (v_correct::NUMERIC / v_scored * 100) ELSE NULL END;

  UPDATE public.student_tests
  SET total_questions = v_total,
      correct_answers = v_correct,
      score_percentage = v_score,
      time_spent_seconds = v_time,
      -- v6.9.50: never downgrade a reviewed test back to completed
      status = CASE WHEN v_current_status = 'reviewed' THEN status ELSE 'completed' END,
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
  WHERE id = p_test_id;

  -- v6.9.50: UPSERT skill rows preserving applied_at + applied_to_element_id
  INSERT INTO public.test_skill_results
    (test_id, student_id, element_type, skill_tags,
     total_questions, correct_answers, score_percentage, suggested_rating)
  SELECT
    p_test_id,
    v_student_id,
    s.element_type,
    (SELECT ARRAY_AGG(DISTINCT tag)
       FROM public.student_test_questions tq, unnest(tq.skill_tags) AS tag
      WHERE tq.test_id = p_test_id AND tq.element_type = s.element_type AND tag IS NOT NULL),
    s.total,
    s.correct,
    CASE WHEN s.attempted > 0 AND s.scored > 0 THEN (s.correct::NUMERIC / s.scored * 100) END,
    CASE
      WHEN s.attempted = 0 OR s.scored = 0 THEN NULL
      WHEN (s.correct::NUMERIC / s.scored * 100) >= 80 THEN 5
      WHEN (s.correct::NUMERIC / s.scored * 100) >= 60 THEN 4
      WHEN (s.correct::NUMERIC / s.scored * 100) >= 40 THEN 3
      WHEN (s.correct::NUMERIC / s.scored * 100) >= 20 THEN 2
      ELSE 1
    END
  FROM (
    SELECT stq.element_type,
           COUNT(*)::INTEGER AS total,
           COALESCE(SUM(CASE WHEN stq.is_correct THEN 1 ELSE 0 END), 0)::INTEGER AS correct,
           COUNT(stq.is_correct)::INTEGER AS scored,
           COUNT(*) FILTER (WHERE stq.student_answer IS NOT NULL
                              AND stq.student_answer <> 'null'::jsonb
                              AND stq.student_answer <> '""'::jsonb)::INTEGER AS attempted
    FROM public.student_test_questions stq
    WHERE stq.test_id = p_test_id AND stq.element_type IS NOT NULL
    GROUP BY stq.element_type
  ) s
  ON CONFLICT (test_id, element_type) DO UPDATE
    SET skill_tags = EXCLUDED.skill_tags,
        total_questions = EXCLUDED.total_questions,
        correct_answers = EXCLUDED.correct_answers,
        score_percentage = EXCLUDED.score_percentage,
        suggested_rating = EXCLUDED.suggested_rating;
    -- applied_at + applied_to_element_id intentionally not touched

  RETURN jsonb_build_object(
    'total_questions', v_total,
    'correct_answers', v_correct,
    'score_percentage', v_score,
    'time_spent_seconds', v_time
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.calculate_test_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_test_results(uuid) TO authenticated, service_role;
