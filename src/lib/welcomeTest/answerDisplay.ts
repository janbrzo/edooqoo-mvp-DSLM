/**
 * Teacher-facing display of a stored Welcome Test answer.
 * The "I don't know" sentinel is never shown raw.
 */
import { WELCOME_TEST_IDK } from './keyedAnswer';

export const IDK_LABEL = "I don't know";

export const isWelcomeTestIdk = (answer: unknown): boolean => answer === WELCOME_TEST_IDK;

export const formatWelcomeTestAnswer = (answer: unknown): string => {
  if (answer === WELCOME_TEST_IDK) return IDK_LABEL;
  if (typeof answer === 'boolean') return answer ? 'True' : 'False';
  if (Array.isArray(answer)) return answer.map((a) => (a === WELCOME_TEST_IDK ? IDK_LABEL : String(a))).join(', ');
  if (typeof answer === 'object' && answer !== null) return JSON.stringify(answer);
  return String(answer);
};
