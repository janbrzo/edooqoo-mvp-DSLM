-- Phase 1 / owner decision 3: Add Exercise and Regenerate cost 0.1 token per exercise.
--
-- DESIGN (token amounts are INTEGER in production: profiles.available_tokens,
-- total_tokens_received, total_tokens_consumed and token_transactions.amount are all
-- integer, and profiles_sync_available_tokens forces available = max(0, received - consumed)):
-- a fractional token cannot be stored, so exercise actions accumulate as credit UNITS
-- (1 unit = 0.1 token) per teacher and one WHOLE token is charged for every 10 units.
-- The balance semantics are unchanged: a settled token is one more total_tokens_consumed
-- and one less available_tokens, with a usage row in token_transactions.
--
--   public.exercise_credit_accounts  one row per teacher: units_accrued (lifetime units)
--                                    and tokens_settled (lifetime whole tokens charged).
--                                    Owed tokens = floor(units_accrued / 10) - tokens_settled.
--   public.exercise_credit_actions   one row per (teacher_id, action_ref): the idempotency
--                                    record of a client action (add_exercise, regenerate).
--   public.settle_exercise_credit_token(teacher, reference)  service-only helper that charges
--                                    ONE whole token. It does NOT use consume_token_internal
--                                    on purpose: that function also adds one to
--                                    total_worksheets_created and monthly_worksheets_used and
--                                    is keyed by worksheet, so an exercise credit would
--                                    inflate worksheet counters and a second token on the same
--                                    worksheet would be a no-op. The usage row reference_id is a
--                                    deterministic uuid of (teacher, settled sequence number),
--                                    which makes settlement idempotent and never collides with a
--                                    worksheet id.
--   public.consume_exercise_credit(p_worksheet_id, p_action_ref, p_action, p_count)
--                                    authenticated RPC. The caller must own the worksheet
--                                    (teacher_id or user_id = auth.uid()), otherwise 42501.
--                                    Idempotent by p_action_ref. Returns
--                                    {charged, tokens_charged, remaining_credit, reason}.
--
-- Result contract: charged = true means the action carries no overdue token (the client
-- needs no warning); charged = false means a whole token is owed and could not be settled
-- (reason frozen, no_balance or no_profile): the client should warn. The units stay
-- accrued, so the owed token is settled by the next call once the balance allows it
-- (debt is never forgiven and never charged twice). tokens_charged is the number of whole
-- tokens settled by THIS call (numeric). remaining_credit is the part of the next token
-- already used, in tokens (0.0 .. 0.9; 1.0 or more while a token is overdue).
-- Reasons: accrued, settled, already_recorded (same action_ref seen before: state only,
-- nothing charged), anonymous and promo_window (never charged or blocked, nothing
-- recorded), frozen, no_balance, no_profile.
--
-- Anonymous Supabase users and free promotion windows (is_free_generation_window) are
-- never charged, matching the worksheet charge. p_count is 1..100, p_action is
-- add_exercise or regenerate.
--
-- Additive only: no DROP, no change to consume_token or consume_token_internal.

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.exercise_credit_accounts (
  teacher_id uuid PRIMARY KEY,
  units_accrued bigint NOT NULL DEFAULT 0,
  tokens_settled integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercise_credit_accounts_non_negative CHECK (units_accrued >= 0 AND tokens_settled >= 0)
);

CREATE TABLE IF NOT EXISTS public.exercise_credit_actions (
  teacher_id uuid NOT NULL,
  action_ref uuid NOT NULL,
  worksheet_id uuid,
  action text NOT NULL,
  units integer NOT NULL,
  tokens_charged integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, action_ref),
  CONSTRAINT exercise_credit_actions_action_check CHECK (action IN ('add_exercise', 'regenerate')),
  CONSTRAINT exercise_credit_actions_units_check CHECK (units BETWEEN 1 AND 100)
);

ALTER TABLE public.exercise_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_credit_actions ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exercise_credit_accounts'
      AND policyname = 'Service role manages exercise credit accounts'
  ) THEN
    CREATE POLICY "Service role manages exercise credit accounts" ON public.exercise_credit_accounts
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exercise_credit_actions'
      AND policyname = 'Service role manages exercise credit actions'
  ) THEN
    CREATE POLICY "Service role manages exercise credit actions" ON public.exercise_credit_actions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$policy$;

REVOKE ALL ON TABLE public.exercise_credit_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.exercise_credit_actions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.exercise_credit_accounts TO service_role;
GRANT ALL ON TABLE public.exercise_credit_actions TO service_role;

-- 1. Settle one whole token (service-only helper) ---------------------------------------

