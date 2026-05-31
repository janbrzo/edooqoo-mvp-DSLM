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

type HeroProofPanel = 'calculator' | 'workflow';

interface OneMinutePrepHeroProofSwitcherProps {
  calculatorValue: OneMinutePrepCalculatorInput;
  onCalculatorChange: (value: OneMinutePrepCalculatorInput) => void;
  defaultPanel?: HeroProofPanel;
}

const setupSteps = [
  { icon: UserPlus, label: 'Student' },
  { icon: ClipboardList, label: 'Welcome Test' },
  { icon: Goal, label: 'Goals' },
  { icon: Map, label: 'Roadmap' },
];

const weeklySteps = [
  { icon: Lightbulb, label: 'Next Lesson Ideas' },
  { icon: CheckCircle2, label: 'Choose one' },
  { icon: FileText, label: 'Worksheet' },
];

const FlowStep = ({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) => (
  <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground shadow-sm">
    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
    <span className="min-w-0">{label}</span>
  </div>
);

const CompactWorkflowProof = () => (
  <div
    id="one-minute-hero-workflow-panel"
    role="tabpanel"
    aria-labelledby="one-minute-hero-workflow-tab"
    className="rounded-2xl border-2 border-violet-100 bg-white p-4 shadow-xl shadow-violet-500/10"
  >
    <div className="flex items-center gap-2">
      <PlayCircle className="h-5 w-5 text-primary" />
      <div>
        <h2 className="text-base font-semibold text-gray-900">Workflow proof</h2>
        <p className="text-xs text-muted-foreground">The loop behind weekly prep.</p>
      </div>
    </div>

    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">One-time setup</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Student -&gt; Welcome Test -&gt; Goals -&gt; Roadmap
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {setupSteps.map((step) => (
            <FlowStep key={step.label} {...step} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-green-100 bg-green-50/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-green-700">Weekly prep</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Next Lesson Ideas -&gt; Choose one -&gt; Worksheet
        </p>
        <div className="mt-3 grid gap-2">
          {weeklySteps.map((step) => (
            <FlowStep key={step.label} {...step} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
        Setup builds student context. Weekly prep uses that context.
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
      'flex h-9 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      activePanel === panel
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-violet-50 hover:text-primary'
    );

  return (
    <div className="w-full max-w-[460px]">
      <div
        className="mb-3 grid grid-cols-2 gap-1 rounded-full border border-violet-100 bg-white/90 p-1 shadow-sm"
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
          <Calculator className="h-3.5 w-3.5" />
          Prep impact
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
          <PlayCircle className="h-3.5 w-3.5" />
          Workflow proof
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
      ) : (
        <CompactWorkflowProof />
      )}
    </div>
  );
};

export default OneMinutePrepHeroProofSwitcher;
