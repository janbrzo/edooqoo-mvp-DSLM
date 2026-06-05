import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BarChart2,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageSeo, buildFaqPageLd } from '@/components/seo/PageSeo';
import OneMinutePrepProofSection from '@/components/landing/OneMinutePrepProofSection';
import {
  DEFAULT_ONE_MINUTE_PREP_CALCULATOR_INPUT,
  type OneMinutePrepCalculatorInput,
} from '@/components/PricingCalculator';

const BASE_URL = 'https://edooqoo.com';

const loopStages = [
  {
    title: 'Student context',
    description: 'Profile, goals, CEFR level, Welcome Test data, lesson notes, and teacher observations.',
    icon: Brain,
  },
  {
    title: 'Nano-skill evidence',
    description: 'Tagged questions, worksheet checks, homework evaluations, and teacher ratings create skill-level evidence.',
    icon: BarChart2,
  },
  {
    title: 'Pacing and roadmap',
    description: 'Goals, deadlines, profile traits, and skill metrics shape the pacing mode and roadmap influence.',
    icon: ClipboardCheck,
  },
  {
    title: 'DSLM recommendation',
    description: 'DSLM turns stored evidence into a next focus, exercise mix, rationale, and confidence context.',
    icon: BarChart2,
  },
  {
    title: 'Worksheet output',
    description: 'The teacher reviews or edits the suggestion, then generates the worksheet as the output layer.',
    icon: FileText,
  },
];

const evidenceStackItems = [
  {
    title: 'Nano-skill evidence',
    description: 'Welcome Test items and worksheet exercises carry atomic labels such as grammar, vocabulary, writing, speaking, listening, and reading subskills.',
    icon: BarChart2,
  },
  {
    title: 'Student goal',
    description: 'Main goals, progress goals, target dates, and learning elements keep the next step tied to the adult learner outcome.',
    icon: ClipboardCheck,
  },
  {
    title: 'Pacing mode',
    description: 'Scientific, balanced, or pragmatic pacing changes how much input, output, review, and domain context the next step should use.',
    icon: RefreshCw,
  },
  {
    title: 'Roadmap phase',
    description: 'Curriculum phases and existing suggestions stop each worksheet from becoming an isolated one-off task.',
    icon: Brain,
  },
  {
    title: 'Recent activity',
    description: 'Homework, worksheet history, skill metrics, knowledge notes, and flashcard progress provide current context where available.',
    icon: CheckCircle2,
  },
  {
    title: 'Teacher review',
    description: 'The teacher still selects, edits, approves, and teaches the material. DSLM supports the decision; it does not replace it.',
    icon: ShieldCheck,
  },
];

const bestFitItems = [
  'Recurring 1:1 adult English students',
  'Saved student goals, profile, or lesson notes',
  'Welcome Test results or a manual CEFR baseline',
  'Homework, flashcards, live-session, or worksheet signals',
  'Teacher review before teaching or assigning materials',
];

const boundaryItems = [
  'First setup is not one minute. A new student needs profile, goal, and signal setup first.',
  'Weak or missing student data produces more generic output.',
  'The teacher remains responsible for review, editing, and lesson decisions.',
  'The calculator and workflow do not guarantee exact prep time or income.',
  'Edooqoo.com does not expose a public worksheet-generation API.',
];

const faqItems = [
  {
    question: 'Is the first lesson also one minute?',
    answer: 'No. First setup requires profile, goals, and student signals. Edooqoo is designed to move recurring weekly prep toward one focused minute after that context exists.',
  },
  {
    question: 'Is Edooqoo still a worksheet generator?',
    answer: 'Yes. The generator is the output layer.',
  },
  {
    question: 'Do I need student data first?',
    answer: 'Best results require placement/profile/goals or lesson signals.',
  },
  {
    question: 'Can I use it for one-off students?',
    answer: 'Yes, but recurring students benefit more because the model has more context.',
  },
  {
    question: 'Does it replace teacher review?',
    answer: 'No. Teachers review and edit before teaching or assigning.',
  },
];

const softwareLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${BASE_URL}/#software`,
  name: 'Edooqoo',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  url: `${BASE_URL}/one-minute-prep`,
  description:
    '1-Minute Prep workflow for recurring 1:1 English teachers that combines student context, DSLM nano-skill evidence, pacing, and editable worksheet generation.',
  audience: [
    { '@type': 'Audience', audienceType: 'ESL teachers' },
    { '@type': 'Audience', audienceType: 'English tutors' },
    { '@type': 'Audience', audienceType: '1:1 adult English teachers' },
  ],
  featureList: [
    '1-Minute Prep workflow',
    'DSLM student context loop',
    'Welcome Test setup',
    'Learning Roadmap',
    'Next Lesson Ideas',
    'Editable worksheet output',
    'Homework, flashcard, and live-session signals',
    'Teacher review before teaching or assigning',
  ],
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
    { '@type': 'ListItem', position: 2, name: '1-Minute Prep', item: `${BASE_URL}/one-minute-prep` },
  ],
};

