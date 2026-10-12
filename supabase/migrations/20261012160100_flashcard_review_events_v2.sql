-- Flashcard review events v2 (iteration 4 of the evaluation pipeline fixes).
--
-- 1. save_flashcard_progress upserts flashcard_progress, so a card's first review
--    is an INSERT. The trigger only ran AFTER UPDATE, so every first review was
--    missing from student_events (37% of cards in production had only that one).
--    The trigger now also runs AFTER INSERT.
-- 2. Event mastery is the outcome of this review (recalled 100, Again 0, times the
--    direction difficulty multiplier) instead of the card's spaced-repetition
--    state, which mixed history into each event and was then averaged again by
--    compute_skill_metric. The state value stays in the payload as
--    card_state_mastery; review_quality is added.
-- 3. Rows without a quality rating are not logged (they are not reviews).
-- Body otherwise identical to 20261012090000_dslm_pipeline_baseline.sql.

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.log_flashcard_review_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id UUID;
  v_teacher_id UUID;
  v_card_front TEXT;
  v_card_back TEXT;
  v_cefr_level TEXT;
  v_back_type TEXT;
  v_mastery_value INTEGER;
  v_skill_id TEXT;
  v_difficulty_multiplier NUMERIC;
  v_raw_mastery INTEGER;
  v_state_mastery INTEGER;
BEGIN
  SELECT fs.student_id, fs.teacher_id, fs.back_type 
  INTO v_student_id, v_teacher_id, v_back_type
  FROM public.flashcard_sets fs
  WHERE fs.id = NEW.set_id;

  SELECT fc.front_text, fc.back_text, COALESCE(fc.cefr_level, 'A2')
  INTO v_card_front, v_card_back, v_cefr_level
  FROM public.flashcard_cards fc
  WHERE fc.id = NEW.card_id;

  -- A row without a rating is not a review.
  IF v_student_id IS NOT NULL AND v_teacher_id IS NOT NULL AND NEW.last_quality_rating IS NOT NULL THEN
    v_skill_id := 'ns.' || v_cefr_level || '.vocabulary.definition_' ||
      trim(both '_' from regexp_replace(
        regexp_replace(
          regexp_replace(lower(COALESCE(v_card_front, 'unknown')), '[\s\-]+', '_', 'g'),
          '[^a-z0-9_]', '', 'g'),
        '_+', '_', 'g'
      ));

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
    RETURN NEW;
END;
$function$
;

DROP TRIGGER IF EXISTS trigger_log_flashcard_review_event ON public.flashcard_progress;
CREATE TRIGGER trigger_log_flashcard_review_event
  AFTER INSERT OR UPDATE ON public.flashcard_progress
  FOR EACH ROW EXECUTE FUNCTION log_flashcard_review_event();
