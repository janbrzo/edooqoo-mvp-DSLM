-- Iteration 8 (I8.BC): homework AI recovery and worksheet save semantics.
--
-- 1. save_worksheet_answer (8 and 9 argument overloads, the ones the client
--    reaches through save_worksheet_answer_by_share_token): the old upsert kept
--    COALESCE(new, old) for mastery and item_evaluations and never touched
--    ai_evaluation, so clearing an answer left its old mastery, and editing one
--    left the old AI score and feedback. When the saved answers differ from the
--    stored ones (keys starting with an underscore, such as transcriptions, are
--    ignored) the stored ai_evaluation is cleared and mastery and
--    item_evaluations come from the new call as they are. When the answers are
--    unchanged (a re-save) the ratings with source ai_alternative (the AI raise
--    of a typed closed answer) are kept instead of being overwritten by the
--    key-only values the client sends, and the exercise mastery they produced
--    is kept with them. Signatures and grants are unchanged.
-- 2. Homework AI recovery: homework AI ran only in the submitting browser tab
--    and was lost when it closed. Three service role functions let the
--    scheduled process-pending-ai-evaluations run list, claim and give up
--    submitted answers that still have no ai_evaluation.
--
-- Rollback: re-run the 8 and 9 argument save_worksheet_answer definitions from
-- 20261012090000_dslm_pipeline_baseline.sql and drop the three homework
-- functions and the three ai_eval_* columns.

SET LOCAL lock_timeout = '5s';

-- 1. save_worksheet_answer -----------------------------------------------------

-- True when two answer objects differ, ignoring keys that start with an underscore.
CREATE OR REPLACE FUNCTION public.worksheet_answers_differ(p_old jsonb, p_new jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT jsonb_object_agg(key, value) FROM jsonb_each(CASE WHEN jsonb_typeof(p_old) = 'object' THEN p_old ELSE '{}'::jsonb END) WHERE key NOT LIKE E'\\_%'), '{}'::jsonb)
         IS DISTINCT FROM
         COALESCE((SELECT jsonb_object_agg(key, value) FROM jsonb_each(CASE WHEN jsonb_typeof(p_new) = 'object' THEN p_new ELSE '{}'::jsonb END) WHERE key NOT LIKE E'\\_%'), '{}'::jsonb);
$function$;

