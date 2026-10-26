import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Homework P0 contract: the server, not the student's browser, owns grading and
 * submit side effects (supabase/AGENTS.md, Answers & Evaluation). The SQL is
 * exercised against production in a rolled-back transaction when it is written;
 * these tests keep the contract from silently regressing.
 */
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const read = (f: string) => readFileSync(join(MIGRATIONS, f), 'utf8');
const hardening = read('20261023090100_homework_p0_server_authority.sql');
const baseline = read('20261023090000_baseline_homework_prod_only_functions.sql');

const bodyOf = (sql: string, fn: string): string => {
  const start = sql.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`));
  expect(start).toBeGreaterThanOrEqual(0);
  return sql.slice(start, sql.indexOf('$function$;', sql.indexOf('AS $function$', start)));
};

describe('baseline of production-only homework functions', () => {
  it.each([
    'generate_homework_share_token', 'verify_homework_student_email',
    'get_homework_by_share_token', 'mark_homework_completed_internal',
    'insert_homework_submission_notification',
  ])('%s is versioned', (fn) => {
    expect(baseline).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`));
  });

  it('keeps the production grants (internal Mark done is service-only, the token mint is not anonymous)', () => {
    expect(baseline).toMatch(/REVOKE ALL ON FUNCTION public\.mark_homework_completed_internal\(uuid, uuid, boolean\) FROM PUBLIC, anon, authenticated/);
    expect(baseline).toMatch(/REVOKE ALL ON FUNCTION public\.generate_homework_share_token\(uuid, uuid\) FROM PUBLIC, anon/);
    expect(baseline).toMatch(/GRANT EXECUTE ON FUNCTION public\.mark_homework_completed_internal\(uuid, uuid, boolean\) TO service_role;/);
  });
});

describe('update_homework_answer_by_share_token', () => {
  const body = bodyOf(hardening, 'update_homework_answer_by_share_token');

  it('writes nothing for a student: grading columns are owner-teacher or service only', () => {
    expect(body).toMatch(/has_homework_student_access\(p_share_token, p_homework_id, p_student_email\)/);
    // The early return for a non-owner comes before the UPDATE.
    const earlyReturn = body.indexOf('RETURN EXISTS');
    expect(earlyReturn).toBeGreaterThan(0);
    expect(earlyReturn).toBeLessThan(body.indexOf('UPDATE public.homework_student_answers'));
    expect(body).toMatch(/ha\.teacher_id = auth\.uid\(\)/);
  });

  it('validates ratings and clamps mastery on the owner path', () => {
    expect(body).toMatch(/sanitize_homework_item_evaluations\(v_exercise, p_item_evaluations\)/);
    expect(body).toMatch(/LEAST\(GREATEST\(p_mastery, 0\), 100\)/);
  });
});

describe('save_homework_answer', () => {
  const body = bodyOf(hardening, 'save_homework_answer');

  it('takes the exercise and its type from the homework snapshot and validates ratings', () => {
    expect(body).toMatch(/v_exercises -> p_exercise_index/);
    expect(body).toMatch(/p_exercise_index < 0/);
    expect(body).toMatch(/sanitize_homework_item_evaluations\(v_exercise, p_item_evaluations\)/);
  });

  it('merges by key instead of replacing the exercise snapshot', () => {
    expect(body).toMatch(/answers = public\.merge_homework_answers\(/);
    expect(body).toMatch(/item_evaluations = public\.merge_homework_item_evaluations\(/);
    expect(body).toMatch(/audio_answers = public\.merge_homework_audio_answers\(/);
    expect(body).toMatch(/time_spent_ms = GREATEST\(/);
    expect(body).not.toMatch(/item_evaluations = EXCLUDED\.item_evaluations/);
  });

  it('still refuses writes once any row of the student is submitted', () => {
    expect(body).toMatch(/hs\.is_submitted = TRUE[\s\S]*RETURN NULL/);
    expect(body).toMatch(/WHERE homework_student_answers\.is_submitted = FALSE/);
  });
});

describe('save_homework_answer_by_share_token', () => {
  it('never lets the owner teacher write the student rows ("View as student")', () => {
    const body = bodyOf(hardening, 'save_homework_answer_by_share_token');
    expect(body).toMatch(/ha\.teacher_id = auth\.uid\(\)[\s\S]*RETURN NULL/);
    expect(body.indexOf('RETURN NULL')).toBeLessThan(body.indexOf('RETURN public.save_homework_answer('));
  });
});

describe('submit_homework_answers', () => {
  const body = bodyOf(hardening, 'submit_homework_answers');

  it('creates the teacher notification and the homework_submitted event itself, idempotently', () => {
    expect(body).toMatch(/insert_homework_submission_notification\(p_homework_id, NULL\)/);
    expect(body).toMatch(/hn\.is_read = FALSE/);
    expect(body).toMatch(/add_student_event_internal\(/);
    expect(body).toMatch(/NOT EXISTS \(\s*SELECT 1 FROM public\.student_events se/);
  });

  it('only fires when rows were actually submitted and never blocks the submit', () => {
    expect(body).toMatch(/v_found AND \(v_rows > 0 OR COALESCE\(v_first, false\)\)/);
    expect(body).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING/);
  });

  it('identifies the student by homework.student_id, not by e-mail', () => {
    expect(body).toMatch(/v_hw\.student_id/);
    expect(body).not.toMatch(/students s[\s\S]*student_email/);
  });

  it('uses no DELETE statement (the SQL tool waits for a manual confirmation on one)', () => {
    expect(hardening).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});

describe('rating helpers are not callable by clients', () => {
  it.each([
    'homework_answer_value_present(jsonb)', 'homework_question_has_answer(jsonb, jsonb, integer)',
    'sanitize_homework_item_evaluations(jsonb, jsonb)', 'merge_homework_answers(jsonb, jsonb)',
    'merge_homework_audio_answers(jsonb, jsonb)', 'merge_homework_item_evaluations(jsonb, jsonb, jsonb, jsonb)',
  ])('%s is service-only', (sig) => {
    const escaped = sig.replace(/[()]/g, '\\$&');
    expect(hardening).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${escaped} FROM PUBLIC, anon, authenticated;`));
  });
});
