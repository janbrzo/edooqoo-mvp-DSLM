import { normalizeSuggestionPrefill } from '@/lib/dslm/normalizeSuggestionPrefill';
import { clearAutoGenerateFlags, toEnglishLevelBand } from '@/lib/worksheet/autoGenerateBootstrap';
import type { PlacementLessonProposal } from './placementReportApi';

const PENDING_LESSON_KEY = 'edooqoo_pending_placement_lesson';
export function rememberPlacementLesson(token: string, id: string) {
  try { localStorage.setItem(PENDING_LESSON_KEY, JSON.stringify({ token, id })); } catch { /* account claim remains available */ }
}
export function pendingPlacementLessonId(token: string): string | null {
  try {
    const raw = localStorage.getItem(PENDING_LESSON_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    return stored?.token === token && typeof stored.id === 'string' ? stored.id : null;
  } catch { return null; }
}
export function clearPendingPlacementLesson() {
  try { localStorage.removeItem(PENDING_LESSON_KEY); } catch { /* storage unavailable */ }
}

/** Manual handoff only: anonymous forms never receive an unclaimed student ID. */
export function prefillPlacementLesson(lesson: PlacementLessonProposal, student?: { id: string; name: string }) {
  const normalized = normalizeSuggestionPrefill({ exercises: lesson.exercises, focusMap: lesson.exerciseFocusMap });
  clearAutoGenerateFlags();
  for (const key of ['preSelectedStudent', 'prefillSuggestionId', 'appliedPresetSuggestionId']) sessionStorage.removeItem(key);
  sessionStorage.setItem('prefillWorksheet', JSON.stringify({
    topic: lesson.topic, goal: lesson.goal ?? '', additionalInfo: lesson.additionalInfo ?? '',
    grammarFocus: lesson.grammarFocus ?? '', englishLevel: toEnglishLevelBand(lesson.difficulty),
  }));
  sessionStorage.setItem('prefillExercises', JSON.stringify(normalized.selectedExercises));
  sessionStorage.setItem('prefillExerciseFocusMap', JSON.stringify(normalized.exerciseFocusMap));
  sessionStorage.setItem('prefillMediaTypes', JSON.stringify(normalized.selectedMediaTypes));
  sessionStorage.setItem('forceNewWorksheet', 'true');
  if (student) {
    sessionStorage.setItem('preSelectedStudent', JSON.stringify(student));
    sessionStorage.setItem('prefillSuggestionId', lesson.id);
  }
}