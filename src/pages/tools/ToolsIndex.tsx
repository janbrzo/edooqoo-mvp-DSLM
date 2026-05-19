import React from 'react';
import { Link } from 'react-router-dom';
import { PageSeo } from '@/components/seo/PageSeo';

const TOOLS = [
  {
    to: '/tools/cefr-level-test',
    title: 'CEFR Level Test',
    blurb: '25 questions, ~5 minutes. Instant A1–C2 result. No sign-up.',
    keyword: 'english level test',
  },
  {
    to: '/tools/lesson-plan-generator',
    title: 'ESL Lesson Plan Generator',
    blurb: 'Build a printable 60-minute 1-on-1 lesson plan in under a minute.',
    keyword: 'esl lesson plan template',
  },
  {
    to: '/tools/vocab-cefr-checker',
    title: 'CEFR Vocabulary Checker',
    blurb: 'Paste any English text. See per-word CEFR levels and overall difficulty.',
    keyword: 'cefr vocabulary level',
  },
];

const ToolsIndex: React.FC = () => (
  <div className="min-h-screen bg-background">
    <PageSeo
      title="Free Tools for English Teachers — Edooqoo"
      description="Free English teaching tools: CEFR level test, ESL lesson plan generator, CEFR vocabulary checker. No sign-up, runs in your browser."
      path="/tools"
      jsonLd={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: TOOLS.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://edooqoo.com${t.to}`,
          name: t.title,
        })),
      }}
    />
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Free Tools for English Teachers</h1>
        <p className="text-lg text-muted-foreground">
          Three browser-based tools built with Martha (10 yrs ESL). No login, no installs, no data leaves your device.
        </p>
      </header>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TOOLS.map((t) => (
          <li key={t.to} className="rounded-lg border bg-card p-6">
            <Link to={t.to} className="text-xl font-semibold text-primary hover:underline">{t.title}</Link>
            <p className="text-sm text-muted-foreground mt-2">{t.blurb}</p>
          </li>
        ))}
      </ul>
    </article>
  </div>
);

export default ToolsIndex;