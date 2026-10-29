-- Flashcards Phase 1, migration A: guard the flashcard -> DSLM event trigger.
--
-- 1. log_flashcard_review_event():
--    a. an UPDATE that does not change total_reviews (retry, stale tab, practice
--       write) emits no event; an INSERT with a rating always emits.
--    b. the event is written only when the set's student has no usable e-mail
--       (cannot verify) or the learner e-mail equals students.student_email
--       (case and surrounding spaces ignored). The progress row is always kept.
--    c. the CEFR level is upper(btrim()) and must be A1..C2, else 'A2'.
--    d. the skill slug is unchanged for every front that yields a non-empty slug
--       of up to 60 characters; longer slugs are cut to 60, an empty slug (only
--       non-ASCII or punctuation) becomes 'w' || first 10 chars of md5(front).
--       Metrics already stored under old names are never renamed.
--    e. a failure still never blocks the review save, but is recorded in
--       public.flashcard_event_failures (nested block, cannot break the save).
-- 2. public.flashcard_event_failures: service-only table.
-- 3. flashcard_cards.cefr_level CHECK (validated when no row violates it).
-- 4. student_add_flashcard_v2 stores a CEFR level only from the allowed list.
-- The trigger trigger_log_flashcard_review_event is intentionally not touched.

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.flashcard_event_failures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  progress_id UUID,
  card_id UUID,
  set_id UUID,
  learner_identifier TEXT,
  sqlstate TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcard_event_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.flashcard_event_failures FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.flashcard_event_failures TO service_role;

CREATE OR REPLACE FUNCTION public.log_flashcard_review_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id UUID;
  v_teacher_id UUID;
  v_student_email TEXT;
  v_card_front TEXT;
  v_card_back TEXT;
  v_cefr_level TEXT;
  v_back_type TEXT;
  v_mastery_value INTEGER;
  v_skill_id TEXT;
  v_slug TEXT;
  v_difficulty_multiplier NUMERIC;
  v_raw_mastery INTEGER;
  v_state_mastery INTEGER;
