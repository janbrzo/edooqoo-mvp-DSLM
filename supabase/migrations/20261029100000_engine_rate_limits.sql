-- Phase 2 / step 4b (P2.5): shared rate limiter and balance pre-check for generateWorksheet.
--
-- PROBLEM: the generateWorksheet limiter lived in the memory of one Edge isolate (3/5 min,
-- 5/15 min, 10/60 min, key = raw X-Forwarded-For string), so the effective limit was far
-- above the nominal one and a client-supplied XFF tail could create unbounded keys. A teacher
-- with no credit also paid the full model cost: the server charge trigger
-- (charge_worksheet_on_insert) only runs AFTER the worksheet was generated and never aborts.
--
-- SOLUTION (additive only):
--   * public.engine_rate_limits: one fixed-window counter per (key, bucket), service-only RLS.
--   * public.consume_engine_rate_limit(p_key, p_bucket, p_limit, p_window_seconds) -> jsonb
--     {allowed, remaining, retry_after_seconds}: atomic (single INSERT .. ON CONFLICT DO UPDATE
--     .. WHERE), a denied call does not move the counter. The window is part of the bucket name
--     chosen by the caller (for example generate_300), so several windows per kind coexist.
--   * public.cleanup_engine_rate_limits(p_older_than_seconds) deletes stale counters. It is NOT
--     scheduled here. Guidance: run it daily, for example
--       SELECT cron.schedule('engine-rate-limits-cleanup', '17 3 * * *',
--                            $$SELECT public.cleanup_engine_rate_limits()$$);
--     or by hand; the table stays small (one row per active key and bucket) either way.
--   * public.engine_pre_check(p_user_id) -> jsonb {allowed, reason, available_tokens, frozen}:
--     read-only; mirrors consume_token_internal and charge_worksheet_on_insert so it never
--     refuses a user the trigger would charge:
--       - no user id, no auth.users row, Supabase anonymous account  -> allowed (never charged)
--       - free promotion window (is_free_generation_window)           -> allowed
--       - no profile row                                              -> allowed (conservative)
--       - is_tokens_frozen                                            -> refused (tokens_frozen)
--       - monthly_worksheet_limit > 0 AND monthly_worksheets_used < limit -> allowed
--       - available_tokens > 0                                        -> allowed
--       - otherwise                                                   -> refused (insufficient_tokens)
--
-- The Edge Function fails OPEN on any error of these RPCs (and works with this migration
-- missing), so apply order does not matter for availability; the limits take effect once both
-- the migration and the function are live.
--
-- ROLLBACK (nothing else depends on these objects):
--   Set ENGINE_DB_RATE_LIMIT=off and ENGINE_BALANCE_PRECHECK=off on the function, then
--   DROP FUNCTION public.engine_pre_check(uuid);
--   DROP FUNCTION public.cleanup_engine_rate_limits(integer);
--   DROP FUNCTION public.consume_engine_rate_limit(text, text, integer, integer);
--   DROP TABLE public.engine_rate_limits;

SET LOCAL lock_timeout = '5s';

-- 1. Counters ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.engine_rate_limits (
  key text NOT NULL,
  bucket text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, bucket),
  CONSTRAINT engine_rate_limits_key_length CHECK (char_length(key) BETWEEN 1 AND 200),
  CONSTRAINT engine_rate_limits_bucket_length CHECK (char_length(bucket) BETWEEN 1 AND 64)
);

CREATE INDEX IF NOT EXISTS idx_engine_rate_limits_window_started_at
  ON public.engine_rate_limits (window_started_at);

ALTER TABLE public.engine_rate_limits ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'engine_rate_limits'
      AND policyname = 'service_role_internal_access'
  ) THEN
    CREATE POLICY service_role_internal_access ON public.engine_rate_limits
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$policy$;

REVOKE ALL ON TABLE public.engine_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.engine_rate_limits TO service_role;

