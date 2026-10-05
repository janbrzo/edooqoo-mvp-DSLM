/**
 * ModelStatusLine: one sentence about the state of the student's plan,
 * at most one optional hint, and "How it works". Replaces the cockpit stats
 * (level, lessons, worksheets, pacing, goal badges): every number here
 * drives a decision.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReadinessImprovement, ReadinessStage } from '@/lib/dslm/modelReadiness';
import { HowItWorksPopover } from './HowItWorksPopover';

export interface ModelStatusLineProps {
  stage: ReadinessStage | 'loading';
  studentName: string;
  doneCount: number;
  totalSteps: number;
  pendingReviewCount: number;
  queuedCount: number;
  /** `Phase 2 of 4`: null when there is no phase in progress. */
  phaseProgress: string | null;
  roadmapPaused: boolean;
  improvement: ReadinessImprovement | null;
  improvementBusy?: boolean;
  onImprovement: (improvement: ReadinessImprovement) => void;
}

const IMPROVEMENT_LABEL: Record<ReadinessImprovement, string> = {
  send_test: 'send the Welcome Test',
  generate_roadmap: 'generate a roadmap',
  add_goal: 'add a specific goal',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function buildSentence(props: ModelStatusLineProps): string {
  const firstName = props.studentName.split(' ')[0] || props.studentName;
  switch (props.stage) {
    case 'loading':
      return 'Loading the plan…';
    case 'setup':
      return `Setting up ${firstName}'s plan · ${props.doneCount} of ${props.totalSteps} done`;
    case 'review':
      return `Plan ready · ${plural(props.pendingReviewCount, 'change needs', 'changes need')} your OK`;
    case 'ready':
    default: {
      const parts = ['Plan ready'];
      if (props.phaseProgress) parts.push(props.phaseProgress);
      parts.push(`${plural(props.queuedCount, 'lesson', 'lessons')} queued`);
      if (props.roadmapPaused) parts.push('roadmap paused');
      return parts.join(' · ');
    }
  }
}

const DOT_CLASS: Record<ModelStatusLineProps['stage'], string> = {
  loading: 'bg-muted-foreground/40',
  setup: 'border-2 border-primary bg-transparent',
  review: 'bg-amber-500',
  ready: 'bg-primary',
};

export const ModelStatusLine: React.FC<ModelStatusLineProps> = (props) => {
  const { stage, improvement, improvementBusy, onImprovement } = props;
  return (
    <section
      aria-label="Learning plan status"
      data-testid="plan-status"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground" aria-live="polite">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT_CLASS[stage])} aria-hidden="true" />
          <span className="min-w-0">{buildSentence(props)}</span>
        </p>
        {improvement && stage !== 'setup' && stage !== 'loading' && (
          <p
            className="pl-[18px] text-xs text-muted-foreground"
            data-spotlight={improvement === 'send_test' ? 'send-welcome-test' : undefined}
          >
            Sharper plan:{' '}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onImprovement(improvement)}
              disabled={improvementBusy}
            >
              {improvementBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              {IMPROVEMENT_LABEL[improvement]} →
            </Button>
          </p>
        )}
      </div>
      <HowItWorksPopover />
    </section>
  );
};
