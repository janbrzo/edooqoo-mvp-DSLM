// Canonical save (P2.3): the one shape every reader of a NEW worksheet row sees.
//
// After the gate, the parsed worksheet is normalised (P1.5 shapes), every
// exercise gets a stable `ex_<uuid>` id, the per-type `time` from the single
// shared table (same numbers as the client), the official numbered title and a
// `canonical_version`. The result is stored as both `ai_response` and
// `html_content`; the untouched model text goes to `ai_response_raw`.
//
// Pure apart from the id source. Idempotent: canonicalising a canonical
// worksheet changes nothing (existing valid, unique ids are kept). It does not
// touch `nano_skill` or any other field the model produced, never shuffles
// options and never invents an answer key.
import { normalizeWorksheetExercises } from "../_shared/normalizeExercise.ts";
import { getExerciseTimeByType } from "../_shared/exerciseTime.ts";
import { applyExerciseTitles } from "./normalise.ts";

export const CANONICAL_VERSION = 1;

const EXERCISE_ID = /^ex_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CanonicalizeOptions {
  /** "45min" or "60min" (a space is tolerated); anything else is treated as 45min. */
  lessonTime?: string | null;
  /** True when the teacher gave a grammar focus (the client uses `teachingPreferences`). */
  hasGrammar: boolean;
  /** Number the titles by position. False for batch exercises that are added to another worksheet. */
  titles: boolean;
  /** Id source, injectable for tests. */
  newId?: () => string;
}

/** CANONICAL_SAVE flag: on unless explicitly switched off (rollback without a deploy of code). */
export function isCanonicalSaveEnabled(): boolean {
  try {
    const value = String(Deno.env.get("CANONICAL_SAVE") ?? "").trim().toLowerCase();
    if (value === "off" || value === "0" || value === "false") return false;
  } catch (_) { /* no environment: default */ }
  return true;
}

/** Form data to canonicalisation options (hasGrammar mirrors the client's `teachingPreferences` check). */
export function canonicalOptionsFromForm(formData: any, titles: boolean): CanonicalizeOptions {
  const preferences = formData?.teachingPreferences;
  return {
    lessonTime: typeof formData?.lessonTime === "string" ? formData.lessonTime : null,
    hasGrammar: typeof preferences === "string" && preferences.trim().length > 0,
    titles,
  };
}

/** Returns a canonical copy; the input is not modified. A value without an exercises array is returned as is. */
export function canonicalizeWorksheet<T extends Record<string, any>>(worksheet: T, options: CanonicalizeOptions): T {
  if (!worksheet || !Array.isArray(worksheet.exercises)) return worksheet;
  const newId = options.newId ?? (() => crypto.randomUUID());
  const normalized = normalizeWorksheetExercises(worksheet);
  const seen = new Set<string>();

  const exercises = normalized.exercises.map((exercise: any) => {
    if (!exercise || typeof exercise !== "object") return exercise;
    let id: string = typeof exercise.id === "string" && EXERCISE_ID.test(exercise.id) ? exercise.id : "";
    if (!id || seen.has(id)) {
      do { id = `ex_${newId()}`; } while (seen.has(id));
    }
    seen.add(id);
    return {
      ...exercise,
      id,
      time: getExerciseTimeByType(String(exercise.type ?? ""), options.lessonTime ?? "", options.hasGrammar),
      canonical_version: CANONICAL_VERSION,
    };
  });

  if (options.titles) applyExerciseTitles(exercises.filter((exercise: any) => exercise && typeof exercise === "object"));

  return { ...normalized, exercises, canonical_version: CANONICAL_VERSION };
}

/**
 * Pipeline stage helper: canonicalises the parsed worksheet in place so the
 * saved row and the response to the client carry the same exercises.
 * No-op when the CANONICAL_SAVE flag is off.
 */
export function canonicalizeInPlace(worksheet: any, formData: any, titles: boolean): void {
  if (!isCanonicalSaveEnabled()) return;
  Object.assign(worksheet, canonicalizeWorksheet(worksheet, canonicalOptionsFromForm(formData, titles)));
}