const OneMinutePrep: React.FC = () => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  const [oneMinutePrepCalculator, setOneMinutePrepCalculator] = useState<OneMinutePrepCalculatorInput>(
    DEFAULT_ONE_MINUTE_PREP_CALCULATOR_INPUT
  );

  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.hash, location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="1-Minute Prep for 1:1 English Teachers | Edooqoo"
        description="Canonical Edooqoo 1-Minute Prep workflow: student context, DSLM nano-skill evidence, pacing, and editable worksheet output for recurring 1:1 English students."
        path="/one-minute-prep"
        jsonLd={[softwareLd, buildFaqPageLd(faqItems), breadcrumbLd]}
      />

      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="text-xl font-bold text-primary">edooqoo</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/how-it-works" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">
              How it works
            </Link>
            <Link to="/features/dslm" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">
              DSLM
            </Link>
            <Button size="sm" asChild>
              <Link to="/signup" state={fromState}>
                Start Free <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b bg-gradient-to-b from-primary/5 to-background">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
            <div>
              <Badge variant="secondary" className="mb-4 border-primary/20 bg-primary/10 text-primary">
                Canonical workflow
              </Badge>
              <h1 className="max-w-3xl text-4xl font-bold tracking-normal text-foreground sm:text-5xl">
                1-Minute Prep for 1:1 English teachers
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                1-Minute Prep is Edooqoo's workflow target for recurring students: move weekly prep toward one focused minute after student profile, goals, and learning signals exist. The worksheet generator is the output layer.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link to="/signup" state={fromState}>
                    Start 1-Minute Prep Free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/how-it-works">See how it works</Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Need the immediate generator path?{' '}
                <a href="/#worksheet-form" className="font-medium text-primary hover:underline">
                  Try worksheet generator now
                </a>
                .
              </p>
            </div>

            <Card className="border-primary/15 bg-background shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">How Student Context Changes The Worksheet</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Edooqoo stops treating each worksheet as a blank-page task. It keeps student context visible, then uses DSLM nano-skill evidence to suggest a focused next step before the worksheet is generated.
                  </p>
                </div>
                <div className="grid gap-3">
                  {['Profile and goals exist', 'Recent learning signal exists', 'DSLM suggests next focus', 'Teacher reviews worksheet output'].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <OneMinutePrepProofSection
          calculatorValue={oneMinutePrepCalculator}
          onCalculatorChange={setOneMinutePrepCalculator}
        />

        <section className="border-y bg-secondary/20 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold text-foreground">Why DSLM can choose a better next step</h2>
              <p className="mt-3 text-muted-foreground">
                DSLM is not a single model file. It is a student-specific signal graph built from stored learner evidence. The value is not that Edooqoo makes a generic worksheet faster; the value is that each recurring prep cycle starts from goals, nano-skill evidence, pacing, roadmap context, and recent activity before the worksheet is generated.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {evidenceStackItems.map(({ title, description, icon: Icon }) => (
                <Card key={title}>
                  <CardContent className="p-5">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold text-foreground">What 1-Minute Prep Uses</h2>
              <p className="mt-3 text-muted-foreground">
                The first student setup is a separate step. Edooqoo is designed to move recurring weekly prep toward one focused minute after profile, goals, notes, and learning signals exist. The teacher still chooses the focus, reviews the output, and edits before use.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-foreground">First setup</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Add the student, level, goals, profile notes, or Welcome Test results. This builds the starting context.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-foreground">Recurring prep</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Use existing context plus recent signals to decide the next focus before generating the material.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-foreground">Worksheet output</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Generate an editable worksheet with exercises, audio, images, and AI-assisted review where applicable.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-y bg-secondary/20 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold text-foreground">What The Teacher Gets</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {bestFitItems.map((item) => (
                <div key={item} className="flex gap-3 rounded-md bg-background p-4 text-sm shadow-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-8 max-w-3xl">
              <h2 className="text-2xl font-bold text-foreground">Where Homework And Progress Signals Enter</h2>
              <p className="mt-3 text-muted-foreground">
                The system works as a student-context loop, not a single worksheet prompt.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-5">
              {loopStages.map(({ title, description, icon: Icon }) => (
                <div key={title} className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-primary/5 py-16">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2">
            <div>
              <FileText className="mb-4 h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Generator as output layer</h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                Edooqoo still generates worksheets. The difference is that 1-Minute Prep treats worksheet generation as the final output after student context, DSLM nano-skill evidence, pacing, and teacher choice define the next focus.
              </p>
            </div>
            <div>
              <ShieldCheck className="mb-4 h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Boundaries</h2>
              <ul className="mt-4 space-y-3">
                {boundaryItems.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-2xl font-bold text-foreground">FAQ</h2>
            <div className="mt-6 space-y-3">
              {faqItems.map(({ question, answer }) => (
                <details key={question} className="rounded-lg border bg-card p-4">
                  <summary className="cursor-pointer font-semibold text-foreground">{question}</summary>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default OneMinutePrep;
