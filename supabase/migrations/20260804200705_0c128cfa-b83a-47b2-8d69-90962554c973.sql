-- 1. token_transactions: remove anonymous read access
DROP POLICY IF EXISTS "Anonymous users can view token_transactions" ON public.token_transactions;
REVOKE SELECT ON public.token_transactions FROM anon;

-- 2. calendar_settings: remove token-existence-only public read
DROP POLICY IF EXISTS "Public can read settings by token" ON public.calendar_settings;

CREATE OR REPLACE FUNCTION public.get_public_calendar_settings(p_token text)
RETURNS SETOF public.calendar_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.calendar_settings cs
  WHERE p_token IS NOT NULL
    AND length(p_token) >= 8
    AND (
      cs.hub_token = p_token
      OR (cs.public_calendar_enabled = true AND cs.public_calendar_token = p_token)
      OR (cs.public_calendar_enabled = true AND cs.public_calendar_slug = p_token)
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_calendar_settings(text) TO anon, authenticated;

-- 3. student_tests / student_test_questions: remove token-existence-only policies
DROP POLICY IF EXISTS "Public can view tests by share token" ON public.student_tests;
DROP POLICY IF EXISTS "Public can view questions in shared tests" ON public.student_test_questions;
DROP POLICY IF EXISTS "Anyone can update question answers" ON public.student_test_questions;

CREATE OR REPLACE FUNCTION public.get_test_context_by_share_token(p_share_token text)
RETURNS TABLE (
  id uuid,
  student_id uuid,
  teacher_id uuid,
  generation_params jsonb,
  student_native_language text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.student_id, t.teacher_id, t.generation_params, s.native_language
  FROM public.student_tests t
  LEFT JOIN public.students s ON s.id = t.student_id
  WHERE p_share_token IS NOT NULL
    AND length(p_share_token) >= 8
    AND t.share_token = p_share_token
    AND t.deleted_at IS NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_test_context_by_share_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_test_questions_by_share_token(p_share_token text)
RETURNS SETOF public.student_test_questions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.*
  FROM public.student_test_questions q
  JOIN public.student_tests t ON t.id = q.test_id
  WHERE p_share_token IS NOT NULL
    AND length(p_share_token) >= 8
    AND t.share_token = p_share_token
    AND t.deleted_at IS NULL
  ORDER BY q.question_index ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_test_questions_by_share_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_test_answer_by_share_token(
  p_share_token text,
  p_question_index integer,
  p_answer jsonb,
  p_is_correct boolean DEFAULT NULL,
  p_time_spent_seconds integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_test_id uuid;
BEGIN
  SELECT t.id INTO v_test_id
  FROM public.student_tests t
  WHERE p_share_token IS NOT NULL
    AND length(p_share_token) >= 8
    AND t.share_token = p_share_token
    AND t.deleted_at IS NULL
  LIMIT 1;

  IF v_test_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.student_test_questions
  SET student_answer = p_answer,
      is_correct = p_is_correct,
      answered_at = now(),
      time_spent_seconds = COALESCE(p_time_spent_seconds, time_spent_seconds)
  WHERE test_id = v_test_id
    AND question_index = p_question_index;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_test_answer_by_share_token(text, integer, jsonb, boolean, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_test_by_share_token(p_share_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.student_tests
  SET status = 'in_progress', started_at = COALESCE(started_at, now())
  WHERE p_share_token IS NOT NULL
    AND length(p_share_token) >= 8
    AND share_token = p_share_token
    AND deleted_at IS NULL
    AND status = 'assigned';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_test_by_share_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_test_answered_count_by_share_token(
  p_share_token text,
  p_answered_count integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.student_tests
  SET answered_count = p_answered_count
  WHERE p_share_token IS NOT NULL
    AND length(p_share_token) >= 8
    AND share_token = p_share_token
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_test_answered_count_by_share_token(text, integer) TO anon, authenticated;