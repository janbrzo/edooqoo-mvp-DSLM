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
} from 'lucide-react';
import {
  PricingCalculator,
  type OneMinutePrepCalculatorInput,
} from '@/components/PricingCalculator';
import {
  lessonSignalWorkflowCopy,
  lessonSignalWorkflowSteps,
  setupWorkflowSteps,
  weeklyWorkflowSteps,
} from '@/constants/oneMinutePrepWorkflowProof';
import { cn } from '@/lib/utils';

type ProofPanel = 'workflow' | 'evidence' | 'calculator';
type ProofIcon = React.ComponentType<{ className?: string }>;

interface OneMinutePrepProofSectionProps {
  calculatorValue: OneMinutePrepCalculatorInput;
  onCalculatorChange: (value: OneMinutePrepCalculatorInput) => void;
  videoSrc?: string;
  posterSrc?: string;
  defaultPanel?: ProofPanel;
}

const signalInputs = [
  'Welcome Test answers',
  'Student goals',
  'Live Session answers',
  'Homework evaluations',
  'Teacher notes',
  'Worksheet history',
  'Flashcard progress',
];

const evidenceSteps = [
  { icon: ClipboardList, label: 'Signals enter' },
  { icon: Goal, label: 'Nano-skills are rated' },
  { icon: Map, label: 'Pacing and roadmap shape priority' },
  { icon: Lightbulb, label: 'Next focus is suggested' },
  { icon: CheckCircle2, label: 'Teacher chooses or edits' },
  { icon: FileText, label: 'Worksheet is generated as output' },
];

const StepPill = ({
  icon: Icon,
  label,
  badge,
  nowrap,
}: {
  icon: ProofIcon;
  label: string;
  badge?: string;
  nowrap?: boolean;
}) => (
  <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm">
    <Icon className="h-4 w-4 shrink-0 text-primary" />
    <span className={cn('min-w-0 flex-1 leading-snug', nowrap && 'whitespace-nowrap text-xs sm:text-sm')}>{label}</span>
    {badge ? (
      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
        {badge}
      </span>
    ) : null}
  </div>
);

