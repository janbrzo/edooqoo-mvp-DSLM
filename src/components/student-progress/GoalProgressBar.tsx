/**
 * GoalProgressBar — DSLM v5.0
 *
 * Renders a compact progress bar + percentage for a goal.
 * `value === null` renders a dash ("—") instead of 0% to distinguish "no signals"
 * from "0% completed".
 */
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface GoalProgressBarProps {
  value: number | null;
  isManualOverride?: boolean;
  signalsLabel?: string;
  className?: string;
}

export const GoalProgressBar: React.FC<GoalProgressBarProps> = ({ value, isManualOverride, signalsLabel, className }) => {
  if (value === null) {
    return (
      <span className={`text-[11px] text-muted-foreground ${className || ''}`} title="No ratings or skill matches yet — rate elements or generate skill metrics to see progress.">—</span>
    );
  }
  const tooltipLines = [
    `Progress: ${value}%`,
    signalsLabel ? `Sources: ${signalsLabel}` : 'Sources: learning element ratings + skill metrics',
    isManualOverride ? 'Manual override active (lifts the computed value, never lowers it).' : null,
  ].filter(Boolean).join('\n');
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 ${className || ''}`}>
            <Progress value={value} className="h-1.5 w-16 sm:w-24" />
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums shrink-0">
              {value}%{isManualOverride ? '*' : ''}
            </span>
            <a
              href="/blog/how-goal-progress-is-calculated-esl.html"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Learn more about Goal Progress"
            >
              <HelpCircle className="h-3 w-3" />
            </a>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-line text-[11px]">
          {tooltipLines}
          {'\n'}Click the (?) icon → "Learn more about Goal Progress".
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};