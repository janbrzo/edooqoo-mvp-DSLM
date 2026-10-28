import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261028150000_homework_redo.sql', 'utf8');
const review = readFileSync('src/pages/HomeworkReviewPage.tsx', 'utf8');

describe('homework redo', () => {
  it('is owner-only and only for a homework the student returned', () => {
    expect(sql).toMatch(/v_hw\.teacher_id IS DISTINCT FROM auth\.uid\(\)/);
    expect(sql).toMatch(/v_hw\.completed_at IS NULL OR v_hw\.by_teacher/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.request_homework_redo\(uuid\) FROM PUBLIC, anon/);
  });

  it('archives the returned attempt before it resets anything', () => {
    const archive = sql.indexOf('INSERT INTO public.homework_attempts');
    const reset = sql.indexOf("SET answers = '{}'::jsonb");
    expect(archive).toBeGreaterThan(0);
    expect(reset).toBeGreaterThan(archive);
    expect(sql).toMatch(/attempt = v_hw\.attempt \+ 1/);
    expect(sql).toMatch(/reviewed_at = NULL/);
  });

  it('the archive is readable only by the homework teacher', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ha\.teacher_id = auth\.uid\(\)/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.homework_attempts FROM PUBLIC, anon/);
  });

  it('the review page offers it behind a confirmation', () => {
    expect(review).toMatch(/requestHomeworkRedo\(homework\.id\)/);
    expect(review).toMatch(/Let the student do this homework again\?/);
  });
});

describe('homework redo notification', () => {
  const follow = readFileSync('supabase/migrations/20261028160000_homework_redo_settles_notification.sql', 'utf8');
  it('settles the old completed notification so the second return notifies the teacher again', () => {
    expect(follow).toMatch(/UPDATE public\.homework_notifications SET is_read = true/);
    expect(follow).toMatch(/notification_type = 'completed' AND is_read = false/);
  });
});
