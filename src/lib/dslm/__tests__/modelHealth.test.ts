import { describe, it, expect } from 'vitest';
import { computeModelHealth } from '../modelHealth';

describe('computeModelHealth', () => {
  it('calibrating below 3 signals', () => {
    expect(computeModelHealth({ totalLessons: 1, totalWorksheets: 1 }).level).toBe('calibrating');
  });
  it('learning from 3 to 7 signals', () => {
    expect(computeModelHealth({ totalLessons: 2, totalWorksheets: 1 }).level).toBe('learning');
    expect(computeModelHealth({ totalLessons: 4, totalWorksheets: 3 }).level).toBe('learning');
  });
  it('tuned from 8 signals', () => {
    expect(computeModelHealth({ totalLessons: 5, totalWorksheets: 3 }).level).toBe('tuned');
  });
  it('clamps negative/NaN input', () => {
    const h = computeModelHealth({ totalLessons: -4, totalWorksheets: NaN });
    expect(h.signals).toBe(0);
    expect(h.level).toBe('calibrating');
  });
});
