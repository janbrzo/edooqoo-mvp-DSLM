import { describe, expect, it } from 'vitest';
import { formatGoal } from '../formatGoal';

describe('formatGoal', () => {
  it('maps current dropdown codes', () => {
    expect(formatGoal('work')).toBe('Work/Business');
    expect(formatGoal('fun-entertainment')).toBe('Fun & Entertainment');
  });
  it('maps legacy codes still stored on older students', () => {
    expect(formatGoal('grammar-structure')).toBe('Grammar & Language Structure');
    expect(formatGoal('listening-skills')).toBe('Listening Skills & Understanding');
  });
  it('passes free text through and blanks empty input', () => {
    expect(formatGoal('Business English — meetings')).toBe('Business English — meetings');
    expect(formatGoal(null)).toBe('');
    expect(formatGoal('')).toBe('');
  });
});
