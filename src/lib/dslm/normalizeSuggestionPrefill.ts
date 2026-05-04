import { devWarn } from '@/utils/logger';
/**
 * normalizeSuggestionPrefill — single source of truth for converting a DSLM
 * suggestion (next step / phase step) or a persisted draft into a coherent
 * WorksheetForm state: { selectedExercises, selectedMediaTypes, exerciseFocusMap }.
 *
 * Guarantees:
 *  - exactly `targetCount` exercises (8 for 60min, 6 for 45min)
 *  - mediaTypes inferred from exercise IDs (one media family at most)
 *  - if mixed media → keep dominant family, replace minority with no-media fallbacks
 *  - exerciseFocusMap pruned to actually-selected exercises, only 'vocabulary'|'grammar' kept
 *  - 'sentence-transformation' (currently disabled) is always filtered out
 *
 * Used by:
 *  - WorksheetForm prefill (sessionStorage from DSLM)
 *  - WorksheetForm draft hydration (localStorage 24h persistence)
 */

export type MediaTypeLite = 'picture' | 'audio';

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

export const NO_MEDIA_DEFAULTS = [
  'reading',
  'fill-in-blanks',
  'multiple-choice',
  'true-false',
  'matching',
  'dialogue',
  'answer-questions',
  'discussion',
] as const;

const VALID_IDS = new Set<string>([
  ...NO_MEDIA_DEFAULTS,
  ...PICTURE_EXERCISE_IDS,
  ...AUDIO_EXERCISE_IDS,
  'error-correction','odd-one-out','matching-halves','word-order','gap-text',
  'negative-prefixes','categorize','paraphrasing','complete-word','synonyms','antonyms',
]);

export interface NormalizedPrefill {
  selectedExercises: string[];
  selectedMediaTypes: MediaTypeLite[];
  exerciseFocusMap: Record<string, 'vocabulary' | 'grammar'>;
}

export interface NormalizeInput {
  exercises?: string[] | null;
  focusMap?: Record<string, string> | null;
  /** Optional explicit media hint; if omitted we infer from exercises. */
  mediaTypes?: string[] | null;
  lessonTime?: '45min' | '60min';
}

export function normalizeSuggestionPrefill(input: NormalizeInput): NormalizedPrefill {
  const targetCount = input.lessonTime === '45min' ? 6 : 8;

  // 1. Filter to valid IDs, drop disabled
  let ex = (input.exercises || [])
    .filter(id => typeof id === 'string')
    .filter(id => VALID_IDS.has(id))
    .filter(id => id !== 'sentence-transformation');

  // De-dupe (preserve order)
  ex = Array.from(new Set(ex));

  // 2. Decide media family
  const pictureCount = ex.filter(id => (PICTURE_EXERCISE_IDS as readonly string[]).includes(id)).length;
  const audioCount = ex.filter(id => (AUDIO_EXERCISE_IDS as readonly string[]).includes(id)).length;

  let mediaFamily: MediaTypeLite | null = null;
  if (input.mediaTypes && input.mediaTypes.includes('picture') && pictureCount >= audioCount) {
    mediaFamily = 'picture';
  } else if (input.mediaTypes && input.mediaTypes.includes('audio') && audioCount >= pictureCount) {
    mediaFamily = 'audio';
  } else if (pictureCount > 0 && audioCount === 0) {
    mediaFamily = 'picture';
  } else if (audioCount > 0 && pictureCount === 0) {
    mediaFamily = 'audio';
  } else if (pictureCount > 0 && audioCount > 0) {
    // Mixed → pick dominant, log developer warning
    mediaFamily = pictureCount >= audioCount ? 'picture' : 'audio';
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      devWarn('[normalizeSuggestionPrefill] mixed picture+audio → forcing', mediaFamily);
    }
  }

  // 3. If a media family is set, drop the OTHER family's exercises and replace with no-media fallbacks
  if (mediaFamily === 'picture') {
    ex = ex.filter(id => !(AUDIO_EXERCISE_IDS as readonly string[]).includes(id));
  } else if (mediaFamily === 'audio') {
    ex = ex.filter(id => !(PICTURE_EXERCISE_IDS as readonly string[]).includes(id));
  } else {
    // None → drop ALL media exercises (pure no-media form)
    ex = ex.filter(id =>
      !(PICTURE_EXERCISE_IDS as readonly string[]).includes(id) &&
      !(AUDIO_EXERCISE_IDS as readonly string[]).includes(id)
    );
  }

  // 4. Pad to target count using no-media defaults
  for (const fb of NO_MEDIA_DEFAULTS) {
    if (ex.length >= targetCount) break;
    if (!ex.includes(fb)) ex.push(fb);
  }
  // Hard cap
  if (ex.length > targetCount) ex = ex.slice(0, targetCount);

  // 5. Build cleaned focus map limited to final exercises
  const cleanedFocus: Record<string, 'vocabulary' | 'grammar'> = {};
  const rawMap = input.focusMap || {};
  for (const id of ex) {
    const v = rawMap[id];
    if (v === 'vocabulary' || v === 'grammar') cleanedFocus[id] = v;
  }

  return {
    selectedExercises: ex,
    selectedMediaTypes: mediaFamily ? [mediaFamily] : [],
    exerciseFocusMap: cleanedFocus,
  };
}