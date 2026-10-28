-- Teacher score on any homework item (open answers too), generalising set_homework_item_verdict.
--
-- The verdict RPC only said correct / incorrect for closed items. An open answer rated by the
-- model can be wrong in either direction, and a failed or partial evaluation leaves unrated
-- entries, so the owner teacher can now set 0-100 for a question. All ratings of that question
-- get the value with source 'teacher'; the exercise mastery is the share of rated questions at
-- 50 or more for closed exercises (the rule of applyAiAlternatives) and the mean of the rated
-- questions for open ones (averageScoredMastery). Only a row the server finished grading can be
-- rated (ai_evaluation stored, or a finalised selection row), so a late AI result never
-- overwrites the teacher.
CREATE OR REPLACE FUNCTION public.set_homework_item_score(
  p_homework_id uuid,
  p_exercise_index integer,
  p_question_index integer,
  p_mastery integer
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.homework_student_answers%ROWTYPE;
  v_new jsonb;
  v_mastery integer;
  v_value integer := GREATEST(0, LEAST(100, COALESCE(p_mastery, 0)));
  v_open boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.homework_assignments ha
    WHERE ha.id = p_homework_id AND ha.teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.homework_student_answers a
  WHERE a.homework_id = p_homework_id AND a.exercise_index = p_exercise_index AND a.is_submitted = true
  ORDER BY a.last_saved_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR jsonb_typeof(v_row.item_evaluations) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing to rate for this question');
  END IF;

  IF v_row.ai_evaluation IS NULL AND v_row.eval_trigger IS DISTINCT FROM 'submit_homework' THEN
    RETURN jsonb_build_object('success', false, 'error', 'The evaluation of this exercise is still running');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_row.item_evaluations) e
    WHERE (e->>'question_index')::int = p_question_index
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This question has no skill to rate');
  END IF;

  v_open := v_row.exercise_type IN (
    'reading', 'discussion', 'describe', 'describe-picture', 'answer-questions',
    'answer-questions-audio', 'answer-questions-picture', 'dialogue', 'paraphrasing',
    'speaking', 'sentence-transformation', 'essay', 'listening-comprehension');

  SELECT COALESCE(jsonb_agg(
           CASE WHEN (e->>'question_index')::int = p_question_index
                THEN e || jsonb_build_object('mastery', v_value, 'hasValue', true, 'source', 'teacher')
                ELSE e END
           ORDER BY ord), '[]'::jsonb)
    INTO v_new
  FROM jsonb_array_elements(v_row.item_evaluations) WITH ORDINALITY AS t(e, ord);

  SELECT CASE WHEN count(*) = 0 THEN NULL
              WHEN v_open THEN round(avg(m))::int
              ELSE round(100.0 * count(*) FILTER (WHERE m >= 50) / count(*))::int END
    INTO v_mastery
  FROM (
    SELECT DISTINCT ON ((e->>'question_index')::int) (e->>'mastery')::numeric AS m
    FROM jsonb_array_elements(v_new) WITH ORDINALITY AS t(e, ord)
    WHERE COALESCE((e->>'hasValue')::boolean, true) AND (e->>'mastery')::numeric >= 0
    ORDER BY (e->>'question_index')::int, ord
  ) q;

  UPDATE public.homework_student_answers
     SET item_evaluations = v_new,
         mastery = COALESCE(v_mastery, mastery)
   WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'mastery', v_mastery, 'item_evaluations', v_new);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_homework_item_score(uuid, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_homework_item_score(uuid, integer, integer, integer) TO authenticated, service_role;

-- The verdict RPC keeps its contract and now delegates.
CREATE OR REPLACE FUNCTION public.set_homework_item_verdict(
  p_homework_id uuid,
  p_exercise_index integer,
  p_question_index integer,
  p_correct boolean
)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.set_homework_item_score(
    p_homework_id, p_exercise_index, p_question_index, CASE WHEN p_correct THEN 100 ELSE 0 END);
$function$;