BEGIN
  -- A write that leaves total_reviews unchanged is a retry or stale tab, not a review.
  IF TG_OP = 'UPDATE' AND NEW.total_reviews IS NOT DISTINCT FROM OLD.total_reviews THEN
    RETURN NEW;
  END IF;

  SELECT fs.student_id, fs.teacher_id, fs.back_type 
  INTO v_student_id, v_teacher_id, v_back_type
  FROM public.flashcard_sets fs
  WHERE fs.id = NEW.set_id;

  SELECT fc.front_text, fc.back_text, fc.cefr_level
  INTO v_card_front, v_card_back, v_cefr_level
  FROM public.flashcard_cards fc
  WHERE fc.id = NEW.card_id;

  -- Only a known CEFR level reaches the skill id; anything else falls back to A2.
  v_cefr_level := upper(btrim(COALESCE(v_cefr_level, '')));
  IF v_cefr_level NOT IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') THEN
    v_cefr_level := 'A2';
  END IF;

  -- Progress is kept for any e-mail, but a DSLM event only for the set's own student.
  IF v_student_id IS NOT NULL THEN
    SELECT NULLIF(btrim(s.student_email), '') INTO v_student_email
    FROM public.students s
    WHERE s.id = v_student_id;
  END IF;

  -- A row without a rating is not a review.
  IF v_student_id IS NOT NULL AND v_teacher_id IS NOT NULL AND NEW.last_quality_rating IS NOT NULL
     AND (v_student_email IS NULL
          OR lower(btrim(COALESCE(NEW.learner_identifier, ''))) = lower(v_student_email)) THEN
    -- Slug: same algorithm as before, bounded to 60 characters; an empty slug
    -- (e.g. only non-ASCII) is replaced by 'w' + 10 hex chars of md5(front).
    v_slug := trim(both '_' from regexp_replace(
        regexp_replace(
          regexp_replace(lower(COALESCE(v_card_front, 'unknown')), '[\s\-]+', '_', 'g'),
          '[^a-z0-9_]', '', 'g'),
        '_+', '_', 'g'
      ));
    IF char_length(v_slug) > 60 THEN
      v_slug := trim(both '_' from left(v_slug, 60));
    END IF;
    IF v_slug = '' THEN
      v_slug := 'w' || substr(md5(lower(btrim(COALESCE(v_card_front, '')))), 1, 10);
    END IF;
    v_skill_id := 'ns.' || v_cefr_level || '.vocabulary.definition_' || v_slug;

    -- 3-scenario difficulty multiplier based on direction + back_type
    v_difficulty_multiplier := CASE 
      WHEN NEW.direction = 1 THEN 0.70  -- Sees EN term, guesses back = easiest
      WHEN NEW.direction = 2 AND COALESCE(v_back_type, 'translation') = 'definition' THEN 1.1  -- Sees EN definition, must recall EN term = hardest
      ELSE 1.0  -- Sees native translation, must recall EN term = normal
    END;

    -- This review's outcome (0 = Again, 2 = I know this): recalled = 100, not = 0.
    -- The card's spaced-repetition state is kept separately as card_state_mastery.
    v_raw_mastery := CASE WHEN NEW.last_quality_rating >= 2 THEN 100 ELSE 0 END;
    v_state_mastery := CASE
      WHEN NEW.last_quality_rating < 2 THEN 0
      WHEN NEW.repetition >= 4 AND NEW.interval_days >= 21 THEN 100
      WHEN NEW.repetition >= 3 AND NEW.interval_days >= 6 THEN 90
      WHEN NEW.repetition = 2 THEN 70
      WHEN NEW.repetition = 1 THEN 50
      ELSE 60
    END;

    v_mastery_value := LEAST(ROUND(v_raw_mastery * v_difficulty_multiplier), 100);
    
    INSERT INTO public.student_events (
      student_id, teacher_id, event_type, event_source, source_id,
      event_payload, skill_ids, element_type, mastery
    ) VALUES (
      v_student_id, v_teacher_id,
      'flashcard_review', 'flashcard', NEW.set_id,
      jsonb_build_object(
        'card_id', NEW.card_id,
        'set_id', NEW.set_id,
        'direction', NEW.direction,
        'back_type', COALESCE(v_back_type, 'translation'),
        'cefr_level', v_cefr_level,
        'card_front', v_card_front,
        'card_back', v_card_back,
        'mastery', v_mastery_value,
        'review_quality', NEW.last_quality_rating,
        'card_state_mastery', v_state_mastery,
        'difficulty_multiplier', v_difficulty_multiplier,
        'easiness_factor', NEW.easiness_factor,
        'repetition', NEW.repetition,
        'interval_days', NEW.interval_days,
        'total_reviews', NEW.total_reviews,
        'time_spent_seconds', ROUND(COALESCE(NEW.last_response_time_ms, 0) / 1000.0, 1)
      ),
      ARRAY[v_skill_id],
      'vocabulary',
      v_mastery_value
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to log flashcard review event: %', SQLERRM;
    -- Record the failure; a problem here must never break the review save.
    BEGIN
      INSERT INTO public.flashcard_event_failures (
        progress_id, card_id, set_id, learner_identifier, sqlstate, message
      ) VALUES (
        NEW.id, NEW.card_id, NEW.set_id, NEW.learner_identifier, SQLSTATE, left(SQLERRM, 1000)
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to record flashcard event failure: %', SQLERRM;
    END;
    RETURN NEW;
END;
$function$
;

-- CEFR allow-list on stored cards (live data had no violating rows when written).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flashcard_cards_cefr_level_check'
      AND conrelid = 'public.flashcard_cards'::regclass
  ) THEN
    ALTER TABLE public.flashcard_cards
      ADD CONSTRAINT flashcard_cards_cefr_level_check
      CHECK (cefr_level IS NULL OR cefr_level IN ('A1','A2','B1','B2','C1','C2')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.flashcard_cards
    WHERE cefr_level IS NOT NULL AND cefr_level NOT IN ('A1','A2','B1','B2','C1','C2')
  ) THEN
    ALTER TABLE public.flashcard_cards VALIDATE CONSTRAINT flashcard_cards_cefr_level_check;
  END IF;
END $$;

-- Same body as before except cefr_level: only an allowed level is stored, else NULL.
CREATE OR REPLACE FUNCTION public.student_add_flashcard_v2(p_set_id uuid, p_student_email text, p_front text, p_back text, p_front_example text DEFAULT NULL::text, p_cefr_level text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_set record;
  v_student record;
  v_new_id uuid;
  v_max_pos int;
  v_cefr text;
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

  v_cefr := upper(trim(COALESCE(p_cefr_level, '')));
  IF v_cefr NOT IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') THEN
    v_cefr := NULL;
  END IF;

  INSERT INTO public.flashcard_cards(
    set_id, front_text, back_text, front_example, cefr_level,
    card_position, source_type, created_by_student
  ) VALUES (
    p_set_id, trim(p_front), trim(p_back),
    NULLIF(trim(p_front_example),''), v_cefr,
    v_max_pos + 1, 'manual', true
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $function$
;
