DROP POLICY IF EXISTS "Allow update for edge functions" ON public.export_payments;
DROP POLICY IF EXISTS "Allow insert for edge functions" ON public.export_payments;

CREATE OR REPLACE FUNCTION public.get_flashcard_cards_by_share_token(p_share_token text)
RETURNS TABLE (
  id uuid,
  set_id uuid,
  front_text text,
  back_text text,
  front_example text,
  cefr_level text,
  source_type text,
  created_by_student boolean,
  card_position integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.set_id, c.front_text, c.back_text, c.front_example, c.cefr_level,
         c.source_type, c.created_by_student, c.card_position, c.created_at
  FROM public.flashcard_cards c
  JOIN public.flashcard_sets s ON s.id = c.set_id
  WHERE s.share_token = p_share_token
    AND s.deleted_at IS NULL
    AND c.deleted_at IS NULL
  ORDER BY c.card_position ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_flashcard_set_is_bidirectional(p_set_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT s.is_bidirectional FROM public.flashcard_sets s WHERE s.id = p_set_id AND s.deleted_at IS NULL), false);
$$;

CREATE OR REPLACE FUNCTION public.get_homework_status_by_share_token(p_share_token text)
RETURNS TABLE (
  id uuid,
  reviewed_at timestamptz,
  completed_at timestamptz,
  source_worksheet_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.reviewed_at, h.completed_at, h.source_worksheet_id
  FROM public.homework_assignments h
  WHERE h.share_token = p_share_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_homework_owner_ids(p_homework_id uuid)
RETURNS TABLE (teacher_id uuid, student_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.teacher_id, h.student_id
  FROM public.homework_assignments h
  WHERE h.id = p_homework_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_flashcard_cards_by_share_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_flashcard_set_is_bidirectional(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_homework_status_by_share_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_homework_owner_ids(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public can view sets by share_token" ON public.flashcard_sets;
DROP POLICY IF EXISTS "Public can view cards in shared sets" ON public.flashcard_cards;
DROP POLICY IF EXISTS "Public can view homework by share token" ON public.homework_assignments;

DROP POLICY IF EXISTS "Service role full access homework_assignments" ON public.homework_assignments;
CREATE POLICY "Service role full access homework_assignments"
ON public.homework_assignments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);