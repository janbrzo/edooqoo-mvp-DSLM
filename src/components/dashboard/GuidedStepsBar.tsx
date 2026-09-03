import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GuidedStepKey = 'add_student' | 'generate_worksheet' | 'create_homework';

export interface GuidedStep {
  key: GuidedStepKey;
  label: string;
  done: boolean;
}

interface GuidedStepsBarProps {
  steps: GuidedStep[];
  onShowEverything: () => void;
}

/** Pure helper — builds the 3 guided steps from `onboarding_progress.steps`. */
export function guidedSteps(steps: Partial<Record<GuidedStepKey, boolean>> | undefined): GuidedStep[] {
  return [
    { key: 'add_student', label: 'Add a student', done: !!steps?.add_student },
    { key: 'generate_worksheet', label: 'Prepare a lesson', done: !!steps?.generate_worksheet },
    { key: 'create_homework', label: 'Send homework', done: !!steps?.create_homework },
  ];
}

/**
 * v6.9.109 — three-step guided bar shown to new accounts on the Today dashboard.
 * Disappears permanently once the teacher generates a worksheet or clicks
 * "Show everything" (which dismisses onboarding).
 */
export const GuidedStepsBar: React.FC<GuidedStepsBarProps> = ({ steps, onShowEverything }) => {
  const firstOpenIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <ol role="list" className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {steps.map((step, i) => {
          const isCurrent = i === firstOpenIndex;
          const Icon = step.done ? CheckCircle2 : Circle;
          return (
            <li
              key={step.key}
              role="listitem"
              className={cn(
                'flex items-center gap-2 text-sm',
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <Icon
                className={cn('h-4 w-4 shrink-0', step.done ? 'text-primary' : 'text-muted-foreground')}
                aria-hidden="true"
              />
              <span>
                {i + 1} {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-xs" onClick={onShowEverything}>
        Show everything
      </Button>
    </div>
  );
};

export default GuidedStepsBar;
