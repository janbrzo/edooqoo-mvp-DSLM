-- Teacher verdict on a homework item the answer key could not decide.
--
-- A closed item whose key result is "review" (word order, uncertain typed answers) is stored
-- as an unrated skill rating (mastery -1, hasValue false) and so never reached the DSLM or the
-- exercise mastery. The owner teacher can now mark such a question correct (100) or incorrect (0)
-- on /homework/:id/review. Every rating of that question gets the verdict with source 'teacher';
-- the exercise mastery is the share of rated questions at 50 or more (the rule
-- applyAiAlternatives uses for AI raises). The row's answer trigger re-creates the DSLM events.
CREATE OR REPLACE FUNCTION public.set_homework_item_verdict(
  p_homework_id uuid,
  p_exercise_index integer,
  p_question_index integer,
  p_correct boolean
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.homework_student_answers%ROWTYPE;
  v_items jsonb;
  v_new jsonb;
  v_mastery integer;
  v_value integer := CASE WHEN p_correct THEN 100 ELSE 0 END;
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

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_row.item_evaluations) e
    WHERE (e->>'question_index')::int = p_question_index
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This question has no skill to rate');
  END IF;

  SELECT COALESCE(jsonb_agg(
           CASE WHEN (e->>'question_index')::int = p_question_index
                THEN e || jsonb_build_object('mastery', v_value, 'hasValue', true, 'source', 'teacher')
                ELSE e END
           ORDER BY ord), '[]'::jsonb)
    INTO v_new
  FROM jsonb_array_elements(v_row.item_evaluations) WITH ORDINALITY AS t(e, ord);

  SELECT CASE WHEN count(*) = 0 THEN NULL
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

REVOKE ALL ON FUNCTION public.set_homework_item_verdict(uuid, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_homework_item_verdict(uuid, integer, integer, boolean) TO authenticated, service_role;
