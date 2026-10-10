/**
 * ClosedAiExplanations - AI "why" for closed exercises.
 * The mark (check / cross / approx) comes from the deterministic answer-key verdict,
 * never from the AI score. The AI only supplies the explanation text.
 */

import type { AiEvaluation } from "./AiEvaluationBadge";

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

const MARK_VIEW: Record<ClosedMark, { symbol: string; className: string }> = {
  correct: { symbol: '✓', className: 'text-green-600' },
  wrong: { symbol: '✗', className: 'text-red-600' },
  review: { symbol: '≈', className: 'text-amber-600' },
};

interface ClosedAiExplanationsProps {
  evaluations?: Record<number, AiEvaluation>;
  className?: string;
}

export function ClosedAiExplanations({ evaluations, className }: ClosedAiExplanationsProps) {
  if (!evaluations) return null;
  const items = Object.values(evaluations)
    .filter(e => e && e.quality_score >= 0 && e.feedback?.trim())
    .sort((a, b) => (a.question_index ?? 0) - (b.question_index ?? 0));
  if (items.length === 0) return null;

  return (
    <div
      className={`mt-4 rounded-md border bg-muted/40 p-3${className ? ` ${className}` : ''}`}
      data-testid="closed-ai-feedback"
    >
      <p className="text-xs font-semibold text-muted-foreground mb-2">AI explanations</p>
      <ul className="space-y-1.5">
        {items.map((e, i) => {
          const view = MARK_VIEW[closedMark(e)];
          return (
            <li key={e.question_index ?? i} className="flex items-start gap-2 text-xs leading-snug">
              <span className={`font-semibold shrink-0 ${view.className}`}>
                {(e.question_index ?? 0) + 1}. {view.symbol}
              </span>
              <span className="text-muted-foreground">{e.feedback}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ClosedAiExplanations;
