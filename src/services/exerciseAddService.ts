import { supabase } from '@/integrations/supabase/client';
import { updateWorksheetAPI } from '@/services/worksheetService/updateService';
import { isValidExerciseId } from '@/lib/exerciseTaxonomy';

/** Longest free-text instruction sent with an add request. */
export const MAX_ADDITIONAL_INSTRUCTIONS_LENGTH = 500;
/** Most active exercises a worksheet can hold. */
export const MAX_EXERCISES_PER_WORKSHEET = 12;

export interface AddExerciseRequest {
  exerciseType: string;
  additionalInstructions?: string;
  formData: Record<string, unknown> | null | undefined;
  userId: string;
}

/**
 * One call per user action: asking the engine for a single exercise. Any
 * per-exercise charging decided later belongs here (and in the matching
 * regeneration function), not in the UI.
 */
export async function requestNewExercise({ exerciseType, additionalInstructions, formData, userId }: AddExerciseRequest) {
  if (!isValidExerciseId(exerciseType)) {
    throw new Error('Unknown exercise type');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again to add an exercise');

  const instructions = (additionalInstructions ?? '').trim().slice(0, MAX_ADDITIONAL_INSTRUCTIONS_LENGTH);
  const topic = typeof formData?.lessonTopic === 'string' && formData.lessonTopic ? formData.lessonTopic : 'General English';
  const level = typeof formData?.englishLevel === 'string' && formData.englishLevel ? formData.englishLevel : 'B1';
  const grammar =
    typeof formData?.teachingPreferences === 'string' && formData.teachingPreferences.trim()
      ? `Grammar focus: ${formData.teachingPreferences}.`
      : '';

  const prompt = `Generate a single ${exerciseType} exercise for the topic: ${topic}.
Level: ${level}.
${grammar}
${instructions ? `Additional instructions: ${instructions}` : ''}`;

  const response = await supabase.functions.invoke('generateWorksheet', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {
      prompt,
      formData: {
        ...formData,
        targetExerciseTypes: [exerciseType],
        exerciseCountPerType: 1,
      },
      userId,
      isBatchGeneration: true,
    },
  });

  if (response.error) throw new Error(response.error.message || 'Generation failed');

  const newExercise = response.data?.exercises?.[0];
  if (!newExercise) throw new Error('No exercise was generated');
  return newExercise as Record<string, unknown> & { title?: string };
}

/** Number of exercises a teacher can see (soft-deleted ones do not count). */
export function countActiveExercises(worksheet: { exercises?: Array<{ deleted?: boolean }> } | null | undefined): number {
  return (worksheet?.exercises ?? []).filter((exercise) => !exercise.deleted).length;
}

/** Returns the worksheet with the new exercise appended and numbered after the active ones. */
export function appendExercise<W extends { exercises?: unknown[] }>(
  worksheet: W,
  newExercise: Record<string, unknown> & { title?: string },
  fallbackLabel: string,
): W {
  const number = countActiveExercises(worksheet as { exercises?: Array<{ deleted?: boolean }> }) + 1;
  const cleanTitle = (newExercise.title ?? '').replace(/^Exercise\s+\d+:\s*/i, '') || fallbackLabel;
  const exercise = { ...newExercise, title: `Exercise ${number}: ${cleanTitle}` };
  return { ...worksheet, exercises: [...(worksheet.exercises ?? []), exercise] };
}

/** Persists through the single worksheet write path (keeps ai_response, html_content and title in sync). */
export async function persistAddedExercise(worksheetId: string, worksheet: unknown, userId: string) {
  return updateWorksheetAPI(worksheetId, worksheet, userId);
}
