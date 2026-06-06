import React from 'react';
import {
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  FileText,
  Goal,
  Lightbulb,
  Map,
  Send,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TwoPhaseWorkflowSectionProps {
  compact?: boolean;
  className?: string;
}

const phaseSummaries = [
  {
    eyebrow: 'Phase 1: One-time student setup',
    title: 'Build the learner context once',
    description:
      'One-time setup is not the 1-minute claim. It creates the student context Edooqoo needs before recurring prep can become faster and more precise.',
    icon: Brain,
    tone: 'setup',
    steps: [
      { icon: UserPlus, label: 'Create account' },
      { icon: Goal, label: 'Add student profile and goals' },
      { icon: Send, label: 'Send Welcome Test, optional' },
      { icon: Map, label: 'Generate Learning Roadmap' },
    ],
  },
  {
    eyebrow: 'Phase 2: Weekly 1-Minute Prep',
    title: 'Run the recurring prep loop',
    description:
      'Weekly prep is the recurring workflow Edooqoo is designed to make fast once student context and learning signals exist.',
    icon: Lightbulb,
    tone: 'weekly',
    steps: [
      { icon: Lightbulb, label: 'Generate Next Lesson Ideas' },
      { icon: CalendarDays, label: 'Use booking context, optional' },
      { icon: CheckCircle2, label: 'Choose the next focus' },
      { icon: FileText, label: 'Create the worksheet output' },
    ],
  },
] as const;

const TwoPhaseWorkflowSection: React.FC<TwoPhaseWorkflowSectionProps> = ({ compact = false, className }) => (
  <section className={cn('border-y border-primary/10 bg-primary/5 px-4 py-8', className)}>
    <div className="mx-auto max-w-6xl">
      <div className={cn('mb-6 text-center', compact && 'mx-auto max-w-3xl')}>
        <h2 className={cn('font-bold text-foreground', compact ? 'text-2xl' : 'text-2xl md:text-3xl')}>
          The 1-Minute Prep workflow has two phases
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The setup phase builds the learner context. The weekly phase is the recurring prep workflow Edooqoo is designed to make fast.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] lg:items-stretch">
        {phaseSummaries.map(({ eyebrow, title, description, icon: Icon, tone, steps }, index) => (
          <React.Fragment key={title}>
            <div
              className={
                tone === 'setup'
                  ? 'rounded-xl border border-violet-100 bg-background p-5 shadow-sm'
                  : 'rounded-xl border border-primary/20 bg-primary/10 p-5 shadow-sm'
              }
            >
              <div className="mb-4 flex items-center gap-3">
                <div className={tone === 'setup' ? 'rounded-lg bg-violet-100 p-2' : 'rounded-lg bg-primary/15 p-2'}>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
                  <h3 className={cn('font-bold text-foreground', compact ? 'text-lg' : 'text-xl')}>{title}</h3>
                </div>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              <div className="mt-4 grid gap-2">
                {steps.map(({ icon: StepIcon, label }) => (
                  <div key={label} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                    <StepIcon className="h-4 w-4 shrink-0 text-primary" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {index === 0 ? (
              <div className="hidden items-center justify-center lg:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-background shadow-sm">
                  <ArrowRight className="h-5 w-5 text-primary" />
                </div>
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  </section>
);

export default TwoPhaseWorkflowSection;

