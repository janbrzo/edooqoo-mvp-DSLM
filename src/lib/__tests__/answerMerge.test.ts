import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * W2: saving an exercise merges the new answers over the stored ones, so a stale
 * tab cannot erase another tab's keys or the `_transcription_N` keys written by the
 * evaluation queue. The client never deletes a key (clearing stores an empty string).
 */
const sql = readFileSync(join(__dirname, '../../../supabase/migrations/20261016090000_w2_merge_answers_on_save.sql'), 'utf8');

describe('save_worksheet_answer / save_homework_answer merge answers', () => {
  it.each([
    ['worksheet_student_answers', 'save_worksheet_answer'],
    ['homework_student_answers', 'save_homework_answer'],
  ])('%s keeps stored keys that the new map does not send', (table, fn) => {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    expect(start).toBeGreaterThan(-1);
    const body = sql.slice(start, sql.indexOf('$function$;', start));
    expect(body).toContain(`${table}.answers || EXCLUDED.answers`);
    expect(body).not.toMatch(/answers = EXCLUDED\.answers\s*,/);
    // behaviour the merge must not change
    expect(body).toContain('eval_trigger = NULL');
    expect(body).toContain('audio_answers = CASE');
  });

  it('fits one SQL Editor paste and has no SELECT ... INTO', () => {
    expect(Buffer.byteLength(sql)).toBeLessThan(8000);
    expect(sql).not.toMatch(/SELECT[^;]*\bINTO\b/i);
  });

  it('the client clears an answer by storing an empty string, never by deleting the key', () => {
    for (const f of ['src/hooks/useInteractiveSharedWorksheet.tsx', 'src/hooks/useInteractiveHomework.tsx']) {
      const src = readFileSync(join(__dirname, '../../../', f), 'utf8');
      expect(src).not.toMatch(/delete\s+(updated|next|exerciseAnswers)\[/);
    }
  });
});

describe('W2: a submitted homework is locked on the server', () => {
  const lock = readFileSync(join(__dirname, '../../../supabase/migrations/20261016090010_w2_homework_lock_after_submit.sql'), 'utf8');

  it('save_homework_answer updates only rows that are not submitted yet', () => {
    const start = lock.indexOf('CREATE OR REPLACE FUNCTION public.save_homework_answer(');
    const body = lock.slice(start, lock.indexOf('$function$;', start));
    expect(body).toMatch(/WHERE homework_student_answers\.is_submitted = FALSE\s+RETURNING/);
    expect(body).toContain('homework_student_answers.answers || EXCLUDED.answers');
  });

  it('save_homework_answer also refuses a new exercise row after a submit', () => {
    const start = lock.indexOf('CREATE OR REPLACE FUNCTION public.save_homework_answer(');
    const body = lock.slice(start, lock.indexOf('$function$;', start));
    expect(body).toMatch(/IF EXISTS \([\s\S]*hs\.is_submitted = TRUE[\s\S]*RETURN NULL;/);
    expect(body.indexOf('RETURN NULL')).toBeLessThan(body.indexOf('INSERT INTO public.homework_student_answers'));
  });

  it('submit_homework_answers keeps the first completion date', () => {
    expect(lock).toContain('completed_at = COALESCE(completed_at, NOW())');
  });

  it('fits one SQL Editor paste and has no SELECT ... INTO', () => {
    expect(Buffer.byteLength(lock)).toBeLessThan(8000);
    expect(lock).not.toMatch(/SELECT[^;]*\bINTO\b/i);
  });

  it('the post-submit AI phase does not rely on save_homework_answer', () => {
    const hook = readFileSync(join(__dirname, '../../../src/hooks/useInteractiveHomework.tsx'), 'utf8');
    const afterSubmit = hook.slice(hook.indexOf('await submitHomeworkAnswers('));
    expect(afterSubmit).not.toMatch(/callStudentAnswerRpc\('save_homework_answer'/);
  });
});
