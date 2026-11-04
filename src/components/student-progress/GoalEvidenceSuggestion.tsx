/**
 * Teacher-only DSLM progress suggestion for one goal. Applying it is an explicit
 * teacher action; until then the learner sees only the saved value.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Lightbulb, Trophy, AlertTriangle } from 'lucide-react';
import type { GoalAuditResult } from '@/lib/dslm/goalEvidenceAuditor';

interface Props {
  audit: GoalAuditResult;
  onApply: (pct: number) => void;
  onMarkAchieved?: () => void;
}

export const GoalEvidenceSuggestion: React.FC<Props> = ({ audit, onApply, onMarkAchieved }) => {
  if (!audit.hasNewEvidence || audit.suggestedProgressPct === null) return null;
  const pct = audit.suggestedProgressPct;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs">
      <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="min-w-0">
        DSLM suggests <strong className="tabular-nums">{pct}%</strong>
        {' '}({audit.matchedSkillsCount} skill{audit.matchedSkillsCount === 1 ? '' : 's'}, {audit.confidence} confidence)
      </span>
      {audit.statusRecommendation === 'at_risk' && (
        <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />behind schedule</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">Evidence</Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">{audit.rationale}</p>
            <ul className="space-y-1">
              {audit.supportingSkills.map((s) => (
                <li key={`${s.category}-${s.name}`} className="flex justify-between gap-2 text-xs">
                  <span className="truncate">{s.name} <span className="text-muted-foreground">({s.category})</span></span>
                  <span className="tabular-nums shrink-0">
                    {s.effectiveMastery}% · {s.eventsCount}x{s.lastTrainedDaysAgo !== null ? ` · ${s.lastTrainedDaysAgo}d ago` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">Suggestion only. The student sees progress after you apply it.</p>
          </PopoverContent>
        </Popover>
        <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => onApply(pct)}>Apply {pct}%</Button>
        {audit.statusRecommendation === 'ready_to_achieve' && onMarkAchieved && (
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onMarkAchieved}>
            <Trophy className="h-3 w-3 mr-1" />Mark achieved
          </Button>
        )}
      </div>
    </div>
  );
};
