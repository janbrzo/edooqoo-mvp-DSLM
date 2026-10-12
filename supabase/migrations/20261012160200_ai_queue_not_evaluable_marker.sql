-- AI evaluation queue: race-free "not evaluable" marker.
--
-- The stale-answer scan (process-pending-ai-evaluations) records a save it
-- cannot evaluate (unsupported type, no resolvable closed items) as a completed
-- queue row, so the scan does not offer it again. It checked for an active row
-- and then upserted, so a student queueing the same exercise between the two
-- statements had their pending row overwritten to 'completed' with no answers.
-- This function does the insert in one statement and never touches a pending or
-- processing row.

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.mark_worksheet_answer_not_evaluable(
  p_worksheet_id uuid,
  p_student_email text,
  p_exercise_index integer,
  p_exercise_type text
)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO public.pending_worksheet_ai_evaluations AS p (
    worksheet_id, student_email, exercise_index, exercise_type, answers,
    status, error_message, created_at, processed_at
  )
  VALUES (
    -- Same email as the answer row (the stale scan matches it exactly).
    p_worksheet_id, p_student_email, p_exercise_index, p_exercise_type, '{}'::jsonb,
    'completed', 'not evaluable', now(), now()
  )
  ON CONFLICT (worksheet_id, student_email, exercise_index) DO UPDATE SET
    exercise_type = EXCLUDED.exercise_type,
    answers = EXCLUDED.answers,
    status = EXCLUDED.status,
    error_message = EXCLUDED.error_message,
    created_at = EXCLUDED.created_at,
    processed_at = EXCLUDED.processed_at,
    locked_at = NULL
  WHERE p.status NOT IN ('pending', 'processing');
$function$;

REVOKE ALL ON FUNCTION public.mark_worksheet_answer_not_evaluable(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
