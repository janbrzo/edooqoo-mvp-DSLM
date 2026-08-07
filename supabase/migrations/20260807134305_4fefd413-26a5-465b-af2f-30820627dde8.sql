-- ============ CALENDAR SLOTS ============
DROP POLICY IF EXISTS "Public can book available slots" ON public.calendar_slots;
DROP POLICY IF EXISTS "Public can view available slots" ON public.calendar_slots;

CREATE POLICY "Public can view available slots of public calendars"
ON public.calendar_slots FOR SELECT
TO anon, authenticated
USING (
  status = 'available'
  AND student_id IS NULL
  AND slot_type <> 'block'
  AND EXISTS (
    SELECT 1 FROM public.calendar_settings cs
    WHERE cs.teacher_id = calendar_slots.teacher_id
      AND cs.public_calendar_enabled = true
  )
);

REVOKE UPDATE ON public.calendar_slots FROM anon;

CREATE OR REPLACE FUNCTION public.book_public_slot(
  p_slot_id uuid,
  p_student_name text,
  p_student_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot public.calendar_slots%ROWTYPE;
  v_auto_confirm boolean := false;
  v_student_id uuid;
  v_student_name text;
  v_email text := lower(trim(p_student_email));
BEGIN
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;
  IF coalesce(trim(p_student_name), '') = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  SELECT * INTO v_slot FROM public.calendar_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND OR v_slot.status <> 'available' OR v_slot.student_id IS NOT NULL OR v_slot.slot_type = 'block' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'slot_unavailable');
  END IF;

  SELECT cs.default_booking_mode = 'auto_confirm' INTO v_auto_confirm
  FROM public.calendar_settings cs
  WHERE cs.teacher_id = v_slot.teacher_id AND cs.public_calendar_enabled = true;

  IF v_auto_confirm IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'public_booking_disabled');
  END IF;

  SELECT s.id, s.name INTO v_student_id, v_student_name
  FROM public.students s
  WHERE s.teacher_id = v_slot.teacher_id
    AND lower(s.student_email) = v_email
    AND s.deleted_at IS NULL
  LIMIT 1;

  v_student_name := coalesce(v_student_name, trim(p_student_name));

  UPDATE public.calendar_slots
  SET student_id = v_student_id,
      status = 'booked',
      booking_type = 'student_booked',
      booked_at = now(),
      booked_by = 'student',
      confirmed_at = CASE WHEN v_auto_confirm THEN now() ELSE NULL END,
      student_notes = 'Booked by: ' || v_student_name || ' (' || v_email || ')',
      title = v_student_name || ' — English lesson'
  WHERE id = p_slot_id AND status = 'available';

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_slot.teacher_id,
    'student_existed', v_student_id IS NOT NULL,
    'student_id', v_student_id,
    'student_name', v_student_name,
    'auto_confirm', v_auto_confirm,
    'slot_date', v_slot.slot_date,
    'start_time', v_slot.start_time,
    'end_time', v_slot.end_time,
    'meeting_link', v_slot.meeting_link,
    'worksheet_id', v_slot.worksheet_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_public_slot(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_public_slot(uuid, text, text) TO anon, authenticated, service_role;

-- ============ FLASHCARD PROGRESS ============
DROP POLICY IF EXISTS "Anyone can manage their own progress" ON public.flashcard_progress;

CREATE POLICY "Teachers can view progress of their own sets"
ON public.flashcard_progress FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.flashcard_sets fs
  WHERE fs.id = flashcard_progress.set_id AND fs.teacher_id = auth.uid()
));

CREATE POLICY "Teachers can manage progress of their own sets"
ON public.flashcard_progress FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.flashcard_sets fs
  WHERE fs.id = flashcard_progress.set_id AND fs.teacher_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.flashcard_sets fs
  WHERE fs.id = flashcard_progress.set_id AND fs.teacher_id = auth.uid()
));

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.flashcard_progress FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_progress TO authenticated;
GRANT ALL ON public.flashcard_progress TO service_role;

CREATE OR REPLACE FUNCTION public.save_flashcard_progress(
  p_card_id uuid,
  p_set_id uuid,
  p_learner_identifier text,
  p_direction integer,
  p_easiness_factor numeric,
  p_repetition integer,
  p_interval_days integer,
  p_next_review_date timestamptz,
  p_total_reviews integer,
  p_correct_count integer,
  p_incorrect_count integer,
  p_last_response_time_ms integer,
  p_last_quality_rating integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_learner_identifier));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'learner_identifier is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.flashcard_cards c
    WHERE c.id = p_card_id AND c.set_id = p_set_id
  ) THEN
    RAISE EXCEPTION 'Card does not belong to the given set';
  END IF;

  INSERT INTO public.flashcard_progress (
    card_id, set_id, learner_identifier, direction, easiness_factor, repetition,
    interval_days, next_review_date, last_reviewed_at, total_reviews,
    correct_count, incorrect_count, last_response_time_ms, last_quality_rating
  ) VALUES (
    p_card_id, p_set_id, v_email, coalesce(p_direction, 0), p_easiness_factor, p_repetition,
    p_interval_days, p_next_review_date, now(), p_total_reviews,
    p_correct_count, p_incorrect_count, p_last_response_time_ms, p_last_quality_rating
  )
  ON CONFLICT (card_id, learner_identifier, direction) DO UPDATE SET
    easiness_factor = EXCLUDED.easiness_factor,
    repetition = EXCLUDED.repetition,
    interval_days = EXCLUDED.interval_days,
    next_review_date = EXCLUDED.next_review_date,
    last_reviewed_at = EXCLUDED.last_reviewed_at,
    total_reviews = EXCLUDED.total_reviews,
    correct_count = EXCLUDED.correct_count,
    incorrect_count = EXCLUDED.incorrect_count,
    last_response_time_ms = EXCLUDED.last_response_time_ms,
    last_quality_rating = EXCLUDED.last_quality_rating,
    updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_flashcard_progress(uuid, uuid, text, integer, numeric, integer, integer, timestamptz, integer, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_flashcard_progress(uuid, uuid, text, integer, numeric, integer, integer, timestamptz, integer, integer, integer, integer, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_learner_mastered_counts(p_learner_identifier text)
RETURNS TABLE(set_id uuid, mastered_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fp.set_id, count(*)::bigint
  FROM public.flashcard_progress fp
  WHERE lower(fp.learner_identifier) = lower(trim(p_learner_identifier))
    AND coalesce(fp.repetition, 0) >= 4
  GROUP BY fp.set_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_learner_mastered_counts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_learner_mastered_counts(text) TO anon, authenticated, service_role;