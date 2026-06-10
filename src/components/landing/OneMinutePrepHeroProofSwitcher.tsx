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
  type WorkflowProofStep,
} from '@/constants/oneMinutePrepWorkflowProof';
import { cn } from '@/lib/utils';

type HeroProofPanel = 'calculator' | 'workflow' | 'evidence';
type ProofIcon = React.ComponentType<{ className?: string }>;

interface OneMinutePrepHeroProofSwitcherProps {
  calculatorValue: OneMinutePrepCalculatorInput;
  onCalculatorChange: (value: OneMinutePrepCalculatorInput) => void;
  defaultPanel?: HeroProofPanel;
}

const signalInputs = [
  'Welcome Test',
  'Goals',
  'Live Session',
  'Homework',
  'Notes',
  'Flashcards',
];

const evidenceSteps = [
  { icon: ClipboardList, label: 'Signals' },
  { icon: Goal, label: 'Nano-skills' },
  { icon: Map, label: 'Pacing/Roadmap' },
  { icon: Lightbulb, label: 'Next focus' },
  { icon: FileText, label: 'Worksheet' },
];

const FlowStep = ({
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
  <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground shadow-sm">
    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
    <span className={cn('min-w-0 flex-1 leading-snug', nowrap && 'whitespace-nowrap text-[11px] sm:text-xs')}>{label}</span>
    {badge ? (
      <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
        {badge}
      </span>
    ) : null}
  </div>
);

const CompactBadge = ({
  icon: Icon,
  label,
  nowrap,
}: {
  icon: ProofIcon;
  label: string;
  nowrap?: boolean;
}) => (
  <span
    className={cn(
      'inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-white px-2 py-1 text-[11px] font-medium text-foreground shadow-sm',
      nowrap && 'whitespace-nowrap'
    )}
  >
    <Icon className="h-3 w-3 shrink-0 text-primary" />
    <span className="min-w-0 leading-tight">{label}</span>
  </span>
);

const CompactWorkflowProofPanel = () => (
  <div
    id="one-minute-hero-workflow-panel"
    role="tabpanel"
    aria-labelledby="one-minute-hero-workflow-tab"
    className="rounded-2xl border-2 border-violet-100 bg-white p-3 shadow-xl shadow-violet-500/10 sm:p-4"
  >
    <div className="flex items-center gap-2">
      <PlayCircle className="h-5 w-5 text-primary" />
      <div>
        <h2 className="text-base font-semibold text-gray-900">Workflow proof</h2>
        <p className="text-xs text-muted-foreground">Setup is separate from weekly prep.</p>
      </div>
    </div>

    <div className="mt-3 space-y-2.5">
      <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-2.5 sm:p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">Phase 1: One-time student setup</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          First create the learner context that the recurring prep flow can use.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {setupWorkflowSteps.map((step) => (
            <FlowStep key={step.label} {...step} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-2.5 sm:p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">{lessonSignalWorkflowCopy.eyebrow}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{lessonSignalWorkflowCopy.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lessonSignalWorkflowSteps.map(({ icon: Icon, label, nowrap }: WorkflowProofStep) => (
            <span
              key={label}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-white px-2 py-1 text-[11px] font-medium text-blue-900',
                nowrap && 'whitespace-nowrap'
              )}
            >
              <Icon className="h-3 w-3 shrink-0 text-primary" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-green-100 bg-green-50/70 p-2.5 sm:p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-green-700">Phase 2: Weekly 1-Minute Prep flow</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Then use stored context to choose the next focus before the worksheet is generated.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {weeklyWorkflowSteps.map((step) => (
            <FlowStep key={step.label} {...step} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const CompactEvidenceStackPanel = () => (
  <div
    id="one-minute-hero-evidence-panel"
    role="tabpanel"
    aria-labelledby="one-minute-hero-evidence-tab"
    className="rounded-2xl border-2 border-violet-100 bg-white p-4 shadow-xl shadow-violet-500/10"
  >
    <div className="flex items-center gap-2">
      <PlayCircle className="h-5 w-5 text-primary" />
      <div>
        <h2 className="text-base font-semibold text-gray-900">Evidence stack</h2>
        <p className="text-xs text-muted-foreground">Why the next focus is not guessed from scratch.</p>
      </div>
    </div>

    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">Stored learner evidence</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          DSLM reads available student-specific signals before the worksheet prompt is used.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {signalInputs.map((input) => (
            <span key={input} className="rounded-full border border-violet-200 bg-white px-2 py-1 text-[11px] font-medium text-violet-800">
              {input}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-green-100 bg-green-50/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-green-700">Decision path</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Signals become nano-skill evidence, pacing context, and a teacher-reviewed next focus.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {evidenceSteps.map((step) => (
            <CompactBadge key={step.label} {...step} />
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Worksheet generation remains the output layer after teacher review.</span>
      </div>
    </div>
  </div>
);

