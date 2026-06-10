import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  BarChart2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Goal,
  Lightbulb,
  Send,
  UserPlus,
} from 'lucide-react';
import LessonSignalCaptureSection from '@/components/landing/LessonSignalCaptureSection';
import PublicWorkflowNav from '@/components/public/PublicWorkflowNav';
import TwoPhaseWorkflowSection from '@/components/landing/TwoPhaseWorkflowSection';

const steps = [
  {
    number: 1,
    phase: 'setup',
    icon: UserPlus,
    title: "Create your account",
    description: "Create a free Edooqoo account so student context, worksheets, homework and progress signals can be saved between lessons.",
    benefits: ["No credit card required", "2 free worksheets to start", "Browser-based teacher workspace"],
  },
  {
    number: 2,
    phase: 'setup',
    icon: Goal,
    title: "Add student profile and goals",
    description: "Create a student profile with CEFR level, learning goals, lesson context and preferences. This gives 1-Minute Prep a stable starting point.",
    benefits: ["Student goals stored in one place", "Manual CEFR estimate supported", "Works for repeat and one-off 1:1 students"],
  },
  {
    number: 3,
    phase: 'setup',
    icon: Send,
    title: "Send the Welcome Test, optional",
    description: "Send a placement test when you need a stronger baseline. The test covers grammar, vocabulary, reading, listening and speaking, then updates the student profile.",
    benefits: ["58-question assessment", "Speaking analysis included", "Initial DSLM profile data"],
  },
  {
    number: 4,
    phase: 'setup',
    icon: BarChart2,
    title: "Review the profile and DSLM baseline",
    description: "Review strengths, weak areas, learning path and nano-skill signals before deciding what to teach next.",
    benefits: ["Skill radar and mastery signals", "Learning path context", "Teacher review stays in control"],
  },
  {
    number: 5,
    phase: 'weekly',
    icon: Lightbulb,
    title: "Generate Next Lesson Ideas",
    description: "Use the student profile, goals, notes, roadmap context and recent signals to generate candidate next-lesson ideas before creating a worksheet.",
    benefits: ["Suggestion-first prep", "Student-specific context", "Less blank-page topic search"],
  },
  {
    number: 6,
    phase: 'weekly',
    icon: CalendarDays,
    title: "Use booking context, optional",
    description: "Optional when you use Edooqoo Calendar: confirmed booking time, lesson timing, and schedule context can inform the prep decision.",
    benefits: ["Calendar-aware planning context", "No requirement to use the calendar", "Useful for recurring lessons"],
  },
  {
    number: 7,
    phase: 'weekly',
    icon: FileText,
    title: "Choose the next focus and generate the worksheet",
    description: "Review or edit the suggested focus, then generate a ready-to-teach worksheet with the topic, CEFR level and exercise types you choose.",
    benefits: ["29 exercise types", "Audio and image-capable worksheets", "Editable before teaching or assigning"],
  },
  {
    number: 8,
    phase: 'weekly',
    icon: ClipboardCheck,
    title: "Teach, assign, and let signals update the next cycle",
    description: "Use the worksheet in a live lesson, share it through a link, assign selected exercises as homework, and let activity signals inform the next prep cycle where applicable.",
    benefits: ["Interactive sharing", "AI-assisted homework review", "Learning events connected to student history"],
  },
];

const faqItems = [
  { q: "Is first setup the same as 1-Minute Prep?", a: "No. First setup is separate. You create the account, add a student, add known context or send the Welcome Test, then build the signal base that moves recurring weekly prep toward 1 minute per student." },
  { q: "What emails will I receive after signing up?", a: "Two emails. First, a confirmation email from Supabase (no-reply) with an activation link — click it to activate your account. After confirming, you'll receive a branded welcome email from hello@edooqoo.com with quick-start guidance and a link to your dashboard." },
  { q: "Do students need to create accounts?", a: "No. Students access everything via links or the Student Hub portal using just their email. No account creation, no password, no app installation needed." },
  { q: "Can I skip the Welcome Test?", a: "Yes. The Welcome Test is optional. You can start generating worksheets immediately by manually setting the student's CEFR level. The test is recommended for new students where you want a detailed skill assessment." },
  { q: "How many worksheets can I generate?", a: "Free plan: 2 worksheets. Side-Gig ($9/mo): 15 worksheets/month. Full-Time (from $19/mo): 30-90 worksheets/month. Each worksheet can contain up to 12 exercises." },
  { q: "Is there a limit on students?", a: "No. You can add unlimited students on any plan, including the free plan. Student management is always free." },
];

