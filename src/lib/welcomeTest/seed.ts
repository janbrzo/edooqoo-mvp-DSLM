/**
 * The one place that turns a Welcome Test bank into seeded question rows.
 *
 * Every creation path (ensureWelcomeTest, the dashboard card, the student tests
 * tab, retakes, useWelcomeTestActions) uses these helpers, so a test is always
 * seeded the same way: same row fields, the question id stored next to the
 * options, and the bank/form written to generation_params.
 */
import { questionDefsFor } from '@/lib/welcomeTest/flow';
import type { NewQuestionData } from '@/types/studentTests';
import {
  welcomeTestParams,
  type WelcomeTestForm,
  type WelcomeTestParams,
} from '../../../supabase/functions/_shared/welcomeTestBank';

/** The bank new tests are created from. */
export const CURRENT_WELCOME_BANK = 2;

/** The question definitions of one bank and form, in array (= question_index) order. */
export function bankQuestions(bank: number = CURRENT_WELCOME_BANK, form: WelcomeTestForm = 'A') {
  return questionDefsFor(bank, form);
}

/** Attempts alternate forms (1 = A, 2 = B, 3 = A ...), so a retake never repeats the same items. */
export function formForAttempt(attemptNumber: number): WelcomeTestForm {
  return attemptNumber % 2 === 0 ? 'B' : 'A';
}

/** generation_params written on a new Welcome Test row. */
export function welcomeTestGenerationParams(
  bank: number = CURRENT_WELCOME_BANK,
  form: WelcomeTestForm = 'A',
): WelcomeTestParams {
  return welcomeTestParams(bank, form);
}

/** Row fields shared by every seed path (question_index is added by the caller). */
function seedFields(q: ReturnType<typeof bankQuestions>[number]) {
  return {
    question_type: q.question_type as any,
    question_text: q.question_text,
    question_data: { ...(q.options ? { options: q.options } : {}), question_id: q.id } as any,
    correct_answer: (q.correct_answer || '') as any,
    explanation: q.description || undefined,
    element_type: q.element_type as any,
    difficulty_level: q.difficulty_level,
    skill_tags: q.nano_skill ? [q.nano_skill] : [],
  };
}

/** For paths that insert through useStudentTests.addQuestions (it assigns question_index). */
export function welcomeTestQuestionsToAdd(
  bank: number = CURRENT_WELCOME_BANK,
  form: WelcomeTestForm = 'A',
): NewQuestionData[] {
  return bankQuestions(bank, form).map(seedFields);
}

/** For paths that insert rows directly (question_index set here). */
export function welcomeTestSeedRows(testId: string, bank: number = CURRENT_WELCOME_BANK, form: WelcomeTestForm = 'A') {
  return bankQuestions(bank, form).map((q, i) => ({
    test_id: testId,
    question_index: i,
    ...seedFields(q),
    explanation: q.description || null,
    difficulty_level: q.difficulty_level || 3,
  }));
}
