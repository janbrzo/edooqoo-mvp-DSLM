/**
 * What the student sees after the teacher sent the review: the per-exercise comments and the
 * teacher's decisions on items the answer key could not judge. Read with the share token and the
 * assigned email, and only once the homework is reviewed (the server answers null before that).
 */
import { supabase } from '@/integrations/supabase/client';
import type { TeacherVerdicts } from '@/lib/answers/teacherVerdicts';

export interface StudentReview {
  comments: Record<number, string>;
  verdicts: Record<number, TeacherVerdicts>;
}

interface RawReview {
  comments?: Array<{ exercise_index: number; comment_text: string }>;
  verdicts?: Record<string, Record<string, string>>;
}

export function parseStudentReview(raw: unknown): StudentReview | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as RawReview;
  const comments: Record<number, string> = {};
  for (const c of r.comments ?? []) {
    if (typeof c?.exercise_index === 'number' && typeof c.comment_text === 'string' && c.comment_text.trim()) {
      comments[c.exercise_index] = c.comment_text;
    }
  }
  const verdicts: Record<number, TeacherVerdicts> = {};
  for (const [ex, byQuestion] of Object.entries(r.verdicts ?? {})) {
    const decided: Record<number, 'correct' | 'wrong'> = {};
    for (const [q, v] of Object.entries(byQuestion ?? {})) {
      if (v === 'correct' || v === 'wrong') decided[Number(q)] = v;
    }
    verdicts[Number(ex)] = decided;
  }
  return { comments, verdicts };
}

export async function fetchStudentReview(token: string, email: string): Promise<StudentReview | null> {
  const { data, error } = await supabase.rpc('get_homework_review_by_share_token', {
    p_share_token: token, p_student_email: email,
  });
  if (error) throw error;
  return parseStudentReview(data);
}
