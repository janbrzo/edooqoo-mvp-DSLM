/**
 * Closed-exercise support for verify-open-answers.
 *
 * Closed items (multiple choice, true/false, matching, blanks, ...) arrive with
 * the answer key in `suggested_answer` (built by `src/lib/answers/closedItemContext.ts`).
 * The key is ground truth: the model explains the rule, it never overrules the key
 * for selection items. Typed items may accept a valid alternative.
 *
 * CLOSED_EXERCISE_TYPES mirrors `src/utils/masteryCalculator.ts`; keep in sync.
 */

export const CLOSED_EXERCISE_TYPES = [
  "multiple-choice", "multiple-choice-audio", "multiple-choice-picture",
  "true-false", "true-false-audio", "true-false-picture", "matching", "matching-halves",
  "fill-in-blanks", "fill-in-blanks-audio", "categorize",
  "complete-word", "negative-prefixes", "odd-one-out", "synonyms-antonyms",
  "synonyms", "antonyms", "error-correction", "gap-text", "word-order",
];

/** Selection items: the student picks from a fixed set, so no alternative can be right. */
const SELECTION_PREFIXES = ["multiple-choice", "true-false", "matching", "categorize", "odd-one-out"];

export const isClosedType = (t: string | undefined): boolean => {
  if (!t) return false;
  const n = t.replace("-picture", "").replace("-audio", "");
  return CLOSED_EXERCISE_TYPES.some((c) => t === c || n === c.replace("-audio", "").replace("-picture", ""));
};

export const isSelectionType = (t: string | undefined): boolean =>
  !!t && SELECTION_PREFIXES.some((p) => t.startsWith(p));

/** Max items per model call; larger requests are split and evaluated in parallel. */
export const CHUNK_SIZE = 10;
export const CHUNK_THRESHOLD = 12;

export function chunkAnswers<T>(items: T[]): T[][] {
  if (items.length <= CHUNK_THRESHOLD) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) out.push(items.slice(i, i + CHUNK_SIZE));
  return out;
}

const normalize = (s: string | undefined): string =>
  (s || "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[.,!?;:"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Exact key match after light normalisation. Used as a safety net, never to mark wrong. */
export const matchesKey = (student: string | undefined, key: string | undefined): boolean =>
  !!key && normalize(student) !== "" && normalize(student) === normalize(key);

export const CLOSED_RULES_PROMPT = `

CLOSED ITEMS WITH AN ANSWER KEY (items marked "Item kind: CLOSED"):
- The line "Answer key" is GROUND TRUTH from the worksheet. Never contradict it.
- SELECTION items (multiple choice, true/false, matching, categorize, odd one out): if the student's choice equals the key, quality_score 1.0 and is_acceptable true. Otherwise quality_score 0.0-0.2 and is_acceptable false. No partial credit.
- TYPED items (fill in blanks, gap text, complete word, prefixes, synonyms, antonyms, error correction, word order): exact key match (ignoring case, punctuation and extra spaces) is 1.0. A grammatically correct alternative that fits the context and keeps the meaning is acceptable: quality_score 0.85-0.95, is_acceptable true, and the feedback names it as an acceptable alternative. Spelling slips on the right word: 0.6-0.7. Wrong word or form: 0.0-0.2, is_acceptable false.
- Feedback for closed items: 1-2 sentences, max 30 words, written for an adult learner. Explain WHY using the grammar or vocabulary rule (for example the tense signal word or collocation). When wrong, state the correct answer. Do not use the "Writing:"/"Speaking:" format and do not ask the student to write more.
- The non-answer, wrong-language and minimal-effort rules above do not apply to short closed answers such as a letter, "True", or a single word.`;
