-- AI evaluation queue v2 (iteration 3 of the evaluation pipeline fixes).
--
-- process-pending-ai-evaluations selected 'pending' rows and then marked them
-- 'processing' in a separate statement, so two runs could process the same
-- row; a run killed mid-way left rows in 'processing' forever; 'failed' rows
-- were never retried; and evaluation only ran when a student's browser tab
-- (or a teacher action) invoked the function.
--
-- 1. attempts + locked_at columns and an atomic claim (FOR UPDATE SKIP LOCKED)
--    that also recovers stale 'processing' rows and retries 'failed' rows
--    (at most 3 attempts, 5 minutes apart).
-- 2. Re-queueing an exercise resets its attempt counter.
-- 3. A list of saved worksheet answers that still need evaluation (10 minutes
--    after the last save, not evaluated since, saved within 7 days), so a
--    scheduled call can queue them server-side even when the tab was closed.
-- The schedule itself (pg_cron + CRON_SECRET) is created outside migrations;
-- see mem://features/dslm/evaluation-pipeline.

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.pending_worksheet_ai_evaluations
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_pending_ai_evaluations(
  p_limit integer DEFAULT 10,
  p_worksheet_id uuid DEFAULT NULL,
  p_student_email text DEFAULT NULL
)
 RETURNS SETOF public.pending_worksheet_ai_evaluations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.pending_worksheet_ai_evaluations q
     SET status = 'processing',
         locked_at = now(),
         attempts = q.attempts + 1
   WHERE q.id IN (
     SELECT p.id
     FROM public.pending_worksheet_ai_evaluations p
     WHERE (
             p.status = 'pending'
          OR (p.status = 'processing' AND p.locked_at IS NOT NULL AND p.locked_at < now() - interval '10 minutes')
          OR (p.status = 'processing' AND p.locked_at IS NULL AND p.created_at < now() - interval '10 minutes')
          OR (p.status = 'failed' AND p.attempts < 3
              AND coalesce(p.processed_at, p.created_at) < now() - interval '5 minutes')
           )
       AND (p_worksheet_id IS NULL OR p.worksheet_id = p_worksheet_id)
       AND (p_student_email IS NULL OR p.student_email = lower(p_student_email))
     ORDER BY p.created_at
     LIMIT greatest(1, least(coalesce(p_limit, 10), 50))
     FOR UPDATE SKIP LOCKED
   )
  RETURNING q.*;
END;
$function$;

-- Same body as production (20261012090000) plus: re-queueing resets the
-- attempt counter and the lock.
CREATE OR REPLACE FUNCTION public.queue_worksheet_ai_evaluation(p_worksheet_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_english_level text DEFAULT 'Intermediate'::text, p_context jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO pending_worksheet_ai_evaluations (
    worksheet_id,
    student_email,
    exercise_index,
    exercise_type,
    answers,
    english_level,
    context,
    status
  )
  VALUES (
    p_worksheet_id,
    lower(p_student_email),
    p_exercise_index,
    p_exercise_type,
    p_answers,
    p_english_level,
    p_context,
    'pending'
  )
  ON CONFLICT (worksheet_id, student_email, exercise_index)
  DO UPDATE SET
    answers = EXCLUDED.answers,
    english_level = EXCLUDED.english_level,
    context = EXCLUDED.context,
    status = 'pending',
    created_at = NOW(),
    processed_at = NULL,
    error_message = NULL,
    attempts = 0,
    locked_at = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_worksheet_answers_needing_ai_evaluation(p_limit integer DEFAULT 20)
 RETURNS TABLE(worksheet_id uuid, student_email text, exercise_index integer, exercise_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.worksheet_id, a.student_email, a.exercise_index, a.exercise_type
  FROM public.worksheet_student_answers a
  WHERE a.last_saved_at <= now() - interval '10 minutes'
    AND a.last_saved_at >= now() - interval '7 days'
    AND (a.last_ai_eval_at IS NULL OR a.last_ai_eval_at < a.last_saved_at)
    AND a.answers IS NOT NULL AND a.answers <> '{}'::jsonb
    AND NOT EXISTS (
      SELECT 1 FROM public.pending_worksheet_ai_evaluations p
      WHERE p.worksheet_id = a.worksheet_id
        AND p.student_email = a.student_email
        AND p.exercise_index = a.exercise_index
        AND (
              p.status IN ('pending', 'processing')
           -- gave up on this save already: do not queue it again until the student saves anew
           OR (p.status = 'failed' AND p.attempts >= 3 AND p.created_at >= a.last_saved_at)
        )
    )
  ORDER BY a.last_saved_at
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$function$;

-- Queue internals are for the Edge Function (service role) only.
REVOKE ALL ON FUNCTION public.claim_pending_ai_evaluations(integer, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_worksheet_answers_needing_ai_evaluation(integer) FROM PUBLIC, anon, authenticated;
