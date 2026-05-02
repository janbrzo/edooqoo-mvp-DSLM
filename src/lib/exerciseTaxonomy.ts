/**
 * Single source of truth for exercise IDs across the app.
 * MUST stay in sync with `supabase/functions/_shared/exerciseTaxonomy.ts`.
 * IDs here MUST match those rendered by `WorksheetForm/ExerciseSelector.tsx`.
 *
 * v4.2: `sentence-transformation` removed — currently disabled (coming-soon) in UI.
 * Re-add when the exercise type is fully available end-to-end.
 */

export const NO_MEDIA_EXERCISE_IDS = [
  'reading',
  'fill-in-blanks',
  'multiple-choice',
  'true-false',
  'matching',
  'dialogue',
  'answer-questions',
  'discussion',
  'error-correction',
  'odd-one-out',
  'matching-halves',
  'word-order',
  'gap-text',
  'negative-prefixes',
  'categorize',
  'paraphrasing',
  'complete-word',
  'synonyms',
  'antonyms',
] as const;

export const PICTURE_EXERCISE_IDS = [
  'describe-picture',
  'answer-questions-picture',
  'true-false-picture',
  'multiple-choice-picture',
] as const;

export const AUDIO_EXERCISE_IDS = [
  'listening-comprehension',
  'answer-questions-audio',
  'true-false-audio',
  'multiple-choice-audio',
  'fill-in-blanks-audio',
] as const;

export const ALL_EXERCISE_IDS = [
  ...NO_MEDIA_EXERCISE_IDS,
  ...PICTURE_EXERCISE_IDS,
  ...AUDIO_EXERCISE_IDS,
] as const;

export type ExerciseId = typeof ALL_EXERCISE_IDS[number];

export const isValidExerciseId = (id: string): id is ExerciseId =>
  (ALL_EXERCISE_IDS as readonly string[]).includes(id);

/**
 * Human-readable labels for the Edit dialog picker.
 * Keep concise — used as checkbox labels in a 2-col grid.
 */
export const EXERCISE_LABELS: Record<string, string> = {
  reading: 'Reading',
  'fill-in-blanks': 'Fill in blanks',
  'multiple-choice': 'Multiple choice',
  'true-false': 'True / False',
  matching: 'Matching',
  dialogue: 'Dialogue',
  'answer-questions': 'Answer questions',
  discussion: 'Discussion',
  'error-correction': 'Error correction',
  'odd-one-out': 'Odd one out',
  'matching-halves': 'Matching halves',
  'word-order': 'Word order',
  'gap-text': 'Gap text',
  'negative-prefixes': 'Negative prefixes',
  categorize: 'Categorize',
  paraphrasing: 'Paraphrasing',
  'complete-word': 'Complete word',
  synonyms: 'Synonyms',
  antonyms: 'Antonyms',
  'describe-picture': 'Describe picture',
  'answer-questions-picture': 'Q&A (picture)',
  'true-false-picture': 'T/F (picture)',
  'multiple-choice-picture': 'MC (picture)',
  'listening-comprehension': 'Listening',
  'answer-questions-audio': 'Q&A (audio)',
  'true-false-audio': 'T/F (audio)',
  'multiple-choice-audio': 'MC (audio)',
  'fill-in-blanks-audio': 'Fill blanks (audio)',
};
