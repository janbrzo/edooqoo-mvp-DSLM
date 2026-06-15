CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'unsubscribed')),
  source text NOT NULL DEFAULT 'unknown',
  consent_version text NOT NULL DEFAULT '2026-06-15',
  confirmation_token_hash text,
  confirmation_expires_at timestamptz,
  confirmation_sent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx
  ON public.newsletter_subscribers (status);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_confirmation_token_idx
  ON public.newsletter_subscribers (confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.newsletter_subscribers IS
  'Double-opt-in subscribers for the What Should I Teach Next? newsletter. No existing product users are imported.';
COMMENT ON COLUMN public.newsletter_subscribers.source IS
  'Controlled public form location. It must not contain learner identity or free-text notes.';

CREATE TABLE IF NOT EXISTS public.newsletter_rate_limits (
  key_hash text NOT NULL,
  action text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  PRIMARY KEY (key_hash, action)
);

ALTER TABLE public.newsletter_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_newsletter_rate_limit(
  p_key_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.newsletter_rate_limits%ROWTYPE;
  v_now timestamptz := now();
  v_inserted integer := 0;
BEGIN
  IF length(p_key_hash) < 32 OR length(p_action) = 0 OR p_limit < 1 OR p_window_seconds < 1 THEN
    RETURN false;
  END IF;

  SELECT *
    INTO v_record
  FROM public.newsletter_rate_limits
  WHERE key_hash = p_key_hash
    AND action = p_action
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.newsletter_rate_limits (key_hash, action, window_started_at, request_count)
    VALUES (p_key_hash, p_action, v_now, 1)
    ON CONFLICT (key_hash, action) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted = 1 THEN
      RETURN true;
    END IF;

    SELECT *
      INTO v_record
    FROM public.newsletter_rate_limits
    WHERE key_hash = p_key_hash
      AND action = p_action
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN false;
    END IF;
  END IF;

  IF v_record.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN
    UPDATE public.newsletter_rate_limits
    SET window_started_at = v_now,
        request_count = 1
    WHERE key_hash = p_key_hash
      AND action = p_action;
    RETURN true;
  END IF;

  IF v_record.request_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.newsletter_rate_limits
  SET request_count = request_count + 1
  WHERE key_hash = p_key_hash
    AND action = p_action;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_newsletter_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_newsletter_rate_limit(text, text, integer, integer) TO service_role;

