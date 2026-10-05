/**
 * GoalsSummary: the destination in a few lines: main goal (deadline +
 * progress) and up to three active goals. Everything else (elements,
 * ratings, achieved/archived goals, goal notes) opens in the goals panel.
 */
import React, { forwardRef } from 'react';
import { ChevronRight, Pencil, Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GoalProgressBar } from '@/components/student-progress/GoalProgressBar';
import { formatDeadline } from '@/lib/students/studentSnapshot';
import { PlanSection } from './PlanSection';

export interface GoalSummaryRow {
  id: string;
  title: string;
  targetDate: string | null;
  pct: number | null;
}

interface GoalsSummaryProps {
  mainGoalLabel: string | null;
  mainGoalTargetDate: string | null;
  mainGoalPct: number | null;
  goals: readonly GoalSummaryRow[];
  totalGoals: number;
  onEditMainGoal: () => void;
  onAddGoal: () => void;
  onOpenAll: () => void;
}

const MAX_ROWS = 3;

export const GoalsSummary = forwardRef<HTMLElement, GoalsSummaryProps>(
  ({ mainGoalLabel, mainGoalTargetDate, mainGoalPct, goals, totalGoals, onEditMainGoal, onAddGoal, onOpenAll }, ref) => {
    const mainDeadline = formatDeadline(mainGoalTargetDate);
    const hidden = Math.max(0, goals.length - MAX_ROWS);
    return (
      <PlanSection
        ref={ref}
        id="plan-goals"
        title="Goals"
        action={
          <Button variant="ghost" size="sm" onClick={onAddGoal}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Add goal
          </Button>
        }
      >
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
            <Target className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 break-words text-sm font-semibold text-foreground">
              {mainGoalLabel || 'Main goal not set'}
            </span>
            {mainDeadline && <span className="text-xs text-muted-foreground">by {mainDeadline}</span>}
            <GoalProgressBar value={mainGoalPct} />
            <Button variant="ghost" size="sm" className="ml-auto h-8" onClick={onEditMainGoal}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Edit
            </Button>
          </div>
          {goals.slice(0, MAX_ROWS).map((goal) => {
            const due = formatDeadline(goal.targetDate);
            return (
              <div key={goal.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 pl-10">
                <span className="min-w-0 flex-1 break-words text-sm text-foreground">{goal.title}</span>
                {due && <span className="text-xs text-muted-foreground">due {due}</span>}
                <GoalProgressBar value={goal.pct} />
              </div>
            );
          })}
          {goals.length === 0 && (
            <p className="px-3 py-2 pl-10 text-sm text-muted-foreground">
              No specific goals yet. A concrete goal ("Run a 30-minute client meeting") makes suggestions sharper.
            </p>
          )}
        </div>
        <Button variant="link" size="sm" className="h-auto px-0" onClick={onOpenAll}>
          All goals & notes ({totalGoals}{hidden > 0 ? `, ${hidden} more active` : ''})
          <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden="true" />
        </Button>
      </PlanSection>
    );
  },
);
GoalsSummary.displayName = 'GoalsSummary';
