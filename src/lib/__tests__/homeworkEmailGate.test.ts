import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { hasHomeworkExercises } from '@/lib/homework/exercisesRpc';

const gated = readFileSync('supabase/migrations/20261028100000_homework_exercises_behind_email_gate.sql', 'utf8');
const stripped = readFileSync('supabase/migrations/20261028100100_homework_link_read_without_exercises.sql', 'utf8');
const page = readFileSync('src/pages/HomeworkPage.tsx', 'utf8');

describe('homework exercises behind the email gate', () => {
  it('the gated read needs the owner teacher or the assigned student email', () => {
    expect(gated).toMatch(/auth\.uid\(\) = v_teacher_id/);
    expect(gated).toMatch(/lower\(btrim\(v_student_email\)\) = lower\(btrim\(p_student_email\)\)/);
    expect(gated).toMatch(/v_student_email IS NOT NULL/);
    expect(gated).toMatch(/REVOKE ALL ON FUNCTION public\.get_homework_exercises_by_share_token\(text, text\) FROM PUBLIC;/);
  });

  it('the link-only read keeps exercises, image and audio for the owner teacher only', () => {
    expect(stripped).toMatch(/CASE WHEN o\.is_owner THEN ha\.selected_exercises ELSE '\[\]'::jsonb END/);
    for (const col of ['selected_image', 'selected_audio', 'audio_url']) {
      expect(stripped).toMatch(new RegExp(`CASE WHEN o\\.is_owner THEN w\\.${col} END`));
    }
  });

  it('the student page reads exercises only after the email is verified and drops a stale remembered email', () => {
    expect(page).toContain('fetchHomeworkExercises(token, verifiedEmail)');
    expect(page).toContain("localStorage.removeItem(`homework_email_${token}`)");
    expect(page).toContain("exercisesLoaded ? (verifiedEmail || '') : ''");
  });

  it('knows when the page already holds exercises', () => {
    expect(hasHomeworkExercises([])).toBe(false);
    expect(hasHomeworkExercises(null)).toBe(false);
    expect(hasHomeworkExercises([{ type: 'reading' }])).toBe(true);
  });
});
