ALTER TABLE public.worksheets
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS public_topic TEXT,
  ADD COLUMN IF NOT EXISTS public_level TEXT,
  ADD COLUMN IF NOT EXISTS public_exercise_types TEXT[];

CREATE INDEX IF NOT EXISTS idx_worksheets_public
  ON public.worksheets (is_public, published_at DESC)
  WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_worksheets_public_slug
  ON public.worksheets (public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_worksheets_public_topic
  ON public.worksheets (public_topic) WHERE is_public = true;

DROP POLICY IF EXISTS "Public worksheets readable by anyone" ON public.worksheets;
CREATE POLICY "Public worksheets readable by anyone"
  ON public.worksheets FOR SELECT
  USING (is_public = true);

CREATE OR REPLACE FUNCTION public.generate_public_slug(p_title TEXT, p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  base TEXT;
  hash TEXT;
BEGIN
  base := lower(regexp_replace(coalesce(p_title, 'worksheet'), '[^a-zA-Z0-9]+', '-', 'g'));
  base := regexp_replace(base, '^-+|-+$', '', 'g');
  base := substring(base from 1 for 60);
  IF length(base) = 0 THEN
    base := 'worksheet';
  END IF;
  hash := substring(p_id::text from 1 for 6);
  RETURN base || '-' || hash;
END $$;