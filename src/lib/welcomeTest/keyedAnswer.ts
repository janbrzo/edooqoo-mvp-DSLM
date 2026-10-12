/**
 * Welcome Test keyed answer checking (D6).
 *
 * Typed answers (`fill_blank`) go through the shared matcher
 * (`src/lib/answers/matchAnswer.ts`): an uncertain match is `null`
 * (unscored, needs review), never `false`. Selection items (multiple choice,
 * listening, scenario) keep the exact option comparison. "I don't know" stays
 * an honest wrong answer, as before.
 *
 * Only used for answers being submitted now; stored results are never
 * recomputed.
 */
import { matchAnswer, type MatchVerdict } from '@/lib/answers/matchAnswer';
import type { WelcomeTestQuestionDef } from '@/types/welcomeTest';

export const WELCOME_TEST_IDK = '__IDK__';

type KeyedQuestion = Pick<WelcomeTestQuestionDef, 'question_type' | 'correct_answer'>;

const VERDICT_RANK: Record<MatchVerdict, number> = { correct: 3, review: 2, wrong: 1, empty: 0 };

const exactMatch = (answer: unknown, key: string | string[]): boolean => {
  const answerStr = String(answer).toLowerCase().trim();
  const keys = Array.isArray(key) ? key : [key];
  return keys.some((k) => String(k).toLowerCase().trim() === answerStr);
};

/**
 * Returns true (correct), false (wrong) or null (no key, or a typed answer
 * that needs teacher review).
 */
export const checkWelcomeTestKeyedAnswer = (
  question: KeyedQuestion,
  answer: unknown,
): boolean | null => {
  const key = question.correct_answer;
  if (!key || (Array.isArray(key) && key.length === 0)) return null;

  if (question.question_type !== 'fill_blank' || answer === WELCOME_TEST_IDK) {
    return exactMatch(answer, key);
  }

  const keys = Array.isArray(key) ? key : [key];
  let best: MatchVerdict = 'empty';
  for (const k of keys) {
    const { verdict } = matchAnswer(answer, k, { mode: 'word' });
    if (VERDICT_RANK[verdict] > VERDICT_RANK[best]) best = verdict;
    if (best === 'correct') break;
  }

  if (best === 'correct') return true;
  if (best === 'review') return null;
  // `wrong`, or an empty submission (same result as the old exact compare).
  return false;
};

/** Nano-skill rating written to the DSLM event: unscored stays unscored. */
export const welcomeTestRatingFor = (
  isCorrect: boolean | null,
): { mastery: number; hasValue: boolean } => ({
  mastery: isCorrect === true ? 100 : isCorrect === false ? 0 : -1,
  hasValue: isCorrect !== null,
});
