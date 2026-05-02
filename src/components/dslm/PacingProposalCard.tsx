/**
 * PacingProposalCard — DSLM v4.9
 *
 * Inline card shown inside a single student's Pathway view when a pending
 * pacing proposal exists for them. Lets the teacher accept or reject in 1 click.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gauge, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PacingProposal, triggerLabel, usePacingProposals } from '@/hooks/usePacingProposals';
import { pacingLabel } from './PacingModeSlider';

interface Props {
  proposal: PacingProposal;
}

const bucketColor = (v: number) => {
  if (v <= 30) return 'bg-blue-500/15 text-blue-700 border-blue-500/30';
  if (v >= 70) return 'bg-orange-500/15 text-orange-700 border-orange-500/30';
  return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
};

const TRIGGER_SENTENCES: Record<string, string> = {
  goal_added:     'A new goal was added with a fixed deadline, so the system rebalanced the learning rhythm to match the available time.',
  placement_test: 'The placement test exposed a clearer profile of this learner — strengths, weaknesses, and behavioural traits — that shifts the optimal pace.',
  periodic_30d:   'A scheduled 30-day re-check looked at the latest skill mastery, deadline pressure, and behavioural signals to keep the pace honest.',
  manual:         'The teacher requested a recalculation. The system aggregated all current signals.',
};

const buildExplanation = (p: PacingProposal): string => {
  const direction = p.proposed_pacing > p.current_pacing ? 'pragmatic' : 'scientific';
  const delta = Math.abs(p.proposed_pacing - p.current_pacing);
  const trigger = TRIGGER_SENTENCES[p.trigger_type] ?? 'The system re-evaluated all available signals.';
  const directionSentence = direction === 'pragmatic'
    ? 'Signals point toward task-based, just-in-time grammar (TBLT) — the learner benefits from producing language for real situations rather than drilling rules in isolation.'
    : 'Signals point toward Krashen Natural Order — the learner needs more comprehensible input and structured grammar progression before being pushed to produce.';
  const magnitude = delta >= 20
    ? `The shift is significant (${delta} points), so review the reasoning carefully before accepting.`
    : `The shift is modest (${delta} points) but worth confirming.`;
  return `${trigger} ${directionSentence} ${magnitude}`;
};

export const PacingProposalCard: React.FC<Props> = ({ proposal }) => {
  const { accept, reject } = usePacingProposals(proposal.student_id);
  const delta = proposal.proposed_pacing - proposal.current_pacing;
  const direction = delta > 0 ? 'Pragmatic' : 'Scientific';
  const explanation = buildExplanation(proposal);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">Pacing recheck suggested</span>
            <Badge variant="outline" className="text-[9px] py-0 h-4 border-border">
              {triggerLabel(proposal.trigger_type)}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Auto-recalculated based on the student's latest signals — teacher approval required.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline" className={cn('text-[10px]', bucketColor(proposal.current_pacing))}>
          <Gauge className="h-2.5 w-2.5 mr-0.5" />
          Now: {pacingLabel(proposal.current_pacing)} · {proposal.current_pacing}
        </Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant="outline" className={cn('text-[10px]', bucketColor(proposal.proposed_pacing))}>
          {pacingLabel(proposal.proposed_pacing)} · {proposal.proposed_pacing}
        </Badge>
        <span className={cn('text-[10px] font-medium', delta > 0 ? 'text-orange-600' : 'text-blue-600')}>
          ({delta > 0 ? '+' : ''}{delta} → {direction})
        </span>
      </div>

      <div className="rounded-md bg-background/60 border border-border/60 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Why this change</p>
        <p className="text-[11px] text-foreground leading-snug">{explanation}</p>
      </div>

      {proposal.reasoning?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Signals</p>
          <ul className="space-y-0.5 pl-4 list-disc marker:text-muted-foreground/50">
            {proposal.reasoning.slice(0, 6).map((r, i) => (
              <li key={i} className="text-[11px] text-muted-foreground leading-tight">{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-[11px] flex-1 gap-1.5" onClick={() => accept(proposal)}>
          <Check className="h-3 w-3" /> Accept
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[11px] flex-1 gap-1.5" onClick={() => reject(proposal)}>
          <X className="h-3 w-3" /> Dismiss
        </Button>
      </div>
    </div>
  );
};
