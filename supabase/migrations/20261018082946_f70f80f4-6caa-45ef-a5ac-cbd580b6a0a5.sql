-- Pillar 1 closure: exact service-only allowlist, no blanket RPC revocation.
REVOKE ALL ON TABLE public.app_internal_config, public.newsletter_subscribers, public.newsletter_rate_limits, public.dslm_event_errors, public.dslm_backfill_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_internal_config, public.newsletter_subscribers, public.newsletter_rate_limits, public.dslm_event_errors, public.dslm_backfill_audit TO service_role;

ALTER TABLE public.app_internal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dslm_event_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dslm_backfill_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_internal_access ON public.app_internal_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_internal_access ON public.newsletter_subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_internal_access ON public.newsletter_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_internal_access ON public.dslm_event_errors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_internal_access ON public.dslm_backfill_audit FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE EXECUTE ON FUNCTION public.consume_newsletter_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_newsletter_rate_limit(text, text, integer, integer) TO service_role;