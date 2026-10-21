import React from 'react';
import { Link } from 'react-router-dom';
import { PageSeo } from '@/components/seo/PageSeo';
import PublicGalleryExamples from '@/components/gallery/PublicGalleryExamples';

const TOOLS = [
  {
    to: '/tools/what-should-i-teach-next',
    title: 'Next Lesson Decision Tool',
    blurb: 'Choose Repair, Continue, or Advance from bounded learner evidence. No student data required.',
    keyword: 'what should I teach next English student',
  },
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
      title="Free Tools for English Teachers | Edooqoo"
      description="Four free English tutor tools: next lesson decisions, CEFR level test, lesson plan generator and vocabulary checker. No sign-up required."
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
          Next lesson decisions, CEFR level testing, lesson planning and vocabulary checking for adult one-to-one English lessons. No account required.
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
      <section className="mt-10 border-t pt-8">
        <h2 className="text-2xl font-bold text-foreground">Teaching reference hubs</h2>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-primary">
          <li><Link to="/cefr-assessment" className="hover:underline">CEFR assessment</Link></li>
          <li><Link to="/teaching-english-pronunciation" className="hover:underline">Pronunciation</Link></li>
          <li><Link to="/esl-exercise-design" className="hover:underline">Exercise design</Link></li>
          <li><Link to="/tutor-operations" className="hover:underline">Tutor operations</Link></li>
        </ul>
      </section>
      <PublicGalleryExamples />
    </article>
  </div>
);

export default ToolsIndex;
