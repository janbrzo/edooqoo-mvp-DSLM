ALTER TABLE public.students ALTER COLUMN english_level DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN main_goal DROP NOT NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS main_goal_deadline date;

CREATE OR REPLACE FUNCTION public.try_parse_jsonb(input text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  BEGIN
    RETURN input::jsonb;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;