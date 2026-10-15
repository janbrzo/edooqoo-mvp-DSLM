import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * W0 hotfix (worksheet + DSLM audit 2026-10): SECURITY DEFINER functions must
 * decide who the caller is. These checks pin the migration text; production is
 * verified separately with has_function_privilege and md5 of the definitions.
 */
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const hotfix = readFileSync(join(MIGRATIONS, '20261015090000_w0_caller_checks_and_token_wrappers.sql'), 'utf8');
const revoke = readFileSync(join(MIGRATIONS, '20261015090100_w0_revoke_legacy_queue_and_notification_rpcs.sql'), 'utf8');

const definition = (sql: string, fn: string): string => {
  const start = sql.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`, 'i'));
  expect(start, `${fn} is defined`).toBeGreaterThan(-1);
  const end = sql.indexOf('$function$;', start);
  return sql.slice(start, end);
};

describe('caller identity is checked inside SECURITY DEFINER functions', () => {
  it('consume_token only charges the signed-in caller', () => {
    expect(definition(hotfix, 'consume_token')).toMatch(/auth\.uid\(\) IS DISTINCT FROM p_teacher_id/);
    expect(hotfix).toMatch(/REVOKE ALL ON FUNCTION public\.consume_token_internal\(uuid, uuid\) FROM PUBLIC, anon, authenticated/);
  });

  it('soft_delete_worksheet rejects another teacher id', () => {
    expect(definition(hotfix, 'soft_delete_worksheet')).toMatch(/auth\.uid\(\) IS DISTINCT FROM p_teacher_id/);
  });

  it('get_worksheet_live_answers returns rows only to the worksheet owner', () => {
    const body = definition(hotfix, 'get_worksheet_live_answers');
    expect(body).toMatch(/w\.teacher_id = auth\.uid\(\) OR w\.user_id = auth\.uid\(\)/);
  });

  it('mark_homework_completed ignores p_user_id for signed-in callers and blocks students', () => {
    const body = definition(hotfix, 'mark_homework_completed');
    expect(body).toMatch(/NOT p_is_teacher/);
    expect(body).toMatch(/ha\.teacher_id/);
    expect(body).toMatch(/mark_homework_completed_internal\(p_homework_id, auth\.uid\(\), TRUE\)/);
    expect(hotfix).toMatch(/REVOKE ALL ON FUNCTION public\.mark_homework_completed\(uuid, uuid, boolean\) FROM PUBLIC, anon/);
  });

  it('teacher comments are readable and writable only by the owning teacher', () => {
    expect(definition(hotfix, 'save_teacher_comment')).toMatch(/ha\.teacher_id = auth\.uid\(\)/);
    expect(definition(hotfix, 'get_homework_comments')).toMatch(/ha\.teacher_id = auth\.uid\(\)/);
    expect(hotfix).toMatch(/REVOKE ALL ON FUNCTION public\.get_homework_comments\(uuid, text\) FROM PUBLIC, anon/);
  });

  it.each([
    ['needs_ai_evaluation_by_share_token', 'has_worksheet_student_access'],
    ['queue_worksheet_ai_evaluation_by_share_token', 'has_worksheet_student_access'],
    ['insert_homework_submission_notification_by_share_token', 'has_homework_student_access'],
  ])('%s checks the share token and the assigned email', (fn, guard) => {
    expect(definition(hotfix, fn)).toMatch(new RegExp(`public\\.${guard}\\(p_share_token`));
  });

  it('the legacy queue and notification RPCs are revoked from client roles in the follow-up', () => {
    for (const fn of ['queue_worksheet_ai_evaluation', 'needs_ai_evaluation', 'insert_homework_submission_notification']) {
      expect(revoke).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated`));
    }
  });
});

describe('Edge Functions authenticate their callers', () => {
  const read = (p: string) => readFileSync(join(__dirname, '../../../supabase/functions', p), 'utf8');

  it('send-homework-reminders does not accept the anon key', () => {
    expect(read('send-homework-reminders/index.ts')).not.toMatch(/anonKey/);
  });

  it('test-send-reminder requires the service role or the owning teacher', () => {
    const src = read('test-send-reminder/index.ts');
    expect(src).toMatch(/resolveCaller\(req\)/);
    expect(src).toMatch(/teacherIdOf\(caller\)/);
  });

  it.each(['send-homework-email/index.ts', 'send-worksheet-email/index.ts'])('%s builds links from APP_BASE_URL', (file) => {
    const src = read(file);
    expect(src).toMatch(/APP_BASE_URL/);
    expect(src).not.toMatch(/headers\.get\("origin"\)/);
    expect(src).not.toMatch(/your-domain\.com/);
  });
});
