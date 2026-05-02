/**
 * Text Normalization Utilities for Answer Comparison
 * 
 * Used to compare student answers with correct answers while ignoring:
 * - Punctuation (periods, commas, question marks, etc.)
 * - Case differences
 * - Extra whitespace
 */

/**
 * Normalizes text for comparison by:
 * - Converting to lowercase
 * - Removing punctuation
 * - Trimming whitespace
 * - Collapsing multiple spaces into single space
 */
export const normalizeForComparison = (text: string): string => {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .trim()
    // Remove common punctuation marks
    .replace(/[.,!?;:'"()[\]{}\-–—]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Compares two strings for answer validation, ignoring punctuation and case
 */
export const answersMatch = (studentAnswer: string, correctAnswer: string): boolean => {
  return normalizeForComparison(studentAnswer) === normalizeForComparison(correctAnswer);
};
