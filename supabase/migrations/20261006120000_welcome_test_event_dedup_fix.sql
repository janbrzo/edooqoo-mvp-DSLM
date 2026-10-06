-- Welcome Test event dedup: legacy question ids (wt_q10, wt_q12, ...) collide
-- with canonical ids of OTHER questions (wt_q10..wt_q58), so deleting by
-- "answer_id = legacy id" wiped events of unrelated questions (22 of 43 answers
-- kept on a live test). Match the legacy id only on pre-renumber events, which
-- stored the legacy id as answer_id and carry no legacy_answer_id field.
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

  DELETE FROM public.student_events
  WHERE student_id = t.student_id
    AND source_id = t.id
    AND event_type = p_event_type
    AND (
      event_payload->>'answer_id' = p_answer_id
      OR (event_payload->>'answer_id' = p_legacy_answer_id
          AND NOT (event_payload ? 'legacy_answer_id'))
    );

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