const WorkflowStoryboard = () => (
  <div className="space-y-5">
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="flex h-full flex-col rounded-xl border border-violet-100 bg-violet-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Phase 1: One-time student setup</p>
        <h3 className="mt-2 text-lg font-semibold text-foreground">Build the learner context once</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          First setup is not the one-minute claim. It creates the student context that recurring prep can use.
        </p>
        <div className="mt-4 grid gap-2">
          {setupWorkflowSteps.map((step) => (
            <StepPill key={step.label} {...step} />
          ))}
        </div>
      </div>

      <div className="flex h-full flex-col rounded-xl border border-blue-100 bg-blue-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">{lessonSignalWorkflowCopy.eyebrow}</p>
        <h3 className="mt-2 text-lg font-semibold text-foreground">{lessonSignalWorkflowCopy.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{lessonSignalWorkflowCopy.description}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {lessonSignalWorkflowSteps.map((step) => (
            <StepPill key={step.label} {...step} />
          ))}
        </div>
      </div>

      <div className="flex h-full flex-col rounded-xl border border-green-100 bg-green-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-green-700">Phase 2: Weekly 1-Minute Prep flow</p>
        <h3 className="mt-2 text-lg font-semibold text-foreground">Run the recurring prep loop</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Weekly prep uses stored context to decide the next focus before material generation.
        </p>
        <div className="mt-4 grid gap-2">
          {weeklyWorkflowSteps.map((step) => (
            <StepPill key={step.label} {...step} />
          ))}
        </div>
      </div>
    </div>

    <div className="rounded-xl border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
      <p>
        Optional when you use Edooqoo Calendar: confirmed booking time, lesson timing, and schedule context can inform the prep decision.
      </p>
      <p className="mt-2">
        The teacher still chooses or edits the next focus before generating the worksheet output.
      </p>
    </div>
  </div>
);

const WorkflowProofPanel = ({
  videoSrc,
  posterSrc,
}: {
  videoSrc?: string;
  posterSrc?: string;
}) => {
  if (videoSrc) {
    return (
      <video
        className="aspect-video w-full rounded-xl border border-border bg-black"
        controls
        playsInline
        poster={posterSrc}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
    );
  }

  return <WorkflowStoryboard />;
};

const EvidenceStackPanel = () => (
  <div className="space-y-5">
    <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Stored learner evidence</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        DSLM is not a single model file. It is a student-specific signal graph built from profile, goals, activity, and teacher-reviewed evidence.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {signalInputs.map((input) => (
          <span key={input} className="rounded-full border border-violet-200 bg-background px-3 py-1.5 text-xs font-medium text-violet-800">
            {input}
          </span>
        ))}
      </div>
    </div>

    <div className="rounded-xl border border-green-100 bg-green-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-green-700">Decision path</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Nano-skill evidence, pacing mode, roadmap phase, and recent activity narrow the next lesson focus before material generation.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {evidenceSteps.map((step) => (
          <StepPill key={step.label} {...step} />
        ))}
      </div>
    </div>

    <div className="rounded-xl border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
      <p>The teacher still reviews and edits the recommendation.</p>
      <p className="mt-2">
        The worksheet generator is the editable output layer after the next focus has been selected.
      </p>
    </div>
  </div>
);

const OneMinutePrepProofSection: React.FC<OneMinutePrepProofSectionProps> = ({
  calculatorValue,
  onCalculatorChange,
  videoSrc,
  posterSrc,
  defaultPanel = 'workflow',
}) => {
  const [activePanel, setActivePanel] = useState<ProofPanel>(defaultPanel);

  const activatePanel = (panel: ProofPanel) => {
    setActivePanel(panel);
  };

  const tabClassName = (panel: ProofPanel) =>
    cn(
      'flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      activePanel === panel
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-violet-50 hover:text-primary'
    );

  return (
    <section className="bg-background/80 py-14" aria-labelledby="one-minute-prep-proof-heading">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            <PlayCircle className="h-3.5 w-3.5" />
            Workflow proof
          </div>
          <h2 id="one-minute-prep-proof-heading" className="text-2xl font-bold text-foreground sm:text-3xl">
            See the 1-Minute Prep proof before the video is ready
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            First setup builds the student context. Lesson activity adds evidence. Weekly prep uses that context, optional calendar timing, and DSLM evidence before the worksheet output layer.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-xl shadow-violet-500/10">
          <div
            className="grid gap-1 border-b border-border bg-muted/30 p-1 sm:grid-cols-3"
            role="tablist"
            aria-label="1-Minute Prep proof panels"
          >
            <button
              id="one-minute-prep-workflow-tab"
              type="button"
              role="tab"
              aria-selected={activePanel === 'workflow'}
              aria-controls="one-minute-prep-workflow-panel"
              className={tabClassName('workflow')}
              onClick={() => activatePanel('workflow')}
              onMouseEnter={() => activatePanel('workflow')}
              onFocus={() => activatePanel('workflow')}
            >
              <PlayCircle className="h-4 w-4 shrink-0" />
              <span className="min-w-0">Workflow proof</span>
            </button>
            <button
              id="one-minute-prep-evidence-tab"
              type="button"
              role="tab"
              aria-selected={activePanel === 'evidence'}
              aria-controls="one-minute-prep-evidence-panel"
              className={tabClassName('evidence')}
              onClick={() => activatePanel('evidence')}
              onMouseEnter={() => activatePanel('evidence')}
              onFocus={() => activatePanel('evidence')}
            >
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span className="min-w-0">Evidence stack</span>
            </button>
            <button
              id="one-minute-prep-calculator-tab"
              type="button"
              role="tab"
              aria-selected={activePanel === 'calculator'}
              aria-controls="one-minute-prep-calculator-panel"
              className={tabClassName('calculator')}
              onClick={() => activatePanel('calculator')}
              onMouseEnter={() => activatePanel('calculator')}
              onFocus={() => activatePanel('calculator')}
            >
              <Calculator className="h-4 w-4 shrink-0" />
              <span className="min-w-0">Prep impact calculator</span>
            </button>
          </div>

          <div className="p-4 sm:p-5">
            {activePanel === 'workflow' ? (
              <div
                id="one-minute-prep-workflow-panel"
                role="tabpanel"
                aria-labelledby="one-minute-prep-workflow-tab"
              >
                <WorkflowProofPanel videoSrc={videoSrc} posterSrc={posterSrc} />
              </div>
            ) : activePanel === 'evidence' ? (
              <div
                id="one-minute-prep-evidence-panel"
                role="tabpanel"
                aria-labelledby="one-minute-prep-evidence-tab"
              >
                <EvidenceStackPanel />
              </div>
            ) : (
              <div
                id="one-minute-prep-calculator-panel"
                role="tabpanel"
                aria-labelledby="one-minute-prep-calculator-tab"
              >
                <PricingCalculator
                  variant="pricing"
                  value={calculatorValue}
                  onValueChange={onCalculatorChange}
                  className="mb-0 border-violet-100 shadow-none"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OneMinutePrepProofSection;
