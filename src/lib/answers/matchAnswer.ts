/**
 * ============================================
 * Shared Answer Matching Engine
 * ============================================
 *
 * Single source of truth for deciding whether a student's typed answer
 * matches the worksheet answer key.
 *
 * Design contract (do not break):
 * 1. This matcher is only ever MORE LENIENT than a plain
 *    `a.toLowerCase().trim() === b.toLowerCase().trim()` comparison.
 *    Anything that was correct before stays correct.
 * 2. When we cannot prove an answer is wrong, we return `review`
 *    ("needs teacher review") instead of `wrong`. We never tell a student
 *    they are wrong on a guess.
 * 3. Pure module — no React, no I/O — so it can be unit tested and reused
 *    by both the UI layer and the DSLM mastery calculator.
 */

import { expandContractions } from './contractions';

export type MatchVerdict = 'correct' | 'review' | 'wrong' | 'empty';

export type MatchReason =
  | 'exact'
  | 'normalized'
  | 'contraction'
  | 'variant'
  | 'sentinel'
  | 'near'
  | 'no-key'
  | 'mismatch';

export interface MatchResult {
  verdict: MatchVerdict;
  /** Variant of the answer key that produced a match, when any. */
  matchedVariant?: string;
  reason: MatchReason;
  /** All accepted variants, useful for display ("(a / b)"). */
  acceptedAnswers: string[];
}

export interface MatchOptions {
  /** Original sentence, used to resolve the "This sentence is correct" sentinel. */
  sourceSentence?: string;
  /** `word` = single word / prefix answers, `sentence` = full sentence answers. */
  mode?: 'word' | 'sentence';
  /** Defaults to false. */
  caseSensitive?: boolean;
}

/** Answer-key phrases meaning "the source sentence contains no error". */
const SENTINEL_KEYS = [
  'this sentence is correct',
  'the sentence is correct',
  'sentence is correct',
  'no error',
  'no errors',
  'no mistake',
  'no mistakes',
  'correct as is',
  'correct as it is',
  'already correct',
];

/** Student answers accepted as "there is no error here". */
const SENTINEL_ANSWERS = [
  'ok',
  'okay',
  'correct',
  'no error',
  'no errors',
  'no mistake',
  'no mistakes',
  'this sentence is correct',
  'the sentence is correct',
  'sentence is correct',
  'correct as is',
  'no change',
];

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * Canonical normalization: unify typographic characters, collapse whitespace,
 * strip trailing sentence punctuation (never interior punctuation).
 */
export const normalizeAnswerText = (raw: unknown, caseSensitive = false): string => {
  let text = toText(raw);
  if (!text) return '';

  text = text
    .replace(/[\u2018\u2019\u02BC\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // trailing sentence punctuation only
    .replace(/[.?!,;:]+$/g, '')
    .trim();

  return caseSensitive ? text : text.toLowerCase();
};

/**
 * Splits an answer key into the accepted variants.
 * Handles ` OR `, ` / `, `;`, `|` and optional parentheses:
 *   "he (has) gone" -> ["he has gone", "he gone"]
 */
export const splitAnswerVariants = (raw: unknown): string[] => {
  const text = toText(raw).trim();
  if (!text) return [];

  const parts = text
    .split(/\s+OR\s+|\s+or\s+(?=[^\s])|\s*\|\s*|\s*;\s*|\s+\/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // A bare "a/b" (no surrounding spaces) is only a variant separator for short,
  // single-token keys — never inside a sentence (dates, "and/or" in prose).
  const expanded: string[] = [];
  for (const part of parts) {
    if (!/\s/.test(part) && part.includes('/')) {
      expanded.push(...part.split('/').map((p) => p.trim()).filter(Boolean));
    } else {
      expanded.push(part);
    }
  }

  // Optional parentheses: emit both the "with" and "without" version.
  const withOptional: string[] = [];
  for (const part of expanded) {
    withOptional.push(part);
    if (/\([^)]+\)/.test(part)) {
      withOptional.push(part.replace(/\(([^)]*)\)/g, '$1'));
      withOptional.push(part.replace(/\s*\([^)]*\)\s*/g, ' '));
    }
  }

  return Array.from(new Set(withOptional.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)));
};

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
};

