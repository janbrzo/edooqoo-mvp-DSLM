import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Flashcard audit findings F-9, F-11, F-12 (decision D-4 option B): source-level checks of
 * 20261029090100_flashcard_security_guards.sql. Runtime behaviour is verified in production after applying.
 */
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const FILE = '20261029090100_flashcard_security_guards.sql';
const sql = existsSync(join(MIGRATIONS, FILE)) ? readFileSync(join(MIGRATIONS, FILE), 'utf8') : '';

const fnBody = (name: string): string => {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('$function$;', sql.indexOf('AS $function$', start) + 14);
  return sql.slice(start, end);
};

describe('flashcard security guards migration', () => {
  it('exists and is the newest migration touching these functions', () => {
    expect(sql.length).toBeGreaterThan(0);
    const later = readdirSync(MIGRATIONS).filter((f) => f > FILE && /generate_flashcard_share_token|soft_delete_flashcard_set/.test(readFileSync(join(MIGRATIONS, f), 'utf8')));
    expect(later).toEqual([]);
  });

  it('has no destructive statements, no em dash and no apostrophes in comments', () => {
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE)\b/i);
    expect(sql).not.toContain(String.fromCharCode(0x2014));
    for (const line of sql.split('\n')) if (/^\s*--/.test(line)) expect(line).not.toContain("'");
  });

  it.each([
    ['generate_flashcard_share_token', "SET search_path TO 'public', 'extensions'"],
    ['soft_delete_flashcard_set', "SET search_path TO 'public'"],
    ['backfill_skill_metrics', "SET search_path TO 'public'"],
    ['get_flashcard_set_by_share_token', "SET search_path TO 'public'"],
    ['get_flashcard_cards_by_share_token', "SET search_path TO 'public'"],
  ])('%s stays SECURITY DEFINER with a pinned search_path', (fn, sp) => {
    const body = fnBody(fn);
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toContain(sp);
  });

  it('keeps the exact signatures', () => {
    expect(sql).toContain('generate_flashcard_share_token(p_set_id uuid, p_teacher_id uuid, p_expires_hours integer DEFAULT 8760)');
    expect(sql).toContain('soft_delete_flashcard_set(p_set_id uuid, p_teacher_id uuid)');
    expect(sql).toContain('backfill_skill_metrics(p_student_id uuid DEFAULT NULL::uuid)');
  });

  it.each(['generate_flashcard_share_token', 'soft_delete_flashcard_set'])('%s rejects a foreign p_teacher_id but allows the service role', (fn) => {
    const body = fnBody(fn);
    expect(body).toMatch(/IF auth\.uid\(\) IS NOT NULL AND p_teacher_id IS DISTINCT FROM auth\.uid\(\) THEN\s+RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'/);
    expect(body.indexOf('auth.uid()')).toBeLessThan(body.indexOf('UPDATE public.flashcard_sets'));
  });

  it('new share tokens always expire after one year (D-4 option B), token format unchanged', () => {
    const body = fnBody('generate_flashcard_share_token');
    expect(body).toMatch(/share_expires_at = NOW\(\) \+ interval '1 year'/);
    expect(body).not.toMatch(/p_expires_hours \|\|/);
    expect(body).toContain("encode(extensions.gen_random_bytes(32), 'hex')");
  });

  it('backfill_skill_metrics requires ownership and a student id for signed-in callers, and is revoked from client roles', () => {
    const body = fnBody('backfill_skill_metrics');
    expect(body).toMatch(/IF auth\.uid\(\) IS NOT NULL THEN\s+IF p_student_id IS NULL THEN\s+RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'/);
    expect(body).toMatch(/s\.id = p_student_id AND s\.teacher_id = auth\.uid\(\)/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.backfill_skill_metrics\(uuid\) FROM PUBLIC, anon, authenticated;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.backfill_skill_metrics\(uuid\) TO service_role;/);
  });

  it('no client code calls backfill_skill_metrics (the revoke is safe)', () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
    const callers = [...walk(join(__dirname, '../..')), ...walk(join(__dirname, '../../../supabase/functions'))]
      .filter((p) => /\.(tsx?|mjs|js)$/.test(p) && !p.endsWith('types.ts') && !p.includes('__tests__'))
      .filter((p) => readFileSync(p, 'utf8').includes('backfill_skill_metrics'));
    expect(callers).toEqual([]);
  });

  it.each(['get_flashcard_set_by_share_token', 'get_flashcard_cards_by_share_token'])('%s enforces expiry and deleted_at', (fn) => {
    const body = fnBody(fn);
    expect(body).toMatch(/\(\w+\.share_expires_at IS NULL OR \w+\.share_expires_at > now\(\)\)/);
    expect(body).toMatch(/\w+\.deleted_at IS NULL/);
  });

  it('keeps the return columns of the token RPCs, including teacher_email', () => {
    expect(fnBody('get_flashcard_set_by_share_token')).toContain('RETURNS TABLE(id uuid, title text, description text, is_bidirectional boolean, student_name text, student_native_language text, teacher_first_name text, teacher_last_name text, teacher_email text, cards_count bigint, created_at timestamp with time zone)');
    expect(fnBody('get_flashcard_cards_by_share_token')).toContain('RETURNS TABLE(id uuid, set_id uuid, front_text text, back_text text, front_example text, cefr_level text, source_type text, created_by_student boolean, card_position integer, created_at timestamp with time zone)');
  });

  it('does not redefine Phase 1 objects or triggers', () => {
    for (const fn of ['save_flashcard_progress', 'get_flashcard_cards_for_learning', 'compute_skill_metric']) {
      expect(sql).not.toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    }
    expect(sql).not.toMatch(/CREATE (OR REPLACE )?TRIGGER/);
  });
});
