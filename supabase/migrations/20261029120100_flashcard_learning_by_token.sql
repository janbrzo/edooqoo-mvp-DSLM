-- Flashcards Phase 1, migration B: token based learning RPCs (audit findings F-3, F-4, F-5, F-6, F-10, decision D-2 option B).
-- Why: the student page called get_flashcard_cards_for_learning and save_flashcard_progress with a set id plus
--   client computed SM-2 numbers, so any caller could write any schedule, a legacy mixed case e-mail was not found,
--   and the client duplicated cards for the second direction. The new functions take the share token plus the e-mail,
--   validate both, return one row per live card with both directions, and compute SM-2 on the server.
-- New function names only (no overloads). The old anon RPCs stay callable until a later migration revokes them.
-- Access rule (private helper flashcard_resolve_learning_access, not granted to client roles): the token must match
--   a flashcard_sets row with deleted_at IS NULL and no expiry in the past; the e-mail is normalised with
--   lower(btrim()), 3..254 chars, contains an at sign, no whitespace or control characters. Otherwise the call raises
--   P0001 with the message invalid_access.
-- D-2 option B: a review of a row whose next_review_date is still in the future is PRACTICE, nothing is written and
--   counted = false. A new card or a due card is a SCHEDULED review: SM-2 as in the old client formula (quality 0 or 2
--   only), day based due date at UTC midnight, total_reviews + 1. The existing trigger on flashcard_progress then emits
--   at most one DSLM event for that write, and no event for a practice call because nothing is written.
-- Concurrency: one advisory transaction lock per (card, normalised e-mail, direction) serialises double taps and two
--   tabs, the existing row is read FOR UPDATE, and the insert goes through the real unique key
--   unique_progress (card_id, learner_identifier, direction) with ON CONFLICT, so a second row can never appear.
-- Rollback: functions are never dropped; roll back with REVOKE EXECUTE (scratchpad fc rollback_phase1_B.sql).
-- Idempotent: CREATE OR REPLACE and REVOKE/GRANT only. The Worksheet Generation Engine is not touched.

