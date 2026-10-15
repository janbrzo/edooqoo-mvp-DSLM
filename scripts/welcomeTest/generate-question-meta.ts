/**
 * Regenerates supabase/functions/_shared/welcomeTestQuestionMeta.ts from the
 * Welcome Test question bank:
 *   npx vite-node --config vitest.config.ts scripts/welcomeTest/generate-question-meta.ts
 * The parity test fails when the committed file is out of date.
 */
import { writeFileSync } from 'node:fs';
import { ALL_WELCOME_TEST_QUESTIONS } from '../../src/data/welcomeTestQuestions';
import { toEventQuestion } from '../../supabase/functions/_shared/welcomeTestEventPayload';

const meta = ALL_WELCOME_TEST_QUESTIONS.map((q) => toEventQuestion(q));
const body = `/**
 * GENERATED from src/data/welcomeTestQuestions.ts by
 * scripts/welcomeTest/generate-question-meta.ts. Do not edit by hand: the
 * parity test (welcomeTestEventPayload.test.ts) fails when it drifts.
 */
import type { WelcomeEventQuestion } from './welcomeTestEventPayload.ts';

export const WELCOME_TEST_EVENT_QUESTIONS: readonly WelcomeEventQuestion[] = ${JSON.stringify(meta, null, 2)};
`;
writeFileSync('supabase/functions/_shared/welcomeTestQuestionMeta.ts', body);
console.log(`wrote ${meta.length} questions`);