CREATE OR REPLACE FUNCTION public.settle_exercise_credit_token(p_teacher_id uuid, p_reference_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_available integer;
  v_frozen boolean;
  v_email text;
BEGIN
  -- Idempotent: this reference was already charged.
  IF EXISTS (
    SELECT 1 FROM public.token_transactions t
    WHERE t.teacher_id = p_teacher_id AND t.transaction_type = 'usage' AND t.reference_id = p_reference_id
  ) THEN
    RETURN 'ok';
  END IF;

  SELECT COALESCE(p.available_tokens, 0), COALESCE(p.is_tokens_frozen, false), p.email
  INTO v_available, v_frozen, v_email
  FROM public.profiles p
  WHERE p.id = p_teacher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'no_profile';
  END IF;
  IF v_frozen THEN
    RETURN 'frozen';
  END IF;
  IF v_available <= 0 THEN
    RETURN 'no_balance';
  END IF;

  UPDATE public.profiles
  SET available_tokens = available_tokens - 1,
      total_tokens_consumed = COALESCE(total_tokens_consumed, 0) + 1
  WHERE id = p_teacher_id;

  INSERT INTO public.token_transactions (teacher_id, teacher_email, transaction_type, amount, description, reference_id)
  VALUES (p_teacher_id, v_email, 'usage', -1, 'Exercise credit (10 exercise actions)', p_reference_id);

  RETURN 'ok';
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_exercise_credit_token(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_exercise_credit_token(uuid, uuid) TO service_role;

-- 2. The client RPC ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_exercise_credit(
  p_worksheet_id uuid,
  p_action_ref uuid,
  p_action text,
  p_count integer DEFAULT 1
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_units_per_token CONSTANT integer := 10;
  v_uid uuid := auth.uid();
  v_owned boolean;
  v_anonymous boolean;
  v_units bigint;
  v_settled integer;
  v_owed integer;
  v_charged_now integer := 0;
  v_status text := 'ok';
  v_reason text;
  v_rows bigint;
  v_recorded boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_worksheet_id IS NULL OR p_action_ref IS NULL THEN
    RAISE EXCEPTION 'p_worksheet_id and p_action_ref are required' USING ERRCODE = '22023';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('add_exercise', 'regenerate') THEN
    RAISE EXCEPTION 'Unknown exercise credit action' USING ERRCODE = '22023';
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 100 THEN
    RAISE EXCEPTION 'p_count must be between 1 and 100' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = p_worksheet_id AND (w.teacher_id = v_uid OR w.user_id = v_uid)
  ) INTO v_owned;
  IF NOT v_owned THEN
    RAISE EXCEPTION 'Not allowed to charge exercise credit for this worksheet' USING ERRCODE = '42501';
  END IF;

  -- Never charged and never blocked: anonymous accounts and free promotion windows.
  SELECT COALESCE(u.is_anonymous, false) INTO v_anonymous FROM auth.users u WHERE u.id = v_uid;
  IF COALESCE(v_anonymous, false) THEN
    RETURN jsonb_build_object('charged', true, 'tokens_charged', 0, 'remaining_credit', 0, 'reason', 'anonymous');
  END IF;
  IF public.is_free_generation_window(now()) THEN
    RETURN jsonb_build_object('charged', true, 'tokens_charged', 0, 'remaining_credit', 0, 'reason', 'promo_window');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('exercise_credit:' || v_uid::text, 0));

  INSERT INTO public.exercise_credit_accounts (teacher_id) VALUES (v_uid)
  ON CONFLICT (teacher_id) DO NOTHING;

  -- Idempotent by action_ref: a repeated action only reports the current state.
  INSERT INTO public.exercise_credit_actions (teacher_id, action_ref, worksheet_id, action, units)
  VALUES (v_uid, p_action_ref, p_worksheet_id, p_action, p_count)
  ON CONFLICT (teacher_id, action_ref) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_recorded := v_rows > 0;

  IF v_recorded THEN
    UPDATE public.exercise_credit_accounts
    SET units_accrued = units_accrued + p_count, updated_at = now()
    WHERE teacher_id = v_uid;
  END IF;

  SELECT a.units_accrued, a.tokens_settled INTO v_units, v_settled
  FROM public.exercise_credit_accounts a WHERE a.teacher_id = v_uid;

  -- Settle every owed whole token (also a backlog left by an earlier refusal).
  IF v_recorded THEN
    v_owed := (v_units / c_units_per_token)::integer - v_settled;
    WHILE v_owed > 0 LOOP
      v_status := public.settle_exercise_credit_token(
        v_uid,
        md5(v_uid::text || ':exercise_credit:' || (v_settled + 1)::text)::uuid
      );
      EXIT WHEN v_status <> 'ok';
      v_settled := v_settled + 1;
      v_charged_now := v_charged_now + 1;
      v_owed := v_owed - 1;
    END LOOP;

    UPDATE public.exercise_credit_accounts
    SET tokens_settled = v_settled, updated_at = now()
    WHERE teacher_id = v_uid;
    UPDATE public.exercise_credit_actions
    SET tokens_charged = v_charged_now
    WHERE teacher_id = v_uid AND action_ref = p_action_ref;
  END IF;

  v_owed := (v_units / c_units_per_token)::integer - v_settled;

  IF v_owed > 0 THEN
    v_reason := CASE WHEN v_status = 'ok' THEN 'no_balance' ELSE v_status END;
    IF v_recorded THEN
      BEGIN
        INSERT INTO public.billing_charge_audit (source, outcome, reason, teacher_id, worksheet_id, detail)
        VALUES ('exercise_credit', 'refused', v_reason, v_uid, p_worksheet_id,
                jsonb_build_object('action', p_action, 'units', p_count, 'tokens_owed', v_owed));
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  ELSIF NOT v_recorded THEN
    v_reason := 'already_recorded';
  ELSIF v_charged_now > 0 THEN
    v_reason := 'settled';
  ELSE
    v_reason := 'accrued';
  END IF;

  RETURN jsonb_build_object(
    'charged', v_owed = 0,
    'tokens_charged', v_charged_now,
    'remaining_credit', round((v_units - v_settled::bigint * c_units_per_token)::numeric / c_units_per_token, 1),
    'reason', v_reason
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_exercise_credit(uuid, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_exercise_credit(uuid, uuid, text, integer) TO authenticated;
