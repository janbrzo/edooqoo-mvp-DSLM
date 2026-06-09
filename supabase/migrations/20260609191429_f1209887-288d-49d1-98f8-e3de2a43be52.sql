-- v6.9.50 — Preserve reviewed status and applied_at flags in calculate_test_results

-- 1) Deduplicate any existing duplicate (test_id, element_type) rows, then add unique constraint
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY test_id, element_type
    ORDER BY (applied_at IS NOT NULL) DESC, created_at DESC, id
  ) AS rn
  FROM public.test_skill_results
)
DELETE FROM public.test_skill_results r
USING ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'test_skill_results_test_element_unique'
  ) THEN
    ALTER TABLE public.test_skill_results
      ADD CONSTRAINT test_skill_results_test_element_unique
      UNIQUE (test_id, element_type);
  END IF;
END$$;

-- 2) Replace calculate_test_results: never downgrade 'reviewed', UPSERT skill rows
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
    element_type,
    ARRAY_AGG(DISTINCT tag) FILTER (WHERE tag IS NOT NULL),
    COUNT(*)::INTEGER,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::INTEGER,
    (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100),
    CASE
      WHEN (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100) >= 80 THEN 5
      WHEN (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100) >= 60 THEN 4
      WHEN (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100) >= 40 THEN 3
      WHEN (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100) >= 20 THEN 2
      ELSE 1
    END
  FROM public.student_test_questions stq
  LEFT JOIN LATERAL unnest(stq.skill_tags) AS tag ON TRUE
  WHERE stq.test_id = p_test_id AND stq.element_type IS NOT NULL
  GROUP BY element_type
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