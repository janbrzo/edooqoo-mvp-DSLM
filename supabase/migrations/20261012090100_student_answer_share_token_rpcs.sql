-- Student answer RPCs that require the share link token.
--
-- save_homework_answer, save_worksheet_answer, get_student_homework_answers and
-- get_worksheet_student_answers are callable by anon with only an id and an
-- email, so anyone who knows both can read or overwrite a student's answers.
-- These *_by_share_token wrappers add the check the link already implies: the
-- share token must belong to that homework/worksheet and the email must be the
-- assigned student's. The owning teacher (auth.uid()) always passes, so the
-- teacher view of a shared worksheet keeps loading and saving as before. They delegate to the existing functions, so the stored
-- data and the DSLM triggers behave exactly as before.
--
-- The legacy functions stay executable for now (cached clients); a later
-- migration revokes them from anon once the token client has been live.

CREATE OR REPLACE FUNCTION public.has_homework_student_access(p_share_token text, p_homework_id uuid, p_student_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_homework_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.homework_assignments ha
    WHERE ha.id = p_homework_id AND ha.teacher_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;
  IF coalesce(p_share_token, '') = '' OR p_homework_id IS NULL OR coalesce(trim(p_student_email), '') = '' THEN
    RETURN FALSE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.homework_assignments ha
    WHERE ha.id = p_homework_id AND ha.share_token = p_share_token
  ) THEN
    RETURN FALSE;
  END IF;
  RETURN public.verify_homework_student_email(p_homework_id, trim(p_student_email));
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_worksheet_student_access(p_share_token text, p_worksheet_id uuid, p_student_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_worksheet_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = p_worksheet_id AND (w.teacher_id = auth.uid() OR w.user_id = auth.uid())
  ) THEN
    RETURN TRUE;
  END IF;
  IF coalesce(p_share_token, '') = '' OR p_worksheet_id IS NULL OR coalesce(trim(p_student_email), '') = '' THEN
    RETURN FALSE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = p_worksheet_id AND w.share_token = p_share_token AND w.deleted_at IS NULL
  ) THEN
    RETURN FALSE;
  END IF;
  RETURN public.verify_worksheet_student_email(p_worksheet_id, trim(p_student_email));
END;
$function$;

-- Internal helpers: only the SECURITY DEFINER wrappers below call them.
REVOKE ALL ON FUNCTION public.has_homework_student_access(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_worksheet_student_access(text, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_homework_answer_by_share_token(
  p_share_token text,
  p_homework_id uuid,
  p_student_email text,
  p_exercise_index integer,
  p_exercise_type text,
  p_answers jsonb,
  p_time_spent_ms integer DEFAULT NULL::integer,
  p_mastery integer DEFAULT NULL::integer,
  p_item_evaluations jsonb DEFAULT NULL::jsonb,
  p_audio_answers jsonb DEFAULT NULL::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_homework_student_access(p_share_token, p_homework_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for homework' USING ERRCODE = '42501';
  END IF;
  RETURN public.save_homework_answer(
    p_homework_id, p_student_email, p_exercise_index, p_exercise_type, p_answers,
    p_time_spent_ms, p_mastery, p_item_evaluations, p_audio_answers
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_homework_answers_by_share_token(
  p_share_token text,
  p_homework_id uuid,
  p_student_email text
)
 RETURNS TABLE(id uuid, exercise_index integer, exercise_type text, answers jsonb, is_submitted boolean, started_at timestamp with time zone, last_saved_at timestamp with time zone, submitted_at timestamp with time zone, ai_evaluation jsonb, item_evaluations jsonb, mastery integer, audio_answers jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_homework_student_access(p_share_token, p_homework_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for homework' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_student_homework_answers(p_homework_id, p_student_email);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_worksheet_answer_by_share_token(
  p_share_token text,
  p_worksheet_id uuid,
  p_student_email text,
  p_exercise_index integer,
  p_exercise_type text,
  p_answers jsonb,
  p_time_spent_ms integer DEFAULT NULL::integer,
  p_mastery integer DEFAULT NULL::integer,
  p_item_evaluations jsonb DEFAULT NULL::jsonb,
  p_audio_answers jsonb DEFAULT NULL::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_worksheet_student_access(p_share_token, p_worksheet_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for worksheet' USING ERRCODE = '42501';
  END IF;
  RETURN public.save_worksheet_answer(
    p_worksheet_id, p_student_email, p_exercise_index, p_exercise_type, p_answers,
    p_time_spent_ms, p_mastery, p_item_evaluations, p_audio_answers
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_worksheet_student_answers_by_share_token(
  p_share_token text,
  p_worksheet_id uuid,
  p_student_email text
)
 RETURNS TABLE(id uuid, exercise_index integer, exercise_type text, answers jsonb, is_completed boolean, started_at timestamp with time zone, last_saved_at timestamp with time zone, completed_at timestamp with time zone, item_evaluations jsonb, mastery integer, audio_answers jsonb, ai_evaluation jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_worksheet_student_access(p_share_token, p_worksheet_id, p_student_email) THEN
    RAISE EXCEPTION 'Invalid share token for worksheet' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_worksheet_student_answers(p_worksheet_id, p_student_email);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.save_homework_answer_by_share_token(text, uuid, text, integer, text, jsonb, integer, integer, jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_homework_answers_by_share_token(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_worksheet_answer_by_share_token(text, uuid, text, integer, text, jsonb, integer, integer, jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_worksheet_student_answers_by_share_token(text, uuid, text) TO anon, authenticated;
