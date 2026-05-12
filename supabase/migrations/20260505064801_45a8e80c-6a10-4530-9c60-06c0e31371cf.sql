
-- 1) Email send log
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  template_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','sent','failed','skipped')),
  provider_message_id text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient_template
  ON public.email_send_log (recipient_email, template_name);
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_select" ON public.email_send_log FOR SELECT TO service_role USING (true);
CREATE POLICY "service_role_insert" ON public.email_send_log FOR INSERT TO service_role WITH CHECK (true);

-- 2) Internal config (server-only secrets for trigger -> edge function auth)
CREATE TABLE IF NOT EXISTS public.app_internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_internal_config ENABLE ROW LEVEL SECURITY;
-- No policies = no access from anon/authenticated. service_role bypasses RLS.

INSERT INTO public.app_internal_config (key, value) VALUES
  ('welcome_email_url', 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/send-welcome-email'),
  ('welcome_email_secret', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 3) Trigger function
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_signup_source text;
  v_first_name text;
BEGIN
  IF (TG_OP = 'UPDATE')
     AND OLD.email_confirmed_at IS NULL
     AND NEW.email_confirmed_at IS NOT NULL THEN

    SELECT value INTO v_url FROM public.app_internal_config WHERE key = 'welcome_email_url';
    SELECT value INTO v_secret FROM public.app_internal_config WHERE key = 'welcome_email_secret';

    IF v_url IS NULL OR v_secret IS NULL THEN
      RETURN NEW;
    END IF;

    v_signup_source := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
    v_first_name := COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'firstName',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    );

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', v_secret
      ),
      body := jsonb_build_object(
        'email', NEW.email,
        'firstName', v_first_name,
        'signupSource', v_signup_source,
        'userId', NEW.id::text
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_email_confirmed ON auth.users;
CREATE TRIGGER on_user_email_confirmed
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();
