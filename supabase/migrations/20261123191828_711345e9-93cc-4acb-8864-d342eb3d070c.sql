-- 1. Sentinel system owner profile for unclaimed public placement students.
-- No auth.users account can ever hold the nil UUID, and deleted_at is set so
-- active teacher lookups (.is('deleted_at', null)) and email queries ignore it.
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  available_tokens,
  total_tokens_received,
  total_tokens_consumed,
  rollover_tokens,
  deleted_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  NULL,
  'Unclaimed',
  'Placement',
  0,
  0,
  0,
  0,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Link public placement reports to their pre-created unclaimed student & test.
ALTER TABLE public.public_placement_reports
  ADD COLUMN IF NOT EXISTS unclaimed_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unclaimed_test_id UUID REFERENCES public.student_tests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_public_placement_reports_unclaimed_student_id
  ON public.public_placement_reports (unclaimed_student_id)
  WHERE unclaimed_student_id IS NOT NULL;

-- 3. Atomic service-only transfer of an unclaimed placement student and all
-- related DSLM / Welcome Test records to a signed-in teacher.
CREATE OR REPLACE FUNCTION public.claim_unclaimed_placement_student(
  p_student_id UUID,
  p_new_teacher_id UUID,
  p_teacher_email TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unclaimed_id CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
  v_moved INTEGER;
BEGIN
  IF p_student_id IS NULL OR p_new_teacher_id IS NULL OR p_new_teacher_id = v_unclaimed_id THEN
    RAISE EXCEPTION 'Invalid student or target teacher' USING ERRCODE = '22023';
  END IF;

  UPDATE public.students
  SET teacher_id = p_new_teacher_id,
      teacher_email = COALESCE(NULLIF(trim(p_teacher_email), ''), teacher_email),
      placement_pending_at = NULL,
      updated_at = NOW()
  WHERE id = p_student_id
    AND teacher_id = v_unclaimed_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  IF v_moved = 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.student_tests
  SET teacher_id = p_new_teacher_id,
      updated_at = NOW()
  WHERE student_id = p_student_id
    AND teacher_id = v_unclaimed_id;

  UPDATE public.student_learning_profiles
  SET teacher_id = p_new_teacher_id,
      updated_at = NOW()
  WHERE student_id = p_student_id
    AND teacher_id = v_unclaimed_id;

  UPDATE public.student_learning_profile_versions
  SET teacher_id = p_new_teacher_id
  WHERE student_id = p_student_id
    AND teacher_id = v_unclaimed_id;

  UPDATE public.student_events
  SET teacher_id = p_new_teacher_id
  WHERE student_id = p_student_id
    AND teacher_id = v_unclaimed_id;

  UPDATE public.student_skill_metrics
  SET teacher_id = p_new_teacher_id,
      updated_at = NOW()
  WHERE student_id = p_student_id
    AND teacher_id = v_unclaimed_id;

  UPDATE public.student_progress_goals
  SET teacher_id = p_new_teacher_id,
      updated_at = NOW()
  WHERE student_id = p_student_id
    AND teacher_id = v_unclaimed_id;

  UPDATE public.dslm_curriculum_phases
  SET teacher_id = p_new_teacher_id,
      updated_at = NOW()
  WHERE student_id = p_student_id
    AND teacher_id = v_unclaimed_id;

  UPDATE public.future_worksheet_suggestions
  SET teacher_id = p_new_teacher_id,
      updated_at = NOW()
  WHERE student_id = p_student_id
    AND teacher_id = v_unclaimed_id;

  UPDATE public.pacing_proposals
  SET teacher_id = p_new_teacher_id
  WHERE student_id = p_student_id
    AND teacher_id = v_unclaimed_id;

  DELETE FROM public.homework_notifications
  WHERE student_id = p_student_id
    AND teacher_id = v_unclaimed_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_unclaimed_placement_student(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_unclaimed_placement_student(UUID, UUID, TEXT) TO service_role;