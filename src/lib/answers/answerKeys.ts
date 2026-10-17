/**
 * Answer maps are keyed by question index (`3`) or, for sentences with several
 * blanks (gap-text, fill-in-blanks), by `${question}_${blank}` (`3_1`). Keys that
 * start with `_` are metadata (`_transcription_3`). These helpers read both forms
 * so progress and queue code count a multi-blank sentence once.
 */
const KEY = /^(\d+)(?:_\d+)?$/;

/** Question index of an answer key, or null for metadata keys. */
export function questionIndexOfKey(key: string): number | null {
  const m = KEY.exec(key);
  return m ? Number(m[1]) : null;
}

/** Sorted, de-duplicated question indices present in an answer map. */
export function questionIndicesOf(answers: Record<string | number, unknown> | null | undefined): number[] {
  const set = new Set<number>();
  for (const key of Object.keys(answers ?? {})) {
    const q = questionIndexOfKey(key);
    if (q !== null) set.add(q);
  }
  return [...set].sort((a, b) => a - b);
}

const filled = (v: unknown): boolean => v !== null && v !== undefined && v !== '';

/** True when the question has a non-empty answer under its plain key or any blank key. */
export function hasAnswerForQuestion(answers: Record<string | number, unknown> | null | undefined, q: number): boolean {
  if (!answers) return false;
  if (filled(answers[q])) return true;
  const prefix = `${q}_`;
  return Object.keys(answers).some((k) => k.startsWith(prefix) && KEY.test(k) && filled(answers[k]));
}
