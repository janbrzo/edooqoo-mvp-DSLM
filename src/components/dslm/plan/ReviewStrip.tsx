/**
 * ReviewStrip: "Needs your OK": every change the system proposes and the
 * teacher must approve, in one place (it used to be spread over the roadmap
 * header, the pathway body and the goals section). Same amber language as
 * the dashboard "Needs your attention" zone. Renders nothing when empty.
 */
import React from 'react';
import { SuggestedLevelChangeBanner } from '@/components/student-tests/SuggestedLevelChangeBanner';
import { PacingProposalCard } from '@/components/dslm/PacingProposalCard';
import type { PacingProposal } from '@/hooks/usePacingProposals';
import type { ProgressGoal } from '@/types/studentProgress';
import { PlanSection } from './PlanSection';
import { SuggestedGoalsCard } from './SuggestedGoalsCard';

interface ReviewStripProps {
  studentId: string;
  englishLevel: string;
  pendingCount: number;
  showLevelChange: boolean;
  pacingProposals: readonly PacingProposal[];
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
  goals,
  hasSuggestedGoals,
  updateGoal,
  deleteGoal,
  onResolved,
}) => {
  if (pendingCount <= 0) return null;
  return (
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
        {hasSuggestedGoals && (
          <SuggestedGoalsCard goals={goals} updateGoal={updateGoal} deleteGoal={deleteGoal} onChanged={onResolved} />
        )}
      </div>
    </PlanSection>
  );
};
