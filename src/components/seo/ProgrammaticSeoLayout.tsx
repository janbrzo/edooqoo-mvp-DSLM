import React from 'react';
import { Link } from 'react-router-dom';
import { PageSeo, buildFaqPageLd } from '@/components/seo/PageSeo';

export interface PseoFaq {
  question: string;
  answer: string;
}

export interface PseoRelated {
  label: string;
  to: string;
}

export interface PseoBreadcrumb {
  label: string;
  to?: string;
}

export interface ProgrammaticSeoLayoutProps {
  seo: { title: string; description: string; path: string };
  breadcrumbs: PseoBreadcrumb[];
  h1: string;
  lead: string;
  primaryCta: { label: string; to: string };
  whatsInside: { title: string; body: string }[];
  bodyIntro: string;
  howItWorks: string[];
  trustNumbers: { value: string; label: string }[];
  related: { heading: string; items: PseoRelated[] };
  faqs: PseoFaq[];
  extraJsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const BASE = 'https://edooqoo.com';

const buildBreadcrumbLd = (items: PseoBreadcrumb[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((b, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: b.label,
    ...(b.to ? { item: `${BASE}${b.to}` } : {}),
  })),
});

const ProgrammaticSeoLayout: React.FC<ProgrammaticSeoLayoutProps> = ({
  seo,
  breadcrumbs,
  h1,
  lead,
  primaryCta,
  whatsInside,
  bodyIntro,
  howItWorks,
  trustNumbers,
  related,
  faqs,
  extraJsonLd,
}) => {
  const faqLd = buildFaqPageLd(faqs);
  const crumbLd = buildBreadcrumbLd(breadcrumbs);
  const ld: Record<string, unknown>[] = [crumbLd, faqLd];
  if (extraJsonLd) {
    Array.isArray(extraJsonLd) ? ld.push(...extraJsonLd) : ld.push(extraJsonLd);
  }

  return (
    <div className="min-h-screen bg-background">
      <PageSeo title={seo.title} description={seo.description} path={seo.path} ogType="article" jsonLd={ld} />
      <article className="container mx-auto px-4 py-12 max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex flex-wrap gap-1">
            {breadcrumbs.map((b, i) => (
              <li key={i} className="flex items-center gap-1">
                {b.to ? (
                  <Link to={b.to} className="hover:text-primary">{b.label}</Link>
                ) : (
                  <span className="text-foreground">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <span aria-hidden>/</span>}
              </li>
            ))}
          </ol>
        </nav>

        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{h1}</h1>
          <p className="text-lg text-muted-foreground mb-6">{lead}</p>
          <Link
            to={primaryCta.to}
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            {primaryCta.label}
          </Link>
        </header>

        <aside
          aria-label="Summary"
          className="mb-10 rounded-lg border bg-card p-5 text-sm"
        >
          <strong className="block text-foreground mb-1">TL;DR</strong>
          <span className="text-muted-foreground">{lead}</span>
        </aside>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-4">What&apos;s inside every worksheet</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {whatsInside.map((item, i) => (
              <li key={i} className="rounded-lg border bg-card p-4">
                <div className="font-semibold text-foreground text-sm mb-1">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.body}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-4">How it works</h2>
          <p className="text-muted-foreground mb-4">{bodyIntro}</p>
          <ol className="space-y-3">
            {howItWorks.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-muted-foreground pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {trustNumbers.map((n, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{n.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{n.label}</div>
            </div>
          ))}
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-4">{related.heading}</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {related.items.map((r, i) => (
              <li key={i}>
                <Link to={r.to} className="text-primary hover:underline text-sm">
                  → {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-6 border-b pb-2">Frequently asked questions</h2>
          <div className="space-y-3">
            {faqs.map(({ question, answer }) => (
              <details key={question} className="border rounded-lg p-4">
                <summary className="font-semibold text-foreground cursor-pointer">{question}</summary>
                <p className="mt-2 text-muted-foreground text-sm">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="p-8 bg-primary/5 rounded-lg text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Generate your first worksheet free</h2>
          <p className="text-muted-foreground mb-6">
            Two worksheets included on the free plan. No credit card. Built with Martha (10 yrs ESL).
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to={primaryCta.to}
              className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              {primaryCta.label}
            </Link>
            <Link
              to="/pricing"
              className="inline-block border border-input px-6 py-3 rounded-lg font-semibold text-foreground hover:bg-accent transition-colors"
            >
              See pricing
            </Link>
          </div>
        </section>
      </article>
    </div>
  );
};

export default ProgrammaticSeoLayout;