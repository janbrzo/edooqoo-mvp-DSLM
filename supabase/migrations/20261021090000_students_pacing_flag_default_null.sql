-- D11 (audit B1): last_pacing_set_manually means "never set" when NULL.
-- The column default was false, which made every new student look like
-- "pacing was set by recalculate-pacing", so the prompt used the stored 50 and
-- automatic pacing never ran. New rows now start with NULL; resolvePromptPacing
-- then computes the style with computeStylePacing. Existing rows are untouched
-- (the one-off apply is 20261021090100). No DROP: ALTER ... SET DEFAULT only.
ALTER TABLE public.students ALTER COLUMN last_pacing_set_manually SET DEFAULT NULL;