-- 2. Atomic consume ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_engine_rate_limit(
  p_key text,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_window interval;
  v_count integer;
  v_started timestamptz;
BEGIN
  IF p_key IS NULL OR char_length(p_key) NOT BETWEEN 1 AND 200
     OR p_bucket IS NULL OR char_length(p_bucket) NOT BETWEEN 1 AND 64
     OR p_limit IS NULL OR p_limit < 1
     OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'consume_engine_rate_limit: invalid argument' USING ERRCODE = '22023';
  END IF;

  v_window := make_interval(secs => p_window_seconds);

  -- One statement: the conflicting row is locked by ON CONFLICT DO UPDATE, so concurrent
  -- callers are serialised per (key, bucket). The WHERE leaves a full window untouched, which
  -- makes a denied call free and returns no row.
  INSERT INTO public.engine_rate_limits AS t (key, bucket, window_started_at, request_count)
  VALUES (p_key, p_bucket, v_now, 1)
  ON CONFLICT (key, bucket) DO UPDATE
    SET window_started_at = CASE WHEN t.window_started_at + v_window <= v_now THEN v_now ELSE t.window_started_at END,
        request_count = CASE WHEN t.window_started_at + v_window <= v_now THEN 1 ELSE t.request_count + 1 END
    WHERE t.window_started_at + v_window <= v_now OR t.request_count < p_limit
  RETURNING t.request_count, t.window_started_at INTO v_count, v_started;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', GREATEST(p_limit - v_count, 0),
      'retry_after_seconds', 0
    );
  END IF;

  SELECT t.window_started_at INTO v_started
  FROM public.engine_rate_limits t
  WHERE t.key = p_key AND t.bucket = p_bucket;

  RETURN jsonb_build_object(
    'allowed', false,
    'remaining', 0,
    'retry_after_seconds', GREATEST(1, ceil(extract(epoch FROM (COALESCE(v_started, v_now) + v_window - v_now)))::integer)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_engine_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_engine_rate_limit(text, text, integer, integer) TO service_role;

-- 3. Cleanup (not scheduled here) -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_engine_rate_limits(p_older_than_seconds integer DEFAULT 172800)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  -- The longest window in use is one day; the default keeps two.
  IF p_older_than_seconds IS NULL OR p_older_than_seconds < 86400 THEN
    RAISE EXCEPTION 'cleanup_engine_rate_limits: p_older_than_seconds must be at least 86400' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.engine_rate_limits
  WHERE window_started_at < now() - make_interval(secs => p_older_than_seconds);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_engine_rate_limits(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_engine_rate_limits(integer) TO service_role;

-- 4. Balance pre-check (read-only) --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.engine_pre_check(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exists boolean;
  v_anonymous boolean;
  v_has_profile boolean;
  v_available integer;
  v_frozen boolean;
  v_monthly_limit integer;
  v_monthly_used integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_user', 'available_tokens', NULL, 'frozen', false);
  END IF;

  SELECT true, COALESCE(u.is_anonymous, false)
  INTO v_exists, v_anonymous
  FROM auth.users u
  WHERE u.id = p_user_id;

  -- Same skips as charge_worksheet_on_insert: orphan ids and anonymous accounts are never charged.
  IF v_exists IS NOT TRUE THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_account', 'available_tokens', NULL, 'frozen', false);
  END IF;
  IF v_anonymous THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'anonymous', 'available_tokens', NULL, 'frozen', false);
  END IF;

  IF public.is_free_generation_window(now()) THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'free_window', 'available_tokens', NULL, 'frozen', false);
  END IF;

  SELECT true,
         COALESCE(p.available_tokens, 0),
         COALESCE(p.is_tokens_frozen, false),
         COALESCE(p.monthly_worksheet_limit, 0),
         COALESCE(p.monthly_worksheets_used, 0)
  INTO v_has_profile, v_available, v_frozen, v_monthly_limit, v_monthly_used
  FROM public.profiles p
  WHERE p.id = p_user_id;

  -- consume_token_internal refuses a missing profile; the pre-check stays conservative and lets
  -- it through, because a refusal here is final while the trigger never blocks the worksheet.
  IF v_has_profile IS NOT TRUE THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_profile', 'available_tokens', NULL, 'frozen', false);
  END IF;

  -- Order and conditions of consume_token_internal.
  IF v_frozen THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'tokens_frozen', 'available_tokens', v_available, 'frozen', true);
  END IF;
  IF v_monthly_limit > 0 AND v_monthly_used < v_monthly_limit THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'monthly_limit', 'available_tokens', v_available, 'frozen', false);
  END IF;
  IF v_available > 0 THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'available_tokens', 'available_tokens', v_available, 'frozen', false);
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_tokens', 'available_tokens', v_available, 'frozen', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.engine_pre_check(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engine_pre_check(uuid) TO service_role;
