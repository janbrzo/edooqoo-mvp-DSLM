-- WT-5 (broader): keep best row per (student, teacher, attempt_number) for welcome tests.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY student_id, teacher_id, test_type, COALESCE(attempt_number, 1)
      ORDER BY
        COALESCE(answered_count, 0) DESC,
        CASE WHEN status IN ('completed', 'reviewed') THEN 0 ELSE 1 END,
        created_at DESC
    ) AS rn
  FROM public.student_tests
  WHERE test_type = 'welcome'
    AND deleted_at IS NULL
)
UPDATE public.student_tests t
SET deleted_at = now()
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_welcome_attempt
  ON public.student_tests (student_id, teacher_id, test_type, attempt_number)
  WHERE deleted_at IS NULL AND test_type = 'welcome';