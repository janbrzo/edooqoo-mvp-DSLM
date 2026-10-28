import type { EnglishLevel } from '@/components/WorksheetForm/types';
import { toEnglishLevelBand } from '@/lib/worksheet/autoGenerateBootstrap';

export const DEFAULT_ENGLISH_LEVEL: EnglishLevel = 'B1/B2';

/** Label for the student select: never "(null)" or "(unknown)". */
export function formatStudentLevelLabel(level: string | null | undefined): string {
  const value = (level ?? '').trim();
  if (!value || value.toLowerCase() === 'unknown') return 'level not set';
  return value;
}

export interface LevelBandDecision {
  /** Band to preselect when the student is chosen. */
  band: EnglishLevel;
  /** True when the student has no usable level and the default was used. */
  usedDefault: boolean;
}

/** Band for a freshly selected student; falls back to B1/B2 and says so. */
export function decideLevelBandForStudent(studentLevel: string | null | undefined): LevelBandDecision {
  const band = toEnglishLevelBand(studentLevel);
  return band ? { band, usedDefault: false } : { band: DEFAULT_ENGLISH_LEVEL, usedDefault: true };
}

/**
 * Warning text when the chosen band differs from the student's own level band,
 * or null when they match or the student has no level.
 */
export function levelMismatchWarning(
  chosen: EnglishLevel,
  studentLevel: string | null | undefined,
): string | null {
  const studentBand = toEnglishLevelBand(studentLevel);
  if (!studentBand || studentBand === chosen) return null;
  return `This student is ${formatStudentLevelLabel(studentLevel)} (${studentBand}), but the worksheet is set to ${chosen}.`;
}
