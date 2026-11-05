/**
 * Teacher-only trajectory hint for one goal (Goals Step 3). Changing the date
 * is always an explicit teacher click; nothing is written automatically.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Gauge, CalendarClock } from 'lucide-react';
import type { VelocityResult } from '@/lib/dslm/deadlineVelocity';
import { cn } from '@/lib/utils';

interface Props {
  velocity: VelocityResult;
  onSetTargetDate?: (isoDate: string) => void;
}

const VISIBLE = new Set(['tension', 'lagging', 'overdue']);

export const GoalVelocityHint: React.FC<Props> = ({ velocity, onSetTargetDate }) => {
  if (!VISIBLE.has(velocity.status)) return null;
  const strong = velocity.status !== 'tension';
  return (
    <div className={cn(
      'flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
      strong ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/40',
    )}>
      <Gauge className={cn('h-3.5 w-3.5 shrink-0', strong ? 'text-destructive' : 'text-muted-foreground')} />
      <span className="min-w-0">
        {velocity.message}
        {velocity.timeElapsedPct !== null && velocity.progressPct !== null && (
          <span className="text-muted-foreground tabular-nums"> ({velocity.progressPct}% done, {velocity.timeElapsedPct}% of time used)</span>
        )}
      </span>
      {velocity.recommendation === 'extend' && velocity.suggestedTargetDate && onSetTargetDate && (
        <Button size="sm" variant="outline" className="ml-auto h-6 px-2 text-xs" onClick={() => onSetTargetDate(velocity.suggestedTargetDate!)}>
          <CalendarClock className="h-3 w-3 mr-1" />Move to {velocity.suggestedTargetDate}
        </Button>
      )}
    </div>
  );
};
