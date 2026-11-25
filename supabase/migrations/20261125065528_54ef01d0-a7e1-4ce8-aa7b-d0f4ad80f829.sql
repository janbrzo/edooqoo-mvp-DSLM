ALTER TABLE public.public_placement_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE OR REPLACE FUNCTION public.touch_placement_report_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE OR REPLACE TRIGGER touch_placement_report_updated_at BEFORE UPDATE ON public.public_placement_reports FOR EACH ROW EXECUTE FUNCTION public.touch_placement_report_updated_at();
REVOKE ALL ON FUNCTION public.touch_placement_report_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_placement_report_updated_at() TO service_role;