import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Goal,
  Headphones,
  Layers,
  MessagesSquare,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type HeroProofPanel = 'worksheet' | 'test' | 'loop';

const panels: Array<{ id: HeroProofPanel; label: string }> = [
  { id: 'worksheet', label: 'Worksheet' },
  { id: 'test', label: 'Welcome Test' },
  { id: 'loop', label: '1-Minute Loop' },
];

const WorksheetPreview = () => (
  <div id="hero-worksheet-panel" role="tabpanel" aria-labelledby="hero-worksheet-tab">
    <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Example worksheet</p>
        <h2 className="mt-1.5 text-xl font-bold leading-tight text-foreground">Cross-Cultural Negotiations in Tech</h2>
      </div>
      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">B2/C1</span>
    </div>

    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
      <UserRound className="h-4 w-4 text-primary" />
      <span>Marta, Senior Product Manager</span>
    </div>

    <div className="space-y-2.5">
      <article className="rounded-xl border border-border bg-background p-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Headphones className="h-4 w-4 text-primary" />
          Audio discussion
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Compare two approaches to a delayed product launch.</p>
      </article>
      <article className="rounded-xl border border-border bg-background p-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpen className="h-4 w-4 text-primary" />
          Vocabulary in context
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose the phrase that softens a disagreement.</p>
      </article>
      <article className="rounded-xl border border-border bg-background p-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessagesSquare className="h-4 w-4 text-primary" />
          Roleplay prompt
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Renegotiate a deadline without damaging trust.</p>
      </article>
    </div>

    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />Adult-focused</span>
      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />Editable</span>
      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />Ready to share</span>
    </div>
  </div>
);

const WelcomeTestPreview = () => (
  <div id="hero-test-panel" role="tabpanel" aria-labelledby="hero-test-tab">
    <div className="border-b border-border pb-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Example student profile</p>
      <h2 className="mt-1.5 text-xl font-bold text-foreground">Start with evidence, not a blank prompt</h2>
    </div>

    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Marta's learning context</p>
          <p className="mt-1 text-sm text-muted-foreground">Goal: Lead international client meetings</p>
        </div>
        <span className="rounded-full bg-card px-3 py-1 text-sm font-bold text-primary shadow-sm">B2</span>
      </div>
    </div>

    <div className="mt-4 space-y-3">
      {[
        ['Speaking', 'Strong interaction, precision needs work'],
        ['Listening', 'Follow-up practice recommended'],
        ['Vocabulary', 'Business phrases ready to reuse'],
      ].map(([label, detail]) => (
        <div key={label} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5">
          <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
          </div>
        </div>
      ))}
    </div>

    <p className="mt-4 text-xs leading-5 text-muted-foreground">The teacher reviews the profile and suggested goals before using them in lesson planning.</p>
  </div>
);

const loopSteps = [
  { icon: ClipboardCheck, title: 'Welcome Test', detail: 'Establish level, goals and a useful starting point.' },
  { icon: FileText, title: 'Worksheet', detail: 'Teach with material built for the next lesson.' },
  { icon: Layers, title: 'Homework + flashcards', detail: 'Keep mistakes and vocabulary attached to the student.' },
  { icon: RotateCcw, title: 'Next lesson', detail: 'Review the suggested focus instead of starting over.' },
];

const LoopPreview = () => (
  <div id="hero-loop-panel" role="tabpanel" aria-labelledby="hero-loop-tab">
    <div className="border-b border-border pb-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">The 1-Minute Prep loop</p>
      <h2 className="mt-1.5 text-xl font-bold text-foreground">One student context, reused every week</h2>
    </div>

    <div className="mt-4 space-y-2">
      {loopSteps.map(({ icon: Icon, title, detail }, index) => (
        <div key={title} className="relative flex gap-3 rounded-xl border border-border bg-background p-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary">0{index + 1}</span>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
      <Goal className="h-4 w-4 shrink-0 text-primary" />
      You review the next focus before anything is generated.
    </div>
  </div>
);

const OneMinutePrepHeroProofSwitcher: React.FC = () => {
  const [activePanel, setActivePanel] = useState<HeroProofPanel>('worksheet');

  return (
    <div className="w-full max-w-[500px]">
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-full border border-border bg-card p-1 shadow-sm" role="tablist" aria-label="Edooqoo product preview">
        {panels.map((panel) => (
          <button
            key={panel.id}
            id={`hero-${panel.id}-tab`}
            type="button"
            role="tab"
            aria-selected={activePanel === panel.id}
            aria-controls={`hero-${panel.id}-panel`}
            onClick={() => setActivePanel(panel.id)}
            className={cn(
              'flex h-9 min-w-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-3 sm:text-xs',
              activePanel === panel.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {panel.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-primary/5" />
        <div className="min-h-[480px] rounded-2xl border border-border bg-card p-4 shadow-xl shadow-primary/10 sm:min-h-[500px] sm:p-5">
          {activePanel === 'worksheet' ? <WorksheetPreview /> : activePanel === 'test' ? <WelcomeTestPreview /> : <LoopPreview />}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
        <span>From one worksheet to a connected student loop</span>
        <ArrowRight className="h-3.5 w-3.5 text-primary" />
      </div>
    </div>
  );
};

export default OneMinutePrepHeroProofSwitcher;
