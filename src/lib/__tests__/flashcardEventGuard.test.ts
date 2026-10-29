import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Flashcards Phase 1, migration A: the flashcard -> DSLM event trigger function is
 * guarded against retries, foreign e-mails, bad CEFR levels and unbounded slugs,
 * and failures are recorded without ever blocking the review save.
 */
const FILE = join(__dirname, '../../../supabase/migrations/20261029120000_flashcard_event_guard.sql');
const sql = readFileSync(FILE, 'utf8');

const fnBody = (name: string): string => {
  const start = sql.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`));
  expect(start).toBeGreaterThanOrEqual(0);
  return sql.slice(start, sql.indexOf('$function$\n;', start));
};

describe('log_flashcard_review_event guard', () => {
  const body = fnBody('log_flashcard_review_event');

  it('keeps SECURITY DEFINER and the pinned search_path', () => {
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path TO 'public'/);
  });

  it('ignores an UPDATE that leaves total_reviews unchanged', () => {
    expect(body).toMatch(/TG_OP = 'UPDATE' AND NEW\.total_reviews IS NOT DISTINCT FROM OLD\.total_reviews/);
  });

  it('keeps the existing event conditions and payload', () => {
    expect(body).toMatch(/NEW\.last_quality_rating IS NOT NULL/);
    expect(body).toMatch(/v_raw_mastery := CASE WHEN NEW\.last_quality_rating >= 2 THEN 100 ELSE 0 END/);
    expect(body).toMatch(/'card_state_mastery', v_state_mastery/);
  });

  it('emits only for the set student e-mail, or when the student has none', () => {
    expect(body).toMatch(/v_student_email IS NULL/);
    expect(body).toMatch(/lower\(btrim\(COALESCE\(NEW\.learner_identifier, ''\)\)\) = lower\(v_student_email\)/);
    expect(body).toMatch(/NULLIF\(btrim\(s\.student_email\), ''\)/);
  });

  it('accepts only A1..C2 as the CEFR level and falls back to A2', () => {
    expect(body).toMatch(/v_cefr_level := upper\(btrim\(COALESCE\(v_cefr_level, ''\)\)\)/);
    expect(body).toMatch(/NOT IN \('A1', 'A2', 'B1', 'B2', 'C1', 'C2'\)/);
    expect(body).toMatch(/v_cefr_level := 'A2'/);
  });

  it('bounds the slug to 60 chars and replaces an empty slug by a hash', () => {
    expect(body).toMatch(/char_length\(v_slug\) > 60/);
    expect(body).toMatch(/left\(v_slug, 60\)/);
    expect(body).toMatch(/v_slug = ''/);
    expect(body).toMatch(/'w' \|\| substr\(md5\(lower\(btrim\(COALESCE\(v_card_front, ''\)\)\)\), 1, 10\)/);
    // the legacy normalisation steps are unchanged
    expect(body).toContain("'[\\s\\-]+', '_', 'g'");
    expect(body).toContain("'[^a-z0-9_]', '', 'g'");
  });

  it('records failures in a nested block and never blocks the save', () => {
    const handler = body.slice(body.indexOf('EXCEPTION'));
    expect(handler).toMatch(/RAISE WARNING 'Failed to log flashcard review event/);
    expect(handler).toMatch(/INSERT INTO public\.flashcard_event_failures/);
    expect(handler).toMatch(/BEGIN[\s\S]*INSERT INTO public\.flashcard_event_failures[\s\S]*EXCEPTION\s+WHEN OTHERS THEN/);
    expect(handler).toMatch(/RETURN NEW;\s*END;\s*$/);
  });

  it('does not redefine the trigger', () => {
    expect(sql).not.toMatch(/CREATE TRIGGER/i);
  });
});

describe('flashcard_event_failures table', () => {
  it('is service-only', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.flashcard_event_failures/);
    expect(sql).toMatch(/ALTER TABLE public\.flashcard_event_failures ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.flashcard_event_failures FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT ALL ON TABLE public\.flashcard_event_failures TO service_role/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    for (const col of ['progress_id', 'card_id', 'set_id', 'learner_identifier', 'sqlstate', 'message', 'created_at']) {
      expect(sql).toContain(col);
    }
  });
});

describe('CEFR allow-list', () => {
  it('adds an idempotent CHECK and validates it only when no row violates it', () => {
    expect(sql).toMatch(/IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint\s+WHERE conname = 'flashcard_cards_cefr_level_check'/);
    expect(sql).toMatch(/CHECK \(cefr_level IS NULL OR cefr_level IN \('A1','A2','B1','B2','C1','C2'\)\) NOT VALID/);
    expect(sql).toMatch(/VALIDATE CONSTRAINT flashcard_cards_cefr_level_check/);
  });

  it('student_add_flashcard_v2 stores only an allowed level, rest unchanged', () => {
    const body = fnBody('student_add_flashcard_v2');
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path TO 'public'/);
    expect(body).toMatch(/v_cefr := upper\(trim\(COALESCE\(p_cefr_level, ''\)\)\)/);
    expect(body).toMatch(/v_cefr := NULL/);
    for (const err of ['empty_card', 'missing_email', 'set_not_found', 'contributions_disabled', 'student_not_authorized']) {
      expect(body).toContain(`'${err}'`);
    }
  });
});

describe('migration hygiene', () => {
  it('has no DROP and no em dash', () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/—|&mdash;/);
  });
});