-- New ratings, except that a rating the stored array holds with source
-- ai_alternative (same question and skill) is kept. NULL when p_new is NULL.
CREATE OR REPLACE FUNCTION public.keep_ai_alternative_ratings(p_old jsonb, p_new jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_new IS NULL OR jsonb_typeof(p_new) <> 'array' THEN p_new
    WHEN p_old IS NULL OR jsonb_typeof(p_old) <> 'array' THEN p_new
    ELSE COALESCE((
      SELECT jsonb_agg(
        COALESCE(
          (SELECT o FROM jsonb_array_elements(p_old) o
            WHERE o->>'source' = 'ai_alternative'
              AND o->>'question_index' = n->>'question_index'
              AND o->>'name' IS NOT DISTINCT FROM n->>'name'
            LIMIT 1),
          n)
        ORDER BY ord)
      FROM jsonb_array_elements(p_new) WITH ORDINALITY AS t(n, ord)
    ), '[]'::jsonb)
  END;
$function$;

REVOKE ALL ON FUNCTION public.worksheet_answers_differ(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.keep_ai_alternative_ratings(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- save_worksheet_answer__8args
CREATE OR REPLACE FUNCTION public.save_worksheet_answer(p_worksheet_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_old public.worksheet_student_answers%ROWTYPE;
  v_found boolean;
  v_changed boolean;
  v_items jsonb;
  v_kept boolean;
BEGIN
  SELECT * INTO v_old
  FROM public.worksheet_student_answers
  WHERE worksheet_id = p_worksheet_id
    AND student_email = lower(p_student_email)
    AND exercise_index = p_exercise_index
  FOR UPDATE;
  v_found := FOUND;
  -- A row created by a concurrent save counts as changed (clearing is the safe side).
  v_changed := NOT v_found OR public.worksheet_answers_differ(v_old.answers, p_answers);
  v_items := public.keep_ai_alternative_ratings(v_old.item_evaluations, p_item_evaluations);
  v_kept := NOT v_changed AND v_items IS DISTINCT FROM p_item_evaluations;

  INSERT INTO public.worksheet_student_answers (
    worksheet_id, student_email, exercise_index, exercise_type,
    answers, started_at, last_saved_at, time_spent_ms, mastery, item_evaluations
  )
  VALUES (
    p_worksheet_id, lower(p_student_email), p_exercise_index, p_exercise_type,
    p_answers, NOW(), NOW(), COALESCE(p_time_spent_ms, 0), p_mastery, p_item_evaluations
  )
  ON CONFLICT (worksheet_id, student_email, exercise_index)
  DO UPDATE SET
    answers = EXCLUDED.answers,
    last_saved_at = NOW(),
    time_spent_ms = COALESCE(EXCLUDED.time_spent_ms, worksheet_student_answers.time_spent_ms),
    ai_evaluation = CASE WHEN v_changed THEN NULL ELSE worksheet_student_answers.ai_evaluation END,
    mastery = CASE
      WHEN v_changed THEN EXCLUDED.mastery
      WHEN v_kept THEN worksheet_student_answers.mastery
      ELSE COALESCE(EXCLUDED.mastery, worksheet_student_answers.mastery)
    END,
    item_evaluations = CASE
      WHEN v_changed THEN EXCLUDED.item_evaluations
      ELSE COALESCE(v_items, worksheet_student_answers.item_evaluations)
    END,
    eval_trigger = NULL  -- RESET on student save so trigger maps to student_learning_activity
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- save_worksheet_answer__9args
CREATE OR REPLACE FUNCTION public.save_worksheet_answer(p_worksheet_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_audio_answers jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_old public.worksheet_student_answers%ROWTYPE;
  v_found boolean;
  v_changed boolean;
  v_items jsonb;
  v_kept boolean;
BEGIN
  SELECT * INTO v_old
  FROM public.worksheet_student_answers
  WHERE worksheet_id = p_worksheet_id
    AND student_email = lower(p_student_email)
    AND exercise_index = p_exercise_index
  FOR UPDATE;
  v_found := FOUND;
  v_changed := NOT v_found OR public.worksheet_answers_differ(v_old.answers, p_answers);
  v_items := public.keep_ai_alternative_ratings(v_old.item_evaluations, p_item_evaluations);
  v_kept := NOT v_changed AND v_items IS DISTINCT FROM p_item_evaluations;

  INSERT INTO public.worksheet_student_answers (
    worksheet_id, student_email, exercise_index, exercise_type,
    answers, started_at, last_saved_at, time_spent_ms, mastery, item_evaluations, audio_answers
  )
  VALUES (
    p_worksheet_id, lower(p_student_email), p_exercise_index, p_exercise_type,
    p_answers, NOW(), NOW(), COALESCE(p_time_spent_ms, 0), p_mastery, p_item_evaluations,
    COALESCE(p_audio_answers, '{}'::jsonb)
  )
  ON CONFLICT (worksheet_id, student_email, exercise_index)
  DO UPDATE SET
    answers = EXCLUDED.answers,
    last_saved_at = NOW(),
    time_spent_ms = COALESCE(EXCLUDED.time_spent_ms, worksheet_student_answers.time_spent_ms),
    ai_evaluation = CASE WHEN v_changed THEN NULL ELSE worksheet_student_answers.ai_evaluation END,
    mastery = CASE
      WHEN v_changed THEN EXCLUDED.mastery
      WHEN v_kept THEN worksheet_student_answers.mastery
      ELSE COALESCE(EXCLUDED.mastery, worksheet_student_answers.mastery)
    END,
    item_evaluations = CASE
      WHEN v_changed THEN EXCLUDED.item_evaluations
      ELSE COALESCE(v_items, worksheet_student_answers.item_evaluations)
    END,
    audio_answers = CASE
      WHEN EXCLUDED.audio_answers IS NOT NULL AND EXCLUDED.audio_answers != '{}'::jsonb
      THEN EXCLUDED.audio_answers
      ELSE worksheet_student_answers.audio_answers
    END,
    eval_trigger = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- 2. Homework AI recovery --------------------------------------------------------

ALTER TABLE public.homework_student_answers
  ADD COLUMN IF NOT EXISTS ai_eval_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_eval_last_attempt_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ai_eval_note text;

-- Submitted answers of AI evaluated types (open types, and typed closed types
-- the AI may raise: OPEN_EXERCISE_TYPES and the non-selection CLOSED_EXERCISE_TYPES
-- of supabase/functions/_shared/itemMastery.ts) with no ai_evaluation, submitted
-- 3 to 20160 minutes ago (the tab fast path gets 3 minutes), with attempts left
-- and the last attempt at least 10 minutes ago.
CREATE OR REPLACE FUNCTION public.list_homework_answers_needing_ai_evaluation(p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, homework_id uuid, student_email text, exercise_index integer, exercise_type text, answers jsonb, audio_answers jsonb, item_evaluations jsonb, last_saved_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.id, a.homework_id, a.student_email, a.exercise_index, a.exercise_type,
         a.answers, a.audio_answers, a.item_evaluations, a.last_saved_at
  FROM public.homework_student_answers a
  WHERE a.is_submitted = true
    AND a.ai_evaluation IS NULL
    AND a.submitted_at <= now() - interval '3 minutes'
    AND a.submitted_at >= now() - interval '14 days'
    AND a.ai_eval_attempts < 3
    AND (a.ai_eval_last_attempt_at IS NULL OR a.ai_eval_last_attempt_at <= now() - interval '10 minutes')
    AND ((a.answers IS NOT NULL AND a.answers <> '{}'::jsonb) OR (a.audio_answers IS NOT NULL AND a.audio_answers <> '{}'::jsonb))
    AND (
      a.exercise_type IN (
        'reading', 'discussion', 'describe', 'describe-picture', 'answer-questions',
        'answer-questions-audio', 'answer-questions-picture', 'dialogue', 'paraphrasing',
        'speaking', 'sentence-transformation', 'essay', 'listening-comprehension'
      )
      OR replace(replace(a.exercise_type, '-picture', ''), '-audio', '') IN (
        'fill-in-blanks', 'complete-word', 'negative-prefixes', 'synonyms-antonyms',
        'synonyms', 'antonyms', 'error-correction', 'gap-text', 'word-order'
      )
    )
  ORDER BY a.submitted_at
  LIMIT greatest(1, least(coalesce(p_limit, 10), 50));
$function$;

-- Takes one attempt on a row atomically: false when the row was evaluated in
-- the meantime, has no attempts left, or another run tried it less than 10
-- minutes ago.
CREATE OR REPLACE FUNCTION public.claim_homework_answer_ai_attempt(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH claimed AS (
    UPDATE public.homework_student_answers a
       SET ai_eval_attempts = a.ai_eval_attempts + 1,
           ai_eval_last_attempt_at = now()
     WHERE a.id = p_id
       AND a.ai_evaluation IS NULL
       AND a.ai_eval_attempts < 3
       AND (a.ai_eval_last_attempt_at IS NULL OR a.ai_eval_last_attempt_at <= now() - interval '10 minutes')
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$function$;

-- Gives a row up for good (nothing to evaluate); it is no longer listed.
CREATE OR REPLACE FUNCTION public.mark_homework_answer_ai_not_evaluable(p_id uuid, p_note text DEFAULT 'not evaluable')
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.homework_student_answers
     SET ai_eval_attempts = 3,
         ai_eval_last_attempt_at = now(),
         ai_eval_note = left(coalesce(p_note, 'not evaluable'), 200)
   WHERE id = p_id
     AND ai_evaluation IS NULL;
$function$;

REVOKE ALL ON FUNCTION public.list_homework_answers_needing_ai_evaluation(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_homework_answer_ai_attempt(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_homework_answer_ai_not_evaluable(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_homework_answers_needing_ai_evaluation(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_homework_answer_ai_attempt(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_homework_answer_ai_not_evaluable(uuid, text) TO service_role;
