/**
 * PhaseAdvanceProposalCard: shown inside "Needs your OK" when the evidence says the
 * weak skills of the current phase recovered. The teacher accepts (phase done, next
 * planned phase starts) or dismisses; nothing advances automatically (audit 9.6, D14).
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Flag } from 'lucide-react';
import type { PhaseAdvanceProposal } from '@/hooks/dslm/usePhaseAdvanceProposals';

interface Props {
  proposal: PhaseAdvanceProposal;
  phaseTitle: string;
  nextPhaseTitle: string | null;
  onAccept: (proposal: PhaseAdvanceProposal) => void;
  onDismiss: (proposal: PhaseAdvanceProposal) => void;
}

export const PhaseAdvanceProposalCard: React.FC<Props> = ({ proposal, phaseTitle, nextPhaseTitle, onAccept, onDismiss }) => {
  const recovered = Array.isArray(proposal.evidence?.recovered) ? proposal.evidence!.recovered! : [];
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5" data-testid="phase-advance-proposal">
      <div className="flex items-start gap-2">
        <Flag className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-foreground">Ready for the next phase?</span>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {proposal.evidence?.reason || 'Fresh results show the weak skills of this phase have recovered.'}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-foreground leading-snug">
        Mark <span className="font-medium">{phaseTitle}</span> as done
        {nextPhaseTitle ? <> and start <span className="font-medium">{nextPhaseTitle}</span></> : null}.
      </p>

      {recovered.length > 0 && (
        <ul className="space-y-0.5 pl-4 list-disc marker:text-muted-foreground/50">
          {recovered.slice(0, 6).map((label) => (
            <li key={label} className="text-[11px] text-muted-foreground leading-tight">{label}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-[11px] flex-1 gap-1.5" onClick={() => onAccept(proposal)}>
          <Check className="h-3 w-3" aria-hidden="true" /> Accept
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[11px] flex-1 gap-1.5" onClick={() => onDismiss(proposal)}>
          <X className="h-3 w-3" aria-hidden="true" /> Dismiss
        </Button>
      </div>
    </div>
  );
};
