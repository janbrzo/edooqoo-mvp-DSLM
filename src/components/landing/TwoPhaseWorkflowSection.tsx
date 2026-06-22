import React from 'react';
import {
  Brain,
  Lightbulb,
  Radio,
} from 'lucide-react';
import {
  lessonSignalWorkflowCopy,
  lessonSignalWorkflowSteps,
  setupWorkflowSteps,
  weeklyWorkflowSteps,
} from '@/constants/oneMinutePrepWorkflowProof';
import { cn } from '@/lib/utils';

interface TwoPhaseWorkflowSectionProps {
  compact?: boolean;
  className?: string;
}

const workflowParts = [
  {
    eyebrow: 'Phase 1: One-time student setup',
    title: 'Build the learner context once',
    description:
      'One-time setup is not the 1-minute claim. It creates the student context Edooqoo needs before recurring prep can become faster and more precise.',
    support: undefined,
    icon: Brain,
    tone: 'setup',
    steps: setupWorkflowSteps,
  },
  {
    eyebrow: lessonSignalWorkflowCopy.eyebrow,
    title: lessonSignalWorkflowCopy.title,
    description: lessonSignalWorkflowCopy.description,
    support: undefined,
    icon: Radio,
    tone: 'signal',
    steps: lessonSignalWorkflowSteps,
  },
  {
    eyebrow: 'Phase 2: Weekly 1-Minute Prep flow',
    title: 'Run the recurring prep loop',
    description:
      'Weekly prep is the recurring workflow Edooqoo is designed to make fast once student context and learning signals exist.',
    support: undefined,
    icon: Lightbulb,
    tone: 'weekly',
    steps: weeklyWorkflowSteps,
  },
] as const;

const TwoPhaseWorkflowSection: React.FC<TwoPhaseWorkflowSectionProps> = ({ compact = false, className }) => (
  <section className={cn('border-y border-primary/10 bg-primary/5 px-4 py-8', className)}>
    <div className="mx-auto max-w-6xl">
      <div className={cn('mb-6 text-center', compact && 'mx-auto max-w-3xl')}>
        <h2 className={cn('font-bold text-foreground', compact ? 'text-2xl' : 'text-2xl md:text-3xl')}>
          The 1-Minute Prep workflow has three connected parts
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Setup builds the learner context, lesson activity adds evidence, and weekly prep uses that context before worksheet output.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        {workflowParts.map(({ eyebrow, title, description, support, icon: Icon, tone, steps }) => (
            <div
              key={title}
              className={cn(
                'flex h-full flex-col rounded-xl border p-5 shadow-sm',
                tone === 'setup' && 'border-violet-100 bg-background',
                tone === 'signal' && 'border-blue-100 bg-blue-50/70',
                tone === 'weekly' && 'border-primary/20 bg-primary/10'
              )}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className={cn('rounded-lg p-2', tone === 'setup' ? 'bg-violet-100' : 'bg-primary/15')}>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
                  <h3 className={cn('font-bold text-foreground', compact ? 'text-lg' : 'text-xl')}>{title}</h3>
                </div>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              {support ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{support}</p> : null}
              <div className={cn('mt-4 grid gap-2', tone === 'signal' && 'sm:grid-cols-2')}>
                {steps.map(({ icon: StepIcon, label, badge, nowrap, span }) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground',
                      span === 'full' && 'sm:col-span-2'
                    )}
                  >
                    <StepIcon className="h-4 w-4 shrink-0 text-primary" />
                    <span className={cn('min-w-0 flex-1', nowrap && 'whitespace-nowrap text-xs sm:text-sm')}>{label}</span>
                    {badge ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        {badge}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
        ))}
      </div>
    </div>
  </section>
);

export default TwoPhaseWorkflowSection;

