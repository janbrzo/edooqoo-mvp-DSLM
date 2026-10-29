-- Flashcard security guards (audit findings F-9, F-11, F-12; plan steps 0.4 and 0.5; decision D-4 option B).
-- Why, per function:
--   generate_flashcard_share_token: trusted the p_teacher_id argument, so any signed-in user could mint a share
--     token for the set of another teacher; now the caller must be that teacher. New tokens always expire after 1 year.
--   soft_delete_flashcard_set: same trust problem; any signed-in user could remove the set of another teacher.
--   backfill_skill_metrics: SECURITY DEFINER recompute of metrics with no ownership check and NULL = every student;
--     no client code calls it, so client roles lose EXECUTE and the function also checks ownership.
--   get_flashcard_set_by_share_token, get_flashcard_cards_by_share_token: share_expires_at was written but never
--     enforced; an expired link now returns nothing (NULL expiry = no limit, grandfathered by D-4 option B).
-- auth.uid() is NULL for the service role and for direct database sessions (SQL editor, pg_cron); those stay allowed.
-- Return columns of the token RPCs are unchanged (teacher_email stays for now). The protected generation engine,
-- save_flashcard_progress, get_flashcard_cards_for_learning, triggers and compute_skill_metric are not touched.
-- Idempotent: CREATE OR REPLACE and REVOKE/GRANT only.
-- Rollback: the previous definitions and grants are in the file rollback_phase0_sql.sql kept with the flashcard audit
-- (scratchpad fc/); re-run its CREATE OR REPLACE statements and GRANTs.

CREATE OR REPLACE FUNCTION public.generate_flashcard_share_token(p_set_id uuid, p_teacher_id uuid, p_expires_hours integer DEFAULT 8760)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  new_token TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND p_teacher_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  new_token := encode(extensions.gen_random_bytes(32), 'hex');

  -- Decision D-4 option B: every new link lives one year; p_expires_hours is kept only for the signature.
  UPDATE public.flashcard_sets
  SET
    share_token = new_token,
    share_expires_at = NOW() + interval '1 year',
    updated_at = NOW()
  WHERE id = p_set_id
    AND teacher_id = p_teacher_id
    AND deleted_at IS NULL;

  IF FOUND THEN
    RETURN new_token;
  ELSE
    RETURN NULL;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_flashcard_set(p_set_id uuid, p_teacher_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND p_teacher_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.flashcard_sets
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = p_set_id
    AND teacher_id = p_teacher_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.backfill_skill_metrics(p_student_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  -- A signed-in caller may only recompute one of their own students; all students is service role only.
  IF auth.uid() IS NOT NULL THEN
    IF p_student_id IS NULL THEN
      RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = p_student_id AND s.teacher_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
  END IF;

  FOR r IN
    SELECT DISTINCT
      nsr->>'name' AS skill_name,
      se.student_id,
      se.teacher_id
    FROM student_events se,
         jsonb_array_elements(se.event_payload->'nano_skill_ratings') AS nsr
    WHERE (p_student_id IS NULL OR se.student_id = p_student_id)
      AND (nsr->>'hasValue')::boolean = true
      AND (nsr->>'mastery')::numeric >= 0
  LOOP
    PERFORM public.compute_skill_metric(
      r.student_id, r.teacher_id, r.skill_name,
      public.extract_skill_category(r.skill_name)
    );
    v_count := v_count + 1;
  END LOOP;

  -- Also backfill flashcard metrics
  FOR r IN
    SELECT DISTINCT
      'flashcard:' || (se.event_payload->>'card_id') AS skill_name,
      se.student_id,
      se.teacher_id
    FROM student_events se
    WHERE se.event_source = 'flashcard'
      AND se.mastery IS NOT NULL
      AND (p_student_id IS NULL OR se.student_id = p_student_id)
  LOOP
    PERFORM public.compute_skill_metric(
      r.student_id, r.teacher_id, r.skill_name, 'vocabulary'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- No client code calls backfill_skill_metrics (checked in src/ and supabase/functions); service role and SQL editor only.
REVOKE EXECUTE ON FUNCTION public.backfill_skill_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_skill_metrics(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_flashcard_set_by_share_token(p_share_token text)
 RETURNS TABLE(id uuid, title text, description text, is_bidirectional boolean, student_name text, student_native_language text, teacher_first_name text, teacher_last_name text, teacher_email text, cards_count bigint, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT fs.id, fs.title, fs.description, fs.is_bidirectional,
    s.name as student_name, COALESCE(s.native_language, 'Spanish') as student_native_language,
    p.first_name as teacher_first_name, p.last_name as teacher_last_name, p.email as teacher_email,
    (SELECT COUNT(*) FROM public.flashcard_cards fc WHERE fc.set_id = fs.id AND fc.deleted_at IS NULL) as cards_count,
    fs.created_at
  FROM public.flashcard_sets fs
  JOIN public.students s ON fs.student_id = s.id
  JOIN public.profiles p ON fs.teacher_id = p.id
  WHERE fs.share_token = p_share_token
    AND fs.deleted_at IS NULL
    AND (fs.share_expires_at IS NULL OR fs.share_expires_at > now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_flashcard_cards_by_share_token(p_share_token text)
 RETURNS TABLE(id uuid, set_id uuid, front_text text, back_text text, front_example text, cefr_level text, source_type text, created_by_student boolean, card_position integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.set_id, c.front_text, c.back_text, c.front_example, c.cefr_level,
         c.source_type, c.created_by_student, c.card_position, c.created_at
  FROM public.flashcard_cards c
  JOIN public.flashcard_sets s ON s.id = c.set_id
  WHERE s.share_token = p_share_token
    AND s.deleted_at IS NULL
    AND (s.share_expires_at IS NULL OR s.share_expires_at > now())
    AND c.deleted_at IS NULL
  ORDER BY c.card_position ASC;
$function$;
