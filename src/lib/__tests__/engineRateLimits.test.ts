import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Phase 2 / step 4b (P2.5): DB-backed engine rate limiter and balance pre-check.
 * Source assertions on the migration (same pattern as billingServerCharge.test.ts).
 */
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const FILE = '20261029100000_engine_rate_limits.sql';
const sql = readFileSync(join(MIGRATIONS, FILE), 'utf8');
const TRIGGER = readFileSync(join(MIGRATIONS, '20261028101000_billing_server_charge_trigger.sql'), 'utf8');

const fnBody = (src: string, name: string): string => {
  const start = src.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`, 'i'));
  expect(start, `${name} defined`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf('$function$', start);
  return src.slice(start, src.indexOf('$function$', open + 10));
};

describe('engine rate limit migration', () => {
  it('is additive: no DROP or destructive statement outside the rollback comment', () => {
    const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(code).not.toMatch(/\bDROP\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b|\bALTER TABLE public\.(worksheets|profiles)/i);
    expect(sql).toMatch(/PROBLEM:/);
    expect(sql).toMatch(/SOLUTION/);
    expect(sql).toMatch(/ROLLBACK/);
  });

  it('keeps the counter table service-only behind RLS', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.engine_rate_limits/);
    expect(sql).toMatch(/ALTER TABLE public\.engine_rate_limits ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/FOR ALL TO service_role USING \(true\) WITH CHECK \(true\)/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.engine_rate_limits FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/PRIMARY KEY \(key, bucket\)/);
  });

  it('consume_engine_rate_limit is atomic, SECURITY DEFINER and returns allowed/remaining/retry_after_seconds', () => {
    const fn = fnBody(sql, 'consume_engine_rate_limit');
    expect(fn).toMatch(/RETURNS jsonb/);
    expect(fn).toMatch(/SECURITY DEFINER/);
    expect(fn).toMatch(/SET search_path TO 'public'/);
    expect(fn).toMatch(/ON CONFLICT \(key, bucket\) DO UPDATE/);
    // a denied call must not move the counter: the DO UPDATE only runs for an expired or non-full window
    expect(fn).toMatch(/WHERE t\.window_started_at \+ v_window <= v_now OR t\.request_count < p_limit/);
    expect(fn).not.toMatch(/FOR UPDATE;/);
    for (const key of ['allowed', 'remaining', 'retry_after_seconds']) expect(fn).toContain(`'${key}'`);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.consume_engine_rate_limit\(text, text, integer, integer\) FROM PUBLIC, anon, authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.consume_engine_rate_limit\(text, text, integer, integer\) TO service_role/,
    );
  });

  it('provides a cleanup function (not a cron job) for old counters', () => {
    const fn = fnBody(sql, 'cleanup_engine_rate_limits');
    expect(fn).toMatch(/DELETE FROM public\.engine_rate_limits/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.cleanup_engine_rate_limits\(integer\) TO service_role/);
    const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(code).not.toMatch(/cron\.schedule/);
  });

  it('engine_pre_check is read-only, service-only and mirrors consume_token_internal and the trigger', () => {
    const fn = fnBody(sql, 'engine_pre_check');
    expect(fn).toMatch(/STABLE/);
    expect(fn).toMatch(/SECURITY DEFINER/);
    expect(fn).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.engine_pre_check\(uuid\) TO service_role/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.engine_pre_check\(uuid\) FROM PUBLIC, anon, authenticated/);
    for (const key of ['allowed', 'reason', 'available_tokens', 'frozen']) expect(fn).toContain(`'${key}'`);

    // same skips and the same window as charge_worksheet_on_insert
    expect(TRIGGER).toMatch(/IF v_exists IS NOT TRUE OR v_anonymous THEN/);
    expect(fn).toMatch(/v_exists IS NOT TRUE/);
    expect(fn).toMatch(/IF v_anonymous THEN/);
    expect(fn).toMatch(/public\.is_free_generation_window\(now\(\)\)/);

    // same decision order and conditions as consume_token_internal (frozen, monthly room, tokens)
    const frozen = fn.indexOf('IF v_frozen THEN');
    const monthly = fn.indexOf('v_monthly_limit > 0 AND v_monthly_used < v_monthly_limit');
    const tokens = fn.indexOf('v_available > 0');
    expect(frozen).toBeGreaterThan(0);
    expect(monthly).toBeGreaterThan(frozen);
    expect(tokens).toBeGreaterThan(monthly);
    expect(fn).toMatch(/'insufficient_tokens'/);
    expect(fn).toMatch(/'tokens_frozen'/);
  });
});
