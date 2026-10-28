-- What the student sees after the teacher sent the review.
--
-- "Send review" used to set reviewed_at and promise that the student sees the comments, but no
-- student-facing read existed. This returns the teacher's per-exercise comments and the
-- teacher's decisions on items the answer key could not judge, only once the homework is
-- reviewed and only to the assigned email (share token + email, like the exercise read).
--   { "comments": [{ "exercise_index": 0, "comment_text": "..." }],
--     "verdicts":  { "0": { "1": "correct" } } }          -- exercise -> question -> decision
CREATE OR REPLACE FUNCTION public.get_homework_review_by_share_token(p_share_token text, p_student_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_homework_id uuid;
  v_reviewed timestamptz;
  v_student_email text;
  v_comments jsonb;
  v_verdicts jsonb;
BEGIN
  SELECT ha.id, ha.reviewed_at, s.student_email
    INTO v_homework_id, v_reviewed, v_student_email
  FROM public.homework_assignments ha
  LEFT JOIN public.students s ON s.id = ha.student_id
  WHERE ha.share_token = p_share_token;

  IF v_homework_id IS NULL OR v_reviewed IS NULL
     OR p_student_email IS NULL OR v_student_email IS NULL
     OR lower(btrim(v_student_email)) <> lower(btrim(p_student_email)) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('exercise_index', c.exercise_index, 'comment_text', c.comment_text)
                            ORDER BY c.exercise_index), '[]'::jsonb)
    INTO v_comments
  FROM public.homework_teacher_comments c
  WHERE c.homework_id = v_homework_id AND btrim(COALESCE(c.comment_text, '')) <> '';

  SELECT COALESCE(jsonb_object_agg(x.exercise_index::text, x.q), '{}'::jsonb)
    INTO v_verdicts
  FROM (
    SELECT t.exercise_index,
           jsonb_object_agg(t.question_index::text, CASE WHEN t.mastery >= 50 THEN 'correct' ELSE 'wrong' END) AS q
    FROM (
      SELECT DISTINCT ON (a.exercise_index, (e->>'question_index')::int)
             a.exercise_index, (e->>'question_index')::int AS question_index, (e->>'mastery')::numeric AS mastery
      FROM public.homework_student_answers a
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(a.item_evaluations) = 'array' THEN a.item_evaluations ELSE '[]'::jsonb END) AS e
      WHERE a.homework_id = v_homework_id AND a.is_submitted = true
        AND e->>'source' = 'teacher' AND (e->>'mastery')::numeric >= 0
      ORDER BY a.exercise_index, (e->>'question_index')::int
    ) t
    GROUP BY t.exercise_index
  ) x;

  RETURN jsonb_build_object('comments', v_comments, 'verdicts', v_verdicts);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_homework_review_by_share_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_homework_review_by_share_token(text, text) TO anon, authenticated, service_role;
