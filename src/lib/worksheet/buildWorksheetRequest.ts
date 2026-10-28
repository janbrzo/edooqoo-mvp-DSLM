/**
 * buildWorksheetRequest: the single builder of the FormData sent to the
 * generation pipeline. Used by WorksheetForm.submitForm and by the auto
 * generate bootstrap, so the same input always yields the same request.
 *
 * - every free-text field is trimmed (a whitespace-only grammar focus used to
 *   be truthy and shifted the server-side `grammarFocus:` parsing),
 * - empty optional fields become undefined,
 * - exercises go through normalizeSuggestionPrefill: trimmed to 6/8, one media
 *   family, deterministic padding from NO_MEDIA_DEFAULTS (no Math.random).
 *
 * The prompt wording and engine are not touched; this only shapes the input.
 */
import type { EnglishLevel, FormData, LessonTime, MediaType } from '@/components/WorksheetForm/types';
import { normalizeSuggestionPrefill } from '@/lib/dslm/normalizeSuggestionPrefill';

export interface WorksheetRequestState {
  lessonTime: LessonTime;
  lessonTopic: string;
  lessonGoal?: string | null;
  grammarFocus?: string | null;
  additionalInformation?: string | null;
  englishLevel: EnglishLevel;
  languageStyle?: number;
  studentId?: string | null;
  selectedExercises?: string[] | null;
  selectedMediaTypes?: string[] | null;
  exerciseFocusMap?: Record<string, string> | null;
  selectedImage?: FormData['selectedImage'] | null;
}

export interface BuiltWorksheetRequest {
  request: FormData;
  /** How many exercises were added to reach the 6/8 target. */
  autoCompletedCount: number;
}

const clean = (value: string | null | undefined): string => (value ?? '').trim();
const cleanOrUndefined = (value: string | null | undefined): string | undefined => {
  const v = clean(value);
  return v.length > 0 ? v : undefined;
};

export function getExerciseTarget(lessonTime: LessonTime): number {
  return lessonTime === '45min' ? 6 : 8;
}

export function buildWorksheetRequest(state: WorksheetRequestState): BuiltWorksheetRequest {
  const requested = Array.isArray(state.selectedExercises) ? state.selectedExercises : [];
  const normalized = normalizeSuggestionPrefill({
    exercises: requested,
    focusMap: state.exerciseFocusMap ?? {},
    mediaTypes: state.selectedMediaTypes ?? null,
    lessonTime: state.lessonTime,
  });
  const kept = new Set(requested);
  const autoCompletedCount = normalized.selectedExercises.filter((id) => !kept.has(id)).length;

  const request: FormData = {
    lessonTime: state.lessonTime,
    lessonTopic: clean(state.lessonTopic),
    lessonGoal: clean(state.lessonGoal),
    teachingPreferences: clean(state.grammarFocus),
    additionalInformation: cleanOrUndefined(state.additionalInformation),
    englishLevel: state.englishLevel,
    languageStyle: state.languageStyle ?? 3,
    studentId: cleanOrUndefined(state.studentId),
    selectedExercises: normalized.selectedExercises,
    selectedMediaTypes: normalized.selectedMediaTypes as MediaType[],
    exerciseFocusMap:
      Object.keys(normalized.exerciseFocusMap).length > 0 ? normalized.exerciseFocusMap : undefined,
    selectedImage: state.selectedImage ?? undefined,
  };
  return { request, autoCompletedCount };
}
