/**
 * StudentPathwayBadges — secondary context badges (lessons, goal, deadline) shown next to the "Pathway" section header.
 */
import React from 'react';
import { Calendar, Target } from 'lucide-react';
import { formatGoalLabel } from '@/constants/studentGoals';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StudentPathwayBadgesProps {
  totalLessons: number;
  mainGoal: string;
  mainGoalTargetDate: string | null;
  /** v5.2: nearest non-main active goal deadline, shown as a secondary blue badge */
  nearestGoalDeadline?: { date: string; title: string; goalType: string } | null;
}

const getDeadlineInfo = (date: string | null): { label: string; urgent: boolean; days: number } | null => {
  if (!date) return null;
  const target = new Date(date).getTime();
  const now = Date.now();
  const days = Math.round((target - now) / (1000 * 60 * 60 * 24));
  let label: string;
  let urgent = false;
  if (days < 0)        { label = `overdue ${Math.abs(days)}d`; urgent = true; }
  else if (days === 0) { label = 'deadline today';             urgent = true; }
  else if (days < 30)  { label = `in ${days}d`;                urgent = true; }
  else if (days < 60)  { label = 'in 1 month'; }
  else if (days < 365) { label = `in ${Math.round(days / 30)} months`; }
  else                 { label = `in ${Math.round(days / 365)}y`; }
  return { label, urgent, days };
};

const formatExactDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
};

export const StudentPathwayBadges: React.FC<StudentPathwayBadgesProps> = ({
  totalLessons,
  mainGoal,
  mainGoalTargetDate,
  nearestGoalDeadline,
}) => {
  const deadline = getDeadlineInfo(mainGoalTargetDate);
  const goalLabel = mainGoal ? formatGoalLabel(mainGoal) : null;
  const nearestDeadline = nearestGoalDeadline
    ? getDeadlineInfo(nearestGoalDeadline.date)
    : null;
  const showNearest = !!(nearestDeadline && nearestGoalDeadline && nearestGoalDeadline.date !== mainGoalTargetDate);

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex flex-wrap items-center gap-1.5 justify-end">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground whitespace-nowrap">
        {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}
      </span>
      {goalLabel && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap cursor-help',
              deadline?.urgent
                ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                : deadline
                  ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                  : 'bg-secondary text-secondary-foreground'
            )}>
              <Target className="h-3 w-3" />
              <span className="truncate max-w-[180px]">Main goal: {goalLabel}</span>
              {deadline && (
                <>
                  <Calendar className="h-3 w-3 ml-0.5" />
                  <span>{deadline.label}</span>
                </>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="font-semibold">Main goal</div>
              <div className="text-muted-foreground">{goalLabel}</div>
              {mainGoalTargetDate && deadline && (
                <div className="pt-1 border-t border-border/50">
                  <div>Deadline: <span className="font-medium">{formatExactDate(mainGoalTargetDate)}</span></div>
                  <div className={cn(deadline.urgent && 'text-red-500 font-medium')}>
                    {deadline.days < 0 ? `${Math.abs(deadline.days)} days overdue` : `${deadline.days} days remaining`}
                  </div>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
      {showNearest && nearestDeadline && nearestGoalDeadline && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap cursor-help',
              nearestDeadline.urgent
                ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
            )}>
              <Calendar className="h-3 w-3" />
              <span className="truncate max-w-[180px]">Nearest goal: {nearestGoalDeadline.title}</span>
              <span className="opacity-80">· {nearestDeadline.label}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="font-semibold capitalize">{nearestGoalDeadline.goalType} goal</div>
              <div className="text-muted-foreground">{nearestGoalDeadline.title}</div>
              <div className="pt-1 border-t border-border/50">
                <div>Deadline: <span className="font-medium">{formatExactDate(nearestGoalDeadline.date)}</span></div>
                <div className={cn(nearestDeadline.urgent && 'text-red-500 font-medium')}>
                  {nearestDeadline.days < 0 ? `${Math.abs(nearestDeadline.days)} days overdue` : `${nearestDeadline.days} days remaining`}
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    </TooltipProvider>
  );
};
