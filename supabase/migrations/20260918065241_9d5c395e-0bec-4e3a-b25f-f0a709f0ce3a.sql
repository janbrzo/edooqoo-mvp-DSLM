CREATE OR REPLACE FUNCTION public.prevent_profile_billing_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND (
    NEW.available_tokens IS DISTINCT FROM OLD.available_tokens OR
    NEW.total_tokens_received IS DISTINCT FROM OLD.total_tokens_received OR
    NEW.total_tokens_consumed IS DISTINCT FROM OLD.total_tokens_consumed OR
    NEW.rollover_tokens IS DISTINCT FROM OLD.rollover_tokens OR
    NEW.subscription_type IS DISTINCT FROM OLD.subscription_type OR
    NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
    NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at OR
    NEW.monthly_worksheet_limit IS DISTINCT FROM OLD.monthly_worksheet_limit OR
    NEW.monthly_worksheets_used IS DISTINCT FROM OLD.monthly_worksheets_used OR
    NEW.last_limit_reset IS DISTINCT FROM OLD.last_limit_reset OR
    NEW.is_tokens_frozen IS DISTINCT FROM OLD.is_tokens_frozen OR
    NEW.total_worksheets_created IS DISTINCT FROM OLD.total_worksheets_created
  ) THEN
    RAISE EXCEPTION 'Billing and usage fields cannot be updated directly';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_billing_self_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_profile_billing_self_update() TO authenticated, service_role;

DROP TRIGGER IF EXISTS prevent_profile_billing_self_update_trigger ON public.profiles;
CREATE TRIGGER prevent_profile_billing_self_update_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_billing_self_update();