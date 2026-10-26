/**
 * ReviewStrip: "Needs your OK": every change the system proposes and the
 * teacher must approve, in one place (it used to be spread over the roadmap
 * header, the pathway body and the goals section). Same amber language as
 * the dashboard "Needs your attention" zone. Renders nothing when empty.
 */
import React from 'react';
import { SuggestedLevelChangeBanner } from '@/components/student-tests/SuggestedLevelChangeBanner';
import { PacingProposalCard } from '@/components/dslm/PacingProposalCard';
import { PhaseAdvanceProposalCard } from '@/components/dslm/PhaseAdvanceProposalCard';
import type { PacingProposal } from '@/hooks/usePacingProposals';
import type { PhaseAdvanceProposal } from '@/hooks/dslm/usePhaseAdvanceProposals';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import type { ProgressGoal } from '@/types/studentProgress';
import { PlanSection } from './PlanSection';
import { SuggestedGoalsCard } from './SuggestedGoalsCard';

interface ReviewStripProps {
  studentId: string;
  englishLevel: string;
  pendingCount: number;
  showLevelChange: boolean;
  pacingProposals: readonly PacingProposal[];
  phaseAdvanceProposals?: readonly PhaseAdvanceProposal[];
  phaseTitleById?: ReadonlyMap<string, string>;
  onAcceptPhaseAdvance?: (proposal: PhaseAdvanceProposal) => void;
  onDismissPhaseAdvance?: (proposal: PhaseAdvanceProposal) => void;
  /** One reminder line (D14): never counted in `pendingCount`, never regenerates by itself. */
  staleNotice?: string | null;
  onRefreshPlan?: () => void;
  goals: readonly ProgressGoal[];
  hasSuggestedGoals: boolean;
  updateGoal: (goalId: string, updates: { accepted_at?: string | null }) => Promise<boolean>;
  deleteGoal: (goalId: string) => Promise<unknown>;
  onResolved: () => void;
}

export const ReviewStrip: React.FC<ReviewStripProps> = ({
  studentId,
  englishLevel,
  pendingCount,
  showLevelChange,
  pacingProposals,
  phaseAdvanceProposals = [],
  phaseTitleById,
  onAcceptPhaseAdvance,
  onDismissPhaseAdvance,
  staleNotice = null,
  onRefreshPlan,
  goals,
  hasSuggestedGoals,
  updateGoal,
  deleteGoal,
  onResolved,
}) => {
  const staleLine = staleNotice ? (
    <div
      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
      data-testid="stale-plan-notice"
    >
      <p className="text-xs text-muted-foreground">{staleNotice}</p>
      {onRefreshPlan && (
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px] flex-shrink-0" onClick={onRefreshPlan}>
          <RefreshCw className="h-3 w-3" aria-hidden="true" /> Refresh plan
        </Button>
      )}
    </div>
  ) : null;
  if (pendingCount <= 0) return staleLine;
  return (
    <div className="space-y-3">
    <PlanSection id="plan-review" title={`Needs your OK (${pendingCount})`}>
      <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 sm:p-3">
        {showLevelChange && (
          <SuggestedLevelChangeBanner
            studentId={studentId}
            currentLevel={englishLevel}
            onApplied={onResolved}
            onDismissed={onResolved}
          />
        )}
        {pacingProposals.map((proposal) => (
          <PacingProposalCard key={proposal.id} proposal={proposal} />
        ))}
        {phaseAdvanceProposals.map((proposal) => (
          <PhaseAdvanceProposalCard
            key={proposal.id}
            proposal={proposal}
            phaseTitle={phaseTitleById?.get(proposal.phase_id) ?? 'This phase'}
            nextPhaseTitle={proposal.next_phase_id ? phaseTitleById?.get(proposal.next_phase_id) ?? null : null}
            onAccept={(p) => onAcceptPhaseAdvance?.(p)}
            onDismiss={(p) => onDismissPhaseAdvance?.(p)}
          />
        ))}
        {hasSuggestedGoals && (
          <SuggestedGoalsCard goals={goals} updateGoal={updateGoal} deleteGoal={deleteGoal} onChanged={onResolved} />
        )}
      </div>
    </PlanSection>
    {staleLine}
    </div>
  );
};
