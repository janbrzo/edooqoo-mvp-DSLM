CREATE OR REPLACE FUNCTION public.get_public_worksheet_by_slug(p_slug text)
 RETURNS TABLE(id uuid, title text, ai_response text, html_content text, public_topic text, public_level text, published_at timestamp with time zone, is_public boolean, public_slug text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT w.id, w.title, w.ai_response, w.html_content, w.public_topic,
         w.public_level, w.published_at, w.is_public, w.public_slug
  FROM public.worksheets w
  WHERE w.public_slug = p_slug AND w.is_public = true AND w.deleted_at IS NULL
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_flashcard_set_is_bidirectional(p_set_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT s.is_bidirectional FROM public.flashcard_sets s
    WHERE s.id = p_set_id AND s.deleted_at IS NULL
      AND (s.teacher_id = auth.uid()
           OR (s.share_token IS NOT NULL AND (s.share_expires_at IS NULL OR s.share_expires_at > now())))), false);
$function$;

CREATE OR REPLACE FUNCTION public.get_learner_mastered_counts(p_learner_identifier text)
 RETURNS TABLE(set_id uuid, mastered_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT fp.set_id, count(*)::bigint
  FROM public.flashcard_progress fp
  JOIN public.flashcard_sets s ON s.id = fp.set_id AND s.teacher_id = auth.uid()
  WHERE lower(fp.learner_identifier) = lower(trim(p_learner_identifier))
    AND coalesce(fp.repetition, 0) >= 4
  GROUP BY fp.set_id;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_learner_mastered_counts(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_learner_mastered_counts(text) TO authenticated, service_role;