-- Homework answer keys stay behind the email gate (step 1 of 2, additive).
--
-- Until now get_homework_by_share_token returned the whole exercise snapshot (answer keys
-- included) to anyone holding the link, and the page only blurred it until the student typed
-- the assigned email. This adds the gated read; the client switches to it, and a second
-- migration (20261028100100) then stops the link-only read from returning exercises.
--
-- Access: the homework's own teacher (auth.uid()), or the caller proving the assigned student
-- email together with the share token. Same lower-case comparison as verify_homework_student_email.
CREATE OR REPLACE FUNCTION public.get_homework_exercises_by_share_token(p_share_token text, p_student_email text)
 RETURNS TABLE(selected_exercises jsonb, selected_image jsonb, selected_audio jsonb, audio_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_homework_id uuid;
  v_teacher_id uuid;
  v_student_email text;
BEGIN
  SELECT ha.id, ha.teacher_id, s.student_email
    INTO v_homework_id, v_teacher_id, v_student_email
  FROM public.homework_assignments ha
  LEFT JOIN public.students s ON s.id = ha.student_id
  WHERE ha.share_token = p_share_token;

  IF v_homework_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    (auth.uid() IS NOT NULL AND auth.uid() = v_teacher_id)
    OR (
      p_student_email IS NOT NULL
      AND v_student_email IS NOT NULL
      AND lower(btrim(v_student_email)) = lower(btrim(p_student_email))
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ha.selected_exercises, w.selected_image, w.selected_audio, w.audio_url
  FROM public.homework_assignments ha
  LEFT JOIN public.worksheets w ON ha.source_worksheet_id = w.id
  WHERE ha.id = v_homework_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_homework_exercises_by_share_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_homework_exercises_by_share_token(text, text) TO anon, authenticated, service_role;
