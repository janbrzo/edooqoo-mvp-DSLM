/**
 * The exercise snapshot of a homework (answer keys included) is read only behind the email
 * gate: the link-only read gives the verification screen its title and names, and the student
 * gets the exercises by presenting the assigned email with the share token.
 */
import { supabase } from '@/integrations/supabase/client';

export interface HomeworkExercisesPayload {
  selected_exercises: unknown;
  selected_image: unknown;
  selected_audio: unknown;
  audio_url: string | null;
}

/** True when the page already holds exercises (teacher view, or after the gated read). */
export const hasHomeworkExercises = (selected: unknown): boolean =>
  Array.isArray(selected) && selected.length > 0;

/** The exercises for this email, or null when the email does not match the assigned student. */
export async function fetchHomeworkExercises(
  token: string, email: string,
): Promise<HomeworkExercisesPayload | null> {
  const { data, error } = await supabase
    .rpc('get_homework_exercises_by_share_token', { p_share_token: token, p_student_email: email })
    .maybeSingle();
  if (error) throw error;
  if (!data || !hasHomeworkExercises((data as HomeworkExercisesPayload).selected_exercises)) return null;
  return data as HomeworkExercisesPayload;
}
