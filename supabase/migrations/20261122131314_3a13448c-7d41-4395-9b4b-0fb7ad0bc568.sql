ALTER TABLE public.public_placement_reports
  ADD COLUMN IF NOT EXISTS answers jsonb;