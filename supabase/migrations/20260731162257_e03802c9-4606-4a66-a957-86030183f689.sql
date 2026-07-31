-- 1. PROFILES: restrict to the owner
DROP POLICY IF EXISTS "Profiles access policy" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
REVOKE ALL ON public.profiles FROM anon;

-- 2. STUDENT GCAL TOKENS: service_role only
DROP POLICY IF EXISTS "Service role manages student gcal tokens" ON public.student_gcal_tokens;
CREATE POLICY "Only service role manages student gcal tokens"
  ON public.student_gcal_tokens FOR ALL TO service_role
  USING (true) WITH CHECK (true);
REVOKE ALL ON public.student_gcal_tokens FROM anon, authenticated;
GRANT ALL ON public.student_gcal_tokens TO service_role;

-- 3. HOMEWORK STUDENT ANSWERS: remove "any share_token" bypass policies
DROP POLICY IF EXISTS "Students can read answers for shared homework" ON public.homework_student_answers;
DROP POLICY IF EXISTS "Students can insert answers for shared homework" ON public.homework_student_answers;
DROP POLICY IF EXISTS "Students can update their own answers for shared homework" ON public.homework_student_answers;

CREATE POLICY "Teachers can manage answers for their homework"
  ON public.homework_student_answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.homework_assignments ha
                 WHERE ha.id = homework_student_answers.homework_id AND ha.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.homework_assignments ha
                 WHERE ha.id = homework_student_answers.homework_id AND ha.teacher_id = auth.uid()));

REVOKE ALL ON public.homework_student_answers FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.homework_student_answers TO authenticated;
GRANT ALL ON public.homework_student_answers TO service_role;

-- 3a. Token-scoped writers replacing the anonymous direct-table access
CREATE OR REPLACE FUNCTION public.update_homework_answer_by_share_token(
  p_share_token text,
  p_homework_id uuid,
  p_student_email text,
  p_exercise_index integer,
  p_answers jsonb DEFAULT NULL,
  p_ai_evaluation jsonb DEFAULT NULL,
  p_item_evaluations jsonb DEFAULT NULL,
  p_mastery integer DEFAULT NULL,
  p_eval_trigger text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.homework_assignments ha
    WHERE ha.id = p_homework_id
      AND ha.share_token IS NOT NULL
      AND ha.share_token = p_share_token
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Invalid share token for homework';
  END IF;

  UPDATE public.homework_student_answers
     SET answers          = COALESCE(p_answers, answers),
         ai_evaluation    = COALESCE(p_ai_evaluation, ai_evaluation),
         item_evaluations = COALESCE(p_item_evaluations, item_evaluations),
         mastery          = COALESCE(p_mastery, mastery),
         eval_trigger     = COALESCE(p_eval_trigger, eval_trigger)
   WHERE homework_id = p_homework_id
     AND student_email = p_student_email
     AND exercise_index = p_exercise_index;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.update_homework_answer_by_share_token(text, uuid, text, integer, jsonb, jsonb, jsonb, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_homework_answer_by_share_token(text, uuid, text, integer, jsonb, jsonb, jsonb, integer, text) TO anon, authenticated, service_role;