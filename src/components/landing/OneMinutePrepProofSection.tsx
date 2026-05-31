import React, { useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  ClipboardList,
  FileText,
  Goal,
  Lightbulb,
  Map,
  PlayCircle,
  UserPlus,
} from 'lucide-react';
import {
  PricingCalculator,
  type OneMinutePrepCalculatorInput,
} from '@/components/PricingCalculator';
import { cn } from '@/lib/utils';

type ProofPanel = 'calculator' | 'workflow';

interface OneMinutePrepProofSectionProps {
  calculatorValue: OneMinutePrepCalculatorInput;
  onCalculatorChange: (value: OneMinutePrepCalculatorInput) => void;
  videoSrc?: string;
  posterSrc?: string;
  defaultPanel?: ProofPanel;
}

const setupSteps = [
  { icon: UserPlus, label: 'Add 1 real student' },
  { icon: ClipboardList, label: 'Send Welcome Test' },
  { icon: Goal, label: 'Add goals' },
  { icon: Map, label: 'Generate Learning Roadmap' },
];

const weeklySteps = [
  { icon: Lightbulb, label: 'Generate Next Lesson Ideas' },
  { icon: CheckCircle2, label: 'Choose one idea' },
  { icon: FileText, label: 'Create a worksheet' },
];

const StepPill = ({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) => (
  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm">
    <Icon className="h-4 w-4 shrink-0 text-primary" />
    <span>{label}</span>
  </div>
);

const StoryboardFallback = () => (
  <div className="space-y-5">
    <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">One-time student setup</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        First, do the one-time student setup: add 1 real student → send Welcome Test → add goals → generate Learning Roadmap.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {setupSteps.map((step) => (
          <StepPill key={step.label} {...step} />
        ))}
      </div>
    </div>

    <div className="rounded-xl border border-green-100 bg-green-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-green-700">Weekly 1-Minute Prep flow</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Then test the weekly 1-Minute Prep flow: generate Next Lesson Ideas → choose one idea → create a worksheet.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {weeklySteps.map((step) => (
          <StepPill key={step.label} {...step} />
        ))}
      </div>
    </div>

    <div className="rounded-xl border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
      <p>The setup helps Edooqoo understand the student.</p>
      <p className="mt-2">
        The 1-Minute Prep part is the weekly lesson preparation flow we want to make extremely fast.
      </p>
    </div>
  </div>
);

const OneMinutePrepProofSection: React.FC<OneMinutePrepProofSectionProps> = ({
  calculatorValue,
  onCalculatorChange,
  videoSrc,
  posterSrc,
  defaultPanel = 'calculator',
}) => {
  const [activePanel, setActivePanel] = useState<ProofPanel>(defaultPanel);
  const hasVideo = Boolean(videoSrc);

  const activatePanel = (panel: ProofPanel) => {
    setActivePanel(panel);
  };

  return (
    <section className="bg-background/80 py-14" aria-labelledby="one-minute-prep-proof-heading">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            <PlayCircle className="h-3.5 w-3.5" />
            Workflow proof
          </div>
          <h2 id="one-minute-prep-proof-heading" className="text-2xl font-bold text-foreground sm:text-3xl">
            See the 1-Minute Prep loop before the video is ready
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Before the video, Edooqoo may look like a worksheet generator. After 60 seconds, the loop should be clear.
          </p>
        </div>

        <div
          className={cn(
            'grid gap-4 lg:items-stretch',
            activePanel === 'calculator'
              ? 'lg:grid-cols-[minmax(0,1fr)_14rem]'
              : 'lg:grid-cols-[14rem_minmax(0,1fr)]'
          )}
        >
          <article
            className={cn(
              'overflow-hidden rounded-2xl border transition-all duration-200',
              activePanel === 'calculator'
                ? 'border-violet-200 bg-white shadow-xl shadow-violet-500/10'
                : 'border-border bg-muted/30 hover:border-violet-200'
            )}
            onMouseEnter={() => activatePanel('calculator')}
            onFocusCapture={() => activatePanel('calculator')}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={activePanel === 'calculator'}
              aria-controls="one-minute-prep-calculator-panel"
              onClick={() => activatePanel('calculator')}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Calculator className="h-4 w-4 text-primary" />
                Prep impact calculator
              </span>
              <span className="text-xs text-muted-foreground">{activePanel === 'calculator' ? 'Open' : 'Hover or tap'}</span>
            </button>
            <div
              id="one-minute-prep-calculator-panel"
              className={cn(activePanel === 'calculator' ? 'block px-3 pb-3' : 'hidden')}
            >
              <PricingCalculator
                variant="pricing"
                value={calculatorValue}
                onValueChange={onCalculatorChange}
                className="mb-0 border-violet-100 shadow-none"
              />
            </div>
          </article>

          <article
            className={cn(
              'overflow-hidden rounded-2xl border transition-all duration-200',
              activePanel === 'workflow'
                ? 'border-violet-200 bg-white shadow-xl shadow-violet-500/10'
                : 'border-border bg-muted/30 hover:border-violet-200'
            )}
            onMouseEnter={() => activatePanel('workflow')}
            onFocusCapture={() => activatePanel('workflow')}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={activePanel === 'workflow'}
              aria-controls="one-minute-prep-workflow-panel"
              onClick={() => activatePanel('workflow')}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PlayCircle className="h-4 w-4 text-primary" />
                Workflow proof
              </span>
              <span className="text-xs text-muted-foreground">{activePanel === 'workflow' ? 'Open' : 'Hover or tap'}</span>
            </button>
            <div
              id="one-minute-prep-workflow-panel"
              className={cn(activePanel === 'workflow' ? 'block px-4 pb-4' : 'hidden')}
            >
              {hasVideo ? (
                <video
                  className="aspect-video w-full rounded-xl border border-border bg-black"
                  controls
                  playsInline
                  poster={posterSrc}
                >
                  <source src={videoSrc} type="video/mp4" />
                </video>
              ) : (
                <StoryboardFallback />
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export default OneMinutePrepProofSection;
