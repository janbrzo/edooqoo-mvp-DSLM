/**
 * Learner level sent to evaluation models. Pure helper shared by Edge Functions
 * and the client (no Deno APIs).
 *
 * Evaluation used a hard-coded 'Intermediate' for every learner, so an A1 answer
 * was judged against B1 expectations. Candidates are tried in order (student's
 * CEFR level, then the worksheet level such as "B1/B2"); placeholders like
 * 'unknown' or the old 'Intermediate' default are skipped.
 */
export const DEFAULT_ENGLISH_LEVEL = 'Intermediate';

const CEFR = /^(A1|A2|B1|B2|C1|C2)(\s*\/\s*(A1|A2|B1|B2|C1|C2))?$/i;

export function resolveEnglishLevel(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const v = c.trim();
    if (CEFR.test(v)) return v.toUpperCase().replace(/\s+/g, '');
  }
  return DEFAULT_ENGLISH_LEVEL;
}
