/**
 * Closed-exercise support for verify-open-answers.
 *
 * Closed items (multiple choice, true/false, matching, blanks, ...) arrive with
 * the answer key in `suggested_answer` (built by `src/lib/answers/closedItemContext.ts`).
 * The key is ground truth: the model explains the rule, it never overrules the key
 * for selection items. Typed items may accept a valid alternative.
 *
 * CLOSED_EXERCISE_TYPES is defined once in `_shared/itemMastery.ts` and re-exported here.
 */

import { CLOSED_EXERCISE_TYPES, isClosedExerciseType } from './itemMastery.ts';
export { CLOSED_EXERCISE_TYPES };

/** Selection items: the student picks from a fixed set, so no alternative can be right. */
const SELECTION_PREFIXES = ["multiple-choice", "true-false", "matching", "categorize", "odd-one-out"];

export const isClosedType = (t: string | undefined): boolean => !!t && isClosedExerciseType(t);

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

export type KeyVerdict = "correct" | "wrong" | "review";

/**
 * Applies the answer key to the model score (key is ground truth).
 * - key says correct (or exact normalised match): always 1.0 and acceptable.
 * - selection item the key says wrong (or no verdict and no exact match): max 0.2, not acceptable.
 * - typed item that is not an exact match: the model decides (valid alternatives allowed).
 * `keyVerdict` comes from `calculateItemMastery`; when absent (old queue rows) only the exact match is used.
 */
export function applyClosedKeyRules(args: {
  aiScore: number;
  exerciseType: string;
  student?: string;
  key?: string;
  keyVerdict?: KeyVerdict;
}): { qualityScore: number; keyVerdict?: KeyVerdict } {
  const { aiScore, exerciseType, student, key } = args;
  const verdict: KeyVerdict | undefined =
    args.keyVerdict === "correct" || matchesKey(student, key) ? "correct" : args.keyVerdict;
  if (verdict === "correct") return { qualityScore: 1.0, keyVerdict: "correct" };
  if (isSelectionType(exerciseType) && verdict !== "review") {
    return { qualityScore: Math.min(aiScore, 0.2), keyVerdict: "wrong" };
  }
  return { qualityScore: aiScore, keyVerdict: verdict };
}

/** Evaluation built from the key alone, used when the model reply is missing or unusable. */
export function fallbackClosedEvaluation(a: {
  exercise_index?: number;
  question_index: number;
  exercise_type: string;
  student_answer?: string;
  suggested_answer?: string;
  key_verdict?: KeyVerdict;
}) {
  const base = { exercise_index: a.exercise_index, question_index: a.question_index };
  const r = applyClosedKeyRules({
    aiScore: 0.7,
    exerciseType: a.exercise_type,
    student: a.student_answer,
    key: a.suggested_answer,
    keyVerdict: a.key_verdict,
  });
  if (r.keyVerdict === "correct") {
    return { ...base, key_verdict: "correct" as KeyVerdict, quality_score: 1.0, is_acceptable: true, feedback: "Correct. This matches the answer key." };
  }
  if (isSelectionType(a.exercise_type)) {
    return { ...base, key_verdict: "wrong" as KeyVerdict, quality_score: 0.0, is_acceptable: false, feedback: `Not quite. The correct answer is ${a.suggested_answer}.` };
  }
  if (r.keyVerdict === "wrong") {
    return { ...base, key_verdict: "wrong" as KeyVerdict, quality_score: 0.2, is_acceptable: false, feedback: `Not quite. The answer key gives ${a.suggested_answer}.` };
  }
  return { ...base, key_verdict: "review" as KeyVerdict, quality_score: 0.7, is_acceptable: true, feedback: "Your teacher will check this answer." };
}
