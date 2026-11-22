/**
 * Regenerates supabase/functions/_shared/welcomeTestSeedBank2A.ts from the
 * Welcome Test bank 2 form A seed builder:
 *   npx vite-node --config vitest.config.ts scripts/welcomeTest/generate-seed-bank.ts
 * The parity test (welcomeTestSeedParity.test.ts) fails when the committed file drifts.
 */
import { writeFileSync } from 'node:fs';
import { CURRENT_WELCOME_BANK, welcomeTestSeedRows } from '../../src/lib/welcomeTest/seed';

const rows = welcomeTestSeedRows('__template__', CURRENT_WELCOME_BANK, 'A').map(({ test_id: _ignored, ...rest }) => ({
  ...rest,
  element_type: rest.element_type ?? null,
}));
const body = `/**
 * GENERATED from src/lib/welcomeTest/seed.ts (bank ${CURRENT_WELCOME_BANK}, form A) by
 * scripts/welcomeTest/generate-seed-bank.ts. Do not edit by hand: the
 * parity test (welcomeTestSeedParity.test.ts) fails when it drifts.
 */
export interface WelcomeTestSeedRow {
  question_index: number;
  question_type: string;
  question_text: string;
  question_data: { options?: string[]; question_id: string };
  correct_answer: string | string[];
  explanation: string | null;
  element_type: string | null;
  difficulty_level: number;
  skill_tags: string[];
}

export const WELCOME_TEST_SEED_BANK_2A: readonly WelcomeTestSeedRow[] = ${JSON.stringify(rows, null, 2)};
`;
writeFileSync('supabase/functions/_shared/welcomeTestSeedBank2A.ts', body);
console.log(`wrote ${rows.length} seed rows`);