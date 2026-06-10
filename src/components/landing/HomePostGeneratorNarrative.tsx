import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Goal,
  Layers,
  Lightbulb,
  Map,
  Radio,
  StickyNote,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import FeatureScreenshotFrame from '@/components/features/FeatureScreenshotFrame';
import { cn } from '@/lib/utils';

const workflowSteps = [
  {
    title: 'Open the student context',
    detail: 'Goals, notes, test results and recent activity are already attached to the learner.',
    icon: UserPlus,
  },
  {
    title: 'Review the next focus',
    detail: 'Edooqoo shows the current recommendation before a worksheet is generated.',
    icon: Lightbulb,
  },
  {
    title: 'Check the reason',
    detail: 'The suggestion is tied to stored evidence, pacing and teacher-approved goals.',
    icon: Map,
  },
  {
    title: 'Create the worksheet output',
    detail: 'The final material is editable before you use it with the student.',
    icon: FileText,
  },
];

const contextSignals = [
  { label: 'Welcome Test', icon: BookOpenCheck },
  { label: 'Goals', icon: Goal },
  { label: 'Teacher notes', icon: StickyNote },
  { label: 'Homework', icon: ClipboardCheck },
  { label: 'Flashcards', icon: Layers },
  { label: 'Live Session answers', icon: Radio },
  { label: 'Lesson calendar', icon: CalendarDays },
  { label: 'Worksheet history', icon: FileText },
];

const featureProof = [
  {
    id: 'feature-one-minute-prep',
    phase: 'Weekly prep',
    title: '1-Minute Prep',
    description: 'Choose the next lesson idea from stored student context, then generate the worksheet output.',
    image: '/features/one-minute-next-steps.png',
    alt: '1-Minute Prep next lesson ideas panel',
    link: '/one-minute-prep',
  },
  {
    id: 'feature-placement-test',
    phase: 'Setup',
    title: 'Welcome Test',
    description: 'Initialize a student profile with level, skill evidence and learning context before recurring prep.',
    image: '/features/welcome-test-profile-ai.png',
    alt: 'Welcome Test AI profile summary',
    link: '/features/placement-test',
  },
  {
    id: 'feature-dslm',
    phase: 'Decision layer',
    title: 'DSLM',
    description: 'Organize goals, pacing, roadmap context and skill signals before deciding the next focus.',
    image: '/features/skills-heat-map.png',
    alt: 'DSLM skill heat map',
    link: '/features/dslm',
  },
  {
    id: 'feature-homework',
    phase: 'Follow-up',
    title: 'Homework Review',
    description: 'Turn lesson work into submitted answers and teacher-reviewed evidence for the next lesson.',
    image: '/features/homework-assignments.png',
    alt: 'Homework assignments list',
    link: '/features/homework',
  },
  {
    id: 'feature-flashcards',
    phase: 'Vocabulary',
    title: 'Flashcards',
    description: 'Keep word and card-level vocabulary practice connected to the student profile.',
    image: '/features/flashcards-sets.png',
    alt: 'Student flashcard sets',
    link: '/features/flashcards',
  },
  {
    id: 'feature-live-sessions',
    phase: 'Lesson signal',
    title: 'Live Sessions',
    description: 'Teach with shared worksheets and keep useful lesson evidence attached to the learner.',
    image: '/features/live-session.png',
    alt: 'Live Session worksheet with student answers',
    link: '/features/live-sessions',
  },
  {
    id: 'feature-calendar',
    phase: 'Rhythm',
    title: 'Calendar',
    description: 'Keep prep tied to the students and lessons that are actually coming next.',
    image: '/features/calendar-teacher.png',
    alt: 'Teacher lesson calendar',
    link: '/features/calendar',
  },
  {
    id: 'feature-student-hub',
    phase: 'Student access',
    title: 'Student Hub',
    description: 'Give students a stable workspace for worksheets, homework, flashcards, bookings and tests.',
    image: '/features/student-dashboard.png',
    alt: 'Student Hub dashboard',
    link: '/features/student-hub',
  },
];

const featureProofColumns = [
  {
    label: 'Setup',
    summary: 'Create the baseline Edooqoo can reuse.',
    features: [featureProof[1]],
  },
  {
    label: 'Prep decision',
    summary: 'Choose the next focus before output.',
    features: [featureProof[0], featureProof[2]],
  },
  {
    label: 'Lesson signals',
    summary: 'Capture evidence during normal teaching work.',
    features: [featureProof[3], featureProof[4], featureProof[5]],
  },
  {
    label: 'Access and rhythm',
    summary: 'Keep the loop attached to upcoming work.',
    features: [featureProof[6], featureProof[7]],
  },
];

