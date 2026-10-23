-- Baseline of the homework access functions that existed only in the production
-- database (their bodies were never in supabase/migrations, so the repository
-- could not rebuild them or review a change to them).
--
-- Bodies and grants are copied verbatim from pg_get_functiondef / the production
-- ACLs on 2026-10-23, so applying this migration changes nothing in production.
-- Hardening of these functions (answer-key stripping before the email gate,
-- terminal Mark done) happens in later, separate migrations.

CREATE OR REPLACE FUNCTION public.generate_homework_share_token(p_homework_id uuid, p_teacher_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  new_token TEXT;
BEGIN
  -- Generate unique token
  new_token := encode(extensions.gen_random_bytes(32), 'hex');

  -- Update homework with new token
  UPDATE public.homework_assignments
  SET share_token = new_token
  WHERE id = p_homework_id
    AND teacher_id = p_teacher_id;

  IF FOUND THEN
    RETURN new_token;
  ELSE
    RETURN NULL;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_homework_student_email(p_homework_id uuid, p_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_student_email TEXT;
    v_student_id UUID;
BEGIN
    SELECT
        ha.student_id,
        s.student_email
    INTO v_student_id, v_student_email
    FROM public.homework_assignments ha
    LEFT JOIN public.students s ON ha.student_id = s.id
    WHERE ha.id = p_homework_id;

    IF v_student_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN (v_student_email IS NOT NULL AND lower(v_student_email) = lower(p_email));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_homework_by_share_token(p_share_token text)
 RETURNS TABLE(id uuid, title text, created_at timestamp with time zone, deadline timestamp with time zone, selected_exercises jsonb, selected_image jsonb, selected_audio jsonb, audio_url text, student_name text, student_english_level text, teacher_first_name text, teacher_last_name text, teacher_email text, source_worksheet_title text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.homework_assignments ha
  SET view_count = COALESCE(ha.view_count, 0) + 1,
      viewed_at = COALESCE(ha.viewed_at, NOW())
  WHERE ha.share_token = p_share_token;

  RETURN QUERY
  SELECT ha.id, ha.title, ha.created_at, ha.deadline, ha.selected_exercises,
    w.selected_image, w.selected_audio, w.audio_url,
    s.name as student_name, s.english_level as student_english_level,
    p.first_name as teacher_first_name, p.last_name as teacher_last_name, p.email as teacher_email,
    w.title as source_worksheet_title
  FROM homework_assignments ha
  LEFT JOIN students s ON ha.student_id = s.id
  LEFT JOIN profiles p ON ha.teacher_id = p.id
  LEFT JOIN worksheets w ON ha.source_worksheet_id = w.id
  WHERE ha.share_token = p_share_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_homework_completed_internal(p_homework_id uuid, p_user_id uuid, p_is_teacher boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_homework RECORD;
  v_student_name TEXT;
  v_homework_title TEXT;
  v_notification_id UUID;
BEGIN
  -- Get homework details
  SELECT
    ha.*,
    s.name as student_name,
    s.teacher_id
  INTO v_homework
  FROM public.homework_assignments ha
  JOIN public.students s ON ha.student_id = s.id
  WHERE ha.id = p_homework_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Homework not found'
    );
  END IF;

  -- Verify authorization
  IF p_is_teacher AND p_user_id != v_homework.teacher_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Update homework completion status
  UPDATE public.homework_assignments
  SET
    completed_at = NOW(),
    completed_by_teacher = p_is_teacher,
    updated_at = NOW()
  WHERE id = p_homework_id;

  -- Create notification for teacher (only if student completed it)
  IF NOT p_is_teacher THEN
    INSERT INTO public.homework_notifications (
      teacher_id,
      homework_id,
      student_id,
      notification_type,
      message
    ) VALUES (
      v_homework.teacher_id,
      p_homework_id,
      v_homework.student_id,
      'completed',
      format('%s has completed homework: %s', v_homework.student_name, v_homework.title)
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'homework_id', p_homework_id,
    'completed_at', NOW(),
    'completed_by_teacher', p_is_teacher,
    'notification_id', v_notification_id
  );
END;
$function$;

-- Production ACLs (unchanged by this migration).
REVOKE ALL ON FUNCTION public.generate_homework_share_token(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_homework_completed_internal(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_homework_share_token(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_homework_student_email(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_homework_by_share_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_homework_completed_internal(uuid, uuid, boolean) TO service_role;
