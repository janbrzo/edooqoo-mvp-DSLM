-- Phase 1 / P1.1 (audit R01, R36): charge a worksheet on the server, at INSERT.
--
-- PROBLEM: the token charge existed only in the browser (useTokenSystem.consumeToken).
-- A closed tab, a swallowed RPC error or a job registry timeout left the worksheet free
-- for good (7 to 16 percent of real-teacher worksheets since 2026-06; 16 owned worksheets
-- uncharged during the billing guard regression of 2026-09-17 .. 2026-10-06).
--
-- SOLUTION: an AFTER INSERT trigger on public.worksheets (status created, owner set)
-- calls consume_token_internal(teacher_id, worksheet_id). That function is idempotent on
-- (teacher_id, reference_id = worksheet id) under an advisory lock, so the existing client
-- consume_token call that follows yields no second usage row: exactly one row per worksheet.
-- Copies (status copy), null-owner rows and anonymous demo rows are not charged.
--
-- Rules mirrored from the client:
--   * Supabase anonymous accounts (auth.users.is_anonymous) and ids without an auth.users
--     row are skipped (the client aborts for anonymous users).
--   * Free promotion windows: public.is_free_generation_window(now()) mirrors
--     src/utils/promoUtils.ts isFreeCustomDemoWeek (dates kept in billing_free_windows).
--   * Billing guard: the trigger function is SECURITY DEFINER, so current_user is the
--     function owner, never authenticated; the guard (current_user = authenticated)
--     lets the profile counters change.
--
-- The trigger NEVER aborts the INSERT: every exception is caught. A refused charge
-- (frozen, no balance, no profile) or an error is written to public.billing_charge_audit
-- (service-only), which the daily coverage monitor (20261028101100) reads.
--
-- Written off by owner decision: the 16 worksheets of the guard regression window are
-- not back-charged (no data change here).
--
-- Additive only: new tables, functions and one trigger. No DROP. Rollback:
--   ALTER TABLE public.worksheets DISABLE TRIGGER trg_charge_worksheet_on_insert;

SET LOCAL lock_timeout = '5s';

-- 1. Free promotion windows (server copy of the client constants) ---------------------

CREATE TABLE IF NOT EXISTS public.billing_free_windows (
  label text PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_free_windows_range CHECK (ends_at > starts_at)
);

ALTER TABLE public.billing_free_windows ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_free_windows'
      AND policyname = 'Service role manages billing free windows'
  ) THEN
    CREATE POLICY "Service role manages billing free windows" ON public.billing_free_windows
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$policy$;

REVOKE ALL ON TABLE public.billing_free_windows FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.billing_free_windows TO service_role;

-- Same instants as src/utils/promoUtils.ts. The September 2025 week is expired in the
-- client; it is kept so the coverage monitor can exclude those historical days.
INSERT INTO public.billing_free_windows (label, starts_at, ends_at)
VALUES
  ('free_demo_week_2025', '2025-09-23T00:00:00.000Z', '2025-10-05T23:59:59.999Z'),
  ('free_christmas_week_2025', '2025-12-25T01:00:00.000Z', '2026-01-04T23:59:59.999Z')
ON CONFLICT (label) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_free_generation_window(p_at timestamptz DEFAULT now())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.billing_free_windows w
    WHERE w.is_active AND p_at >= w.starts_at AND p_at <= w.ends_at
  );
$function$;

REVOKE ALL ON FUNCTION public.is_free_generation_window(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_free_generation_window(timestamptz) TO service_role;

-- 2. Audit of refused or failed charges -------------------------------------------------

CREATE TABLE IF NOT EXISTS public.billing_charge_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  outcome text NOT NULL,
  reason text NOT NULL,
  teacher_id uuid,
  worksheet_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT billing_charge_audit_outcome_check CHECK (outcome IN ('refused', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_billing_charge_audit_created_at
  ON public.billing_charge_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_charge_audit_worksheet
  ON public.billing_charge_audit (worksheet_id) WHERE worksheet_id IS NOT NULL;

ALTER TABLE public.billing_charge_audit ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_charge_audit'
      AND policyname = 'Service role manages billing charge audit'
  ) THEN
    CREATE POLICY "Service role manages billing charge audit" ON public.billing_charge_audit
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$policy$;

REVOKE ALL ON TABLE public.billing_charge_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.billing_charge_audit TO service_role;

-- Lookup used by the monitor and by the idempotency check of consume_token_internal.
CREATE INDEX IF NOT EXISTS idx_token_transactions_reference
  ON public.token_transactions (reference_id) WHERE reference_id IS NOT NULL;

-- 3. The trigger function ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.charge_worksheet_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exists boolean;
  v_anonymous boolean;
  v_charged boolean;
  v_frozen boolean;
  v_available integer;
  v_has_profile boolean;
  v_reason text;
BEGIN
  BEGIN
    SELECT true, COALESCE(u.is_anonymous, false)
    INTO v_exists, v_anonymous
    FROM auth.users u
    WHERE u.id = NEW.teacher_id;

    -- Anonymous demo accounts and orphan ids are never charged (client parity).
    IF v_exists IS NOT TRUE OR v_anonymous THEN
      RETURN NEW;
    END IF;

    -- Free promotion window (client parity: isFreeCustomDemoWeek).
    IF public.is_free_generation_window(now()) THEN
      RETURN NEW;
    END IF;

    v_charged := public.consume_token_internal(NEW.teacher_id, NEW.id);

    IF v_charged IS DISTINCT FROM true THEN
      SELECT true, COALESCE(p.is_tokens_frozen, false), COALESCE(p.available_tokens, 0)
      INTO v_has_profile, v_frozen, v_available
      FROM public.profiles p
      WHERE p.id = NEW.teacher_id;

      v_reason := CASE
        WHEN v_has_profile IS NOT TRUE THEN 'no_profile'
        WHEN v_frozen THEN 'frozen'
        ELSE 'no_balance'
      END;

      INSERT INTO public.billing_charge_audit (source, outcome, reason, teacher_id, worksheet_id, detail)
      VALUES (
        'worksheet_insert_trigger', 'refused', v_reason, NEW.teacher_id, NEW.id,
        jsonb_build_object('available_tokens', v_available, 'result', v_charged)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never abort the worksheet INSERT. The audit insert is guarded too.
    BEGIN
      INSERT INTO public.billing_charge_audit (source, outcome, reason, teacher_id, worksheet_id, detail)
      VALUES (
        'worksheet_insert_trigger', 'error', 'exception', NEW.teacher_id, NEW.id,
        jsonb_build_object('sqlstate', SQLSTATE, 'message', left(SQLERRM, 500))
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.charge_worksheet_on_insert() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_charge_worksheet_on_insert
  AFTER INSERT ON public.worksheets
  FOR EACH ROW
  WHEN (NEW.teacher_id IS NOT NULL AND NEW.status = 'created')
  EXECUTE FUNCTION public.charge_worksheet_on_insert();
