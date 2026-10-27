/**
 * Teacher thumbs on AI-scored items (existing table `teacher_ai_eval_feedback`,
 * RLS "Teachers can manage own feedback"). The table has no unique key, so one
 * vote per (teacher, worksheet, exercise, question) is kept by update-or-insert.
 * `feedback_text` written by the Live Session modal is never touched here.
 */
import { supabase } from '@/integrations/supabase/client';

export interface ThumbKey {
  teacherId: string;
  worksheetId: string;
  exerciseIndex: number;
  questionIndex: number;
}

/** Minimal slice of the supabase client used here (injectable for tests). */
export interface ThumbClient {
  from: (table: string) => any;
}

const TABLE = 'teacher_ai_eval_feedback';
const defaultClient = (): ThumbClient => supabase as unknown as ThumbClient;

/** question_index -> thumbs_up for one exercise. Errors give an empty map. */
export async function fetchThumbVotes(
  key: Omit<ThumbKey, 'questionIndex'>,
  client: ThumbClient = defaultClient(),
): Promise<Record<number, boolean>> {
  try {
    const { data, error } = await client
      .from(TABLE)
      .select('question_index, thumbs_up, created_at')
      .eq('teacher_id', key.teacherId)
      .eq('worksheet_id', key.worksheetId)
      .eq('exercise_index', key.exerciseIndex)
      .order('created_at', { ascending: true });
    if (error || !Array.isArray(data)) return {};
    const out: Record<number, boolean> = {};
    for (const r of data as Array<{ question_index: number; thumbs_up: boolean }>) out[r.question_index] = !!r.thumbs_up; // latest wins
    return out;
  } catch {
    return {};
  }
}

/** Stores the vote; returns an error message or null. Scores are 0-1 like the Live Session badge. */
export async function saveThumbVote(
  key: ThumbKey,
  vote: { thumbsUp: boolean; exerciseType: string; qualityScore: number | null },
  client: ThumbClient = defaultClient(),
): Promise<string | null> {
  try {
    const match = {
      teacher_id: key.teacherId,
      worksheet_id: key.worksheetId,
      exercise_index: key.exerciseIndex,
      question_index: key.questionIndex,
    };
    const { data: existing, error: selErr } = await client.from(TABLE).select('id').match(match).limit(1);
    if (selErr) return selErr.message || 'Could not save feedback';
    const row = { thumbs_up: vote.thumbsUp, exercise_type: vote.exerciseType, quality_score: vote.qualityScore };
    const id = Array.isArray(existing) && existing[0]?.id;
    const { error } = id
      ? await client.from(TABLE).update(row).eq('id', id)
      : await client.from(TABLE).insert({ ...match, ...row });
    return error ? error.message || 'Could not save feedback' : null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Could not save feedback';
  }
}
