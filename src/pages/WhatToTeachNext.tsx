import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ClipboardCheck, History, Target } from 'lucide-react';
import { PageSeo } from '@/components/seo/PageSeo';
import { CONTENT_AUTHORS } from '@/data/contentAuthors';
import { WHAT_TO_TEACH_NEXT_CASES } from '@/data/whatToTeachNextCases';
import { useEventTracking } from '@/hooks/useEventTracking';

const featuredResources = [
  {
    href: '/blog/what-to-teach-next-private-english-student.html',
    title: 'What Should I Teach Next? A Decision Framework',
    description: 'Use goals, recent performance, homework, retention, and context to choose one next lesson.',
  },
  {
    href: '/blog/teaching-english-one-to-one.html',
    title: 'One-to-One English Lesson Planning for Adults',
    description: 'The complete evidence-based planning system for recurring adult learners.',
  },
  {
    href: '/blog/homework-mistakes-next-english-lesson.html',
    title: 'Turn Homework Mistakes Into the Next Lesson',
    description: 'Separate slips, knowledge gaps, retrieval gaps, and low-priority errors.',
  },
  {
    href: '/blog/how-english-tutors-track-what-to-teach-next.html',
    title: 'How Tutors Track What to Teach Next',
    description: 'A compact post-lesson evidence record that supports the next decision.',
  },
];

const steps = [
  {
    icon: Target,
    title: 'Student context',
    text: 'Name the adult learner’s real-world situation, current priority, CEFR context, and practical constraints.',
  },
  {
    icon: History,
    title: 'Evidence',
    text: 'Review the strongest recent signal from live performance, homework, retrieval, or an upcoming communication event.',
  },
  {
    icon: ClipboardCheck,
    title: 'Continue, repair, or advance',
    text: 'Continue partial learning, repair a blocking prerequisite, or advance after independent transfer.',
  },
  {
    icon: BookOpen,
    title: 'Bounded lesson objective',
    text: 'Define one observable performance, the minimum supporting language, and the evidence to collect next.',
  },
];

const WhatToTeachNext: React.FC = () => {
  const { trackEvent } = useEventTracking();

  useEffect(() => {
    trackEvent({
      eventType: 'content_view',
      eventData: { contentType: 'hub', route: '/what-to-teach-next' },
    });
  }, [trackEvent]);

  const pageUrl = 'https://edooqoo.com/what-to-teach-next';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'What Should I Teach Next?',
        description: 'An evidence-based resource hub, worked-example library, and local decision tool for recurring one-to-one adult English lessons.',
        author: { '@type': 'Person', name: CONTENT_AUTHORS.jan.name, url: `https://edooqoo.com${CONTENT_AUTHORS.jan.path}` },
        reviewedBy: { '@type': 'Person', name: CONTENT_AUTHORS.martha.name, url: `https://edooqoo.com${CONTENT_AUTHORS.martha.path}` },
        inLanguage: 'en',
      },
      {
        '@type': 'ItemList',
        itemListElement: WHAT_TO_TEACH_NEXT_CASES.map((example, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: example.title,
          url: `https://edooqoo.com/what-to-teach-next/${example.slug}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://edooqoo.com/' },
          { '@type': 'ListItem', position: 2, name: 'What Should I Teach Next?', item: pageUrl },
        ],
      },
    ],
  };

  const trackCta = (target: string, source: string) => {
    trackEvent({ eventType: 'content_cta_click', eventData: { source, target } });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="What Should I Teach Next? — Adult 1:1 English Lessons"
        description="Use student context and recent evidence to decide whether the next adult 1:1 English lesson should continue, repair, or advance. Includes 12 worked examples and a free local tool."
        path="/what-to-teach-next"
        jsonLd={jsonLd}
      />
      <header className="border-b bg-background/95">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold text-primary">Edooqoo</Link>
          <div className="flex items-center gap-5 text-sm">
            <Link to="/tools/what-should-i-teach-next" className="font-semibold text-primary hover:underline">Decision tool</Link>
            <Link to="/blog" className="text-muted-foreground hover:text-primary">Blog</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b bg-gradient-to-b from-violet-50 to-background">
          <div className="container mx-auto max-w-5xl px-4 py-16 md:py-24">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Decision system for adult 1:1 tutors</p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-foreground md:text-6xl">What Should I Teach Next?</h1>
            <p className="mt-6 max-w-3xl text-xl leading-relaxed text-muted-foreground">
              Choose the next lesson by connecting one real learner goal with the strongest current evidence, then make a clear Continue, Repair, or Advance decision.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>By <Link className="font-semibold text-primary hover:underline" to={CONTENT_AUTHORS.jan.path}>{CONTENT_AUTHORS.jan.name}</Link></span>
              <span>Reviewed by <Link className="font-semibold text-primary hover:underline" to={CONTENT_AUTHORS.martha.path}>{CONTENT_AUTHORS.martha.name}</Link>, ESL Methodology Reviewer, 10 years of experience</span>
              <span>Updated June 15, 2026</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/tools/what-should-i-teach-next"
                onClick={() => trackCta('decision_tool', 'hub_hero')}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
              >
                Decide the next lesson
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#worked-examples" className="rounded-lg border border-input px-6 py-3 font-semibold hover:bg-accent">Browse worked examples</a>
            </div>
          </div>
        </section>

        <section className="container mx-auto max-w-5xl px-4 py-16">
          <div className="grid gap-5 md:grid-cols-2">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="rounded-xl border bg-card p-6">
                  <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  <h2 className="mt-4 text-xl font-bold text-foreground">{step.title}</h2>
                  <p className="mt-2 leading-7 text-muted-foreground">{step.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="container mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-3xl font-bold text-foreground">The decision rule</h2>
            <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
              Repair when a missing prerequisite or recurring error blocks the goal. Continue when the learner has partial control, needs prompts, or the evidence is not strong enough. Advance only after accurate independent use without an established recurring target error.
            </p>
          </div>
        </section>

        <section id="worked-examples" className="container mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">12 constructed cases</p>
            <h2 className="mt-3 text-3xl font-bold text-foreground">Worked examples for adult 1:1 lessons</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Each case follows the same sequence: Student context, Evidence, Continue/Repair/Advance, Lesson objective, Activity sequence, and Evidence to collect next. These are teaching models, not reports of real student outcomes.
            </p>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {WHAT_TO_TEACH_NEXT_CASES.map((example) => (
              <article key={example.slug} className="flex h-full flex-col rounded-xl border bg-card p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Worked example</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{example.decision}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold text-foreground">{example.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{example.summary}</p>
                <Link
                  to={`/what-to-teach-next/${example.slug}`}
                  onClick={() => trackCta('worked_example', example.slug)}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  Read the full decision
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="container mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-3xl font-bold text-foreground">Decision resources</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {featuredResources.map((resource) => (
                <article key={resource.href} className="rounded-xl border bg-background p-6">
                  <h3 className="text-xl font-bold text-foreground">
                    <a href={resource.href} className="hover:text-primary hover:underline">{resource.title}</a>
                  </h3>
                  <p className="mt-3 leading-7 text-muted-foreground">{resource.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold text-foreground">Use evidence, then make one bounded decision</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-muted-foreground">
            The local tool converts seven teaching signals into a transparent recommendation, objective, activity structure, worksheet brief, and next evidence criteria.
          </p>
          <Link
            to="/tools/what-should-i-teach-next"
            onClick={() => trackCta('decision_tool', 'hub_final')}
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
          >
            Open the decision tool
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </main>
    </div>
  );
};

export default WhatToTeachNext;
