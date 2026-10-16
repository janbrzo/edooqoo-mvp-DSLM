SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.normalize_dslm_ratings(p_ratings jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $function$
DECLARE v_item jsonb; v_score numeric; v_valid boolean; v_result jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_ratings) <> 'array' OR p_ratings IS NULL THEN RETURN v_result; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_ratings) LOOP
    IF jsonb_typeof(v_item) <> 'object' OR nullif(btrim(v_item->>'name'), '') IS NULL THEN CONTINUE; END IF;
    v_score := NULL;
    IF jsonb_typeof(v_item->'mastery') = 'number' THEN v_score := (v_item->>'mastery')::numeric; END IF;
    v_valid := coalesce(v_score BETWEEN 0 AND 100, false)
      AND coalesce(NOT (v_item ? 'hasValue') OR v_item->'hasValue' = 'true'::jsonb, false);
    v_result := v_result || jsonb_build_array(v_item || jsonb_build_object(
      'name', btrim(v_item->>'name'), 'mastery', CASE WHEN v_valid THEN v_score ELSE -1 END, 'hasValue', v_valid));
  END LOOP;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.normalize_dslm_ratings(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_dslm_ratings(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.normalize_student_event_ratings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_ratings jsonb;
BEGIN
  NEW.event_payload := coalesce(NEW.event_payload, '{}'::jsonb);
  IF NEW.event_source = 'flashcard' AND NOT (NEW.event_payload ? 'nano_skill_ratings') THEN
    -- Keep existing card scores and direction weighting; add word-level evidence.
    SELECT coalesce(jsonb_agg(jsonb_build_object('name', skill, 'mastery', NEW.mastery, 'hasValue', NEW.mastery IS NOT NULL)), '[]'::jsonb)
      INTO v_ratings FROM unnest(NEW.skill_ids) skill WHERE skill LIKE 'ns.%';
    NEW.event_payload := NEW.event_payload || jsonb_build_object('nano_skill_ratings', v_ratings);
  END IF;
  IF NEW.event_payload ? 'nano_skill_ratings' THEN
    NEW.event_payload := jsonb_set(NEW.event_payload, '{nano_skill_ratings}', public.normalize_dslm_ratings(NEW.event_payload->'nano_skill_ratings'));
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.normalize_student_event_ratings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_student_event_ratings() TO service_role;
CREATE TRIGGER trg_normalize_student_event_ratings BEFORE INSERT OR UPDATE OF event_payload, mastery, skill_ids
ON public.student_events FOR EACH ROW EXECUTE FUNCTION public.normalize_student_event_ratings();
CREATE OR REPLACE FUNCTION public.knowledge_entry_dslm_ratings(p_entry jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $function$
DECLARE v_name text; v_domain text; v_score jsonb;
BEGIN
  IF p_entry->>'category' IS DISTINCT FROM 'Skill Assessment'
     OR (p_entry->>'deleted_at') IS NOT NULL OR p_entry->'is_outdated' = 'true'::jsonb
     OR (p_entry->'ai_classified' = 'true'::jsonb AND
         (jsonb_typeof(p_entry->'ai_confidence') <> 'number' OR coalesce((p_entry->>'ai_confidence')::numeric, 0) < 0.6)) THEN
    RETURN '[]'::jsonb;
  END IF;
  v_name := nullif(btrim(p_entry->'metadata'->>'nano_skill'), '');
  v_score := p_entry->'metadata'->'mastery';
  IF v_name IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF v_name NOT LIKE 'ns.%' THEN
    v_domain := p_entry->'metadata'->>'element_type';
    IF v_domain NOT IN ('grammar','vocabulary','speaking','writing','reading','listening','pronunciation') OR v_domain IS NULL THEN RETURN '[]'::jsonb; END IF;
    v_name := 'ns.' || v_domain || '.' || trim(both '_' from regexp_replace(lower(v_name), '[^a-z0-9]+', '_', 'g'));
    IF v_name = 'ns.' || v_domain || '.' THEN RETURN '[]'::jsonb; END IF;
  END IF;
  RETURN public.normalize_dslm_ratings(jsonb_build_array(jsonb_build_object(
    'name', v_name, 'mastery', v_score, 'reason', coalesce(p_entry->'metadata'->>'reason', ''),
    'source', CASE WHEN p_entry->'ai_classified' = 'true'::jsonb THEN 'ai_classified_observation' ELSE 'teacher_observation' END)));
END;
$function$;
REVOKE ALL ON FUNCTION public.knowledge_entry_dslm_ratings(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.knowledge_entry_dslm_ratings(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.log_knowledge_entry_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_ratings jsonb; v_payload jsonb; v_mastery numeric; v_event uuid;
BEGIN
  v_ratings := public.knowledge_entry_dslm_ratings(to_jsonb(NEW));
  v_payload := jsonb_build_object('category', NEW.category, 'tags', coalesce(NEW.tags, '{}'),
    'entry_source', NEW.entry_source, 'content', NEW.content, 'nano_skill_ratings', v_ratings);
  SELECT round(avg((r->>'mastery')::numeric)) INTO v_mastery FROM jsonb_array_elements(v_ratings) r WHERE r->'hasValue' = 'true'::jsonb;
  SELECT id INTO v_event FROM public.student_events
    WHERE source_id = NEW.id AND student_id = NEW.student_id AND teacher_id = NEW.teacher_id
      AND event_type = 'knowledge_entry_added' AND event_source = 'teacher'
    ORDER BY created_at, id LIMIT 1;
  IF v_event IS NOT NULL THEN
    -- Preserve the original evidence date; one note is one observation.
    UPDATE public.student_events SET event_payload = v_payload, mastery = v_mastery,
      skill_ids = ARRAY(SELECT r->>'name' FROM jsonb_array_elements(v_ratings) r),
      element_type = NEW.category WHERE id = v_event AND event_payload IS DISTINCT FROM v_payload;
  ELSE
    INSERT INTO public.student_events(student_id, teacher_id, event_type, event_source, source_id, event_payload, element_type, skill_ids, mastery, created_at)
    VALUES (NEW.student_id, NEW.teacher_id, 'knowledge_entry_added', 'teacher', NEW.id, v_payload, NEW.category,
      ARRAY(SELECT r->>'name' FROM jsonb_array_elements(v_ratings) r), v_mastery, NEW.created_at);
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.log_knowledge_entry_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_knowledge_entry_event() TO service_role;
DROP TRIGGER IF EXISTS trigger_log_knowledge_entry_event ON public.student_knowledge_entries;
CREATE TRIGGER trigger_log_knowledge_entry_event AFTER INSERT OR UPDATE OF category, content, tags, metadata, ai_classified, ai_confidence, deleted_at, is_outdated
ON public.student_knowledge_entries FOR EACH ROW EXECUTE FUNCTION public.log_knowledge_entry_event();