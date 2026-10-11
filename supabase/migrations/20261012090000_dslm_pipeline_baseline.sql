-- DSLM pipeline baseline (no behaviour change).
--
-- The event and metric engine of DSLM (answer -> student_events triggers,
-- compute_skill_metric, add_student_event, the AI evaluation queue RPCs and the
-- student answer RPCs) existed only in the production database and in the
-- predecessor repository. This migration records the production definitions
-- verbatim (pg_get_functiondef, md5-checked against production on 2026-10-12)
-- so every later change is a reviewable diff. Applying it to production is a
-- no-op: each body and trigger is identical to what is deployed.
--
-- Not included on purpose: the legacy 5/6/7-argument overloads of
-- save_homework_answer and save_worksheet_answer (unused by the client).

-- extract_skill_category
CREATE OR REPLACE FUNCTION public.extract_skill_category(skill_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- ===== NEW CEFR FORMAT: ns.[A1-C2].[topic].* =====
    -- Specific grammar topics (existing)
    WHEN skill_name ~ '^ns\.[ABC][12]\.(past_simple|past_continuous|past_perfect|present_simple|present_continuous|present_perfect|present_perfect_continuous|future_simple|future_going_to|future_continuous|first_conditional|second_conditional|third_conditional|mixed_conditionals|passive_voice|reported_speech|relative_clauses|modal_verbs|gerund_infinitive|phrasal_verbs|comparatives|superlatives|articles|prepositions|word_order|negative_prefixes|word_formation)\.' THEN 'grammar'
    -- Generic grammar catch-all: ns.[CEFR].grammar.* (covers modal_*, going_to_*, will_*, countable_uncountable, to_be_*, etc.)
    WHEN skill_name ~ '^ns\.[ABC][12]\.grammar[\._]' THEN 'grammar'
    -- Related grammar categories
    WHEN skill_name ~ '^ns\.[ABC][12]\.(nouns|pronouns|adjectives|adjectives_adverbs|gerunds|verbs)[\._]' THEN 'grammar'
    -- Vocabulary topics (existing)
    WHEN skill_name ~ '^ns\.[ABC][12]\.(vocabulary|collocations|idioms|synonyms|antonyms)\.' THEN 'vocabulary'
    -- Idiom catch-all (AI sometimes uses ns.B1.idiom.xxx instead of ns.B1.idioms.xxx)
    WHEN skill_name ~ '^ns\.[ABC][12]\.idiom[\._]' THEN 'vocabulary'
    -- Other categories (existing)
    WHEN skill_name ~ '^ns\.[ABC][12]\.reading[\._]' THEN 'reading'
    WHEN skill_name ~ '^ns\.[ABC][12]\.speaking[\._]' THEN 'speaking'
    WHEN skill_name ~ '^ns\.[ABC][12]\.writing[\._]' THEN 'writing'
    WHEN skill_name ~ '^ns\.[ABC][12]\.listening[\._]' THEN 'listening'
    WHEN skill_name ~ '^ns\.[ABC][12]\.visual_comprehension[\._]' THEN 'visual_comprehension'
    WHEN skill_name ~ '^ns\.[ABC][12]\.critical_thinking[\._]' THEN 'reading'
    WHEN skill_name ~ '^ns\.[ABC][12]\.comprehension[\._]' THEN 'reading'
    WHEN skill_name ~ '^ns\.[ABC][12]\.definitions[\._]' THEN 'vocabulary'
    WHEN skill_name ~ '^ns\.[ABC][12]\.spelling[\._]' THEN 'vocabulary'
    WHEN skill_name ~ '^ns\.[ABC][12]\.morphology[\._]' THEN 'grammar'
    WHEN skill_name ~ '^ns\.[ABC][12]\.pronunciation[\._]' THEN 'pronunciation'

    -- ===== OLD ABBREVIATION FORMAT =====
    WHEN skill_name ~ '^ns\.(ps|pc|pp|prs|prc|prp|prpc|fs|fg|fc|cond1|cond2|cond3|condm|passive|rs|rel|mod|ger_inf|phr|comp|sup|art|prep|wo|neg|wf)\.' THEN 'grammar'
    WHEN skill_name ~ '^ns\.(vocab|coll|idiom|syn|ant)\.' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.reading.%' THEN 'reading'
    WHEN skill_name LIKE 'ns.speaking.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.writing.%' THEN 'writing'
    WHEN skill_name LIKE 'ns.listening.%' THEN 'listening'

    -- ===== LEGACY FORMAT =====
    WHEN skill_name LIKE 'ns.grammar.%' THEN 'grammar'
    WHEN skill_name LIKE 'ns.vocabulary.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.morphology.%' THEN 'grammar'
    WHEN skill_name LIKE 'ns.pronunciation.%' THEN 'pronunciation'
    WHEN skill_name LIKE 'ns.spelling.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.collocations.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.idiom.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.expression.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.paraphrasing.%' THEN 'writing'
    WHEN skill_name LIKE 'ns.sentence.%' THEN 'grammar'
    WHEN skill_name LIKE 'ns.questions.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.comprehension.%' THEN 'reading'
    WHEN skill_name LIKE 'ns.dialogue.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.functional.%' THEN 'speaking'
    WHEN skill_name LIKE 'flashcard:%' THEN 'vocabulary'
    ELSE 'other'
  END;
$function$
;

-- extract_micro_skill
CREATE OR REPLACE FUNCTION public.extract_micro_skill(skill_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- ===== NEW CEFR FORMAT: ns.[A1-C2].[full_topic].* =====
    WHEN skill_name ~ '^ns\.[ABC][12]\.' THEN
      CASE
        -- Specific grammar topics at segment 3
        WHEN skill_name ~ '^ns\.[ABC][12]\.past_simple\.' THEN 'past_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.past_continuous\.' THEN 'past_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.past_perfect\.' THEN 'past_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.present_simple\.' THEN 'present_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.present_continuous\.' THEN 'present_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.present_perfect_continuous\.' THEN 'present_perfect_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.present_perfect\.' THEN 'present_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.future_simple\.' THEN 'future_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.future_going_to\.' THEN 'future_going_to'
        WHEN skill_name ~ '^ns\.[ABC][12]\.future_continuous\.' THEN 'future_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.first_conditional\.' THEN 'first_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.second_conditional\.' THEN 'second_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.third_conditional\.' THEN 'third_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.mixed_conditionals\.' THEN 'mixed_conditionals'
        WHEN skill_name ~ '^ns\.[ABC][12]\.passive_voice\.' THEN 'passive_voice'
        WHEN skill_name ~ '^ns\.[ABC][12]\.reported_speech\.' THEN 'reported_speech'
        WHEN skill_name ~ '^ns\.[ABC][12]\.relative_clauses\.' THEN 'relative_clauses'
        WHEN skill_name ~ '^ns\.[ABC][12]\.modal_verbs\.' THEN 'modal_verbs'
        WHEN skill_name ~ '^ns\.[ABC][12]\.gerund_infinitive\.' THEN 'gerund_infinitive'
        WHEN skill_name ~ '^ns\.[ABC][12]\.phrasal_verbs\.' THEN 'phrasal_verbs'
        WHEN skill_name ~ '^ns\.[ABC][12]\.comparatives\.' THEN 'comparatives'
        WHEN skill_name ~ '^ns\.[ABC][12]\.superlatives\.' THEN 'superlatives'
        WHEN skill_name ~ '^ns\.[ABC][12]\.articles\.' THEN 'articles'
        WHEN skill_name ~ '^ns\.[ABC][12]\.prepositions\.' THEN 'prepositions'
        WHEN skill_name ~ '^ns\.[ABC][12]\.word_order\.' THEN 'word_order'
        WHEN skill_name ~ '^ns\.[ABC][12]\.negative_prefixes\.' THEN 'negative_prefixes'
        WHEN skill_name ~ '^ns\.[ABC][12]\.word_formation\.' THEN 'word_formation'
        
        -- Grammar sub-topics via ns.[CEFR].grammar.[sub_topic]
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.modal' THEN 'modal_verbs'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.going_to' THEN 'future_going_to'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.will_' THEN 'future_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.present_simple' THEN 'present_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.present_continuous' THEN 'present_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.present_perfect' THEN 'present_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.past_simple' THEN 'past_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.past_continuous' THEN 'past_continuous'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.past_perfect' THEN 'past_perfect'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.countable_uncountable' THEN 'countable_uncountable'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.negative_prefixes' THEN 'negative_prefixes'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.to_be' THEN 'present_simple'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.conditional' THEN 'first_conditional'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.passive' THEN 'passive_voice'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.reported' THEN 'reported_speech'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.relative' THEN 'relative_clauses'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.phrasal' THEN 'phrasal_verbs'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.word_order' THEN 'word_order'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar\.word_formation' THEN 'word_formation'
        WHEN skill_name ~ '^ns\.[ABC][12]\.grammar' THEN 'grammar_other'
        
        -- Related grammar categories
        WHEN skill_name ~ '^ns\.[ABC][12]\.nouns' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.pronouns' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.adjectives' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.adjectives_adverbs' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.gerunds' THEN 'gerund_infinitive'
        WHEN skill_name ~ '^ns\.[ABC][12]\.verbs' THEN 'grammar_other'

        -- Vocabulary topics
        WHEN skill_name ~ '^ns\.[ABC][12]\.vocabulary\.' THEN 'vocabulary'
        WHEN skill_name ~ '^ns\.[ABC][12]\.collocations\.' THEN 'collocations'
        WHEN skill_name ~ '^ns\.[ABC][12]\.idioms?\.' THEN 'idioms'
        WHEN skill_name ~ '^ns\.[ABC][12]\.synonyms\.' THEN 'synonyms'
        WHEN skill_name ~ '^ns\.[ABC][12]\.antonyms\.' THEN 'antonyms'
        WHEN skill_name ~ '^ns\.[ABC][12]\.definitions' THEN 'vocabulary'
        WHEN skill_name ~ '^ns\.[ABC][12]\.spelling' THEN 'vocabulary'

        -- Other categories
        WHEN skill_name ~ '^ns\.[ABC][12]\.reading\.' THEN 'reading'
        WHEN skill_name ~ '^ns\.[ABC][12]\.speaking\.' THEN 'speaking'
        WHEN skill_name ~ '^ns\.[ABC][12]\.writing\.' THEN 'writing'
        WHEN skill_name ~ '^ns\.[ABC][12]\.listening\.' THEN 'listening'
        WHEN skill_name ~ '^ns\.[ABC][12]\.visual_comprehension\.' THEN 'visual_comprehension'
        WHEN skill_name ~ '^ns\.[ABC][12]\.critical_thinking' THEN 'critical_thinking'
        WHEN skill_name ~ '^ns\.[ABC][12]\.comprehension' THEN 'reading'
        WHEN skill_name ~ '^ns\.[ABC][12]\.morphology' THEN 'grammar_other'
        WHEN skill_name ~ '^ns\.[ABC][12]\.pronunciation' THEN 'pronunciation'
        ELSE 'other'
      END

    -- ===== OLD ABBREVIATION FORMAT: ns.prefix.* (backward compat) =====
    WHEN skill_name LIKE 'ns.ps.%' THEN 'past_simple'
    WHEN skill_name LIKE 'ns.pc.%' THEN 'past_continuous'
    WHEN skill_name LIKE 'ns.pp.%' THEN 'past_perfect'
    WHEN skill_name LIKE 'ns.prs.%' THEN 'present_simple'
    WHEN skill_name LIKE 'ns.prc.%' THEN 'present_continuous'
    WHEN skill_name LIKE 'ns.prp.%' THEN 'present_perfect'
    WHEN skill_name LIKE 'ns.prpc.%' THEN 'present_perfect_continuous'
    WHEN skill_name LIKE 'ns.fs.%' THEN 'future_simple'
    WHEN skill_name LIKE 'ns.fg.%' THEN 'future_going_to'
    WHEN skill_name LIKE 'ns.fc.%' THEN 'future_continuous'
    WHEN skill_name LIKE 'ns.cond1.%' THEN 'first_conditional'
    WHEN skill_name LIKE 'ns.cond2.%' THEN 'second_conditional'
    WHEN skill_name LIKE 'ns.cond3.%' THEN 'third_conditional'
    WHEN skill_name LIKE 'ns.condm.%' THEN 'mixed_conditionals'
    WHEN skill_name LIKE 'ns.passive.%' THEN 'passive_voice'
    WHEN skill_name LIKE 'ns.rs.%' THEN 'reported_speech'
    WHEN skill_name LIKE 'ns.rel.%' THEN 'relative_clauses'
    WHEN skill_name LIKE 'ns.mod.%' THEN 'modal_verbs'
    WHEN skill_name LIKE 'ns.ger_inf.%' THEN 'gerund_infinitive'
    WHEN skill_name LIKE 'ns.phr.%' THEN 'phrasal_verbs'
    WHEN skill_name LIKE 'ns.comp.%' THEN 'comparatives'
    WHEN skill_name LIKE 'ns.sup.%' THEN 'superlatives'
    WHEN skill_name LIKE 'ns.art.%' THEN 'articles'
    WHEN skill_name LIKE 'ns.prep.%' THEN 'prepositions'
    WHEN skill_name LIKE 'ns.wo.%' THEN 'word_order'
    WHEN skill_name LIKE 'ns.neg.%' THEN 'negative_prefixes'
    WHEN skill_name LIKE 'ns.wf.%' THEN 'word_formation'
    WHEN skill_name LIKE 'ns.vocab.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.coll.%' THEN 'collocations'
    WHEN skill_name LIKE 'ns.idiom.%' THEN 'idioms'
    WHEN skill_name LIKE 'ns.syn.%' THEN 'synonyms'
    WHEN skill_name LIKE 'ns.ant.%' THEN 'antonyms'
    WHEN skill_name LIKE 'ns.reading.%' THEN 'reading'
    WHEN skill_name LIKE 'ns.speaking.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.writing.%' THEN 'writing'
    WHEN skill_name LIKE 'ns.listening.%' THEN 'listening'

    -- ===== LEGACY FORMAT =====
    WHEN skill_name LIKE 'ns.grammar.%' THEN 'grammar_other'
    WHEN skill_name LIKE 'ns.vocabulary.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.morphology.%' THEN 'grammar_other'
    WHEN skill_name LIKE 'ns.pronunciation.%' THEN 'pronunciation'
    WHEN skill_name LIKE 'ns.spelling.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.collocations.%' THEN 'collocations'
    WHEN skill_name LIKE 'ns.idiom.%' THEN 'idioms'
    WHEN skill_name LIKE 'ns.expression.%' THEN 'vocabulary'
    WHEN skill_name LIKE 'ns.paraphrasing.%' THEN 'writing'
    WHEN skill_name LIKE 'ns.sentence.%' THEN 'grammar_other'
    WHEN skill_name LIKE 'ns.questions.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.comprehension.%' THEN 'reading'
    WHEN skill_name LIKE 'ns.dialogue.%' THEN 'speaking'
    WHEN skill_name LIKE 'ns.functional.%' THEN 'speaking'
    WHEN skill_name LIKE 'flashcard:%' THEN 'flashcard'
    ELSE 'other'
  END;
$function$
;

-- compute_skill_metric
CREATE OR REPLACE FUNCTION public.compute_skill_metric(p_student_id uuid, p_teacher_id uuid, p_skill_name text, p_skill_category text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_weighted_sum NUMERIC := 0;
  v_weight_total NUMERIC := 0;
  v_total_events INTEGER := 0;
  v_first_at TIMESTAMPTZ;
  v_last_at TIMESTAMPTZ;
  v_current_mastery NUMERIC;
  v_trend TEXT := 'stable';
  v_history JSONB := '[]'::jsonb;
  v_recent_avg NUMERIC;
  v_older_avg NUMERIC;
  v_micro_skill TEXT;
  r RECORD;
BEGIN
  -- Extract micro_skill
  v_micro_skill := public.extract_micro_skill(p_skill_name);

  -- Gather all mastery values for this skill from nano_skill_ratings
  FOR r IN
    SELECT 
      (nsr->>'mastery')::numeric AS mastery_val,
      se.created_at,
      EXTRACT(EPOCH FROM (now() - se.created_at)) / 86400.0 AS days_ago
    FROM student_events se,
         jsonb_array_elements(se.event_payload->'nano_skill_ratings') AS nsr
    WHERE se.student_id = p_student_id
      AND se.teacher_id = p_teacher_id
      AND nsr->>'name' = p_skill_name
      AND (nsr->>'hasValue')::boolean = true
      AND (nsr->>'mastery')::numeric >= 0
    ORDER BY se.created_at ASC
  LOOP
    DECLARE
      v_weight NUMERIC;
    BEGIN
      v_weight := exp(-0.03 * r.days_ago);
      v_weighted_sum := v_weighted_sum + (r.mastery_val * v_weight);
      v_weight_total := v_weight_total + v_weight;
      v_total_events := v_total_events + 1;
      
      IF v_first_at IS NULL THEN
        v_first_at := r.created_at;
      END IF;
      v_last_at := r.created_at;
      
      v_history := v_history || jsonb_build_object(
        'mastery', r.mastery_val,
        'date', to_char(r.created_at, 'YYYY-MM-DD')
      );
    END;
  END LOOP;
  
  -- Also handle flashcard events
  IF p_skill_name LIKE 'flashcard:%' THEN
    FOR r IN
      SELECT 
        se.mastery AS mastery_val,
        se.created_at,
        EXTRACT(EPOCH FROM (now() - se.created_at)) / 86400.0 AS days_ago
      FROM student_events se
      WHERE se.student_id = p_student_id
        AND se.teacher_id = p_teacher_id
        AND se.event_source = 'flashcard'
        AND se.mastery IS NOT NULL
        AND se.event_payload->>'card_id' = substring(p_skill_name from 11)
      ORDER BY se.created_at ASC
    LOOP
      DECLARE
        v_weight NUMERIC;
      BEGIN
        v_weight := exp(-0.03 * r.days_ago);
        v_weighted_sum := v_weighted_sum + (r.mastery_val * v_weight);
        v_weight_total := v_weight_total + v_weight;
        v_total_events := v_total_events + 1;
        
        IF v_first_at IS NULL THEN
          v_first_at := r.created_at;
        END IF;
        v_last_at := r.created_at;
        
        v_history := v_history || jsonb_build_object(
          'mastery', r.mastery_val,
          'date', to_char(r.created_at, 'YYYY-MM-DD')
        );
      END;
    END LOOP;
  END IF;

  IF v_total_events = 0 THEN
    RETURN;
  END IF;

  v_current_mastery := ROUND(v_weighted_sum / NULLIF(v_weight_total, 0), 1);
  
  -- Trim history to last 20
  IF jsonb_array_length(v_history) > 20 THEN
    v_history := (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_history) AS elem
        ORDER BY elem->>'date' DESC
        LIMIT 20
      ) sub
    );
  END IF;

  -- Trend: compare last 3 vs previous 3
  IF v_total_events >= 4 THEN
    SELECT AVG((elem->>'mastery')::numeric) INTO v_recent_avg
    FROM (
      SELECT elem FROM jsonb_array_elements(v_history) AS elem
      ORDER BY elem->>'date' DESC LIMIT 3
    ) sub;
    
    SELECT AVG((elem->>'mastery')::numeric) INTO v_older_avg
    FROM (
      SELECT elem FROM jsonb_array_elements(v_history) AS elem
      ORDER BY elem->>'date' DESC OFFSET 3 LIMIT 3
    ) sub;
    
    IF v_older_avg IS NOT NULL THEN
      IF v_recent_avg > v_older_avg + 10 THEN
        v_trend := 'improving';
      ELSIF v_recent_avg < v_older_avg - 10 THEN
        v_trend := 'declining';
      ELSE
        v_trend := 'stable';
      END IF;
    END IF;
  END IF;

  -- Upsert with micro_skill
  INSERT INTO public.student_skill_metrics (
    student_id, teacher_id, skill_name, skill_category, micro_skill,
    current_mastery, trend, total_events, 
    first_event_at, last_event_at, mastery_history, updated_at
  ) VALUES (
    p_student_id, p_teacher_id, p_skill_name, p_skill_category, v_micro_skill,
    v_current_mastery, v_trend, v_total_events,
    v_first_at, v_last_at, v_history, now()
  )
  ON CONFLICT (student_id, teacher_id, skill_name) DO UPDATE SET
    current_mastery = EXCLUDED.current_mastery,
    trend = EXCLUDED.trend,
    total_events = EXCLUDED.total_events,
    last_event_at = EXCLUDED.last_event_at,
    mastery_history = EXCLUDED.mastery_history,
    skill_category = EXCLUDED.skill_category,
    micro_skill = EXCLUDED.micro_skill,
    updated_at = now();
END;
$function$
;

-- refresh_skill_metrics_on_event
CREATE OR REPLACE FUNCTION public.refresh_skill_metrics_on_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nsr RECORD;
  v_category TEXT;
BEGIN
  -- Process nano_skill_ratings from the event payload
  IF NEW.event_payload ? 'nano_skill_ratings' THEN
    FOR nsr IN
      SELECT 
        elem->>'name' AS skill_name
      FROM jsonb_array_elements(NEW.event_payload->'nano_skill_ratings') AS elem
      WHERE (elem->>'hasValue')::boolean = true
        AND (elem->>'mastery')::numeric >= 0
    LOOP
      v_category := public.extract_skill_category(nsr.skill_name);
      PERFORM public.compute_skill_metric(
        NEW.student_id, NEW.teacher_id, nsr.skill_name, v_category
      );
    END LOOP;
  END IF;
  
  -- Process flashcard events
  IF NEW.event_source = 'flashcard' AND NEW.mastery IS NOT NULL THEN
    PERFORM public.compute_skill_metric(
      NEW.student_id, NEW.teacher_id,
      'flashcard:' || (NEW.event_payload->>'card_id'),
      'vocabulary'
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

-- backfill_skill_metrics
CREATE OR REPLACE FUNCTION public.backfill_skill_metrics(p_student_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT
      nsr->>'name' AS skill_name,
      se.student_id,
      se.teacher_id
    FROM student_events se,
         jsonb_array_elements(se.event_payload->'nano_skill_ratings') AS nsr
    WHERE (p_student_id IS NULL OR se.student_id = p_student_id)
      AND (nsr->>'hasValue')::boolean = true
      AND (nsr->>'mastery')::numeric >= 0
  LOOP
    PERFORM public.compute_skill_metric(
      r.student_id, r.teacher_id, r.skill_name,
      public.extract_skill_category(r.skill_name)
    );
    v_count := v_count + 1;
  END LOOP;
  
  -- Also backfill flashcard metrics
  FOR r IN
    SELECT DISTINCT
      'flashcard:' || (se.event_payload->>'card_id') AS skill_name,
      se.student_id,
      se.teacher_id
    FROM student_events se
    WHERE se.event_source = 'flashcard'
      AND se.mastery IS NOT NULL
      AND (p_student_id IS NULL OR se.student_id = p_student_id)
  LOOP
    PERFORM public.compute_skill_metric(
      r.student_id, r.teacher_id, r.skill_name, 'vocabulary'
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$
;

-- add_student_event
CREATE OR REPLACE FUNCTION public.add_student_event(p_student_id uuid, p_teacher_id uuid, p_event_type text, p_event_source text, p_source_id uuid DEFAULT NULL::uuid, p_event_payload jsonb DEFAULT '{}'::jsonb, p_skill_ids text[] DEFAULT NULL::text[], p_element_type text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id UUID;
  v_mastery numeric;
BEGIN
  -- Auto-extract mastery from nano_skill_ratings if present and has values
  IF p_event_payload ? 'nano_skill_ratings' 
     AND jsonb_array_length(p_event_payload->'nano_skill_ratings') > 0 THEN
    SELECT ROUND(AVG((elem->>'mastery')::numeric))
    INTO v_mastery
    FROM jsonb_array_elements(p_event_payload->'nano_skill_ratings') AS elem
    WHERE elem->>'mastery' IS NOT NULL
      AND (elem->>'mastery')::numeric >= 0
      AND (elem ? 'hasValue' AND (elem->>'hasValue')::boolean = true);
  END IF;

  -- Fallback: extract from is_correct for simple MC questions  
  IF v_mastery IS NULL AND p_event_payload ? 'is_correct' AND (p_event_payload->>'is_correct') IS NOT NULL THEN
    v_mastery := CASE 
      WHEN (p_event_payload->>'is_correct')::boolean = true THEN 100
      WHEN (p_event_payload->>'is_correct')::boolean = false THEN 0
      ELSE NULL
    END;
  END IF;

  INSERT INTO public.student_events (
    student_id, teacher_id, event_type, event_source,
    source_id, event_payload, skill_ids, element_type,
    session_id, mastery
  ) VALUES (
    p_student_id, p_teacher_id, p_event_type, p_event_source,
    p_source_id, p_event_payload, p_skill_ids, p_element_type,
    p_session_id, v_mastery
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$function$
;

-- save_homework_answer__8args
CREATE OR REPLACE FUNCTION public.save_homework_answer(p_homework_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT 0, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_answer_id UUID;
BEGIN
    INSERT INTO public.homework_student_answers (
        homework_id, student_email, exercise_index, exercise_type,
        answers, time_spent_ms, mastery, item_evaluations,
        is_submitted, started_at, last_saved_at
    )
    VALUES (
        p_homework_id, LOWER(TRIM(p_student_email)), p_exercise_index, p_exercise_type,
        p_answers, p_time_spent_ms, p_mastery, p_item_evaluations,
        FALSE, NOW(), NOW()
    )
    ON CONFLICT (homework_id, student_email, exercise_index)
    DO UPDATE SET
        answers = EXCLUDED.answers,
        exercise_type = EXCLUDED.exercise_type,
        time_spent_ms = EXCLUDED.time_spent_ms,
        mastery = EXCLUDED.mastery,
        item_evaluations = EXCLUDED.item_evaluations,
        eval_trigger = NULL,  -- RESET on student save
        last_saved_at = NOW()
    RETURNING id INTO v_answer_id;
    
    RETURN v_answer_id;
END;
$function$
;

-- save_homework_answer__9args
CREATE OR REPLACE FUNCTION public.save_homework_answer(p_homework_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_audio_answers jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_answer_id UUID;
BEGIN
  INSERT INTO public.homework_student_answers (
    homework_id, student_email, exercise_index, exercise_type,
    answers, time_spent_ms, mastery, item_evaluations, audio_answers,
    is_submitted, started_at, last_saved_at
  )
  VALUES (
    p_homework_id, LOWER(TRIM(p_student_email)), p_exercise_index, p_exercise_type,
    p_answers, p_time_spent_ms, p_mastery, p_item_evaluations,
    COALESCE(p_audio_answers, '{}'::jsonb),
    FALSE, NOW(), NOW()
  )
  ON CONFLICT (homework_id, student_email, exercise_index)
  DO UPDATE SET
    answers = EXCLUDED.answers,
    exercise_type = EXCLUDED.exercise_type,
    time_spent_ms = EXCLUDED.time_spent_ms,
    mastery = EXCLUDED.mastery,
    item_evaluations = EXCLUDED.item_evaluations,
    audio_answers = CASE 
      WHEN EXCLUDED.audio_answers IS NOT NULL AND EXCLUDED.audio_answers != '{}'::jsonb 
      THEN EXCLUDED.audio_answers 
      ELSE homework_student_answers.audio_answers 
    END,
    eval_trigger = NULL,
    last_saved_at = NOW()
  RETURNING id INTO v_answer_id;
  
  RETURN v_answer_id;
END;
$function$
;

-- save_worksheet_answer__8args
CREATE OR REPLACE FUNCTION public.save_worksheet_answer(p_worksheet_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_existing_answers JSONB;
BEGIN
  SELECT answers INTO v_existing_answers
  FROM worksheet_student_answers
  WHERE worksheet_id = p_worksheet_id
    AND student_email = lower(p_student_email)
    AND exercise_index = p_exercise_index;
  
  INSERT INTO worksheet_student_answers (
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
    mastery = COALESCE(EXCLUDED.mastery, worksheet_student_answers.mastery),
    item_evaluations = COALESCE(EXCLUDED.item_evaluations, worksheet_student_answers.item_evaluations),
    eval_trigger = NULL  -- RESET on student save so trigger maps to student_learning_activity
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$
;

-- save_worksheet_answer__9args
CREATE OR REPLACE FUNCTION public.save_worksheet_answer(p_worksheet_id uuid, p_student_email text, p_exercise_index integer, p_exercise_type text, p_answers jsonb, p_time_spent_ms integer DEFAULT NULL::integer, p_mastery integer DEFAULT NULL::integer, p_item_evaluations jsonb DEFAULT NULL::jsonb, p_audio_answers jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO worksheet_student_answers (
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
    mastery = COALESCE(EXCLUDED.mastery, worksheet_student_answers.mastery),
    item_evaluations = COALESCE(EXCLUDED.item_evaluations, worksheet_student_answers.item_evaluations),
    audio_answers = CASE 
      WHEN EXCLUDED.audio_answers IS NOT NULL AND EXCLUDED.audio_answers != '{}'::jsonb 
      THEN EXCLUDED.audio_answers 
      ELSE worksheet_student_answers.audio_answers 
    END,
    eval_trigger = NULL
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$
;

-- get_student_homework_answers
CREATE OR REPLACE FUNCTION public.get_student_homework_answers(p_homework_id uuid, p_student_email text)
 RETURNS TABLE(id uuid, exercise_index integer, exercise_type text, answers jsonb, is_submitted boolean, started_at timestamp with time zone, last_saved_at timestamp with time zone, submitted_at timestamp with time zone, ai_evaluation jsonb, item_evaluations jsonb, mastery integer, audio_answers jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    hsa.id,
    hsa.exercise_index,
    hsa.exercise_type,
    hsa.answers,
    hsa.is_submitted,
    hsa.started_at,
    hsa.last_saved_at,
    hsa.submitted_at,
    hsa.ai_evaluation,
    hsa.item_evaluations,
    hsa.mastery,
    hsa.audio_answers
  FROM homework_student_answers hsa
  JOIN homework_assignments ha ON hsa.homework_id = ha.id
  JOIN students s ON ha.student_id = s.id
  WHERE hsa.homework_id = p_homework_id
    AND lower(hsa.student_email) = lower(p_student_email)
  ORDER BY hsa.exercise_index;
END;
$function$
;

-- get_worksheet_student_answers
CREATE OR REPLACE FUNCTION public.get_worksheet_student_answers(p_worksheet_id uuid, p_student_email text)
 RETURNS TABLE(id uuid, exercise_index integer, exercise_type text, answers jsonb, is_completed boolean, started_at timestamp with time zone, last_saved_at timestamp with time zone, completed_at timestamp with time zone, item_evaluations jsonb, mastery integer, audio_answers jsonb, ai_evaluation jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    wsa.id,
    wsa.exercise_index,
    wsa.exercise_type,
    wsa.answers,
    wsa.is_completed,
    wsa.started_at,
    wsa.last_saved_at,
    wsa.completed_at,
    wsa.item_evaluations,
    wsa.mastery,
    wsa.audio_answers,
    wsa.ai_evaluation
  FROM worksheet_student_answers wsa
  WHERE wsa.worksheet_id = p_worksheet_id
    AND lower(wsa.student_email) = lower(p_student_email)
  ORDER BY wsa.exercise_index;
END;
$function$
;

-- get_worksheet_live_answers
CREATE OR REPLACE FUNCTION public.get_worksheet_live_answers(p_worksheet_id uuid)
 RETURNS TABLE(id uuid, student_email text, exercise_index integer, exercise_type text, answers jsonb, last_saved_at timestamp with time zone, item_evaluations jsonb, mastery integer, audio_answers jsonb, ai_evaluation jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    wsa.id,
    wsa.student_email,
    wsa.exercise_index,
    wsa.exercise_type,
    wsa.answers,
    wsa.last_saved_at,
    wsa.item_evaluations,
    wsa.mastery,
    wsa.audio_answers,
    wsa.ai_evaluation
  FROM worksheet_student_answers wsa
  WHERE wsa.worksheet_id = p_worksheet_id
  ORDER BY wsa.exercise_index;
END;
$function$
;

-- needs_ai_evaluation
CREATE OR REPLACE FUNCTION public.needs_ai_evaluation(p_worksheet_id uuid, p_student_email text, p_exercise_index integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_last_saved TIMESTAMPTZ;
  v_last_ai_eval TIMESTAMPTZ;
BEGIN
  SELECT last_saved_at, last_ai_eval_at
  INTO v_last_saved, v_last_ai_eval
  FROM worksheet_student_answers
  WHERE worksheet_id = p_worksheet_id
    AND student_email = lower(p_student_email)
    AND exercise_index = p_exercise_index;
  
  IF v_last_saved IS NULL THEN
    RETURN FALSE; -- No answers saved
  END IF;
  
  IF v_last_ai_eval IS NULL THEN
    RETURN TRUE; -- Never evaluated
  END IF;
  
  RETURN v_last_saved > v_last_ai_eval;
END;
$function$
;

-- queue_worksheet_ai_evaluation
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
    error_message = NULL
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$
;

-- log_homework_answer_to_events
CREATE OR REPLACE FUNCTION public.log_homework_answer_to_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher_id uuid;
  v_student_id uuid;
  v_event_type text;
  v_written_ratings jsonb;
  v_audio_ratings jsonb;
  v_written_mastery numeric;
  v_audio_mastery numeric;
  v_has_text boolean;
  v_has_audio boolean;
BEGIN
  v_event_type := CASE 
    WHEN NEW.eval_trigger = '10min_inactivity' THEN '10min_AI_evaluation'
    WHEN NEW.eval_trigger = 'create_homework' THEN 'create_hw_AI_evaluation'
    WHEN NEW.eval_trigger = 'submit_homework' THEN 'submit_hw_AI_evaluation'
    ELSE 'student_learning_activity'
  END;

  SELECT ha.teacher_id INTO v_teacher_id FROM homework_assignments ha WHERE ha.id = NEW.homework_id;
  IF v_teacher_id IS NULL THEN RETURN NEW; END IF;

  SELECT s.id INTO v_student_id FROM students s
  WHERE s.student_email = NEW.student_email AND s.teacher_id = v_teacher_id AND s.deleted_at IS NULL LIMIT 1;
  IF v_student_id IS NULL THEN RETURN NEW; END IF;

  -- GUARD: Skip re-logging if this exercise already has submit-evaluated events
  -- and the current update is NOT a new submit evaluation.
  -- This prevents transcription persistence or other post-submit updates from
  -- overwriting correct AI evaluation results with empty nano_skill_ratings.
  IF NEW.eval_trigger IS DISTINCT FROM 'submit_homework' AND EXISTS (
    SELECT 1 FROM student_events 
    WHERE student_id = v_student_id 
      AND source_id = NEW.homework_id
      AND (event_payload->>'exercise_index')::int = NEW.exercise_index
      AND event_type = 'submit_hw_AI_evaluation'
  ) THEN
    RETURN NEW;
  END IF;

  v_has_text := NEW.answers IS NOT NULL AND NEW.answers != '{}'::jsonb;
  v_has_audio := NEW.audio_answers IS NOT NULL AND NEW.audio_answers != '{}'::jsonb;

  -- Build separate ratings for written vs audio questions
  IF NEW.item_evaluations IS NOT NULL THEN
    IF v_has_audio THEN
      SELECT jsonb_agg(elem - 'feedback') INTO v_written_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE
        AND NOT (NEW.audio_answers ? (elem->>'question_index'));

      SELECT jsonb_agg(elem - 'feedback') INTO v_audio_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE
        AND (NEW.audio_answers ? (elem->>'question_index'));
    ELSE
      SELECT jsonb_agg(elem - 'feedback') INTO v_written_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE;
    END IF;
  END IF;

  v_written_mastery := NEW.mastery;
  v_audio_mastery := NEW.mastery;

  IF v_written_ratings IS NOT NULL AND jsonb_array_length(v_written_ratings) > 0 THEN
    SELECT ROUND(AVG((elem->>'mastery')::numeric)) INTO v_written_mastery
    FROM jsonb_array_elements(v_written_ratings) AS elem
    WHERE (elem->>'mastery')::numeric >= 0 AND (elem->>'hasValue')::boolean = true;
  END IF;

  IF v_audio_ratings IS NOT NULL AND jsonb_array_length(v_audio_ratings) > 0 THEN
    SELECT ROUND(AVG((elem->>'mastery')::numeric)) INTO v_audio_mastery
    FROM jsonb_array_elements(v_audio_ratings) AS elem
    WHERE (elem->>'mastery')::numeric >= 0 AND (elem->>'hasValue')::boolean = true;
  END IF;

  DELETE FROM student_events
  WHERE student_id = v_student_id AND source_id = NEW.homework_id
    AND (event_payload->>'exercise_index')::int = NEW.exercise_index;

  IF v_has_text THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'homework', NEW.homework_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'written', 'is_submitted', NEW.is_submitted, 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', COALESCE(v_written_ratings, '[]'::jsonb)),
      ARRAY(SELECT elem->>'name' FROM jsonb_array_elements(COALESCE(v_written_ratings, '[]'::jsonb)) AS elem WHERE elem->>'name' IS NOT NULL),
      NEW.exercise_type, NULL, v_written_mastery);
  END IF;

  IF v_has_audio THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'homework', NEW.homework_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'audio', 'audio_answers', NEW.audio_answers, 'is_submitted', NEW.is_submitted, 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', COALESCE(v_audio_ratings, '[]'::jsonb)),
      ARRAY(SELECT elem->>'name' FROM jsonb_array_elements(COALESCE(v_audio_ratings, '[]'::jsonb)) AS elem WHERE elem->>'name' IS NOT NULL),
      NEW.exercise_type, NULL, v_audio_mastery);
  END IF;

  IF NOT v_has_text AND NOT v_has_audio THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'homework', NEW.homework_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'empty', 'is_submitted', NEW.is_submitted, 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', '[]'::jsonb),
      NULL, NEW.exercise_type, NULL, NULL);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_homework_answer_to_events error: %', SQLERRM;
  RETURN NEW;
END;
$function$
;

-- log_worksheet_answer_to_events
CREATE OR REPLACE FUNCTION public.log_worksheet_answer_to_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher_id uuid;
  v_student_id uuid;
  v_event_type text;
  v_all_ratings jsonb;
  v_written_ratings jsonb;
  v_audio_ratings jsonb;
  v_written_mastery numeric;
  v_audio_mastery numeric;
  v_source_id uuid;
  v_has_text boolean;
  v_has_audio boolean;
BEGIN
  v_event_type := CASE 
    WHEN NEW.eval_trigger = '10min_inactivity' THEN '10min_AI_evaluation'
    WHEN NEW.eval_trigger = 'create_homework' THEN 'create_hw_AI_evaluation'
    WHEN NEW.eval_trigger = 'submit_homework' THEN 'submit_hw_AI_evaluation'
    ELSE 'student_learning_activity'
  END;

  SELECT COALESCE(w.teacher_id, w.user_id) INTO v_teacher_id
  FROM worksheets w WHERE w.id = NEW.worksheet_id;
  IF v_teacher_id IS NULL THEN RETURN NEW; END IF;

  SELECT s.id INTO v_student_id FROM students s
  WHERE s.student_email = NEW.student_email AND s.teacher_id = v_teacher_id AND s.deleted_at IS NULL LIMIT 1;
  IF v_student_id IS NULL THEN RETURN NEW; END IF;

  v_source_id := NEW.worksheet_id;
  v_has_text := NEW.answers IS NOT NULL AND NEW.answers != '{}'::jsonb;
  v_has_audio := NEW.audio_answers IS NOT NULL AND NEW.audio_answers != '{}'::jsonb;

  -- Build separate ratings for written vs audio questions
  IF NEW.item_evaluations IS NOT NULL THEN
    IF v_has_audio THEN
      -- Written: ratings for questions NOT in audio_answers
      SELECT jsonb_agg(elem - 'feedback') INTO v_written_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE
        AND NOT (NEW.audio_answers ? (elem->>'question_index'));

      -- Audio: ratings for questions IN audio_answers
      SELECT jsonb_agg(elem - 'feedback') INTO v_audio_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE
        AND (NEW.audio_answers ? (elem->>'question_index'));
    ELSE
      -- No audio, all ratings go to written
      SELECT jsonb_agg(elem - 'feedback') INTO v_written_ratings
      FROM jsonb_array_elements(NEW.item_evaluations::jsonb) AS elem
      WHERE (elem->>'hasValue')::boolean IS NOT FALSE;
    END IF;
  END IF;

  -- Calculate mastery per response type
  v_written_mastery := NEW.mastery;
  v_audio_mastery := NEW.mastery;

  IF v_written_ratings IS NOT NULL AND jsonb_array_length(v_written_ratings) > 0 THEN
    SELECT ROUND(AVG((elem->>'mastery')::numeric)) INTO v_written_mastery
    FROM jsonb_array_elements(v_written_ratings) AS elem
    WHERE (elem->>'mastery')::numeric >= 0 AND (elem->>'hasValue')::boolean = true;
  END IF;

  IF v_audio_ratings IS NOT NULL AND jsonb_array_length(v_audio_ratings) > 0 THEN
    SELECT ROUND(AVG((elem->>'mastery')::numeric)) INTO v_audio_mastery
    FROM jsonb_array_elements(v_audio_ratings) AS elem
    WHERE (elem->>'mastery')::numeric >= 0 AND (elem->>'hasValue')::boolean = true;
  END IF;

  DELETE FROM student_events
  WHERE student_id = v_student_id AND source_id = v_source_id
    AND (event_payload->>'exercise_index')::int = NEW.exercise_index;

  IF v_has_text THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'worksheet', v_source_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'written', 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', COALESCE(v_written_ratings, '[]'::jsonb)),
      ARRAY(SELECT elem->>'name' FROM jsonb_array_elements(COALESCE(v_written_ratings, '[]'::jsonb)) AS elem WHERE elem->>'name' IS NOT NULL),
      NEW.exercise_type, NULL, v_written_mastery);
  END IF;

  IF v_has_audio THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'worksheet', v_source_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'audio', 'audio_answers', NEW.audio_answers, 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', COALESCE(v_audio_ratings, '[]'::jsonb)),
      ARRAY(SELECT elem->>'name' FROM jsonb_array_elements(COALESCE(v_audio_ratings, '[]'::jsonb)) AS elem WHERE elem->>'name' IS NOT NULL),
      NEW.exercise_type, NULL, v_audio_mastery);
  END IF;

  IF NOT v_has_text AND NOT v_has_audio THEN
    INSERT INTO student_events (student_id, teacher_id, event_type, event_source, source_id, event_payload, skill_ids, element_type, session_id, mastery)
    VALUES (v_student_id, v_teacher_id, v_event_type, 'worksheet', v_source_id,
      jsonb_build_object('answer_id', NEW.id, 'exercise_index', NEW.exercise_index, 'exercise_type', NEW.exercise_type, 'response_type', 'empty', 'time_spent_seconds', ROUND(COALESCE(NEW.time_spent_ms, 0)::numeric / 1000.0, 1), 'nano_skill_ratings', '[]'::jsonb),
      NULL, NEW.exercise_type, NULL, NULL);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_worksheet_answer_to_events error: %', SQLERRM;
  RETURN NEW;
END;
$function$
;

-- update_homework_event_with_ai_evaluation
CREATE OR REPLACE FUNCTION public.update_homework_event_with_ai_evaluation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id UUID;
  v_mastery_value INTEGER;
BEGIN
  -- Only trigger if ai_evaluation changed from NULL to a value
  IF OLD.ai_evaluation IS NULL AND NEW.ai_evaluation IS NOT NULL THEN
    -- Get student_id
    SELECT s.id INTO v_student_id
    FROM public.students s
    WHERE s.student_email = NEW.student_email
    LIMIT 1;

    IF v_student_id IS NOT NULL THEN
      -- Calculate mastery from quality_score (0.0-1.0 -> 0-100)
      v_mastery_value := ROUND((NEW.ai_evaluation->>'quality_score')::NUMERIC * 100)::INTEGER;
      
      -- Update the event_payload with AI evaluation results including mastery
      UPDATE public.student_events
      SET event_payload = event_payload || jsonb_build_object(
        'is_correct', (NEW.ai_evaluation->>'is_acceptable')::BOOLEAN,
        'mastery', v_mastery_value,
        'ai_quality_score', (NEW.ai_evaluation->>'quality_score')::NUMERIC,
        'ai_feedback', NEW.ai_evaluation->>'feedback'
      )
      WHERE student_id = v_student_id
        AND source_id = NEW.homework_id
        AND event_type = 'homework_answer_submitted'
        AND (event_payload->>'exercise_index')::INTEGER = NEW.exercise_index;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to update homework event with AI evaluation: %', SQLERRM;
    RETURN NEW;
END;
$function$
;

-- log_flashcard_review_event
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
BEGIN
  SELECT fs.student_id, fs.teacher_id, fs.back_type 
  INTO v_student_id, v_teacher_id, v_back_type
  FROM public.flashcard_sets fs
  WHERE fs.id = NEW.set_id;

  SELECT fc.front_text, fc.back_text, COALESCE(fc.cefr_level, 'A2')
  INTO v_card_front, v_card_back, v_cefr_level
  FROM public.flashcard_cards fc
  WHERE fc.id = NEW.card_id;

  IF v_student_id IS NOT NULL AND v_teacher_id IS NOT NULL THEN
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

    v_raw_mastery := CASE 
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

-- log_knowledge_entry_event
CREATE OR REPLACE FUNCTION public.log_knowledge_entry_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.student_events (
    student_id, 
    teacher_id, 
    event_type, 
    event_source, 
    source_id, 
    event_payload,
    element_type
  ) VALUES (
    NEW.student_id,
    NEW.teacher_id,
    'knowledge_entry_added',
    'teacher',
    NEW.id,
    jsonb_build_object(
      'category', NEW.category,
      'tags', COALESCE(NEW.tags, '{}'),
      'entry_source', NEW.entry_source,
      'content', NEW.content
    ),
    NEW.category
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to log knowledge entry event: %', SQLERRM;
    RETURN NEW;
END;
$function$
;

-- log_test_answer_event
CREATE OR REPLACE FUNCTION public.log_test_answer_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id UUID;
  v_teacher_id UUID;
  v_test_type TEXT;
BEGIN
  IF NEW.student_answer IS NOT NULL AND (OLD IS NULL OR OLD.student_answer IS NULL) THEN
    SELECT st.student_id, st.teacher_id, st.test_type
    INTO v_student_id, v_teacher_id, v_test_type
    FROM public.student_tests st
    WHERE st.id = NEW.test_id;
    
    -- Skip welcome tests - frontend handles event logging with richer payload
    IF v_test_type = 'welcome' THEN
      RETURN NEW;
    END IF;
    
    IF v_student_id IS NOT NULL AND v_teacher_id IS NOT NULL THEN
      INSERT INTO public.student_events (
        student_id,
        teacher_id,
        event_type,
        event_source,
        source_id,
        element_type,
        event_payload
      ) VALUES (
        v_student_id,
        v_teacher_id,
        'test_answer_submitted',
        'test',
        NEW.test_id,
        NEW.element_type,
        jsonb_build_object(
          'question_index', NEW.question_index,
          'question_type', NEW.question_type,
          'is_correct', NEW.is_correct,
          'time_spent_seconds', NEW.time_spent_seconds
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

-- Triggers (identical to production)
DROP TRIGGER IF EXISTS trg_refresh_skill_metrics ON public.student_events;
CREATE TRIGGER trg_refresh_skill_metrics AFTER INSERT ON public.student_events FOR EACH ROW EXECUTE FUNCTION refresh_skill_metrics_on_event();

DROP TRIGGER IF EXISTS trg_homework_answer_to_events ON public.homework_student_answers;
CREATE TRIGGER trg_homework_answer_to_events AFTER INSERT OR UPDATE ON public.homework_student_answers FOR EACH ROW EXECUTE FUNCTION log_homework_answer_to_events();

DROP TRIGGER IF EXISTS trigger_update_homework_ai_evaluation ON public.homework_student_answers;
CREATE TRIGGER trigger_update_homework_ai_evaluation AFTER UPDATE OF ai_evaluation ON public.homework_student_answers FOR EACH ROW EXECUTE FUNCTION update_homework_event_with_ai_evaluation();

DROP TRIGGER IF EXISTS trg_worksheet_answer_to_events ON public.worksheet_student_answers;
CREATE TRIGGER trg_worksheet_answer_to_events AFTER INSERT OR UPDATE ON public.worksheet_student_answers FOR EACH ROW EXECUTE FUNCTION log_worksheet_answer_to_events();

DROP TRIGGER IF EXISTS trigger_log_flashcard_review_event ON public.flashcard_progress;
CREATE TRIGGER trigger_log_flashcard_review_event AFTER UPDATE ON public.flashcard_progress FOR EACH ROW EXECUTE FUNCTION log_flashcard_review_event();

DROP TRIGGER IF EXISTS trigger_log_knowledge_entry_event ON public.student_knowledge_entries;
CREATE TRIGGER trigger_log_knowledge_entry_event AFTER INSERT ON public.student_knowledge_entries FOR EACH ROW EXECUTE FUNCTION log_knowledge_entry_event();

DROP TRIGGER IF EXISTS trigger_log_test_answer_event ON public.student_test_questions;
CREATE TRIGGER trigger_log_test_answer_event AFTER UPDATE ON public.student_test_questions FOR EACH ROW EXECUTE FUNCTION log_test_answer_event();
