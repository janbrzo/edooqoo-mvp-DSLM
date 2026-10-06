/**
 * RoadmapStrip: the roadmap at a glance: one marker per phase (done / now /
 * planned) and one sentence about the phase in progress. Every phase opens
 * the roadmap panel, where the full editor (MacroTimeline) lives unchanged.
 */
import React from 'react';
import { Check, Map, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlanSection } from './PlanSection';

export interface RoadmapPhaseView {
  id: string;
  sequence_number: number;
  title: string;
  status: string;
  estimated_weeks_start: number | null;
  estimated_weeks_end: number | null;
}

interface RoadmapStripProps {
  phases: readonly RoadmapPhaseView[];
  currentPhaseId: string | null;
  queuedInCurrentPhase: number;
  useRoadmap: boolean;
  generating: boolean;
  onOpenPhase: (phaseId: string | null) => void;
  onGenerateRoadmap: () => void;
}

const weeksLabel = (phase: RoadmapPhaseView): string | null =>
  phase.estimated_weeks_start && phase.estimated_weeks_end
    ? `weeks ${phase.estimated_weeks_start}–${phase.estimated_weeks_end}`
    : null;

const PhaseMarker: React.FC<{ phase: RoadmapPhaseView; isCurrent: boolean }> = ({ phase, isCurrent }) => {
  const base = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold';
  if (phase.status === 'done') {
    return (
      <span className={cn(base, 'border-emerald-600 bg-emerald-600 text-primary-foreground dark:border-emerald-500 dark:bg-emerald-500')}>
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (isCurrent) return <span className={cn(base, 'border-primary bg-primary text-primary-foreground')}>{phase.sequence_number}</span>;
  if (phase.status === 'draft') return <span className={cn(base, 'border-dashed border-border text-muted-foreground')}>{phase.sequence_number}</span>;
  return <span className={cn(base, 'border-border text-muted-foreground')}>{phase.sequence_number}</span>;
};

const STATUS_TEXT: Record<string, string> = {
  done: 'done',
  in_progress: 'now',
  planned: 'planned',
  draft: 'draft',
};

export const RoadmapStrip: React.FC<RoadmapStripProps> = ({
  phases,
  currentPhaseId,
  queuedInCurrentPhase,
  useRoadmap,
  generating,
  onOpenPhase,
  onGenerateRoadmap,
}) => {
  const current = phases.find((phase) => phase.id === currentPhaseId) ?? null;

  return (
    <PlanSection
      id="plan-roadmap"
      title="Roadmap"
      spotlight="learning-roadmap"
      action={
        phases.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => onOpenPhase(null)}>
            <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" /> Edit roadmap
          </Button>
        ) : null
      }
    >
      {phases.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            No roadmap yet. Optional: it splits the way to the goal into phases, so lessons come in a sensible order.
          </p>
          <Button variant="outline" size="sm" onClick={onGenerateRoadmap} disabled={generating} className="shrink-0">
            <Map className="mr-1.5 h-4 w-4" aria-hidden="true" /> Generate roadmap
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {!useRoadmap && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Roadmap paused</Badge>
              New suggestions ignore the roadmap until you turn it back on.
            </p>
          )}
          <ol className={cn('flex flex-col gap-1 sm:flex-row sm:gap-2', !useRoadmap && 'opacity-60')} aria-label="Roadmap phases">
            {phases.map((phase) => {
              const isCurrent = phase.id === currentPhaseId;
              return (
                <li key={phase.id} className="min-w-0 sm:flex-1">
                  <button
                    type="button"
                    onClick={() => onOpenPhase(phase.id)}
                    title={phase.title}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn(
                      'flex w-full min-w-0 items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors hover:bg-muted/50',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isCurrent ? 'border-primary/50 bg-primary/5' : 'border-border',
                    )}
                  >
                    <PhaseMarker phase={phase} isCurrent={isCurrent} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{phase.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {isCurrent ? 'now' : STATUS_TEXT[phase.status] ?? phase.status}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-sm text-muted-foreground">
            {current ? (
              <>
                <span className="font-medium text-foreground">Now: {current.title}</span>
                {weeksLabel(current) ? ` · ${weeksLabel(current)}` : ''}
                {` · ${queuedInCurrentPhase} lesson${queuedInCurrentPhase === 1 ? '' : 's'} queued in this phase`}
              </>
            ) : (
              'No phase is in progress. Open the roadmap to start one.'
            )}
          </p>
        </div>
      )}
    </PlanSection>
  );
};
