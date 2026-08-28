import React from 'react';
import type { MatchVerdict } from '@/lib/answers/matchAnswer';

interface AnswerStatusBadgeProps {
  verdict: MatchVerdict;
  /** Answer key text shown next to a wrong / review verdict. */
  expected?: string;
  /** Compact mode renders only the glyph (used in dense word grids). */
  compact?: boolean;
  className?: string;
}

/**
 * Shared answer status indicator with THREE states.
 * `review` exists so we never tell a student they are wrong when the matcher
 * is not certain — the teacher decides instead.
 */
export const AnswerStatusBadge: React.FC<AnswerStatusBadgeProps> = ({
  verdict,
  expected,
  compact = false,
  className = '',
}) => {
  if (verdict === 'empty') return null;

  if (verdict === 'correct') {
    return (
      <span className={`text-sm font-medium text-green-600 ${className}`}>
        {compact ? '✓' : '✓ Correct'}
      </span>
    );
  }

  if (verdict === 'review') {
    return (
      <span className={`text-sm font-medium text-amber-600 ${className}`}>
        {compact ? '●' : '● Needs teacher review'}
        {expected ? <> ({expected})</> : null}
      </span>
    );
  }

  return (
    <span className={`text-sm font-medium text-red-600 ${className}`}>
      ✗{expected ? <> ({expected})</> : null}
    </span>
  );
};

/** Tailwind classes for the answer input itself, matching the badge state. */
export const answerFieldClasses = (verdict: MatchVerdict): string => {
  switch (verdict) {
    case 'correct':
      return 'bg-green-200 border-2 border-green-600';
    case 'review':
      return 'bg-amber-100 border-2 border-amber-500';
    case 'wrong':
      return 'bg-red-100 border-2 border-red-400';
    default:
      return '';
  }
};

export default AnswerStatusBadge;
