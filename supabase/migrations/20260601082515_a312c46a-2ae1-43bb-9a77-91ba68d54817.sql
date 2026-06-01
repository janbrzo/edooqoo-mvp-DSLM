-- Harden the helper added in the previous migration
ALTER FUNCTION public.try_parse_jsonb(text) SET search_path = public;

WITH eligible AS (
  SELECT
    w.id,
    w.title,
    public.try_parse_jsonb(w.ai_response) AS resp,
    w.public_slug,
    w.form_data
  FROM public.worksheets w
  WHERE w.deleted_at IS NULL
    AND w.ai_response IS NOT NULL
    AND (w.is_public IS NULL OR w.is_public = FALSE)
    AND length(trim(w.title)) >= 3
),
filtered AS (
  SELECT
    e.id,
    e.title,
    COALESCE(e.public_slug, public.generate_public_slug(e.title, e.id)) AS slug,
    LOWER(COALESCE(e.form_data->>'topic', 'general')) AS topic,
    COALESCE(e.form_data->>'englishLevel', e.form_data->>'cefr', 'B1') AS lvl,
    ARRAY(
      SELECT DISTINCT (ex->>'type')
      FROM jsonb_array_elements(e.resp->'exercises') ex
      WHERE ex->>'type' IS NOT NULL
      LIMIT 12
    ) AS ex_types
  FROM eligible e
  WHERE e.resp IS NOT NULL
    AND jsonb_typeof(e.resp->'exercises') = 'array'
    AND jsonb_array_length(e.resp->'exercises') >= 6
    AND COALESCE(e.form_data->>'additionalInformation', '') !~
        '([[:alnum:]._%+-]+@[[:alnum:].-]+\.[A-Za-z]{2,}|\+?[0-9][0-9 ().-]{7,}[0-9])'
)
UPDATE public.worksheets w
   SET is_public = TRUE,
       public_slug = f.slug,
       published_at = COALESCE(w.published_at, now()),
       public_topic = LEFT(f.topic, 120),
       public_level = LEFT(f.lvl, 20),
       public_exercise_types = f.ex_types
  FROM filtered f
 WHERE w.id = f.id;