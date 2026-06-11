CREATE OR REPLACE FUNCTION public.verify_welcome_test_email(
  p_share_token text,
  p_email text
)
RETURNS TABLE (has_email boolean, matches boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_email text;
BEGIN
  SELECT s.student_email
    INTO v_student_email
  FROM public.student_tests t
  JOIN public.students s ON s.id = t.student_id
  WHERE t.share_token = p_share_token
  LIMIT 1;

  IF v_student_email IS NULL OR length(btrim(v_student_email)) = 0 THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    lower(btrim(v_student_email)) = lower(btrim(p_email));
END;
$$;

REVOKE ALL ON FUNCTION public.verify_welcome_test_email(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_welcome_test_email(text, text) TO anon, authenticated, service_role;