ALTER FUNCTION public.prevent_profile_billing_self_update() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.prevent_profile_billing_self_update() FROM PUBLIC, anon, authenticated, service_role;