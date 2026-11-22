import { describe, expect, it } from 'vitest';
import { CURRENT_WELCOME_BANK, welcomeTestSeedRows } from '../seed';
import { WELCOME_TEST_SEED_BANK_2A } from '../../../../supabase/functions/_shared/welcomeTestSeedBank2A';

describe('welcomeTestSeedBank2A parity', () => {
  it('matches welcomeTestSeedRows(bank 2, form A) exactly', () => {
    const expected = welcomeTestSeedRows('__template__', CURRENT_WELCOME_BANK, 'A').map(({ test_id: _ignored, ...rest }) => ({
      ...rest,
      element_type: rest.element_type ?? null,
    }));
    expect(WELCOME_TEST_SEED_BANK_2A).toHaveLength(72);
    expect(WELCOME_TEST_SEED_BANK_2A).toEqual(expected);
  });
});