const OneMinutePrepHeroProofSwitcher: React.FC<OneMinutePrepHeroProofSwitcherProps> = ({
  calculatorValue,
  onCalculatorChange,
  defaultPanel = 'calculator',
}) => {
  const [activePanel, setActivePanel] = useState<HeroProofPanel>(defaultPanel);

  const activatePanel = (panel: HeroProofPanel) => {
    setActivePanel(panel);
  };

  const tabClassName = (panel: HeroProofPanel) =>
    cn(
      'flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[11px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:gap-2 sm:px-3 sm:text-xs',
      activePanel === panel
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-violet-50 hover:text-primary'
    );

  return (
    <div className="w-full max-w-[460px]">
      <div
        className="mb-3 grid grid-cols-3 gap-1 rounded-full border border-violet-100 bg-white/90 p-1 shadow-sm"
        role="tablist"
        aria-label="1-Minute Prep hero proof"
      >
        <button
          id="one-minute-hero-calculator-tab"
          type="button"
          role="tab"
          aria-selected={activePanel === 'calculator'}
          aria-controls="one-minute-hero-calculator-panel"
          className={tabClassName('calculator')}
          onClick={() => activatePanel('calculator')}
          onMouseEnter={() => activatePanel('calculator')}
          onFocus={() => activatePanel('calculator')}
        >
          <Calculator className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">Prep impact</span>
        </button>
        <button
          id="one-minute-hero-workflow-tab"
          type="button"
          role="tab"
          aria-selected={activePanel === 'workflow'}
          aria-controls="one-minute-hero-workflow-panel"
          className={tabClassName('workflow')}
          onClick={() => activatePanel('workflow')}
          onMouseEnter={() => activatePanel('workflow')}
          onFocus={() => activatePanel('workflow')}
        >
          <PlayCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">Workflow proof</span>
        </button>
        <button
          id="one-minute-hero-evidence-tab"
          type="button"
          role="tab"
          aria-selected={activePanel === 'evidence'}
          aria-controls="one-minute-hero-evidence-panel"
          className={tabClassName('evidence')}
          onClick={() => activatePanel('evidence')}
          onMouseEnter={() => activatePanel('evidence')}
          onFocus={() => activatePanel('evidence')}
        >
          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">Evidence stack</span>
        </button>
      </div>

      {activePanel === 'calculator' ? (
        <div
          id="one-minute-hero-calculator-panel"
          role="tabpanel"
          aria-labelledby="one-minute-hero-calculator-tab"
        >
          <PricingCalculator
            variant="hero"
            value={calculatorValue}
            onValueChange={onCalculatorChange}
          />
        </div>
      ) : activePanel === 'workflow' ? (
        <CompactWorkflowProofPanel />
      ) : (
        <CompactEvidenceStackPanel />
      )}
    </div>
  );
};

export default OneMinutePrepHeroProofSwitcher;
