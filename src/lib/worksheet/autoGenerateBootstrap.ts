/**
 * v6.9.48 — Auto-generate worksheet bootstrap helper.
 *
 * Reads sessionStorage flags written by DSLM PathwayView "Generate worksheet ↗"
 * suggestions and produces a complete `FormData` payload ready for
 * `handleGenerateWorksheet`. Used by `Index.tsx` mount effect to start the
 * generation deterministically, independent of `WorksheetForm`'s mount race.
 *
 * The mirror auto-fill logic (exercise auto-complete to reach 6 or 8 slots,
 * media-aware filtering) intentionally matches `WorksheetForm.submitForm` so
 * the AI prompt input stays identical regardless of which entrypoint fired.
 * The worksheet generation prompt and engine are NOT touched.
 */
import type { FormData, LessonTime, EnglishLevel, MediaType } from '@/components/WorksheetForm/types';

const PICTURE_COMPATIBLE = ['describe-picture', 'answer-questions-picture', 'true-false-picture', 'multiple-choice-picture'];
const AUDIO_COMPATIBLE = ['listening-comprehension', 'answer-questions-audio', 'true-false-audio', 'multiple-choice-audio', 'fill-in-blanks-audio'];
const GENERAL_EXERCISES = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'multiple-choice', 'dialogue', 'discussion', 'error-correction', 'odd-one-out', 'synonyms', 'antonyms', 'word-order', 'gap-text', 'negative-prefixes', 'categorize', 'paraphrasing', 'complete-word', 'matching-halves'];
const MANUAL_60 = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out', 'multiple-choice', 'discussion'];
const MANUAL_45 = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out'];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export interface AutoGenerateIntent {
  requestId: string;
  studentId?: string;
  suggestionId?: string | null;
}

export function readAutoGenerateIntent(): AutoGenerateIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    if (sessionStorage.getItem('autoGenerateWorksheet') !== 'true') return null;
    const raw = sessionStorage.getItem('autoGenerateWorksheetRequest');
    const parsed = raw ? (JSON.parse(raw) as Partial<AutoGenerateIntent>) : null;
    if (!parsed?.requestId) return null;
    return {
      requestId: String(parsed.requestId),
      studentId: parsed.studentId ? String(parsed.studentId) : undefined,
      suggestionId: parsed.suggestionId ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Build the FormData payload from sessionStorage prefill flags. Returns null
 * when there is no auto-generate intent or the prefilled lesson topic is empty
 * (we never start an empty AI generation).
 */
export function buildAutoGeneratePayload(): (FormData & { __autoGenerateRequestId: string }) | null {
  const intent = readAutoGenerateIntent();
  if (!intent) return null;

  const prefill = safeParse<{ topic?: string; goal?: string; additionalInfo?: string; grammarFocus?: string }>(
    sessionStorage.getItem('prefillWorksheet'),
    {}
  );
  const topic = (prefill.topic || '').trim();
  if (!topic) return null;

  const exercises = safeParse<string[]>(sessionStorage.getItem('prefillExercises'), []);
  const focusMap = safeParse<Record<string, 'vocabulary' | 'grammar'>>(
    sessionStorage.getItem('prefillExerciseFocusMap'),
    {}
  );
  const mediaTypes = safeParse<MediaType[]>(sessionStorage.getItem('prefillMediaTypes'), []);

  // Default lesson time / level mirror WorksheetForm initial state.
  const lessonTime: LessonTime = '60min';
  const englishLevel: EnglishLevel = 'B1/B2';
  const is45 = (lessonTime as LessonTime) === '45min';
  const maxExercises = is45 ? 6 : 8;

  const seed = Array.isArray(exercises) && exercises.length > 0
    ? [...exercises]
    : (is45 ? [...MANUAL_45] : [...MANUAL_60]);

  const isPicture = mediaTypes.includes('picture');
  const isAudio = mediaTypes.includes('audio');

  let finalExercises = [...seed];
  if (finalExercises.length < maxExercises) {
    const unused = GENERAL_EXERCISES.filter(ex => {
      if (finalExercises.includes(ex)) return false;
      if (!isPicture && PICTURE_COMPATIBLE.includes(ex)) return false;
      if (!isAudio && AUDIO_COMPATIBLE.includes(ex)) return false;
      return true;
    });
    const shuffled = [...unused].sort(() => Math.random() - 0.5);
    finalExercises = [...finalExercises, ...shuffled.slice(0, maxExercises - finalExercises.length)];
  }

  const payload: FormData & { __autoGenerateRequestId: string } = {
    lessonTime,
    lessonTopic: topic,
    lessonGoal: prefill.goal || '',
    teachingPreferences: prefill.grammarFocus || '',
    additionalInformation: prefill.additionalInfo || '',
    englishLevel,
    languageStyle: 3,
    studentId: intent.studentId,
    selectedExercises: finalExercises,
    selectedMediaTypes: mediaTypes,
    exerciseFocusMap: focusMap && Object.keys(focusMap).length > 0 ? focusMap : undefined,
    __autoGenerateFromSuggestion: true,
    __autoGenerateRequestId: intent.requestId,
  };
  return payload;
}

export function clearAutoGenerateFlags(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('autoGenerateWorksheet');
    sessionStorage.removeItem('autoGenerateWorksheetRequest');
  } catch {
    /* ignore */
  }
}