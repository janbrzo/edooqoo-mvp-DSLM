-- Homework answer keys stay behind the email gate (step 2 of 2). Apply only after the client
-- that reads exercises through get_homework_exercises_by_share_token is published.
--
-- get_homework_by_share_token keeps the verification screen data (title, deadline, student and
-- teacher names) for anyone with the link, but returns the exercise snapshot, image, audio and
-- audio url only to the homework's own teacher (the teacher's "View as student" page).
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
  SELECT ha.id, ha.title, ha.created_at, ha.deadline,
    CASE WHEN o.is_owner THEN ha.selected_exercises ELSE '[]'::jsonb END,
    CASE WHEN o.is_owner THEN w.selected_image END,
    CASE WHEN o.is_owner THEN w.selected_audio END,
    CASE WHEN o.is_owner THEN w.audio_url END,
    s.name as student_name, s.english_level as student_english_level,
    p.first_name as teacher_first_name, p.last_name as teacher_last_name, p.email as teacher_email,
    w.title as source_worksheet_title
  FROM homework_assignments ha
  CROSS JOIN LATERAL (SELECT (auth.uid() IS NOT NULL AND auth.uid() = ha.teacher_id) AS is_owner) o(is_owner)
  LEFT JOIN students s ON ha.student_id = s.id
  LEFT JOIN profiles p ON ha.teacher_id = p.id
  LEFT JOIN worksheets w ON ha.source_worksheet_id = w.id
  WHERE ha.share_token = p_share_token;
END;
$function$;
