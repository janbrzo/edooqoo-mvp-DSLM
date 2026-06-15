import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { PageSeo } from '@/components/seo/PageSeo';
import { CONTENT_AUTHORS } from '@/data/contentAuthors';
import { getWhatToTeachNextCase } from '@/data/whatToTeachNextCases';
import { useEventTracking } from '@/hooks/useEventTracking';

const WhatToTeachNextCase: React.FC = () => {
  const { slug } = useParams();
  const example = getWhatToTeachNextCase(slug);
  const { trackEvent } = useEventTracking();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!example) return;
    trackEvent({
      eventType: 'content_view',
      eventData: { contentType: 'worked_example', slug: example.slug },
    });
  }, [example, trackEvent]);

  if (!example) return <Navigate to="/what-to-teach-next" replace />;

  const path = `/what-to-teach-next/${example.slug}`;
  const pageUrl = `https://edooqoo.com${path}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: example.title,
        description: example.summary,
        url: pageUrl,
        datePublished: '2026-06-15',
        dateModified: '2026-06-15',
        author: {
          '@type': 'Person',
          name: CONTENT_AUTHORS.jan.name,
          url: `https://edooqoo.com${CONTENT_AUTHORS.jan.path}`,
        },
        reviewedBy: {
          '@type': 'Person',
          name: CONTENT_AUTHORS.martha.name,
          url: `https://edooqoo.com${CONTENT_AUTHORS.martha.path}`,
        },
        about: ['adult one-to-one English tutoring', 'next lesson decision', example.decision],
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://edooqoo.com/' },
          { '@type': 'ListItem', position: 2, name: 'What Should I Teach Next?', item: 'https://edooqoo.com/what-to-teach-next' },
          { '@type': 'ListItem', position: 3, name: example.title, item: pageUrl },
        ],
      },
    ],
  };

  const shareExample = async () => {
    const shareData = { title: example.title, text: example.summary, url: pageUrl };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
    trackEvent({
      eventType: 'case_share',
      eventData: { slug: example.slug, method: navigator.share ? 'native' : 'copy' },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title={`${example.title} — Worked Example`}
        description={example.summary}
        path={path}
        ogType="article"
        jsonLd={jsonLd}
      />
      <article className="container mx-auto max-w-3xl px-4 py-12 md:py-16">
        <nav aria-label="Breadcrumb" className="mb-8">
          <Link to="/what-to-teach-next" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All worked examples
          </Link>
        </nav>

        <header className="mb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Worked example</p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">{example.title}</h1>
          <p className="mt-5 text-xl leading-relaxed text-muted-foreground">{example.summary}</p>
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            This is a constructed teaching example, not a report of a real student or a claimed learning outcome.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span>By <Link to={CONTENT_AUTHORS.jan.path} className="font-semibold text-primary hover:underline">{CONTENT_AUTHORS.jan.name}</Link></span>
            <span>Reviewed by <Link to={CONTENT_AUTHORS.martha.path} className="font-semibold text-primary hover:underline">{CONTENT_AUTHORS.martha.name}</Link>, ESL Methodology Reviewer, 10 years of experience</span>
            <span>Published and updated June 15, 2026</span>
          </div>
        </header>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-bold text-foreground">Student context</h2>
            <p className="mt-3 leading-7 text-muted-foreground">{example.studentContext}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground">Evidence</h2>
            <ul className="mt-4 space-y-3">
              {example.evidence.map((item) => (
                <li key={item} className="flex gap-3 leading-7 text-muted-foreground">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border bg-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Decision</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground">{example.decision}</h2>
            <p className="mt-3 leading-7 text-muted-foreground">{example.decisionReason}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground">Lesson objective</h2>
            <p className="mt-3 border-l-4 border-primary pl-5 text-lg leading-8 text-foreground">{example.lessonObjective}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground">Activity sequence</h2>
            <ol className="mt-4 space-y-3">
              {example.activitySequence.map((item, index) => (
                <li key={item} className="flex gap-4 rounded-lg border bg-card p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
                  <span className="leading-7 text-muted-foreground">{item}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground">Evidence to collect next</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6 leading-7 text-muted-foreground">
              {example.evidenceToCollect.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-3 border-t pt-8">
          <button
            type="button"
            onClick={shareExample}
            className="inline-flex items-center gap-2 rounded-lg border border-input px-5 py-3 text-sm font-semibold hover:bg-accent"
          >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Link copied' : 'Share this example'}
          </button>
          <Link
            to="/tools/what-should-i-teach-next"
            onClick={() => trackEvent({
              eventType: 'content_cta_click',
              eventData: { source: 'worked_example', slug: example.slug, target: 'decision_tool' },
            })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Decide your next lesson
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </article>
    </div>
  );
};

export default WhatToTeachNextCase;
