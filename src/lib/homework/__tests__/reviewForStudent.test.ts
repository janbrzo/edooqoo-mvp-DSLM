import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import { parseStudentReview } from '../reviewForStudent';

const sql = readFileSync('supabase/migrations/20261028120000_homework_review_for_student.sql', 'utf8');

describe('parseStudentReview', () => {
  it('maps comments and decisions by exercise and question', () => {
    expect(parseStudentReview({
      comments: [{ exercise_index: 0, comment_text: 'Good' }, { exercise_index: 1, comment_text: '   ' }],
      verdicts: { '0': { '1': 'correct', '2': 'wrong', '3': 'maybe' } },
    })).toEqual({ comments: { 0: 'Good' }, verdicts: { 0: { 1: 'correct', 2: 'wrong' } } });
  });

  it('is null before the review (server answer null) and for garbage', () => {
    expect(parseStudentReview(null)).toBeNull();
    expect(parseStudentReview('x')).toBeNull();
  });
});

describe('get_homework_review_by_share_token', () => {
  it('answers only after the review, only for the assigned email, and is not anonymous-open without them', () => {
    expect(sql).toMatch(/v_reviewed IS NULL/);
    expect(sql).toMatch(/lower\(btrim\(v_student_email\)\) <> lower\(btrim\(p_student_email\)\)/);
    expect(sql).toMatch(/RETURN NULL;/);
  });
});
