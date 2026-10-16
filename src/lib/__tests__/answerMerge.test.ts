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
