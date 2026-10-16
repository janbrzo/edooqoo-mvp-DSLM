import { describe, it, expect } from 'vitest';
import {
  effectiveMastery,
  forgettingFactor,
  FORGETTING_FLOOR,
  FORGETTING_GRACE_DAYS,
} from '../../../../supabase/functions/_shared/forgetting';

const NOW = new Date('2026-10-15T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

describe('forgetting curve (D9)', () => {
  it('does not decay inside the grace period', () => {
    expect(forgettingFactor(0)).toBe(1);
    expect(forgettingFactor(FORGETTING_GRACE_DAYS)).toBe(1);
    expect(effectiveMastery(80, daysAgo(10), NOW)).toBe(80);
  });

  it('matches the agreed examples: 80 -> 60 after 74 days, 80 -> 50 after 134 days', () => {
    expect(effectiveMastery(80, daysAgo(74), NOW)).toBe(60);
    expect(effectiveMastery(80, daysAgo(134), NOW)).toBe(50);
  });

  it('never drops below the floor, however old the event is', () => {
    expect(forgettingFactor(100000)).toBeCloseTo(FORGETTING_FLOOR, 6);
    expect(effectiveMastery(80, daysAgo(3650), NOW)).toBeGreaterThanOrEqual(40);
    expect(effectiveMastery(80, daysAgo(3650), NOW)).toBeLessThan(40.1);
  });

  it('is monotonically non-increasing with age', () => {
    let prev = Infinity;
    for (let d = 0; d <= 400; d += 5) {
      const f = forgettingFactor(d);
      expect(f).toBeLessThanOrEqual(prev);
      prev = f;
    }
  });

  it('keeps 0 at 0 and never exceeds the stored value', () => {
    expect(effectiveMastery(0, daysAgo(200), NOW)).toBe(0);
    expect(effectiveMastery(100, daysAgo(0), NOW)).toBe(100);
    expect(effectiveMastery(55, daysAgo(-3), NOW)).toBe(55); // future timestamp: no change
  });

  it('applies no decay when there is no usable age, and 0 for a non-numeric value', () => {
    expect(effectiveMastery(70, null, NOW)).toBe(70);
    expect(effectiveMastery(70, 'not-a-date', NOW)).toBe(70);
    expect(effectiveMastery(null, daysAgo(100), NOW)).toBe(0);
    expect(effectiveMastery(Number.NaN, daysAgo(100), NOW)).toBe(0);
  });

  it('accepts Date and string timestamps', () => {
    const d = new Date(NOW.getTime() - 74 * 86400000);
    expect(effectiveMastery(80, d, NOW)).toBe(60);
  });
});
