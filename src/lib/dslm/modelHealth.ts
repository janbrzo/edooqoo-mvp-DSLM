/**
 * modelHealth — pure maturity heuristic for the Learning model cockpit.
 * Counts how many learning signals feed the DSLM. Display-only; never
 * used by generation or evaluation logic.
 */
export type ModelHealthLevel = 'calibrating' | 'learning' | 'tuned';

export interface ModelHealthInput {
  totalLessons: number;
  totalWorksheets: number;
}

export interface ModelHealth {
  level: ModelHealthLevel;
  label: string;
  hint: string;
  signals: number;
}

export function computeModelHealth({ totalLessons, totalWorksheets }: ModelHealthInput): ModelHealth {
  const lessons = Math.max(0, totalLessons || 0);
  const worksheets = Math.max(0, totalWorksheets || 0);
  const signals = lessons + worksheets;
  if (signals >= 8) {
    return { level: 'tuned', label: 'Well tuned', hint: 'Enough history for precise suggestions.', signals };
  }
  if (signals >= 3) {
    return { level: 'learning', label: 'Learning', hint: 'Suggestions improve with every lesson and worksheet.', signals };
  }
  return { level: 'calibrating', label: 'Calibrating', hint: 'Add a lesson, worksheet or note so the model can learn this student.', signals };
}
