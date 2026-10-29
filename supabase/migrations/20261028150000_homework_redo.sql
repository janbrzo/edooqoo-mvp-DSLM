-- Redo: the teacher lets the student do a returned homework again.
--
-- Until now a returned homework stayed final (reopen_homework only undid a teacher's Mark done).
-- request_homework_redo archives the returned attempt (answers, ratings, AI result, review time and
-- the teacher's comments) in homework_attempts, then opens the homework again with empty answers
-- under the same link: attempt + 1, no review, no completion. The first attempt's DSLM events stay
-- until the second attempt is submitted and evaluated (the answer trigger skips drafts of an
-- exercise that already has submit events, then replaces them), so metrics follow the newest
-- submitted attempt and the archive keeps the first one.

ALTER TABLE public.homework_assignments
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.homework_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  attempt integer NOT NULL,
  student_email text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (homework_id, attempt)
);

ALTER TABLE public.homework_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'homework_attempts' AND policyname = 'Teachers read own homework attempts'
  ) THEN
    CREATE POLICY "Teachers read own homework attempts" ON public.homework_attempts
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.homework_assignments ha
        WHERE ha.id = homework_attempts.homework_id AND ha.teacher_id = auth.uid()));
  END IF;
END $$;

REVOKE ALL ON TABLE public.homework_attempts FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.homework_attempts TO authenticated;
GRANT ALL ON TABLE public.homework_attempts TO service_role;

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

  UPDATE public.homework_assignments
     SET completed_at = NULL, completed_by_teacher = false, reviewed_at = NULL, reviewed_by = NULL,
         attempt = v_hw.attempt + 1, updated_at = now()
   WHERE id = p_homework_id;

  RETURN jsonb_build_object('success', true, 'homework_id', p_homework_id, 'attempt', v_hw.attempt + 1);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_homework_redo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_homework_redo(uuid) TO authenticated, service_role;
