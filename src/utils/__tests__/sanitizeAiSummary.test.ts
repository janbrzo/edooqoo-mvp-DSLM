import { describe, it, expect } from 'vitest';
import { sanitizeAiText, sanitizeAiList } from '../sanitizeAiSummary';

describe('sanitizeAiText', () => {
  it('keeps prepositions intact', () => {
    expect(sanitizeAiText('Level is estimated at a B2 for speaking.')).toBe('Level is estimated at a B2 for speaking.');
    expect(sanitizeAiText('Strong in grammar, weak on vocabulary.')).toBe('Strong in grammar, weak on vocabulary.');
    expect(sanitizeAiText('Results from the test via email.')).toBe('Results from the test via email.');
  });
  it('removes question ids and tidies spacing', () => {
    expect(sanitizeAiText('Struggled with tenses (wt_q3c) and articles.')).toBe('Struggled with tenses and articles.');
    expect(sanitizeAiText('Missed q45 , then q7.')).toBe('Missed, then.');
  });
  it('handles empty input', () => {
    expect(sanitizeAiText(null)).toBe('');
    expect(sanitizeAiList(['a q1', '', 'b'])).toEqual(['a', 'b']);
  });
});
