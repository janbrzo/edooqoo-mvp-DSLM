/**
 * Text Normalization Utilities for Answer Comparison
 *
 * DEPRECATED as a matching engine — kept as a thin backwards-compatible
 * wrapper. The single source of truth for answer correctness is
 * `src/lib/answers/matchAnswer.ts`.
 */

import { matchAnswer, normalizeAnswerText } from '@/lib/answers/matchAnswer';

/**
 * Normalizes text for comparison (lowercase, collapse whitespace, unify
 * typographic characters, drop punctuation).
 */
export const normalizeForComparison = (text: string): string => {
  if (!text) return '';

  return normalizeAnswerText(text)
    .replace(/[.,!?;:'"()[\]{}\-–—]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Compares two strings for answer validation.
 * Delegates to the shared matcher so every surface agrees on correctness.
 */
export const answersMatch = (studentAnswer: string, correctAnswer: string): boolean =>
  matchAnswer(studentAnswer, correctAnswer).verdict === 'correct';