const HowItWorks = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: string } | null)?.from;
  const fromState = { from: location.pathname + location.search };
  const handleBack = () => navigate(fromPath ?? '/');

  const setupDetailSteps = steps.filter((step) => step.phase === 'setup');
  const weeklyDetailSteps = steps.filter((step) => step.phase === 'weekly');

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How 1-Minute Prep Works in Edooqoo',
    description: "Step-by-step guide to Edooqoo's student learning loop: profile, worksheet, activity signals, DSLM recommendation, and the next prep cycle.",
    tool: { '@type': 'HowToTool', name: 'Edooqoo 1-Minute Prep' },
    step: steps.map(s => ({
      '@type': 'HowToStep',
      position: s.number,
      name: s.title,
      text: s.description,
    })),
  };

  const renderStep = (step: typeof steps[number]) => {
    const Icon = step.icon;

    return (
      <div key={step.number} className="flex gap-5">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
          {step.number}
        </div>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="text-2xl font-bold text-foreground">{step.title}</h3>
          </div>
          <p className="mb-4 text-muted-foreground">{step.description}</p>
          <ul className="space-y-1">
            {step.benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>How 1-Minute Prep Works — Edooqoo Student Learning Loop</title>
        <meta name="description" content="See how Edooqoo's 1-Minute Prep loop connects student context, Live Session answers, homework, teacher notes, flashcards and DSLM recommendations for the next lesson." />
        <link rel="canonical" href="https://edooqoo.com/how-it-works" />
        <meta property="og:title" content="How 1-Minute Prep Works — Edooqoo Student Learning Loop" />
        <meta property="og:description" content="See how Edooqoo's 1-Minute Prep loop connects student context, Live Session answers, homework, teacher notes, flashcards and DSLM recommendations for the next lesson." />
        <meta property="og:url" content="https://edooqoo.com/how-it-works" />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify(howToJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <PublicWorkflowNav />
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <button onClick={handleBack} className="text-sm text-primary hover:underline">
            ← Back to Edooqoo
          </button>
        </div>

        <h1 className="mb-4 text-4xl font-bold text-foreground">How 1-Minute Prep Works</h1>
        <p className="mb-12 text-lg text-muted-foreground">
          Edooqoo works as a student learning loop: first setup builds context, then Live Session answers, homework, teacher notes and flashcard progress can add context for the next lesson.
        </p>
        <p className="mb-10 text-sm text-muted-foreground">
          For the bounded workflow definition, read the{' '}
          <Link to="/one-minute-prep" className="font-medium text-primary hover:underline">
            canonical 1-Minute Prep page
          </Link>
          .
        </p>

        <TwoPhaseWorkflowSection className="mb-14 -mx-4 sm:-mx-8" />

        <LessonSignalCaptureSection
          compact
          layout="four"
          className="mb-14 rounded-2xl border border-border bg-secondary/20 p-5 sm:p-6"
        />

        <div className="space-y-14">
          <section>
            <div className="mb-6 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Phase 1: One-time student setup</p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">One-time student setup</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This phase creates the learner record, baseline and goals. It is separate from the recurring 1-Minute Prep promise.
              </p>
            </div>
            <div className="space-y-8">
              {setupDetailSteps.map(renderStep)}
            </div>
          </section>

          <section>
            <div className="mb-6 rounded-xl border border-primary/20 bg-primary/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Phase 2: Weekly 1-Minute Prep</p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">Weekly 1-Minute Prep</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This is the recurring prep loop: generate candidate next steps, use optional booking context, choose the focus, then create the worksheet output.
              </p>
            </div>
            <div className="space-y-8">
              {weeklyDetailSteps.map(renderStep)}
            </div>
          </section>
        </div>

        <div className="mt-16">
          <h2 className="mb-6 border-b pb-2 text-2xl font-bold text-foreground">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqItems.map(({ q, a }) => (
              <details key={q} className="rounded-lg border p-4">
                <summary className="cursor-pointer font-semibold text-foreground">{q}</summary>
                <p className="mt-2 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="mt-12 rounded-lg bg-primary/5 p-6 text-center">
          <p className="mb-2 text-lg font-semibold text-foreground">Ready to get started?</p>
          <p className="mb-4 text-muted-foreground">Sign up free, add a student profile, and start building the context for 1-Minute Prep.</p>
          <Link to="/signup" state={fromState} className="inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            Try Edooqoo Free — 2 Worksheets Included
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
