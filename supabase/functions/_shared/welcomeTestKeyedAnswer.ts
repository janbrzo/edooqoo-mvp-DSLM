/**
 * Welcome Test keyed answer checking (D6).
 *
 * Typed vocabulary answers (`fill_blank`) go through the shared matcher
 * (`src/lib/answers/matchAnswer.ts`): an uncertain match is `null`
 * (unscored, needs review), never `false`. Typed GRAMMAR answers are compared
 * strictly (case, spaces and final punctuation ignored): the form of the word
 * is what they test, so "gos" for "goes" is wrong, not a typo to review (owner
 * decision, 2026-10-12). Selection items (multiple choice,
 * listening, scenario) keep the exact option comparison. "I don't know" stays
 * an honest wrong answer, as before.
 *
 * Shared by the browser (provisional verdict while answering) and
 * process-welcome-test, which re-grades the stored answers from the stored key
 * before any score is computed (the server decides; the client verdict is never
 * trusted).
 */
import { matchAnswer, type MatchVerdict } from './matchAnswer.ts';

export const WELCOME_TEST_IDK = '__IDK__';

export interface KeyedQuestion {
  question_type: string;
  correct_answer?: string | string[] | null;
  /** Bank section; on stored question rows this is element_type. */
  section?: string | null;
}

const VERDICT_RANK: Record<MatchVerdict, number> = { correct: 3, review: 2, wrong: 1, empty: 0 };

/** Lowercase, single spaces, no final punctuation: "Has been working." = "has  been working". */
const normalizeTyped = (v: unknown): string =>
  String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim();

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

  if (question.section === 'grammar') {
    const typed = normalizeTyped(answer);
    const keys = Array.isArray(key) ? key : [key];
    return typed !== '' && keys.some((k) => normalizeTyped(k) === typed);
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

export interface StoredQuestionRow {
  id: string;
  question_type: string;
  element_type?: string | null;
  correct_answer?: unknown;
  student_answer?: unknown;
  is_correct?: boolean | null;
}

const isUnanswered = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

const asKey = (v: unknown): string | string[] | null => {
  if (Array.isArray(v)) return v.map((k) => String(k));
  if (v === null || v === undefined || v === '') return null;
  return String(v);
};

/**
 * Server verdict for every stored row: keyed rows are graded from their stored
 * key, unanswered rows and rows without a key (open, speaking, profile items)
 * get null. Returns only the rows whose stored is_correct differs.
 */
export function regradeQuestionRows(rows: StoredQuestionRow[]): Array<{ id: string; is_correct: boolean | null }> {
  const changes: Array<{ id: string; is_correct: boolean | null }> = [];
  for (const row of rows) {
    const key = asKey(row.correct_answer);
    const verdict = isUnanswered(row.student_answer) || !key
      ? null
      : checkWelcomeTestKeyedAnswer(
        { question_type: row.question_type, correct_answer: key, section: row.element_type ?? null },
        row.student_answer,
      );
    if ((row.is_correct ?? null) !== verdict) changes.push({ id: row.id, is_correct: verdict });
  }
  return changes;
}
