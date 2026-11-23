CREATE INDEX IF NOT EXISTS idx_public_placement_reports_unclaimed_test_id
  ON public.public_placement_reports (unclaimed_test_id)
  WHERE unclaimed_test_id IS NOT NULL;