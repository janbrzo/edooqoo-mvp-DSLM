import { describe, it, expect } from 'vitest';
import { closedMark } from '../closedMark';
import type { AiEvaluation } from '@/components/homework/AiEvaluationBadge';

const ev = (over: Partial<AiEvaluation>): AiEvaluation => ({
  is_acceptable: false,
  quality_score: 0,
  feedback: 'x',
  question_index: 0,
  ...over,
});

describe('closedMark', () => {
  it('takes the mark from the key verdict, not from the AI score', () => {
    expect(closedMark(ev({ key_verdict: 'correct', is_acceptable: false, quality_score: 0.1 }))).toBe('correct');
    expect(closedMark(ev({ key_verdict: 'wrong', is_acceptable: false }))).toBe('wrong');
    expect(closedMark(ev({ key_verdict: 'review' }))).toBe('review');
  });

  it('shows an accepted alternative as review instead of wrong', () => {
    expect(closedMark(ev({ key_verdict: 'wrong', is_acceptable: true }))).toBe('review');
  });

  it('falls back to is_acceptable for older evaluations without a verdict', () => {
    expect(closedMark(ev({ is_acceptable: true }))).toBe('correct');
    expect(closedMark(ev({ is_acceptable: false }))).toBe('wrong');
  });
});
