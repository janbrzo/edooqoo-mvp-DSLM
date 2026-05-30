-- Backfill total_questions for welcome tests where the seeded question count
-- has drifted from the row's snapshot (caused 58/54 display bug).
UPDATE public.student_tests st
SET total_questions = sub.cnt,
    updated_at = now()
FROM (
  SELECT test_id, COUNT(*)::int AS cnt
  FROM public.student_test_questions
  GROUP BY test_id
) sub
WHERE sub.test_id = st.id
  AND st.test_type = 'welcome'
  AND (st.total_questions IS NULL OR st.total_questions <> sub.cnt);