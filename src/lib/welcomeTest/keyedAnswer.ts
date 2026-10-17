/**
 * Welcome Test keyed answer checking lives in
 * supabase/functions/_shared/welcomeTestKeyedAnswer.ts so the browser and
 * process-welcome-test (server re-grading) use one implementation.
 */
export {
  checkWelcomeTestKeyedAnswer,
  welcomeTestRatingFor,
  WELCOME_TEST_IDK,
  type KeyedQuestion,
} from '../../../supabase/functions/_shared/welcomeTestKeyedAnswer';
