CREATE TABLE public.homework_mistake_sets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 homework_id uuid NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 attempt integer NOT NULL,
 set_id uuid NOT NULL REFERENCES public.flashcard_sets(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (homework_id, student_id, teacher_id, attempt)
);
GRANT SELECT ON public.homework_mistake_sets TO authenticated;
GRANT ALL ON public.homework_mistake_sets TO service_role;
ALTER TABLE public.homework_mistake_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher reads own homework mistake sets" ON public.homework_mistake_sets FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE TABLE public.homework_mistake_cards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mistake_set_id uuid NOT NULL REFERENCES public.homework_mistake_sets(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 exercise_index integer NOT NULL,
 question_index integer NOT NULL,
 card_id uuid NOT NULL REFERENCES public.flashcard_cards(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (mistake_set_id, exercise_index, question_index)
);
GRANT SELECT ON public.homework_mistake_cards TO authenticated;
GRANT ALL ON public.homework_mistake_cards TO service_role;
ALTER TABLE public.homework_mistake_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher reads own homework mistake cards" ON public.homework_mistake_cards FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE OR REPLACE FUNCTION public.touch_homework_mistake_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.touch_homework_mistake_timestamp() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_homework_mistake_timestamp() TO service_role;
CREATE TRIGGER homework_mistake_sets_updated_at BEFORE UPDATE ON public.homework_mistake_sets FOR EACH ROW EXECUTE FUNCTION public.touch_homework_mistake_timestamp();
CREATE TRIGGER homework_mistake_cards_updated_at BEFORE UPDATE ON public.homework_mistake_cards FOR EACH ROW EXECUTE FUNCTION public.touch_homework_mistake_timestamp();
CREATE OR REPLACE FUNCTION public.save_homework_mistake_flashcards(
 p_homework_id uuid, p_teacher_id uuid, p_share_token text, p_student_email text,
 p_snapshot jsonb, p_cards jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
 hw public.homework_assignments%ROWTYPE;
 st public.students%ROWTYPE;
 fs public.flashcard_sets%ROWTYPE;
 mapping public.homework_mistake_sets%ROWTYPE;
 current_snapshot jsonb;
 cards_snapshot jsonb;
 card jsonb;
 new_card_id uuid;
 existing_card_id uuid;
 created_count integer := 0;
 existing_count integer := 0;
 pos integer;
 ex integer;
 q integer;
BEGIN
 IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object' OR jsonb_typeof(p_cards) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_cards) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_payload'; END IF;
 SELECT * INTO hw FROM public.homework_assignments WHERE id=p_homework_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT * INTO st FROM public.students WHERE id=hw.student_id FOR UPDATE;
 IF NOT FOUND OR st.deleted_at IS NOT NULL OR st.teacher_id IS DISTINCT FROM hw.teacher_id THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF p_teacher_id IS NOT NULL THEN
   IF p_teacher_id IS DISTINCT FROM hw.teacher_id THEN RAISE EXCEPTION 'not_allowed'; END IF;
 ELSE
   IF coalesce(p_share_token,'')='' OR p_share_token IS DISTINCT FROM hw.share_token
      OR coalesce(btrim(p_student_email),'')='' OR st.student_email IS NULL
      OR lower(btrim(p_student_email)) IS DISTINCT FROM lower(btrim(st.student_email)) THEN RAISE EXCEPTION 'not_allowed'; END IF;
   IF hw.reviewed_at IS NULL THEN RAISE EXCEPTION 'not_reviewed'; END IF;
 END IF;
 IF hw.completed_at IS NULL OR coalesce(hw.completed_by_teacher,false) THEN RAISE EXCEPTION 'not_reviewed'; END IF;
 PERFORM 1 FROM public.homework_student_answers WHERE homework_id=hw.id AND lower(btrim(student_email))=lower(btrim(st.student_email)) FOR UPDATE;
 SELECT coalesce(jsonb_agg(jsonb_build_object('exercise_index',a.exercise_index,'exercise_type',a.exercise_type,
   'answers',a.answers,'is_submitted',a.is_submitted,'eval_trigger',a.eval_trigger,'item_evaluations',a.item_evaluations) ORDER BY a.exercise_index),'[]'::jsonb)
 INTO cards_snapshot FROM public.homework_student_answers a WHERE a.homework_id=hw.id AND lower(btrim(a.student_email))=lower(btrim(st.student_email));
 current_snapshot := jsonb_build_object('teacher_id',hw.teacher_id,'student_id',hw.student_id,'attempt',hw.attempt,
   'reviewed_at',hw.reviewed_at,'completed_at',hw.completed_at,'completed_by_teacher',hw.completed_by_teacher,
   'selected_exercises',hw.selected_exercises,'answers',cards_snapshot);
 IF current_snapshot IS DISTINCT FROM p_snapshot THEN RAISE EXCEPTION 'source_changed'; END IF;
 SELECT * INTO mapping FROM public.homework_mistake_sets WHERE homework_id=hw.id AND student_id=st.id AND teacher_id=hw.teacher_id AND attempt=hw.attempt;
 IF FOUND THEN
   SELECT * INTO fs FROM public.flashcard_sets WHERE id=mapping.set_id FOR UPDATE;
   IF NOT FOUND OR fs.deleted_at IS NOT NULL OR fs.teacher_id IS DISTINCT FROM hw.teacher_id OR fs.student_id IS DISTINCT FROM st.id THEN RAISE EXCEPTION 'set_unavailable'; END IF;
   IF fs.share_expires_at IS NOT NULL AND fs.share_expires_at <= now() THEN RAISE EXCEPTION 'set_unavailable'; END IF;
   IF p_teacher_id IS NULL AND fs.allow_student_contributions IS NOT TRUE THEN RAISE EXCEPTION 'contributions_disabled'; END IF;
 ELSE
   INSERT INTO public.flashcard_sets(teacher_id,student_id,title,description,is_bidirectional,back_type,share_token,share_expires_at)
   VALUES(hw.teacher_id,st.id,'Mistakes & Review: '||left(hw.title,160),NULL,false,'definition',encode(extensions.gen_random_bytes(32),'hex'),now()+interval '1 year') RETURNING * INTO fs;
   INSERT INTO public.homework_mistake_sets(homework_id,student_id,teacher_id,attempt,set_id) VALUES(hw.id,st.id,hw.teacher_id,hw.attempt,fs.id) RETURNING * INTO mapping;
 END IF;
 SELECT coalesce(max(card_position),0) INTO pos FROM public.flashcard_cards WHERE set_id=fs.id;
 FOR card IN SELECT value FROM jsonb_array_elements(p_cards) LOOP
   IF jsonb_typeof(card->'exercise_index') IS DISTINCT FROM 'number' OR jsonb_typeof(card->'question_index') IS DISTINCT FROM 'number'
      OR (card->>'exercise_index') !~ '^[0-9]+$' OR (card->>'question_index') !~ '^[0-9]+$'
      OR jsonb_typeof(card->'front_text') IS DISTINCT FROM 'string' OR jsonb_typeof(card->'back_text') IS DISTINCT FROM 'string'
      OR length(btrim(card->>'front_text')) NOT BETWEEN 1 AND 4000 OR length(btrim(card->>'back_text')) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'invalid_card'; END IF;
   ex := (card->>'exercise_index')::int; q := (card->>'question_index')::int;
   IF NOT EXISTS (SELECT 1 FROM public.homework_student_answers a CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a.item_evaluations)='array' THEN a.item_evaluations ELSE '[]'::jsonb END) r
      WHERE a.homework_id=hw.id AND lower(btrim(a.student_email))=lower(btrim(st.student_email)) AND a.exercise_index=ex AND a.is_submitted=true AND a.eval_trigger IS NOT NULL
       AND r->>'question_index'=q::text AND r->>'hasValue'='true' AND (r->>'mastery')::numeric>=0 AND (r->>'mastery')::numeric<50) THEN RAISE EXCEPTION 'invalid_source'; END IF;
   SELECT card_id INTO existing_card_id FROM public.homework_mistake_cards WHERE mistake_set_id=mapping.id AND exercise_index=ex AND question_index=q;
   IF FOUND THEN
     IF NOT EXISTS (SELECT 1 FROM public.flashcard_cards WHERE id=existing_card_id AND deleted_at IS NULL AND set_id=fs.id) THEN RAISE EXCEPTION 'card_unavailable'; END IF;
     existing_count := existing_count+1; CONTINUE;
   END IF;
   pos := pos+1;
   INSERT INTO public.flashcard_cards(set_id,front_text,back_text,front_example,source_type,created_by_student,card_position)
     VALUES(fs.id,btrim(card->>'front_text'),btrim(card->>'back_text'),NULL,'manual',p_teacher_id IS NULL,pos) RETURNING id INTO new_card_id;
   INSERT INTO public.homework_mistake_cards(mistake_set_id,teacher_id,exercise_index,question_index,card_id) VALUES(mapping.id,hw.teacher_id,ex,q,new_card_id);
   created_count := created_count+1;
 END LOOP;
 RETURN jsonb_build_object('set_id',fs.id,'share_token',fs.share_token,'created_count',created_count,'existing_count',existing_count);
END $$;
REVOKE ALL ON FUNCTION public.save_homework_mistake_flashcards(uuid,uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_homework_mistake_flashcards(uuid,uuid,text,text,jsonb,jsonb) TO service_role;