const sameWordSet = (a: string, b: string): boolean => {
  const wa = a.split(' ').filter(Boolean).sort().join(' ');
  const wb = b.split(' ').filter(Boolean).sort().join(' ');
  return wa.length > 0 && wa === wb;
};

const isNearMatch = (student: string, key: string, mode: 'word' | 'sentence'): boolean => {
  if (!student || !key) return false;

  if (mode === 'word') {
    if (key.length < 4) return false;
    return levenshtein(student, key) <= 1;
  }

  // sentence mode
  if (sameWordSet(student, key)) return true;
  const distance = levenshtein(student, key);
  return distance <= Math.max(1, Math.ceil(key.length * 0.15));
};

/**
 * Compares a student answer against an answer key.
 * Never returns `wrong` for a plausible-but-unproven answer — returns `review`.
 */
export const matchAnswer = (
  studentAnswer: unknown,
  correctAnswer: unknown,
  options: MatchOptions = {}
): MatchResult => {
  const { sourceSentence, mode = 'sentence', caseSensitive = false } = options;

  const rawStudent = toText(studentAnswer).trim();
  const variants = splitAnswerVariants(correctAnswer);

  if (!rawStudent) {
    return { verdict: 'empty', reason: 'mismatch', acceptedAnswers: variants };
  }

  if (variants.length === 0) {
    // No key to compare against — never mark the student wrong.
    return { verdict: 'review', reason: 'no-key', acceptedAnswers: [] };
  }

  const student = normalizeAnswerText(rawStudent, caseSensitive);
  const studentExpanded = expandContractions(student.toLowerCase());

  // 1) Exact / normalized / contraction-tolerant match against any variant.
  for (const variant of variants) {
    const key = normalizeAnswerText(variant, caseSensitive);
    if (!key) continue;

    if (student === key) {
      return {
        verdict: 'correct',
        matchedVariant: variant,
        reason: variants.length > 1 ? 'variant' : 'normalized',
        acceptedAnswers: variants,
      };
    }

    if (studentExpanded === expandContractions(key.toLowerCase())) {
      return { verdict: 'correct', matchedVariant: variant, reason: 'contraction', acceptedAnswers: variants };
    }
  }

  // 2) "This sentence is correct" sentinel.
  const sentinelKey = variants.some((v) => SENTINEL_KEYS.includes(normalizeAnswerText(v).toLowerCase()));
  if (sentinelKey) {
    const normalizedSource = normalizeAnswerText(sourceSentence).toLowerCase();
    if (
      SENTINEL_ANSWERS.includes(student.toLowerCase()) ||
      (normalizedSource && studentExpanded === expandContractions(normalizedSource))
    ) {
      return { verdict: 'correct', reason: 'sentinel', acceptedAnswers: variants };
    }
  }

  // 3) Near match -> needs teacher review (yellow), never red.
  for (const variant of variants) {
    const key = normalizeAnswerText(variant, caseSensitive).toLowerCase();
    if (isNearMatch(studentExpanded, expandContractions(key), mode)) {
      return { verdict: 'review', matchedVariant: variant, reason: 'near', acceptedAnswers: variants };
    }
  }

  return { verdict: 'wrong', reason: 'mismatch', acceptedAnswers: variants };
};

/** Backwards-compatible boolean helper. */
export const isAnswerCorrect = (
  studentAnswer: unknown,
  correctAnswer: unknown,
  options: MatchOptions = {}
): boolean => matchAnswer(studentAnswer, correctAnswer, options).verdict === 'correct';
