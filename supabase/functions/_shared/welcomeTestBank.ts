/**
 * Welcome Test question banks (pure, shared by the browser and the Edge Functions).
 *
 * A bank is a fixed question list. A test row remembers which bank it was seeded
 * from, so old tests keep the meaning of their stored answers when the bank grows:
 *   - question_index is the position in the bank array and only ever grows
 *     (new questions are appended, display order is a separate concern);
 *   - every seeded row also stores its question id in question_data.question_id,
 *     so a row can be read without knowing the position map;
 *   - generation_params.welcome_bank / welcome_form say which bank and which
 *     form (A first attempt, B retake) the test was created with.
 * Tests of another size (49 and 54 question legacy tests) belong to no bank.
 */

/** Number of seeded rows per bank. Bank 1 is the 58-question test. */
export const WELCOME_TEST_BANK_SIZES: Readonly<Record<number, number>> = { 1: 58 };

export type WelcomeTestForm = 'A' | 'B';

export interface WelcomeTestParams {
  welcome_bank: number;
  welcome_form: WelcomeTestForm;
}

/** The bank a test with this many seeded rows belongs to, or null (legacy test). */
export function bankOfRowCount(rowCount: number): number | null {
  for (const [bank, size] of Object.entries(WELCOME_TEST_BANK_SIZES)) {
    if (size === rowCount) return Number(bank);
  }
  return null;
}

export function welcomeTestParams(bank: number, form: WelcomeTestForm = 'A'): WelcomeTestParams {
  return { welcome_bank: bank, welcome_form: form };
}

/**
 * Bank and form recorded in generation_params. A test created before the fields
 * existed is bank 1, form A; garbage in the JSON gives the same default.
 */
export function readWelcomeTestParams(generationParams: unknown): WelcomeTestParams {
  const p = generationParams && typeof generationParams === 'object' && !Array.isArray(generationParams)
    ? generationParams as Record<string, unknown>
    : {};
  const bank = Number(p.welcome_bank);
  return {
    welcome_bank: Number.isInteger(bank) && bank in WELCOME_TEST_BANK_SIZES ? bank : 1,
    welcome_form: p.welcome_form === 'B' ? 'B' : 'A',
  };
}

/** Question id stored in a seeded row, or null for rows seeded before it was stored. */
export function storedQuestionId(row: { question_data?: unknown } | null | undefined): string | null {
  const d = row?.question_data;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const id = (d as Record<string, unknown>).question_id;
  return typeof id === 'string' && id !== '' ? id : null;
}
