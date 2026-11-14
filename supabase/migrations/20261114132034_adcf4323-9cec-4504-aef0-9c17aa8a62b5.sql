CREATE OR REPLACE FUNCTION public.generate_homework_share_token(p_homework_id uuid, p_teacher_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE new_token TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_teacher_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  new_token := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE public.homework_assignments SET share_token = new_token
  WHERE id = p_homework_id AND teacher_id = p_teacher_id;
  IF FOUND THEN RETURN new_token; ELSE RETURN NULL; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_test_share_token(p_test_id uuid, p_teacher_id uuid, p_expires_hours integer DEFAULT 720)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE new_token TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_teacher_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  new_token := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE public.student_tests
  SET share_token = new_token,
      share_expires_at = NOW() + (p_expires_hours || ' hours')::interval,
      updated_at = NOW()
  WHERE id = p_test_id AND teacher_id = p_teacher_id AND deleted_at IS NULL;
  IF FOUND THEN RETURN new_token; ELSE RETURN NULL; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_worksheet_share_token(p_worksheet_id uuid, p_teacher_id uuid, p_expires_hours integer DEFAULT NULL::integer)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE new_token TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_teacher_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  new_token := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE public.worksheets SET share_token = new_token, share_expires_at = null
  WHERE id = p_worksheet_id AND teacher_id = p_teacher_id AND deleted_at IS NULL;
  IF FOUND THEN RETURN new_token; ELSE RETURN NULL; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_student_by_email(p_teacher_id uuid, p_email text)
 RETURNS TABLE(id uuid, name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_teacher_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.id, s.name FROM public.students s
  WHERE s.teacher_id = p_teacher_id AND lower(s.student_email) = lower(trim(p_email)) AND s.deleted_at IS NULL
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_tags(p_student_id uuid, p_teacher_id uuid)
 RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE unique_tags TEXT[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_teacher_id) THEN
    RETURN '{}';
  END IF;
  SELECT ARRAY(
    SELECT DISTINCT unnest(tags) FROM public.student_knowledge_entries
    WHERE student_id = p_student_id AND teacher_id = p_teacher_id AND deleted_at IS NULL
    ORDER BY unnest(tags)
  ) INTO unique_tags;
  RETURN COALESCE(unique_tags, '{}');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_meeting_link(p_teacher_id uuid, p_student_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_link TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_teacher_id) THEN
    RETURN NULL;
  END IF;
  SELECT default_meeting_link INTO v_link FROM public.calendar_student_settings
  WHERE teacher_id = p_teacher_id AND student_id = p_student_id;
  RETURN v_link;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_homework_owner_ids(p_homework_id uuid)
 RETURNS TABLE(teacher_id uuid, student_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT h.teacher_id, h.student_id FROM public.homework_assignments h
  WHERE h.id = p_homework_id
    AND (auth.role() = 'service_role' OR h.teacher_id = auth.uid())
  LIMIT 1;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_homework_owner_ids(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.get_token_balance(p_teacher_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_teacher_id) THEN
    RETURN 0;
  END IF;
  RETURN COALESCE((SELECT available_tokens FROM public.profiles WHERE id = p_teacher_id), 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_flashcard_cards_for_learning(p_set_id uuid, p_learner_identifier text)
 RETURNS TABLE(card_id uuid, front_text text, front_example text, back_text text, card_position integer, direction integer, easiness_factor numeric, repetition integer, interval_days integer, next_review_date timestamp with time zone, total_reviews integer, correct_count integer, incorrect_count integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Allowed: owner teacher, service role, or a learner of a currently shared
  -- set whose identifier is the set's assigned student email.
  IF NOT (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.flashcard_sets fs
      LEFT JOIN public.students s ON s.id = fs.student_id AND s.deleted_at IS NULL
      WHERE fs.id = p_set_id AND fs.deleted_at IS NULL
        AND (
          fs.teacher_id = auth.uid()
          OR (
            fs.share_token IS NOT NULL
            AND (fs.share_expires_at IS NULL OR fs.share_expires_at > now())
            AND s.student_email IS NOT NULL
            AND lower(s.student_email) = lower(trim(p_learner_identifier))
          )
        )
    )
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT fc.id, fc.front_text, fc.front_example, fc.back_text, fc.card_position,
    COALESCE(fp.direction, 1), COALESCE(fp.easiness_factor, 2.5), COALESCE(fp.repetition, 0),
    COALESCE(fp.interval_days, 0), COALESCE(fp.next_review_date, NOW()), COALESCE(fp.total_reviews, 0),
    COALESCE(fp.correct_count, 0), COALESCE(fp.incorrect_count, 0)
  FROM public.flashcard_cards fc
  LEFT JOIN public.flashcard_progress fp ON fc.id = fp.card_id AND fp.learner_identifier = p_learner_identifier
  WHERE fc.set_id = p_set_id AND fc.deleted_at IS NULL
  ORDER BY fc.card_position;
END;
$function$;