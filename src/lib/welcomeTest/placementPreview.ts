import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';

// A short, local sample, not the adaptive or persisted student assessment.
const SAMPLE_IDS = ['wt_q3', 'wt_q22', 'wt_q17', 'wt_q16s'] as const;

export const PLACEMENT_PREVIEW_QUESTIONS = SAMPLE_IDS.flatMap((id) => {
  const question = ALL_WELCOME_TEST_QUESTIONS.find((item) => item.id === id);
  if (!question) return [];
  return [{
    id: question.id,
    type: question.question_type,
    text: question.question_text,
    description: question.description,
    options: question.options,
  }];
});