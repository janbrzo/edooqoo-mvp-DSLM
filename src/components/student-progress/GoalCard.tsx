/**
 * GoalCard — extracted from StudentProgressTab for reuse in DSLM GoalsView.
 * v4.2: shows deadline badge ("Due in X days") when goal.target_date is set.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Star, Calendar, Pencil, CheckCircle2, Archive, ArchiveRestore, Target as TargetIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { GoalProgressBar } from './GoalProgressBar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface GoalCardProps {
  goal: any;
  onDelete: () => void;
  onAddElement: () => void;
  onRateElement: (elementId: string, rating: number) => void;
  onDeleteElement: (elementId: string) => void;
  /** v5.0 actions */
  onEdit?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onMarkAchieved?: () => void;
  onSetManualProgress?: (pct: number | null) => void;
  progressPct?: number | null;
  isManualOverride?: boolean;
  signalsLabel?: string;
  isSuggested?: boolean;
}

const formatDeadline = (targetDate?: string | null): string | null => {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const now = new Date();
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Past deadline';
  if (diffDays === 0) return 'Due today';
  if (diffDays <= 30) return `Due in ${diffDays}d`;
  const months = Math.round(diffDays / 30);
  return `Due in ${months}mo`;
};

export const GoalCard: React.FC<GoalCardProps> = ({
  goal, onDelete, onAddElement, onRateElement, onDeleteElement,
  onEdit, onArchive, onUnarchive, onMarkAchieved, onSetManualProgress,
  progressPct, isManualOverride, signalsLabel, isSuggested,
}) => {
  const deadline = formatDeadline(goal.target_date);
  const isArchived = !!goal.archived_at;
  const isAchieved = !!goal.is_achieved;
  const manualValue = typeof goal.manual_progress_pct === 'number' ? goal.manual_progress_pct : 0;
  return (
    <div className={cn(
      'border rounded-lg p-3 space-y-2',
      isAchieved && 'border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20',
      isArchived && 'opacity-60',
      isSuggested && 'opacity-70 grayscale-[0.3] bg-muted/30',
    )}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">{goal.title}</h4>
            {isAchieved && <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700">achieved</Badge>}
            {isArchived && <Badge variant="outline" className="text-[10px]">archived</Badge>}
            {progressPct !== undefined && (
              <GoalProgressBar value={progressPct ?? null} isManualOverride={isManualOverride} signalsLabel={signalsLabel} className="ml-auto" />
            )}
          </div>
          {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
          {deadline && (
            <Badge variant="outline" className="mt-1 text-[10px] flex items-center gap-1 w-fit">
              <Calendar className="h-3 w-3" />
              {deadline}
            </Badge>
          )}
        </div>
        <TooltipProvider delayDuration={200}>
        <div className="flex gap-0.5 shrink-0 ml-2">
          {!isArchived && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Add learning element" className="h-7 w-7 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9" onClick={onAddElement}><Plus className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Add learning element</TooltipContent>
            </Tooltip>
          )}
          {onEdit && !isArchived && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Edit goal" className="h-7 w-7 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
              </TooltipTrigger>
              <TooltipContent>Edit goal</TooltipContent>
            </Tooltip>
          )}
          {onSetManualProgress && !isArchived && !isAchieved && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Set manual progress" className="h-7 w-7 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9" title="Set manual progress">
                  <TargetIcon className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 space-y-2">
                <p className="text-xs font-medium">Manual progress</p>
                <div className="flex items-center gap-2">
                  <Slider
                    defaultValue={[manualValue]}
                    max={100}
                    step={5}
                    onValueCommit={(v) => onSetManualProgress(v[0])}
                  />
                  <span className="text-xs tabular-nums w-10 text-right">{manualValue}%</span>
                </div>
                <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => onSetManualProgress(null)}>
                  Clear override
                </Button>
              </PopoverContent>
            </Popover>
          )}
          {onMarkAchieved && !isArchived && !isAchieved && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Mark goal as achieved" className="h-7 w-7 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 text-emerald-600 hover:text-emerald-700" onClick={onMarkAchieved}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark as achieved</TooltipContent>
            </Tooltip>
          )}
          {onArchive && !isArchived && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Archive goal" className="h-7 w-7 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9" onClick={onArchive}>
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Archive (no longer relevant)</TooltipContent>
            </Tooltip>
          )}
          {onUnarchive && isArchived && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Restore goal from archive" className="h-7 w-7 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9" onClick={onUnarchive}>
                  <ArchiveRestore className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restore from archive</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Delete goal" className="h-7 w-7 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent>Delete goal</TooltipContent>
          </Tooltip>
        </div>
        </TooltipProvider>
      </div>
      {goal.elements?.length > 0 && (
        <div className="space-y-1 pt-2 border-t">
          {goal.elements.map((el: any) => (
            <div key={el.id} className="flex items-center justify-between text-sm py-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{el.element_type}</Badge>
                <span>{el.title}</span>
              </div>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(r => (
                  <button key={r} onClick={() => onRateElement(el.id, r)} className="p-0.5">
                    <Star className={`h-4 w-4 ${el.current_rating >= r ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
                  </button>
                ))}
                <Button size="icon" variant="ghost" aria-label="Delete learning element" className="h-6 w-6 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 ml-1" onClick={() => onDeleteElement(el.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
