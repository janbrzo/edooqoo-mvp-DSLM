-- 1. Billing guard: block only direct client UPDATEs, which run as role
-- `authenticated`. Trusted SECURITY DEFINER functions (consume_token) run as
-- their owner and must write usage fields. The previous auth.role() check reads
-- the JWT claim, which is 'authenticated' inside consume_token too, so no
-- worksheet was charged since 2026-09-18.
CREATE OR REPLACE FUNCTION public.prevent_profile_billing_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' AND (
    NEW.available_tokens IS DISTINCT FROM OLD.available_tokens OR
    NEW.total_tokens_received IS DISTINCT FROM OLD.total_tokens_received OR
    NEW.total_tokens_consumed IS DISTINCT FROM OLD.total_tokens_consumed OR
    NEW.rollover_tokens IS DISTINCT FROM OLD.rollover_tokens OR
    NEW.subscription_type IS DISTINCT FROM OLD.subscription_type OR
    NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
    NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at OR
    NEW.monthly_worksheet_limit IS DISTINCT FROM OLD.monthly_worksheet_limit OR
    NEW.monthly_worksheets_used IS DISTINCT FROM OLD.monthly_worksheets_used OR
    NEW.last_limit_reset IS DISTINCT FROM OLD.last_limit_reset OR
    NEW.is_tokens_frozen IS DISTINCT FROM OLD.is_tokens_frozen OR
    NEW.total_worksheets_created IS DISTINCT FROM OLD.total_worksheets_created
  ) THEN
    RAISE EXCEPTION 'Billing and usage fields cannot be updated directly';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_profile_billing_self_update() FROM PUBLIC, anon, authenticated, service_role;

-- 2. Student-facing event logging. add_student_event is teacher-only since
-- 2026-08-07, so anonymous students lost every Welcome Test answer event and
-- the homework_submitted event. These wrappers authorise by share token or by
-- the student's email and accept only their own fixed event types.
CREATE OR REPLACE FUNCTION public.log_welcome_test_event_by_share_token(
  p_share_token text,
  p_event_type text,
  p_answer_id text,
  p_legacy_answer_id text,
  p_event_payload jsonb,
  p_element_type text DEFAULT NULL,
  p_skill_ids text[] DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
BEGIN
  IF p_event_type NOT IN ('test_answer_submitted', 'test_answer_skipped') THEN
    RAISE EXCEPTION 'Unsupported event type';
  END IF;

  SELECT id, student_id, teacher_id INTO t
  FROM public.student_tests
  WHERE share_token = p_share_token
    AND deleted_at IS NULL
    AND status IN ('assigned', 'in_progress', 'completed')
  LIMIT 1;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Test not found';
  END IF;

  -- One event per answer (canonical or legacy id), same dedup as the client had.
  DELETE FROM public.student_events
  WHERE student_id = t.student_id
    AND source_id = t.id
    AND event_type = p_event_type
    AND (event_payload->>'answer_id' = p_answer_id
         OR event_payload->>'answer_id' = p_legacy_answer_id);

  RETURN public.add_student_event(
    p_student_id => t.student_id,
    p_teacher_id => t.teacher_id,
    p_event_type => p_event_type,
    p_event_source => 'welcome_test',
    p_source_id => t.id,
    p_event_payload => p_event_payload,
    p_skill_ids => p_skill_ids,
    p_element_type => p_element_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_homework_submitted_event(
  p_homework_id uuid,
  p_student_email text,
  p_event_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h record;
BEGIN
  SELECT ha.id, ha.student_id, ha.teacher_id INTO h
  FROM public.homework_assignments ha
  JOIN public.students s ON s.id = ha.student_id
  WHERE ha.id = p_homework_id
    AND ha.completed_at IS NOT NULL
    AND lower(s.student_email) = lower(trim(p_student_email))
  LIMIT 1;
  IF h.id IS NULL THEN
    RAISE EXCEPTION 'Homework not found';
  END IF;

  -- Idempotent: one homework_submitted event per homework.
  DELETE FROM public.student_events
  WHERE source_id = h.id AND event_type = 'homework_submitted';

  RETURN public.add_student_event(
    p_student_id => h.student_id,
    p_teacher_id => h.teacher_id,
    p_event_type => 'homework_submitted',
    p_event_source => 'homework',
    p_source_id => h.id,
    p_event_payload => p_event_payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_welcome_test_event_by_share_token(text, text, text, text, jsonb, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_homework_submitted_event(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_welcome_test_event_by_share_token(text, text, text, text, jsonb, text, text[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_homework_submitted_event(uuid, text, jsonb) TO anon, authenticated, service_role;
