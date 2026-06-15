import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ClipboardCheck, History, Target } from 'lucide-react';
import { PageSeo } from '@/components/seo/PageSeo';
import { CONTENT_AUTHORS } from '@/data/contentAuthors';

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
  const pageUrl = 'https://edooqoo.com/what-to-teach-next';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'What Should I Teach Next?',
        description: 'A practical evidence-based resource hub for recurring one-to-one adult English lesson decisions.',
        author: { '@type': 'Person', name: CONTENT_AUTHORS.jan.name, url: `https://edooqoo.com${CONTENT_AUTHORS.jan.path}` },
        reviewedBy: { '@type': 'Person', name: CONTENT_AUTHORS.martha.name, url: `https://edooqoo.com${CONTENT_AUTHORS.martha.path}` },
        inLanguage: 'en',
      },
      {
        '@type': 'ItemList',
        itemListElement: featuredResources.map((resource, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: resource.title,
          url: `https://edooqoo.com${resource.href}`,
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

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="What Should I Teach Next? — Adult 1:1 English Lessons"
        description="Use student context and recent evidence to decide whether the next adult 1:1 English lesson should continue, repair, or advance."
        path="/what-to-teach-next"
        jsonLd={jsonLd}
      />
      <header className="border-b bg-background/95">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold text-primary">Edooqoo</Link>
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-primary">Blog</Link>
        </div>
      </header>

      <main>
        <section className="border-b bg-gradient-to-b from-violet-50 to-background">
          <div className="container mx-auto max-w-5xl px-4 py-16 md:py-24">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Decision system for adult 1:1 tutors</p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              What Should I Teach Next?
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-relaxed text-muted-foreground">
              Choose the next lesson by connecting one real learner goal with the strongest current evidence, then make a clear continue, repair, or advance decision.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>By <Link className="font-semibold text-primary hover:underline" to={CONTENT_AUTHORS.jan.path}>{CONTENT_AUTHORS.jan.name}</Link></span>
              <span>Reviewed by <Link className="font-semibold text-primary hover:underline" to={CONTENT_AUTHORS.martha.path}>{CONTENT_AUTHORS.martha.name}, ESL Methodology Reviewer</Link></span>
              <span>Updated June 14, 2026</span>
            </div>
          </div>
        </section>

        <section className="container mx-auto max-w-5xl px-4 py-14">
          <h2 className="mb-3 text-3xl font-semibold text-foreground">The decision sequence</h2>
          <p className="mb-8 max-w-3xl text-muted-foreground">
            The framework narrows weekly preparation to the evidence that can change the next adult learner performance.
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="rounded-2xl border bg-card p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>
                <p className="leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y bg-secondary/30">
          <div className="container mx-auto max-w-5xl px-4 py-14">
            <h2 className="mb-8 text-3xl font-semibold text-foreground">Start with these resources</h2>
            <div className="grid gap-5 md:grid-cols-2">
              {featuredResources.map((resource) => (
                <a key={resource.href} href={resource.href} className="group rounded-2xl border bg-background p-6 transition-shadow hover:shadow-md">
                  <h3 className="mb-2 text-xl font-semibold text-foreground group-hover:text-primary">{resource.title}</h3>
                  <p className="mb-4 text-muted-foreground">{resource.description}</p>
                  <span className="inline-flex items-center gap-2 font-semibold text-primary">Read resource <ArrowRight className="h-4 w-4" /></span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto max-w-5xl px-4 py-14">
          <div className="rounded-2xl bg-foreground p-8 text-background md:p-10">
            <h2 className="text-3xl font-semibold">One rule to keep</h2>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-background/80">
              Generate or select material only after the teaching decision is bounded. A polished worksheet built around the wrong objective is still the wrong lesson.
            </p>
            <Link to="/one-minute-prep" className="mt-6 inline-flex items-center gap-2 font-semibold text-violet-300 hover:text-violet-200">
              See the recurring Edooqoo workflow <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default WhatToTeachNext;
