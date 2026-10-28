/**
 * Tracks which plan suggestion (future_worksheet_suggestions row) the open
 * worksheet form was prefilled from, so that generating a worksheet marks it
 * as used (Up next advances).
 *
 * Owner decision: the suggestion is marked used whenever a worksheet is
 * generated after the form was prefilled from it, even if the teacher edited
 * the topic, but only for the SAME student. The origin is bound to the first
 * student the form resolves after the prefill; any other student drops it.
 */

export interface SuggestionOrigin {
  suggestionId: string;
  /** null until the form has resolved the student the prefill was written for. */
  studentId: string | null;
}

const NO_STUDENT = 'no-student';

const isRealStudent = (id: string | null | undefined): id is string =>
  typeof id === 'string' && id.length > 0 && id !== NO_STUDENT;

export function createSuggestionOrigin(
  suggestionId: string | null | undefined,
  studentId: string | null | undefined,
): SuggestionOrigin | null {
  if (!suggestionId) return null;
  return { suggestionId, studentId: isRealStudent(studentId) ? studentId : null };
}

/**
 * Keeps the origin in sync with the selected student: an unbound origin binds
 * to the first real student, a bound origin is dropped when the student
 * changes (including switching to "no student").
 */
export function reconcileSuggestionOrigin(
  origin: SuggestionOrigin | null,
  selectedStudentId: string | null | undefined,
): SuggestionOrigin | null {
  if (!origin) return null;
  if (origin.studentId === null) {
    return isRealStudent(selectedStudentId) ? { ...origin, studentId: selectedStudentId } : origin;
  }
  return origin.studentId === selectedStudentId ? origin : null;
}

/** The suggestion id to stamp on a submit, or null when it must not be marked. */
export function suggestionIdForSubmit(
  origin: SuggestionOrigin | null,
  selectedStudentId: string | null | undefined,
): string | null {
  if (!origin || origin.studentId === null) return null;
  return origin.studentId === selectedStudentId ? origin.suggestionId : null;
}

/** sessionStorage value for `appliedPresetSuggestionId` (key name unchanged). */
export function serializeAppliedPreset(origin: SuggestionOrigin): string {
  return JSON.stringify({ id: origin.suggestionId, studentId: origin.studentId });
}

/** Reads the new JSON value and the legacy plain-id value. */
export function parseAppliedPreset(raw: string | null | undefined): SuggestionOrigin | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string' && parsed.id) {
      return createSuggestionOrigin(parsed.id, typeof parsed.studentId === 'string' ? parsed.studentId : null);
    }
  } catch {
    /* legacy plain id */
  }
  return { suggestionId: raw, studentId: null };
}
