DROP POLICY IF EXISTS "Public worksheets readable by anyone" ON public.worksheets;

CREATE OR REPLACE FUNCTION public.list_public_worksheets(
  p_level text DEFAULT NULL,
  p_topic text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  public_slug text,
  title text,
  public_topic text,
  public_level text,
  public_exercise_types text[],
  published_at timestamptz,
  public_view_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.public_slug, w.title, w.public_topic, w.public_level,
         w.public_exercise_types, w.published_at, w.public_view_count
  FROM public.worksheets w
  WHERE w.is_public = true
    AND (p_level IS NULL OR p_level = '' OR w.public_level ILIKE '%' || p_level || '%')
    AND (p_topic IS NULL OR p_topic = '' OR w.public_topic ILIKE '%' || p_topic || '%')
  ORDER BY w.published_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

REVOKE EXECUTE ON FUNCTION public.list_public_worksheets(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_worksheets(text, text, integer, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_worksheet_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  title text,
  ai_response text,
  html_content text,
  public_topic text,
  public_level text,
  published_at timestamptz,
  is_public boolean,
  public_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.title, w.ai_response, w.html_content, w.public_topic,
         w.public_level, w.published_at, w.is_public, w.public_slug
  FROM public.worksheets w
  WHERE w.public_slug = p_slug
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_worksheet_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_worksheet_by_slug(text) TO anon, authenticated, service_role;