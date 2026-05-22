/**
 * Mirror of `src/lib/exerciseTaxonomy.ts` — keep in sync.
 * Used by suggest-exercises and generate-timeline edge functions.
 *
 * v4.2: `sentence-transformation` removed — currently disabled in UI.
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
];

export const PICTURE_EXERCISE_IDS = [
  'describe-picture',
  'answer-questions-picture',
  'true-false-picture',
  'multiple-choice-picture',
];

export const AUDIO_EXERCISE_IDS = [
  'listening-comprehension',
  'answer-questions-audio',
  'true-false-audio',
  'multiple-choice-audio',
  'fill-in-blanks-audio',
];

export const ALL_EXERCISE_IDS = [
  ...NO_MEDIA_EXERCISE_IDS,
  ...PICTURE_EXERCISE_IDS,
  ...AUDIO_EXERCISE_IDS,
];
