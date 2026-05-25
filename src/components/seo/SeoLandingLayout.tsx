import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageSeo, buildFaqPageLd } from '@/components/seo/PageSeo';

export interface SeoFaq {
  question: string;
  answer: string;
}

export interface SeoSolutionCard {
  title: string;
  body: string;
}

export interface SeoListItem {
  title: string;
  body: string;
  href?: string;
}

export interface SeoLandingLayoutProps {
  seo: {
    title: string;
    description: string;
    path: string;
    ogType?: 'website' | 'article';
    extraJsonLd?: Record<string, unknown> | Record<string, unknown>[];
  };
  h1: string;
  lead: string;
  primaryCta?: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  problems: string[];
  solutionHeading: string;
  solutions: SeoSolutionCard[];
  listHeading: string;
  listIntro?: string;
  list: SeoListItem[];
  body: React.ReactNode;
  faqHeading?: string;
  faqs: SeoFaq[];
  ctaTitle?: string;
  ctaBody?: string;
}

const SeoLandingLayout: React.FC<SeoLandingLayoutProps> = ({
  seo,
  h1,
  lead,
  primaryCta = { label: 'Try Edooqoo free', to: '/signup' },
  secondaryCta = { label: 'See 29 exercise types', to: '/exercise-types' },
  problems,
  solutionHeading,
  solutions,
  listHeading,
  listIntro,
  list,
  body,
  faqHeading = 'Frequently asked questions',
  faqs,
  ctaTitle = 'Ready to save 5+ hours per week?',
  ctaBody = 'Generate your first personalized worksheet in 60 seconds. Free plan includes 2 worksheets, no credit card required.',
}) => {
  const location = useLocation();
  const ctaState = (to: string) =>
    to.startsWith('/signup') || to.startsWith('/login')
      ? { from: location.pathname + location.search }
      : undefined;
  const faqLd = buildFaqPageLd(faqs);
  const jsonLd = seo.extraJsonLd
    ? Array.isArray(seo.extraJsonLd)
      ? [...seo.extraJsonLd, faqLd]
      : [seo.extraJsonLd, faqLd]
    : faqLd;

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title={seo.title}
        description={seo.description}
        path={seo.path}
        ogType={seo.ogType ?? 'article'}
        jsonLd={jsonLd}
      />
      <article className="container mx-auto px-4 py-12 max-w-4xl">
        <nav className="mb-8 text-sm">
          <Link to="/" className="text-primary hover:underline">← Back to Edooqoo</Link>
        </nav>

        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{h1}</h1>
          <p className="text-lg text-muted-foreground mb-6">{lead}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={primaryCta.to}
              state={ctaState(primaryCta.to)}
              className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              {primaryCta.label}
            </Link>
            <Link
              to={secondaryCta.to}
              state={ctaState(secondaryCta.to)}
              className="inline-block border border-input px-6 py-3 rounded-lg font-semibold text-foreground hover:bg-accent transition-colors"
            >
              {secondaryCta.label}
            </Link>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">The problem most English teachers face</h2>
          <ul className="space-y-2">
            {problems.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-muted-foreground">
                <span className="text-destructive mt-1">×</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">{solutionHeading}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {solutions.map((s, i) => (
              <div key={i} className="rounded-lg border bg-card p-5">
                <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">{listHeading}</h2>
          {listIntro && <p className="text-muted-foreground mb-6">{listIntro}</p>}
          <ol className="space-y-4">
            {list.map((item, i) => (
              <li key={i} className="border-l-4 border-primary/40 pl-4">
                <h3 className="font-semibold text-foreground mb-1">
                  {i + 1}. {item.href ? <Link to={item.href} className="hover:text-primary transition-colors">{item.title}</Link> : item.title}
                </h3>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-12 prose prose-sm max-w-none dark:prose-invert text-muted-foreground">
          {body}
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6 border-b pb-2">{faqHeading}</h2>
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
          <h2 className="text-2xl font-bold text-foreground mb-2">{ctaTitle}</h2>
          <p className="text-muted-foreground mb-6">{ctaBody}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/signup"
              state={ctaState('/signup')}
              className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Sign up free — 2 worksheets included
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

export default SeoLandingLayout;