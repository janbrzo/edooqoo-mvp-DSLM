-- Redo settles the teacher's old "completed" notification (follow-up of 20261028150000).
--
-- The E2E showed that a second return created no notification while the one of the first return was
-- still unread (submit_homework_answers creates one only when none is unread). The teacher started
-- the redo, so that notification is marked read in the same call.
CREATE OR REPLACE FUNCTION public.request_homework_redo(p_homework_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hw RECORD;
  v_email text;
  v_submitted_at timestamptz;
  v_rows jsonb;
  v_comments jsonb;
BEGIN
  SELECT ha.teacher_id, ha.completed_at, COALESCE(ha.completed_by_teacher, false) AS by_teacher,
         ha.attempt, ha.reviewed_at
    INTO v_hw
  FROM public.homework_assignments ha
  WHERE ha.id = p_homework_id
  FOR UPDATE;

  IF NOT FOUND OR v_hw.teacher_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  -- Only a homework the student returned can be redone; a teacher's Mark done is undone by reopen_homework.
  IF v_hw.completed_at IS NULL OR v_hw.by_teacher THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only a homework the student returned can be redone');
  END IF;

  SELECT min(a.student_email), max(a.submitted_at),
         COALESCE(jsonb_agg(jsonb_build_object(
           'exercise_index', a.exercise_index, 'exercise_type', a.exercise_type,
           'answers', a.answers, 'audio_answers', a.audio_answers,
           'item_evaluations', a.item_evaluations, 'mastery', a.mastery,
           'ai_evaluation', a.ai_evaluation, 'time_spent_ms', a.time_spent_ms)
           ORDER BY a.exercise_index), '[]'::jsonb)
    INTO v_email, v_submitted_at, v_rows
  FROM public.homework_student_answers a
  WHERE a.homework_id = p_homework_id AND a.is_submitted = true;

  IF v_rows = '[]'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing was submitted, so there is nothing to redo');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('exercise_index', c.exercise_index, 'comment_text', c.comment_text)
                            ORDER BY c.exercise_index), '[]'::jsonb)
    INTO v_comments
  FROM public.homework_teacher_comments c
  WHERE c.homework_id = p_homework_id AND btrim(COALESCE(c.comment_text, '')) <> '';

  INSERT INTO public.homework_attempts (homework_id, attempt, student_email, submitted_at, reviewed_at, answers, comments)
  VALUES (p_homework_id, v_hw.attempt, v_email, v_submitted_at, v_hw.reviewed_at, v_rows, v_comments)
  ON CONFLICT (homework_id, attempt) DO NOTHING;

  -- The teacher's comments belonged to the returned attempt; the next review starts clean.
  UPDATE public.homework_teacher_comments SET comment_text = '', updated_at = now()
  WHERE homework_id = p_homework_id;

  UPDATE public.homework_student_answers
     SET answers = '{}'::jsonb, audio_answers = '{}'::jsonb, item_evaluations = NULL, mastery = NULL,
         ai_evaluation = NULL, is_submitted = false, submitted_at = NULL, eval_trigger = NULL,
         ai_eval_attempts = 0, ai_eval_last_attempt_at = NULL, ai_eval_note = NULL,
         time_spent_ms = 0, last_saved_at = now()
   WHERE homework_id = p_homework_id;

  -- The teacher chose this redo, so the old "completed" notification is settled: an unread one would
  -- suppress the notification of the second return (submit creates one only when none is unread).
  UPDATE public.homework_notifications SET is_read = true
  WHERE homework_id = p_homework_id AND notification_type = 'completed' AND is_read = false;

  UPDATE public.homework_assignments
     SET completed_at = NULL, completed_by_teacher = false, reviewed_at = NULL, reviewed_by = NULL,
         attempt = v_hw.attempt + 1, updated_at = now()
   WHERE id = p_homework_id;

  RETURN jsonb_build_object('success', true, 'homework_id', p_homework_id, 'attempt', v_hw.attempt + 1);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_homework_redo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_homework_redo(uuid) TO authenticated, service_role;
