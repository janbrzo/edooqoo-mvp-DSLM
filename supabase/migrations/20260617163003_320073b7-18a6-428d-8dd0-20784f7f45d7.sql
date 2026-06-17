-- v6.9.62 P7 — Allow students to contribute flashcards to their assigned set
ALTER TABLE public.flashcard_sets
  ADD COLUMN IF NOT EXISTS allow_student_contributions boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.student_add_flashcard(
  p_set_id uuid,
  p_student_email text,
  p_front text,
  p_back text,
  p_native text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set record;
  v_student record;
  v_new_id uuid;
  v_max_order int;
BEGIN
  IF coalesce(trim(p_front),'') = '' OR coalesce(trim(p_back),'') = '' THEN
    RAISE EXCEPTION 'empty_card';
  END IF;
  IF coalesce(trim(p_student_email),'') = '' THEN
    RAISE EXCEPTION 'missing_email';
  END IF;

  SELECT * INTO v_set FROM public.flashcard_sets WHERE id = p_set_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'set_not_found'; END IF;
  IF NOT COALESCE(v_set.allow_student_contributions, true) THEN
    RAISE EXCEPTION 'contributions_disabled';
  END IF;

  SELECT id, teacher_id INTO v_student
    FROM public.students
   WHERE id = v_set.student_id
     AND lower(student_email) = lower(trim(p_student_email));
  IF NOT FOUND THEN RAISE EXCEPTION 'student_not_authorized'; END IF;

  SELECT COALESCE(MAX(display_order), 0) INTO v_max_order
    FROM public.flashcard_cards WHERE set_id = p_set_id;

  INSERT INTO public.flashcard_cards(
    set_id, front_text, back_text, native_text, display_order, created_by_student
  ) VALUES (
    p_set_id, trim(p_front), trim(p_back), NULLIF(trim(p_native),''),
    v_max_order + 1, true
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.student_add_flashcard(uuid, text, text, text, text) TO anon, authenticated;

-- Add tracking column for student-contributed cards
ALTER TABLE public.flashcard_cards
  ADD COLUMN IF NOT EXISTS created_by_student boolean NOT NULL DEFAULT false;