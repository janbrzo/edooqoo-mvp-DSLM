import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Flashcards Phase 1 migration B (audit findings F-3, F-4, F-5, F-6, F-10, decision D-2 option B): source-level checks of
 * 20261029120100_flashcard_learning_by_token.sql. Runtime behaviour was verified on a scratch Postgres and is verified
 * again in production after applying.
 */
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const FILE = '20261029120100_flashcard_learning_by_token.sql';
const sql = existsSync(join(MIGRATIONS, FILE)) ? readFileSync(join(MIGRATIONS, FILE), 'utf8') : '';

const fnBody = (name: string): string => {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('$function$;', sql.indexOf('AS $function$', start) + 14);
  return sql.slice(start, end);
};

describe('flashcard learning by token migration', () => {
  it('exists and defines the three functions with new names', () => {
    expect(sql.length).toBeGreaterThan(0);
    for (const fn of ['flashcard_resolve_learning_access', 'get_flashcard_learning_cards_by_token', 'save_flashcard_review_by_token']) {
      expect(sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`, 'g'))).toHaveLength(1);
    }
  });

  it('has no destructive statements, no em dash and no apostrophes in comments', () => {
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE)\b/i);
    expect(sql).not.toContain(String.fromCharCode(0x2014));
    for (const line of sql.split('\n')) if (/^\s*--/.test(line)) expect(line).not.toContain("'");
  });

  it.each(['flashcard_resolve_learning_access', 'get_flashcard_learning_cards_by_token', 'save_flashcard_review_by_token'])(
    '%s is SECURITY DEFINER with a pinned search_path',
    (fn) => {
      const body = fnBody(fn);
      expect(body).toMatch(/SECURITY DEFINER/);
      expect(body).toContain("SET search_path TO 'public'");
    },
  );

  it('keeps the contract signatures and return columns', () => {
    expect(sql).toContain('get_flashcard_learning_cards_by_token(p_share_token text, p_email text)');
    for (const c of ['card_id uuid', 'card_position integer', 'front_text text', 'back_text text', 'front_example text', 'cefr_level text', 'back_type text', 'is_bidirectional boolean']) {
      expect(fnBody('get_flashcard_learning_cards_by_token')).toContain(c);
    }
    for (const d of ['d1', 'd2']) {
      for (const c of ['easiness_factor numeric', 'repetition integer', 'interval_days integer', 'next_review_date timestamp with time zone', 'total_reviews integer', 'correct_count integer', 'incorrect_count integer']) {
        expect(fnBody('get_flashcard_learning_cards_by_token')).toContain(`${d}_${c}`);
      }
    }
    expect(sql).toMatch(/save_flashcard_review_by_token\(\s*p_share_token text, p_email text, p_card_id uuid, p_direction integer, p_quality integer,\s*p_response_time_ms integer DEFAULT NULL\)/);
    expect(sql).toMatch(/RETURNS TABLE\(\s*counted boolean, easiness_factor numeric, repetition integer, interval_days integer,\s*next_review_date timestamp with time zone, total_reviews integer, correct_count integer, incorrect_count integer\)/);
  });

  it('grants the client RPCs to anon, authenticated and service_role only, and keeps the helper private', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_flashcard_learning_cards_by_token\(text, text\) FROM PUBLIC;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_flashcard_learning_cards_by_token\(text, text\) TO anon, authenticated, service_role;/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.save_flashcard_review_by_token\(text, text, uuid, integer, integer, integer\) FROM PUBLIC;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.save_flashcard_review_by_token\(text, text, uuid, integer, integer, integer\) TO anon, authenticated, service_role;/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.flashcard_resolve_learning_access\(text, text\) FROM PUBLIC, anon, authenticated;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.flashcard_resolve_learning_access\(text, text\) TO service_role;/);
  });

  it('access rule: token, expiry, deleted_at, normalised e-mail and invalid_access', () => {
    const body = fnBody('flashcard_resolve_learning_access');
    expect(body).toContain('lower(btrim(p_email))');
    expect(body).toMatch(/char_length\(v_email\) < 3 OR char_length\(v_email\) > 254/);
    expect(body).toContain("position('@' IN v_email) = 0");
    expect(body).toContain("[[:space:][:cntrl:]]");
    expect(body).toContain('fs.share_token = p_share_token');
    expect(body).toContain('fs.deleted_at IS NULL');
    expect(body).toContain('fs.share_expires_at IS NULL OR fs.share_expires_at > now()');
    expect(body.match(/RAISE EXCEPTION 'invalid_access' USING ERRCODE = 'P0001'/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it.each(['get_flashcard_learning_cards_by_token', 'save_flashcard_review_by_token'])('%s goes through the access helper', (fn) => {
    expect(fnBody(fn)).toContain('public.flashcard_resolve_learning_access(p_share_token, p_email)');
  });

  it('get returns live cards ordered by position and joins progress per direction on the normalised e-mail', () => {
    const body = fnBody('get_flashcard_learning_cards_by_token');
    expect(body).toContain('fc.deleted_at IS NULL');
    expect(body).toContain('fc.set_id = v_set_id');
    expect(body).toContain('ORDER BY fc.card_position');
    expect(body).toContain('fp.direction = 1');
    expect(body).toContain('fp.direction = 2');
    expect(body.match(/lower\(btrim\(fp\.learner_identifier\)\) = v_email/g)).toHaveLength(2);
    expect(body).toContain('COALESCE(p1.easiness_factor, 2.5)');
    expect(body).toContain('p1.next_review_date');
  });

  it('save validates direction, quality, card and clamps the response time', () => {
    const body = fnBody('save_flashcard_review_by_token');
    expect(body).toContain('p_direction NOT IN (1, 2)');
    expect(body).toMatch(/p_direction = 2 AND NOT v_bidirectional/);
    expect(body).toContain('p_quality NOT IN (0, 2)');
    expect(body).toMatch(/c\.id = p_card_id AND c\.set_id = v_set_id AND c\.deleted_at IS NULL/);
    expect(body).toContain('least(greatest(p_response_time_ms, 0), 600000)');
    expect(body.indexOf('flashcard_resolve_learning_access')).toBeLessThan(body.indexOf('p_direction NOT IN'));
  });

  it('save takes no SRS numbers from the client', () => {
    const sig = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.save_flashcard_review_by_token('), sql.indexOf('RETURNS TABLE(', sql.indexOf('CREATE OR REPLACE FUNCTION public.save_flashcard_review_by_token(')));
    expect(sig).not.toMatch(/p_(easiness|repetition|interval|next_review|total|correct|incorrect)/);
  });

  it('practice branch (next_review_date in the future) returns the stored state and writes nothing', () => {
    const body = fnBody('save_flashcard_review_by_token');
    const practice = body.indexOf('v_row.next_review_date > now()');
    expect(practice).toBeGreaterThan(0);
    const branchEnd = body.indexOf('RETURN;', practice);
    const branch = body.slice(practice, branchEnd);
    expect(branch).toContain('RETURN QUERY SELECT false');
    expect(branch).not.toMatch(/\b(INSERT|UPDATE)\b/);
    expect(body.indexOf('UPDATE public.flashcard_progress')).toBeGreaterThan(branchEnd);
    expect(body.indexOf('INSERT INTO public.flashcard_progress')).toBeGreaterThan(branchEnd);
  });

  it('SM-2 constants match the client formula', () => {
    const body = fnBody('save_flashcard_review_by_token');
    expect(body).toContain('IF p_quality < 2 THEN');
    expect(body).toMatch(/v_new_rep := 0;\s+v_new_interval := 1;/);
    expect(body).toContain('WHEN v_rep = 0 THEN 1 WHEN v_rep = 1 THEN 6 ELSE round(v_interval * v_ef)::integer');
    expect(body).toContain('greatest(1.3, v_ef + (0.1 - (3 - p_quality) * (0.08 + (3 - p_quality) * 0.02)))');
    expect(body).toContain('2.5');
    expect(body).toContain("date_trunc('day', now() AT TIME ZONE 'UTC') + v_new_interval * interval '1 day') AT TIME ZONE 'UTC'");
  });

  it('scheduled review counts, stores the normalised learner and sets quality, response time and last_reviewed_at', () => {
    const body = fnBody('save_flashcard_review_by_token');
    expect(body).toContain('learner_identifier = v_email');
    expect(body).toContain('COALESCE(fp.total_reviews, 0) + 1');
    expect(body).toContain('last_quality_rating = p_quality');
    expect(body).toContain('last_response_time_ms = v_response_ms');
    expect(body).toContain('last_reviewed_at = now()');
    expect(body).toContain('RETURN QUERY SELECT true');
  });

  it('is concurrency safe: advisory lock, FOR UPDATE and the real unique key', () => {
    const body = fnBody('save_flashcard_review_by_token');
    expect(body).toContain('pg_advisory_xact_lock(');
    expect(body).toMatch(/lower\(btrim\(fp\.learner_identifier\)\) = v_email[\s\S]*FOR UPDATE/);
    expect(body).toContain('ON CONFLICT (card_id, learner_identifier, direction) DO UPDATE');
  });

  it('is the newest migration touching these functions and the old RPCs are not changed here', () => {
    const later = readdirSync(MIGRATIONS).filter(
      (f) => f > FILE && /get_flashcard_learning_cards_by_token|save_flashcard_review_by_token/.test(readFileSync(join(MIGRATIONS, f), 'utf8')),
    );
    expect(later).toEqual([]);
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.(save_flashcard_progress|get_flashcard_cards_for_learning)\(/);
  });
});
