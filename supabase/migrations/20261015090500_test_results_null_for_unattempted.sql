-- calculate_test_results: a skill with no answered question gets NULL
-- score_percentage and NULL suggested_rating instead of 0% and rating 1 (a skipped
-- skill is not a weak skill). Answered means a non-null student_answer that is not
-- an empty string; an I do not know answer counts as answered.
--
-- Also fixes the skill_tags join: the LATERAL unnest multiplied a question by its
-- number of tags, so total_questions and correct_answers of a skill were counted
-- once per tag. Questions are now counted once and tags are aggregated separately.
-- The test-level totals (student_tests) are unchanged. Existing test_skill_results
-- rows are corrected the next time calculate_test_results runs for the test.

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
BEGIN
  SELECT st.student_id, st.status,
         COUNT(*)::INTEGER,
         COALESCE(SUM(CASE WHEN stq.is_correct THEN 1 ELSE 0 END), 0)::INTEGER,
         COALESCE(SUM(stq.time_spent_seconds), 0)::INTEGER
  INTO v_student_id, v_current_status, v_total, v_correct, v_time
  FROM public.student_tests st
  LEFT JOIN public.student_test_questions stq ON stq.test_id = st.id
  WHERE st.id = p_test_id
  GROUP BY st.student_id, st.status;

  v_score := CASE WHEN v_total > 0 THEN (v_correct::NUMERIC / v_total * 100) ELSE 0 END;

  UPDATE public.student_tests
  SET total_questions = v_total,
      correct_answers = v_correct,
      score_percentage = v_score,
      time_spent_seconds = v_time,
      -- v6.9.50: never downgrade a reviewed test back to 'completed'
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
    CASE WHEN s.attempted > 0 THEN (s.correct::NUMERIC / s.total * 100) END,
    CASE
      WHEN s.attempted = 0 THEN NULL
      WHEN (s.correct::NUMERIC / s.total * 100) >= 80 THEN 5
      WHEN (s.correct::NUMERIC / s.total * 100) >= 60 THEN 4
      WHEN (s.correct::NUMERIC / s.total * 100) >= 40 THEN 3
      WHEN (s.correct::NUMERIC / s.total * 100) >= 20 THEN 2
      ELSE 1
    END
  FROM (
    SELECT stq.element_type,
           COUNT(*)::INTEGER AS total,
           COALESCE(SUM(CASE WHEN stq.is_correct THEN 1 ELSE 0 END), 0)::INTEGER AS correct,
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
