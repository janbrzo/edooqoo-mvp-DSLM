/**
 * ModelCockpitHeader — Learning model cockpit (Model Cockpit v1.0, step 1).
 * One compact status strip above all Learning model perspectives:
 * model maturity, signal counts, level, pacing and goal deadlines.
 * Presentation only — reuses existing hooks/props, no new queries.
 */
import React from 'react';
import { Activity, BookOpen, FileText, GraduationCap, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { computeModelHealth } from '@/lib/dslm/modelHealth';

interface ModelCockpitHeaderProps {
  englishLevel: string;
  totalLessons: number;
  totalWorksheets: number;
  pacingProposalsCount: number;
  /** Pacing control (PacingModeSlider) rendered by the parent. */
  pacingSlot?: React.ReactNode;
  /** Goal/deadline badges rendered by the parent. */
  goalSlot?: React.ReactNode;
}

const healthCls = {
  calibrating: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  learning: 'border-primary/40 bg-primary/10 text-primary',
  tuned: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
} as const;

const Stat: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <Icon className="h-3.5 w-3.5 shrink-0" />
    <span className="font-semibold text-foreground">{value}</span>
    <span>{label}</span>
  </div>
);

export const ModelCockpitHeader: React.FC<ModelCockpitHeaderProps> = ({
  englishLevel, totalLessons, totalWorksheets, pacingProposalsCount, pacingSlot, goalSlot,
}) => {
  const health = computeModelHealth({ totalLessons, totalWorksheets });

  return (
    <section
      aria-label="Learning model status"
      data-testid="model-cockpit"
      className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <Badge variant="outline" className={cn('gap-1 shrink-0', healthCls[health.level])}>
            <Activity className="h-3 w-3" />
            Model: {health.label}
          </Badge>
          <p className="text-xs text-muted-foreground min-w-0">{health.hint}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pacingProposalsCount > 0 && (
            <Badge variant="outline" className="gap-1 text-[10px] border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400">
              <Bell className="h-3 w-3" />
              {pacingProposalsCount} pacing proposal{pacingProposalsCount > 1 ? 's' : ''}
            </Badge>
          )}
          {pacingSlot}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Stat icon={GraduationCap} label="level" value={englishLevel || '—'} />
        <Stat icon={BookOpen} label={totalLessons === 1 ? 'lesson' : 'lessons'} value={totalLessons} />
        <Stat icon={FileText} label={totalWorksheets === 1 ? 'worksheet' : 'worksheets'} value={totalWorksheets} />
        {goalSlot && <div className="min-w-0 sm:ml-auto">{goalSlot}</div>}
      </div>
    </section>
  );
};
