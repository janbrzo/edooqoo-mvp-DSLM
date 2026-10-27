import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Homework P1.2 contract: the assignment (completed_at), not the answer rows,
 * decides whether a homework is open; Mark done is idempotent and terminal.
 */
const sql = readFileSync(join(__dirname, '../../../supabase/migrations/20261027090000_homework_p1_lifecycle.sql'), 'utf8');
const bodyOf = (fn: string): string => {
  const start = sql.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`));
  expect(start).toBeGreaterThanOrEqual(0);
  return sql.slice(start, sql.indexOf('$function$;', sql.indexOf('AS $function$', start)));
};

describe('assignment-level lock', () => {
  it('save_homework_answer refuses a completed assignment', () => {
    const body = bodyOf('save_homework_answer');
    expect(body).toMatch(/ha\.completed_at INTO v_exercises, v_completed/);
    expect(body).toMatch(/IF v_completed IS NOT NULL THEN\s+RETURN NULL;/);
  });

  it('submit_homework_answers refuses a teacher-closed homework with the homework_closed message', () => {
    const body = bodyOf('submit_homework_answers');
    expect(body).toMatch(/IF v_closed THEN\s+RAISE EXCEPTION 'homework_closed/);
    expect(body.indexOf('homework_closed')).toBeLessThan(body.indexOf('UPDATE public.homework_student_answers'));
  });
});

describe('mark_homework_completed_internal', () => {
  const body = bodyOf('mark_homework_completed_internal');

  it('keeps the first completion and never turns a student return into a teacher close', () => {
    expect(body).toMatch(/IF p_is_teacher AND v_homework\.completed_at IS NOT NULL THEN[\s\S]*'already_completed', true/);
    expect(body.indexOf("'already_completed'")).toBeLessThan(body.indexOf('UPDATE public.homework_assignments'));
  });

  it('closes homework whose student was removed (LEFT JOIN, not JOIN)', () => {
    expect(body).toMatch(/LEFT JOIN public\.students s ON ha\.student_id = s\.id/);
    expect(body).not.toMatch(/\bJOIN public\.students s ON ha\.student_id = s\.id\s+WHERE[\s\S]*\bJOIN public\.students/);
  });
});

describe('reopen_homework', () => {
  const body = bodyOf('reopen_homework');

  it('is owner-only and reopens only a teacher close', () => {
    expect(body).toMatch(/v_hw\.teacher_id IS DISTINCT FROM auth\.uid\(\)/);
    expect(body).toMatch(/COALESCE\(v_hw\.completed_by_teacher, false\) IS NOT TRUE/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.reopen_homework\(uuid\) FROM PUBLIC, anon;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.reopen_homework\(uuid\) TO authenticated, service_role;/);
  });
});

describe('state read', () => {
  it('get_homework_state_by_share_token adds completed_by_teacher and is share-token scoped', () => {
    const body = bodyOf('get_homework_state_by_share_token');
    expect(body).toMatch(/COALESCE\(h\.completed_by_teacher, false\)/);
    expect(body).toMatch(/WHERE h\.share_token = p_share_token/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_homework_state_by_share_token\(text\) TO anon, authenticated, service_role;/);
  });
});

describe('migration hygiene', () => {
  it('uses no DELETE or DROP statement (the SQL tool waits for a manual confirmation on one)', () => {
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bDROP\s+(FUNCTION|TRIGGER|TABLE|POLICY)\b/i);
  });
});
