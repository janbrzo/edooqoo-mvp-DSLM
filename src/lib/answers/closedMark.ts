import type { AiEvaluation } from '@/components/homework/AiEvaluationBadge';

export type ClosedMark = 'correct' | 'wrong' | 'review';

/**
 * Resolve the mark for a closed-item evaluation.
 * - key_verdict 'correct' => correct
 * - key_verdict 'wrong'   => wrong, unless the AI accepted it as an alternative (review)
 * - key_verdict 'review'  => review
 * - missing key_verdict   => fall back to is_acceptable (correct / wrong)
 */
export function closedMark(e: AiEvaluation): ClosedMark {
  switch (e.key_verdict) {
    case 'correct':
      return 'correct';
    case 'wrong':
      return e.is_acceptable ? 'review' : 'wrong';
    case 'review':
      return 'review';
    default:
      return e.is_acceptable ? 'correct' : 'wrong';
  }
}
