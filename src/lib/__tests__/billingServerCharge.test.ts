import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Phase 1 (audit R01, R02, R36): the worksheet token charge moves to the server, a daily
 * monitor compares worksheets with usage rows, and Add Exercise / Regenerate cost 0.1 token
 * through an integer-safe credit accumulator. Source assertions on the migrations
 * (same pattern as dslmSqlBaseline.test.ts).
 */
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const read = (f: string) => readFileSync(join(MIGRATIONS, f), 'utf8');

const TRIGGER_FILE = '20261028101000_billing_server_charge_trigger.sql';
const MONITOR_FILE = '20261028101100_billing_charge_monitoring.sql';
const CREDIT_FILE = '20261028101200_exercise_credit.sql';

const fnBody = (src: string, name: string): string => {
  const start = src.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`, 'i'));
  expect(start, `${name} defined`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf('$function$', start);
  return src.slice(start, src.indexOf('$function$', open + 10));
};

describe('P1.1 server-side worksheet charge (20261028101000)', () => {
  const sql = read(TRIGGER_FILE);
  const fn = fnBody(sql, 'charge_worksheet_on_insert');

  it('is a SECURITY DEFINER function with a pinned search_path', () => {
    expect(fn).toMatch(/SECURITY DEFINER/);
    expect(fn).toMatch(/SET search_path TO 'public'/);
    expect(fn).toMatch(/RETURNS trigger/);
  });

  it('catches every exception and always returns NEW, so it never aborts the INSERT', () => {
    expect(fn).toMatch(/EXCEPTION WHEN OTHERS THEN/);
    expect(fn.trimEnd().endsWith('RETURN NEW;\nEND;')).toBe(true);
    expect(fn).not.toMatch(/RAISE EXCEPTION/);
    // the audit write inside the handler is itself guarded
    expect(fn).toMatch(/EXCEPTION WHEN OTHERS THEN\s+NULL;/);
  });

  it('charges only through the idempotent consume_token_internal (one usage row per worksheet)', () => {
    expect(fn).toMatch(/public\.consume_token_internal\(NEW\.teacher_id, NEW\.id\)/);
    expect(fn).not.toMatch(/INSERT INTO public\.token_transactions/);
    expect(fn).not.toMatch(/UPDATE public\.profiles/);
  });

  it('skips anonymous accounts, ids without an auth user and free promotion windows', () => {
    expect(fn).toMatch(/auth\.users/);
    expect(fn).toMatch(/is_anonymous/);
    expect(fn).toMatch(/public\.is_free_generation_window\(now\(\)\)/);
  });

  it('writes a refused or failed charge to the service-only audit table', () => {
    expect(fn).toMatch(/INSERT INTO public\.billing_charge_audit/);
    expect(fn).toMatch(/'frozen'/);
    expect(fn).toMatch(/'no_balance'/);
    expect(sql).toMatch(/ALTER TABLE public\.billing_charge_audit ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/CREATE POLICY "Service role manages billing charge audit" ON public\.billing_charge_audit\s+FOR ALL TO service_role/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.billing_charge_audit FROM PUBLIC, anon, authenticated/);
  });

  it('is an AFTER INSERT trigger limited to owned, created worksheets (copies are free)', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE TRIGGER trg_charge_worksheet_on_insert\s+AFTER INSERT ON public\.worksheets\s+FOR EACH ROW\s+WHEN \(NEW\.teacher_id IS NOT NULL AND NEW\.status = 'created'\)\s+EXECUTE FUNCTION public\.charge_worksheet_on_insert\(\)/,
    );
  });

  it('is not executable by client roles', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.charge_worksheet_on_insert\(\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.is_free_generation_window\(timestamptz\) FROM PUBLIC, anon, authenticated/);
  });

  it('never tests auth.role() (billing guard rule: current_user = authenticated)', () => {
    expect(sql).not.toMatch(/auth\.role\(\)/);
  });

  it('is additive: no DROP, tables created IF NOT EXISTS', () => {
    for (const f of [TRIGGER_FILE, MONITOR_FILE, CREDIT_FILE]) {
      expect(read(f).replace(/^\s*--.*$/gm, ''), f).not.toMatch(/\bDROP\b/i);
    }
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.billing_free_windows/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.billing_charge_audit/);
  });

  it('mirrors the client promotion windows to the millisecond', () => {
    const promo = readFileSync(join(__dirname, '../../utils/promoUtils.ts'), 'utf8');
    const client = [...promo.matchAll(/new Date\('([^']+)'\)/g)].map((m) => m[1]);
    expect(client).toHaveLength(4);
    for (const iso of client) expect(sql, iso).toContain(`'${iso}'`);
    expect(sql).toMatch(/p_at >= w\.starts_at AND p_at <= w\.ends_at/);
  });

  it('the client still calls consume_token afterwards (idempotent by reference id)', () => {
    const hook = readFileSync(join(__dirname, '../../hooks/useTokenSystem.tsx'), 'utf8');
    expect(hook).toMatch(/\.rpc\('consume_token'/);
  });
});

describe('P1.2 daily coverage monitor (20261028101100)', () => {
  const sql = read(MONITOR_FILE);

  it('compares created worksheets with owner against usage rows per UTC day', () => {
    expect(sql).toMatch(/CREATE OR REPLACE VIEW public\.billing_daily_charge_coverage/);
    expect(sql).toMatch(/w\.status = 'created' AND w\.teacher_id IS NOT NULL/);
    expect(sql).toMatch(/t\.reference_id = w\.id AND t\.transaction_type = 'usage'/);
    expect(sql).toMatch(/AT TIME ZONE 'UTC'/);
  });

  it('excludes anonymous owners, orphan ids and promotion windows', () => {
    expect(sql).toMatch(/u\.id IS NULL OR COALESCE\(u\.is_anonymous, false\)/);
    expect(sql).toMatch(/public\.is_free_generation_window\(w\.created_at\)/);
  });

  it('returns the days below a ratio, default 0.9', () => {
    const fn = fnBody(sql, 'billing_days_below_charge_threshold');
    expect(fn).toMatch(/p_threshold numeric DEFAULT 0\.9/);
    expect(fn).toMatch(/c\.ratio < COALESCE\(p_threshold, 0\.9\)/);
  });

  it('is service role only', () => {
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.billing_daily_charge_coverage FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.billing_days_below_charge_threshold\(integer, numeric\) TO service_role/);
  });
});

describe('Exercise credit, 0.1 token per exercise (20261028101200)', () => {
  const sql = read(CREDIT_FILE);
  const rpc = fnBody(sql, 'consume_exercise_credit');

  it('documents the integer-token design in the header', () => {
    const header = sql.slice(0, sql.indexOf('SET LOCAL'));
    expect(header).toMatch(/INTEGER in production/);
    expect(header).toMatch(/1 unit = 0\.1 token/);
    expect(header).toMatch(/one WHOLE token is charged for every 10 units/);
  });

  it('is a SECURITY DEFINER RPC for authenticated users only', () => {
    expect(rpc).toMatch(/RETURNS jsonb/);
    expect(rpc).toMatch(/SECURITY DEFINER/);
    expect(rpc).toMatch(/SET search_path TO 'public'/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.consume_exercise_credit\(uuid, uuid, text, integer\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.consume_exercise_credit\(uuid, uuid, text, integer\) TO authenticated;/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.consume_exercise_credit\([^)]*\) TO (anon|PUBLIC)/i);
  });

  it('keeps the specified signature and result keys', () => {
    expect(rpc).toMatch(/p_worksheet_id uuid,\s+p_action_ref uuid,\s+p_action text,\s+p_count integer DEFAULT 1/);
    for (const key of ["'charged'", "'tokens_charged'", "'remaining_credit'", "'reason'"]) {
      expect(rpc).toContain(key);
    }
  });

  it('validates that the caller owns the worksheet', () => {
    expect(rpc).toMatch(/auth\.uid\(\)/);
    expect(rpc).toMatch(/w\.teacher_id = v_uid OR w\.user_id = v_uid/);
    expect(rpc).toMatch(/ERRCODE = '42501'/);
  });

  it('is idempotent by action reference and serialised per teacher', () => {
    expect(rpc).toMatch(/ON CONFLICT \(teacher_id, action_ref\) DO NOTHING/);
    expect(rpc).toMatch(/pg_advisory_xact_lock\(hashtextextended\('exercise_credit:'/);
    expect(sql).toMatch(/PRIMARY KEY \(teacher_id, action_ref\)/);
  });

  it('never blocks anonymous users or promotion windows', () => {
    expect(rpc).toMatch(/'anonymous'/);
    expect(rpc).toMatch(/'promo_window'/);
    expect(rpc).toMatch(/public\.is_free_generation_window\(now\(\)\)/);
  });

  it('charges one whole token per 10 units through a service-only helper with a deterministic reference', () => {
    expect(rpc).toMatch(/c_units_per_token CONSTANT integer := 10/);
    expect(rpc).toMatch(/public\.settle_exercise_credit_token\(/);
    expect(rpc).toMatch(/md5\(v_uid::text \|\| ':exercise_credit:'/);
    const helper = fnBody(sql, 'settle_exercise_credit_token');
    expect(helper).toMatch(/is_tokens_frozen/);
    expect(helper).toMatch(/'usage', -1/);
    expect(helper).not.toMatch(/total_worksheets_created|monthly_worksheets_used/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.settle_exercise_credit_token\(uuid, uuid\) FROM PUBLIC, anon, authenticated/);
  });

  it('keeps its tables behind RLS with a service-only policy', () => {
    for (const t of ['exercise_credit_accounts', 'exercise_credit_actions']) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`));
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON TABLE public\\.${t} FROM PUBLIC, anon, authenticated`));
    }
  });

  it('leaves consume_token and consume_token_internal untouched', () => {
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.consume_token/);
  });
});