-- Private helper: returns the set row for a valid token and e-mail, raises invalid_access otherwise.
CREATE OR REPLACE FUNCTION public.flashcard_resolve_learning_access(p_share_token text, p_email text)
 RETURNS TABLE(set_id uuid, is_bidirectional boolean, back_type text, learner_email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_email text := lower(btrim(p_email));
BEGIN
  IF p_share_token IS NULL OR btrim(p_share_token) = ''
     OR v_email IS NULL
     OR char_length(v_email) < 3 OR char_length(v_email) > 254
     OR position('@' IN v_email) = 0
     OR v_email ~ '[[:space:][:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid_access' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT fs.id, (fs.is_bidirectional IS TRUE), COALESCE(fs.back_type, 'translation'), v_email
  FROM public.flashcard_sets fs
  WHERE fs.share_token = p_share_token
    AND fs.deleted_at IS NULL
    AND (fs.share_expires_at IS NULL OR fs.share_expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_access' USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.flashcard_resolve_learning_access(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flashcard_resolve_learning_access(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_flashcard_learning_cards_by_token(p_share_token text, p_email text)
 RETURNS TABLE(
   card_id uuid, card_position integer, front_text text, back_text text, front_example text, cefr_level text,
   back_type text, is_bidirectional boolean,
   d1_easiness_factor numeric, d1_repetition integer, d1_interval_days integer, d1_next_review_date timestamp with time zone,
   d1_total_reviews integer, d1_correct_count integer, d1_incorrect_count integer,
   d2_easiness_factor numeric, d2_repetition integer, d2_interval_days integer, d2_next_review_date timestamp with time zone,
   d2_total_reviews integer, d2_correct_count integer, d2_incorrect_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_set_id uuid;
  v_bidirectional boolean;
  v_back_type text;
  v_email text;
BEGIN
  SELECT a.set_id, a.is_bidirectional, a.back_type, a.learner_email
    INTO v_set_id, v_bidirectional, v_back_type, v_email
  FROM public.flashcard_resolve_learning_access(p_share_token, p_email) a;

  RETURN QUERY
  SELECT
    fc.id, fc.card_position, fc.front_text, fc.back_text, fc.front_example, fc.cefr_level,
    v_back_type, v_bidirectional,
    COALESCE(p1.easiness_factor, 2.5), COALESCE(p1.repetition, 0), COALESCE(p1.interval_days, 0), p1.next_review_date,
    COALESCE(p1.total_reviews, 0), COALESCE(p1.correct_count, 0), COALESCE(p1.incorrect_count, 0),
    COALESCE(p2.easiness_factor, 2.5), COALESCE(p2.repetition, 0), COALESCE(p2.interval_days, 0), p2.next_review_date,
    COALESCE(p2.total_reviews, 0), COALESCE(p2.correct_count, 0), COALESCE(p2.incorrect_count, 0)
  FROM public.flashcard_cards fc
  LEFT JOIN LATERAL (
    SELECT * FROM public.flashcard_progress fp
    WHERE fp.card_id = fc.id AND fp.direction = 1 AND lower(btrim(fp.learner_identifier)) = v_email
    ORDER BY (fp.learner_identifier = v_email) DESC, fp.updated_at DESC NULLS LAST, fp.id
    LIMIT 1
  ) p1 ON true
  LEFT JOIN LATERAL (
    SELECT * FROM public.flashcard_progress fp
    WHERE fp.card_id = fc.id AND fp.direction = 2 AND lower(btrim(fp.learner_identifier)) = v_email
    ORDER BY (fp.learner_identifier = v_email) DESC, fp.updated_at DESC NULLS LAST, fp.id
    LIMIT 1
  ) p2 ON true
  WHERE fc.set_id = v_set_id
    AND fc.deleted_at IS NULL
  ORDER BY fc.card_position, fc.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_flashcard_review_by_token(
  p_share_token text, p_email text, p_card_id uuid, p_direction integer, p_quality integer,
  p_response_time_ms integer DEFAULT NULL)
 RETURNS TABLE(
   counted boolean, easiness_factor numeric, repetition integer, interval_days integer,
   next_review_date timestamp with time zone, total_reviews integer, correct_count integer, incorrect_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_set_id uuid;
  v_bidirectional boolean;
  v_email text;
  v_response_ms integer;
  v_row public.flashcard_progress%ROWTYPE;
  v_found boolean;
  v_ef numeric;
  v_rep integer;
  v_interval integer;
  v_new_ef numeric;
  v_new_rep integer;
  v_new_interval integer;
  v_next timestamptz;
BEGIN
  SELECT a.set_id, a.is_bidirectional, a.learner_email
    INTO v_set_id, v_bidirectional, v_email
  FROM public.flashcard_resolve_learning_access(p_share_token, p_email) a;

  IF p_direction IS NULL OR p_direction NOT IN (1, 2) THEN
    RAISE EXCEPTION 'invalid_direction' USING ERRCODE = 'P0001';
  END IF;
  IF p_direction = 2 AND NOT v_bidirectional THEN
    RAISE EXCEPTION 'invalid_direction' USING ERRCODE = 'P0001';
  END IF;
  IF p_quality IS NULL OR p_quality NOT IN (0, 2) THEN
    RAISE EXCEPTION 'invalid_quality' USING ERRCODE = 'P0001';
  END IF;
  IF p_card_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.flashcard_cards c
    WHERE c.id = p_card_id AND c.set_id = v_set_id AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'invalid_card' USING ERRCODE = 'P0001';
  END IF;

  v_response_ms := CASE WHEN p_response_time_ms IS NULL THEN NULL
                        ELSE least(greatest(p_response_time_ms, 0), 600000) END;

  -- Serialise double taps and parallel tabs for the same card, learner and direction.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_card_id::text || '|' || v_email || '|' || p_direction::text, 0));

  SELECT * INTO v_row
  FROM public.flashcard_progress fp
  WHERE fp.card_id = p_card_id AND fp.direction = p_direction AND lower(btrim(fp.learner_identifier)) = v_email
  ORDER BY (fp.learner_identifier = v_email) DESC, fp.updated_at DESC NULLS LAST, fp.id
  LIMIT 1
  FOR UPDATE;
  v_found := FOUND;

  -- D-2 option B: re-study before the due date is practice, nothing is written.
  IF v_found AND v_row.next_review_date IS NOT NULL AND v_row.next_review_date > now() THEN
    RETURN QUERY SELECT false, COALESCE(v_row.easiness_factor, 2.5), COALESCE(v_row.repetition, 0),
      COALESCE(v_row.interval_days, 0), v_row.next_review_date, COALESCE(v_row.total_reviews, 0),
      COALESCE(v_row.correct_count, 0), COALESCE(v_row.incorrect_count, 0);
    RETURN;
  END IF;

  v_ef := CASE WHEN v_found THEN COALESCE(v_row.easiness_factor, 2.5) ELSE 2.5 END;
  v_rep := CASE WHEN v_found THEN COALESCE(v_row.repetition, 0) ELSE 0 END;
  v_interval := CASE WHEN v_found THEN COALESCE(v_row.interval_days, 0) ELSE 0 END;

  -- SM-2, same as the client formula: fail resets repetition and uses interval 1, success uses 1, 6, then round(interval * EF).
  IF p_quality < 2 THEN
    v_new_rep := 0;
    v_new_interval := 1;
  ELSE
    v_new_interval := CASE WHEN v_rep = 0 THEN 1 WHEN v_rep = 1 THEN 6 ELSE round(v_interval * v_ef)::integer END;
    v_new_rep := v_rep + 1;
  END IF;
  v_new_ef := greatest(1.3, v_ef + (0.1 - (3 - p_quality) * (0.08 + (3 - p_quality) * 0.02)));
  -- Day based due date: midnight UTC of today plus the interval.
  v_next := (date_trunc('day', now() AT TIME ZONE 'UTC') + v_new_interval * interval '1 day') AT TIME ZONE 'UTC';

  IF v_found THEN
    UPDATE public.flashcard_progress fp SET
      learner_identifier = v_email,
      easiness_factor = v_new_ef,
      repetition = v_new_rep,
      interval_days = v_new_interval,
      next_review_date = v_next,
      last_reviewed_at = now(),
      total_reviews = COALESCE(fp.total_reviews, 0) + 1,
      correct_count = COALESCE(fp.correct_count, 0) + CASE WHEN p_quality >= 2 THEN 1 ELSE 0 END,
      incorrect_count = COALESCE(fp.incorrect_count, 0) + CASE WHEN p_quality >= 2 THEN 0 ELSE 1 END,
      last_response_time_ms = v_response_ms,
      last_quality_rating = p_quality,
      updated_at = now()
    WHERE fp.id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.flashcard_progress (
      card_id, set_id, learner_identifier, direction, easiness_factor, repetition, interval_days,
      next_review_date, last_reviewed_at, total_reviews, correct_count, incorrect_count,
      last_response_time_ms, last_quality_rating
    ) VALUES (
      p_card_id, v_set_id, v_email, p_direction, v_new_ef, v_new_rep, v_new_interval,
      v_next, now(), 1, CASE WHEN p_quality >= 2 THEN 1 ELSE 0 END, CASE WHEN p_quality >= 2 THEN 0 ELSE 1 END,
      v_response_ms, p_quality
    )
    ON CONFLICT (card_id, learner_identifier, direction) DO UPDATE SET
      easiness_factor = EXCLUDED.easiness_factor,
      repetition = EXCLUDED.repetition,
      interval_days = EXCLUDED.interval_days,
      next_review_date = EXCLUDED.next_review_date,
      last_reviewed_at = EXCLUDED.last_reviewed_at,
      total_reviews = public.flashcard_progress.total_reviews + 1,
      correct_count = public.flashcard_progress.correct_count + CASE WHEN p_quality >= 2 THEN 1 ELSE 0 END,
      incorrect_count = public.flashcard_progress.incorrect_count + CASE WHEN p_quality >= 2 THEN 0 ELSE 1 END,
      last_response_time_ms = EXCLUDED.last_response_time_ms,
      last_quality_rating = EXCLUDED.last_quality_rating,
      updated_at = now()
    RETURNING * INTO v_row;
  END IF;

  RETURN QUERY SELECT true, v_row.easiness_factor, v_row.repetition, v_row.interval_days, v_row.next_review_date,
    v_row.total_reviews, v_row.correct_count, v_row.incorrect_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_flashcard_learning_cards_by_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_flashcard_learning_cards_by_token(text, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_flashcard_review_by_token(text, text, uuid, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_flashcard_review_by_token(text, text, uuid, integer, integer, integer) TO anon, authenticated, service_role;
