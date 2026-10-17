/**
 * Blanks of a fill-in-blanks sentence. Shared by the scorer (itemMastery.ts),
 * the AI context (closedItemContext.ts) and the renderer so all three read the
 * answer key the same way. Pure, no I/O.
 */

/** Number of blanks (runs of underscores) in a sentence text. */
export const countBlanks = (text: unknown): number => (String(text ?? '').match(/_+/g) || []).length;

/**
 * Correct answer per blank: an `answers` array, or one string with the parts
 * separated by " / " or by commas ("starts, at"). For several blanks the part
 * count must equal the blank count, otherwise the key cannot be mapped to the
 * blanks and an empty list is returned (the item is left unscored).
 */
export const blankAnswers = (sentence: any, blanks: number): string[] => {
  if (Array.isArray(sentence?.answers) && sentence.answers.length > 0) return sentence.answers.map(String);
  const raw = String(sentence?.answer ?? sentence?.correct ?? sentence?.missing_word ?? '').trim();
  if (blanks <= 1) return [raw];
  const parts = raw.includes('/') ? raw.split(/\s*\/\s*/) : raw.includes(',') ? raw.split(/\s*,\s*/) : [raw];
  const cleaned = parts.map((p) => p.trim()).filter((p) => p !== '');
  return cleaned.length === blanks ? cleaned : [];
};

/** True when a multi-blank sentence was answered blank by blank (any key `${i}_${b}`). */
export const hasBlankKeys = (itemIndex: number, allAnswers?: Record<string | number, any> | null): boolean => {
  if (!allAnswers) return false;
  const prefix = `${itemIndex}_`;
  return Object.keys(allAnswers).some((k) => k.startsWith(prefix) && /^\d+_\d+$/.test(k) && allAnswers[k] !== undefined);
};