export const HomeCredibilityBridge = () => (
  <section className="border-y border-border bg-white py-16">
    <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-center">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Credibility bridge</p>
        <h2 className="max-w-3xl text-3xl font-bold leading-tight text-foreground md:text-4xl">
          1 minute sounds impossible. For a new student, it is.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          The target starts to make sense after Edooqoo has student context: goals, notes, test results, homework,
          vocabulary practice, and the last worksheet history.
        </p>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          The point is not a faster blank prompt. The point is that you stop rebuilding the same student context every week.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-5">
        <div className="mb-4 text-sm font-semibold text-foreground">What has to exist before prep gets fast</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {contextSignals.slice(0, 6).map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export const HomeWeeklyWorkflowProof = () => (
  <section className="bg-slate-50 py-16">
    <div className="mx-auto max-w-6xl px-4">
      <div className="mb-8 max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Real workflow</p>
        <h2 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
          The sale is not the worksheet. It is the decision before the worksheet.
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          A recurring tutor does not need another isolated generator. They need a way to decide the next useful lesson without reopening every note, chat, test and old worksheet.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {workflowSteps.map(({ title, detail, icon: Icon }, index) => (
          <article key={title} className="rounded-lg border border-border bg-background p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">{index + 1}</span>
            </div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export const HomeCompoundingContext = () => (
  <section className="bg-background py-16">
    <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Honest limitation</p>
        <h2 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
          New students take setup. Recurring students are where the prep time compounds down.
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Edooqoo is strongest when a student keeps coming back and the system has real learner evidence to work with.
          A thin profile still needs teacher input.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Lesson 1', title: 'Set context', detail: 'Profile, goal and optional test baseline.' },
          { label: 'Weeks 2-3', title: 'Collect signals', detail: 'Worksheets, notes, homework and vocabulary practice start to matter.' },
          { label: 'Recurring loop', title: 'Prep from evidence', detail: 'The next focus starts from stored context, not memory.' },
        ].map((item) => (
          <article key={item.label} className="rounded-lg border border-border bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{item.label}</p>
            <h3 className="mt-3 text-lg font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export const HomeFeatureProofGrid = () => (
  <section className="border-y border-border bg-white py-16">
    <div className="mx-auto max-w-6xl px-4">
      <div className="mb-8 max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Product proof</p>
        <h2 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
          Every feature has one job in the same student loop.
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          This is not a pile of tools. Each surface either builds student context, helps choose the next focus, captures lesson evidence, or gives students access to work.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {featureProofColumns.map((column, columnIndex) => (
          <div key={column.label} className="relative">
            <div className="mb-3 flex min-h-[3.25rem] items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{column.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{column.summary}</p>
              </div>
              {columnIndex < featureProofColumns.length - 1 && (
                <ArrowRight className="mt-1 hidden h-4 w-4 shrink-0 text-primary/50 lg:block" />
              )}
            </div>
            <div className="space-y-3">
              {column.features.map((feature) => {
                const isPrimary = feature.title === '1-Minute Prep';
                return (
                  <Link
                    key={feature.id}
                    id={feature.id}
                    to={feature.link}
                    className={cn(
                      'group block scroll-mt-20 overflow-hidden rounded-lg border bg-background transition hover:border-primary/30 hover:shadow-md',
                      isPrimary ? 'border-primary/30 shadow-sm' : 'border-border'
                    )}
                  >
                    <div className="border-b border-border bg-muted/30 p-2">
                      <FeatureScreenshotFrame
                        src={feature.image}
                        alt={feature.alt}
                        imageClassName="h-28"
                        objectPosition="center top"
                        className="rounded-lg border-0 shadow-none"
                      />
                    </div>
                    <div className="p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{feature.phase}</p>
                      <h3 className="mt-1 text-sm font-semibold text-foreground group-hover:text-primary">{feature.title}</h3>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{feature.description}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                        See details
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const HomeTutorRealityScenario = () => (
  <section className="bg-slate-50 py-16">
    <div className="mx-auto max-w-6xl px-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <p className="mb-3 text-sm font-semibold text-primary">Example workload, not a testimonial.</p>
          <h2 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
            A tutor with 14 recurring students does not need 14 blank prompts every Sunday.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            The two new students still need setup. The returning students already have context.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-lg border border-border bg-background p-5">
            <p className="text-3xl font-bold text-foreground">14</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">recurring students with different goals</p>
          </article>
          <article className="rounded-lg border border-border bg-background p-5">
            <p className="text-3xl font-bold text-foreground">2</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">new students that still need setup</p>
          </article>
          <article className="rounded-lg border border-border bg-background p-5">
            <p className="text-3xl font-bold text-foreground">1</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">weekly prep loop for returning learners</p>
          </article>
        </div>
      </div>
    </div>
  </section>
);

interface HomeFinalCTAProps {
  onStartOneMinutePrep: () => void;
}

export const HomeFinalCTA: React.FC<HomeFinalCTAProps> = ({ onStartOneMinutePrep }) => (
  <section className="border-t border-border bg-white py-16 text-center">
    <div className="mx-auto max-w-3xl px-4">
      <h2 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
        Stop preparing recurring students from scratch.
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        Add one real student, set the context, and let the next prep cycle start from evidence you can review.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Button
          type="button"
          size="lg"
          onClick={onStartOneMinutePrep}
          className="h-12 rounded-full px-8 text-base font-semibold"
        >
          Add your first student
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            No credit card
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            2 worksheets free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Teacher review stays in control
          </span>
        </div>
      </div>
    </div>
  </section>
);
