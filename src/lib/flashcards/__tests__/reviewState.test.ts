import { describe, it, expect } from 'vitest';
import {
  calculateSM2, clampResponseTimeMs, normalizeLearnerEmail, parseSaveResult, stateFromSaveResult,
} from '../reviewState';

// Characterization of the CURRENT client SM-2 (q is 0 or 2 only). The SQL function
// save_flashcard_review_by_token must produce exactly these numbers.
describe('calculateSM2 parity table', () => {
  const cases: Array<[number, number, number, number, number, number, number]> = [
    // q, rep, EF, interval -> rep', EF', interval'
    [2, 0, 2.5, 0, 1, 2.5, 1], // q=2 leaves EF unchanged (0.1 - 1 * 0.10 = 0)
    [2, 1, 2.5, 1, 2, 2.5, 6],
    [2, 2, 2.5, 6, 3, 2.5, 15], // round(6 * 2.5)
    [2, 3, 2.7, 15, 4, 2.7, 41], // round(15 * 2.7) = 40.5 -> 41
    [0, 0, 2.5, 0, 0, 2.18, 1],
    [0, 1, 2.6, 1, 0, 2.28, 1],
    [0, 5, 2.0, 30, 0, 1.68, 1],
    [0, 3, 1.4, 10, 0, 1.3, 1], // EF floor
    [0, 3, 1.3, 10, 0, 1.3, 1],
  ];
  it.each(cases)('q=%i rep=%i EF=%f int=%i', (q, rep, ef, interval, nrep, nef, nint) => {
    const r = calculateSM2(q, rep, ef, interval);
    expect(r.newRepetition).toBe(nrep);
    expect(r.newInterval).toBe(nint);
    expect(r.newEF).toBeCloseTo(nef, 10);
  });

  it('a fail lowers EF by 0.32 and a success leaves it unchanged', () => {
    expect(2.5 - calculateSM2(0, 0, 2.5, 0).newEF).toBeCloseTo(0.32, 10);
    expect(calculateSM2(2, 0, 2.5, 0).newEF).toBeCloseTo(2.5, 10);
  });
});

describe('helpers', () => {
  it('normalizes e-mail', () => {
    expect(normalizeLearnerEmail('  Anna@Example.COM ')).toBe('anna@example.com');
    expect(normalizeLearnerEmail(null)).toBe('');
  });

  it('clamps response time to whole ms within 0..600000', () => {
    expect(clampResponseTimeMs(-5)).toBe(0);
    expect(clampResponseTimeMs(NaN)).toBe(0);
    expect(clampResponseTimeMs(1234.6)).toBe(1235);
    expect(clampResponseTimeMs(9_999_999)).toBe(600000);
  });

  const raw = {
    counted: true, easiness_factor: '2.60', repetition: 1, interval_days: 1,
    next_review_date: '2026-10-30T00:00:00Z', total_reviews: 1, correct_count: 1, incorrect_count: 0,
  };

  it('parses a table result (array) and coerces numeric strings', () => {
    const r = parseSaveResult([raw]);
    expect(r).toMatchObject({ counted: true, easiness_factor: 2.6, repetition: 1 });
    expect(stateFromSaveResult(r!)).toMatchObject({ isNew: false, total_reviews: 1 });
  });

  it('rejects malformed responses', () => {
    expect(parseSaveResult([])).toBeNull();
    expect(parseSaveResult(null)).toBeNull();
    expect(parseSaveResult([{ ...raw, counted: undefined }])).toBeNull();
    expect(parseSaveResult([{ ...raw, repetition: 'x' }])).toBeNull();
  });
});
