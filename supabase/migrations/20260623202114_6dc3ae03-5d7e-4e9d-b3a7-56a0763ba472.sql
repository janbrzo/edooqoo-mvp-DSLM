-- v6.9.68 P2 — Fix student_add_flashcard RPC (wrong columns) + add v2 with example/CEFR support.
-- Tabela flashcard_cards ma kolumny: front_text, back_text, front_example, card_position, cefr_level, source_type, created_by_student.
-- Stara funkcja używała nieistniejących `native_text` i `display_order` → 400.

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
  v_max_pos int;
BEGIN
  IF coalesce(trim(p_front),'') = '' OR coalesce(trim(p_back),'') = '' THEN
    RAISE EXCEPTION 'empty_card';
  END IF;
  IF coalesce(trim(p_student_email),'') = '' THEN
    RAISE EXCEPTION 'missing_email';
  END IF;

  SELECT * INTO v_set FROM public.flashcard_sets WHERE id = p_set_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'set_not_found'; END IF;
  IF NOT COALESCE(v_set.allow_student_contributions, true) THEN
    RAISE EXCEPTION 'contributions_disabled';
  END IF;

  SELECT id, teacher_id INTO v_student
    FROM public.students
   WHERE id = v_set.student_id
     AND lower(student_email) = lower(trim(p_student_email))
     AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'student_not_authorized'; END IF;

  SELECT COALESCE(MAX(card_position), 0) INTO v_max_pos
    FROM public.flashcard_cards WHERE set_id = p_set_id;

  INSERT INTO public.flashcard_cards(
    set_id, front_text, back_text, card_position, source_type, created_by_student
  ) VALUES (
    p_set_id, trim(p_front), trim(p_back), v_max_pos + 1, 'manual', true
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.student_add_flashcard(uuid, text, text, text, text) TO anon, authenticated, service_role;

-- v2: pełen kontrakt z example i CEFR.
CREATE OR REPLACE FUNCTION public.student_add_flashcard_v2(
  p_set_id uuid,
  p_student_email text,
  p_front text,
  p_back text,
  p_front_example text DEFAULT NULL,
  p_cefr_level text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set record;
  v_student record;
  v_new_id uuid;
  v_max_pos int;
BEGIN
  IF coalesce(trim(p_front),'') = '' OR coalesce(trim(p_back),'') = '' THEN
    RAISE EXCEPTION 'empty_card';
  END IF;
  IF coalesce(trim(p_student_email),'') = '' THEN
    RAISE EXCEPTION 'missing_email';
  END IF;

  SELECT * INTO v_set FROM public.flashcard_sets WHERE id = p_set_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'set_not_found'; END IF;
  IF NOT COALESCE(v_set.allow_student_contributions, true) THEN
    RAISE EXCEPTION 'contributions_disabled';
  END IF;

  SELECT id, teacher_id INTO v_student
    FROM public.students
   WHERE id = v_set.student_id
     AND lower(student_email) = lower(trim(p_student_email))
     AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'student_not_authorized'; END IF;

  SELECT COALESCE(MAX(card_position), 0) INTO v_max_pos
    FROM public.flashcard_cards WHERE set_id = p_set_id;

  INSERT INTO public.flashcard_cards(
    set_id, front_text, back_text, front_example, cefr_level,
    card_position, source_type, created_by_student
  ) VALUES (
    p_set_id, trim(p_front), trim(p_back),
    NULLIF(trim(p_front_example),''), NULLIF(trim(p_cefr_level),''),
    v_max_pos + 1, 'manual', true
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.student_add_flashcard_v2(uuid, text, text, text, text, text) TO anon, authenticated, service_role;


-- v6.9.68 P4 — attention_reads: per-actor last-seen state for subtle UI dots.
CREATE TABLE IF NOT EXISTS public.attention_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('teacher','student')),
  actor_key text NOT NULL,
  surface text NOT NULL,
  subject_id text NOT NULL DEFAULT '',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attention_reads_uniq UNIQUE (teacher_id, student_id, actor_type, actor_key, surface, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_attention_reads_teacher ON public.attention_reads (teacher_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_attention_reads_student ON public.attention_reads (student_id, actor_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attention_reads TO authenticated;
GRANT ALL ON public.attention_reads TO service_role;

ALTER TABLE public.attention_reads ENABLE ROW LEVEL SECURITY;

-- Teacher (authenticated) zarządza tylko swoimi rows; student-hub idzie przez service role.
CREATE POLICY "teacher_select_own_attention"
  ON public.attention_reads FOR SELECT
  TO authenticated
  USING (actor_type = 'teacher' AND auth.uid() = teacher_id AND actor_key = auth.uid()::text);

CREATE POLICY "teacher_insert_own_attention"
  ON public.attention_reads FOR INSERT
  TO authenticated
  WITH CHECK (actor_type = 'teacher' AND auth.uid() = teacher_id AND actor_key = auth.uid()::text);

CREATE POLICY "teacher_update_own_attention"
  ON public.attention_reads FOR UPDATE
  TO authenticated
  USING (actor_type = 'teacher' AND auth.uid() = teacher_id AND actor_key = auth.uid()::text)
  WITH CHECK (actor_type = 'teacher' AND auth.uid() = teacher_id AND actor_key = auth.uid()::text);

CREATE POLICY "teacher_delete_own_attention"
  ON public.attention_reads FOR DELETE
  TO authenticated
  USING (actor_type = 'teacher' AND auth.uid() = teacher_id AND actor_key = auth.uid()::text);

-- Upsert helper (idempotent) — auth callsites pass actor_key=auth.uid().
CREATE OR REPLACE FUNCTION public.mark_attention_seen(
  p_student_id uuid,
  p_actor_type text,
  p_actor_key text,
  p_surface text,
  p_subject_id text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid;
BEGIN
  IF p_actor_type NOT IN ('teacher','student') THEN
    RAISE EXCEPTION 'invalid_actor_type';
  END IF;

  IF p_actor_type = 'teacher' THEN
    -- Only the authenticated teacher may mark their own surfaces seen.
    IF auth.uid() IS NULL OR auth.uid()::text <> p_actor_key THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  IF p_student_id IS NOT NULL THEN
    SELECT teacher_id INTO v_teacher FROM public.students WHERE id = p_student_id;
  END IF;
  IF v_teacher IS NULL AND p_actor_type = 'teacher' THEN
    v_teacher := auth.uid();
  END IF;
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'student_not_found';
  END IF;

  INSERT INTO public.attention_reads(teacher_id, student_id, actor_type, actor_key, surface, subject_id, last_seen_at, updated_at)
  VALUES (v_teacher, p_student_id, p_actor_type, p_actor_key, p_surface, COALESCE(p_subject_id,''), now(), now())
  ON CONFLICT (teacher_id, student_id, actor_type, actor_key, surface, subject_id)
  DO UPDATE SET last_seen_at = now(), updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.mark_attention_seen(uuid, text, text, text, text) TO authenticated, service_role;