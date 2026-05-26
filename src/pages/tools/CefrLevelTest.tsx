import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageSeo, buildFaqPageLd } from '@/components/seo/PageSeo';
import { CEFR_TEST_QUESTIONS, scoreCefr, type CefrTestLevel } from '@/data/cefrLevelTestQuestions';

const FAQS = [
  { question: 'How long does the test take?', answer: 'About five minutes. There are 25 multiple-choice questions and your result is calculated instantly in your browser.' },
  { question: 'Is the test free?', answer: 'Yes. No sign-up, no email, no payment. Your answers never leave your device.' },
  { question: 'How accurate is the CEFR result?', answer: 'It is a quick estimate based on grammar and vocabulary across A1–C2. For placement decisions, follow up with the Edooqoo Welcome Test, which includes speaking and listening sections.' },
  { question: 'Can I use the result with students?', answer: 'Yes. Share the page link with students before a trial lesson, then use the level to generate a personalized worksheet in Edooqoo.' },
];

const LEVEL_LABELS: Record<CefrTestLevel, string> = {
  A1: 'A1 — Beginner',
  A2: 'A2 — Elementary',
  B1: 'B1 — Intermediate',
  B2: 'B2 — Upper-Intermediate',
  C1: 'C1 — Advanced',
  C2: 'C2 — Proficiency',
};

const CefrLevelTest: React.FC = () => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => (submitted ? scoreCefr(answers) : null), [submitted, answers]);
  const answeredCount = Object.keys(answers).length;

  const handleSelect = (qid: number, idx: number) => {
    setAnswers((prev) => ({ ...prev, [qid]: idx }));
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Free CEFR English Level Test — A1 to C2 in 5 Minutes"
        description="Free CEFR English level test. 25 questions, instant A1–C2 result, no sign-up. Built by Edooqoo for English teachers and adult learners."
        path="/tools/cefr-level-test"
        ogType="article"
        jsonLd={[
          buildFaqPageLd(FAQS),
          {
            '@context': 'https://schema.org',
            '@type': 'Quiz',
            name: 'CEFR English Level Test',
            about: 'CEFR English proficiency levels A1 to C2',
            educationalLevel: 'A1, A2, B1, B2, C1, C2',
            numberOfQuestions: CEFR_TEST_QUESTIONS.length,
            provider: { '@type': 'Organization', name: 'Edooqoo', url: 'https://edooqoo.com' },
          },
        ]}
      />
      <article className="container mx-auto px-4 py-12 max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex gap-1">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li aria-hidden>/</li>
            <li><Link to="/tools" className="hover:text-primary">Tools</Link></li>
            <li aria-hidden>/</li>
            <li className="text-foreground">CEFR Level Test</li>
          </ol>
        </nav>
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Free CEFR English Level Test</h1>
          <p className="text-lg text-muted-foreground">
            25 questions. ~5 minutes. Get your A1–C2 level instantly. No sign-up, no email — runs entirely in your browser.
          </p>
        </header>

        <aside aria-label="Summary" className="mb-8 rounded-lg border bg-card p-5 text-sm">
          <strong className="block text-foreground mb-1">TL;DR</strong>
          <span className="text-muted-foreground">
            Click an answer for each of the 25 questions, then press <em>See my CEFR level</em>. Result is private to your device.
          </span>
        </aside>

        {result && (
          <section className="mb-10 rounded-lg border bg-primary/5 p-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Your level: {LEVEL_LABELS[result.level]}</h2>
            <p className="text-muted-foreground mb-4">
              You scored <strong>{result.score} / {result.total}</strong>. Next step: generate a worksheet calibrated to your level.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/signup?level=${result.level.toLowerCase()}`}
                state={fromState}
                className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold hover:opacity-90"
              >
                Generate a worksheet for {result.level}
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="inline-block border border-input px-5 py-2.5 rounded-lg font-semibold text-foreground hover:bg-accent"
              >
                Take the test again
              </button>
            </div>
          </section>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="space-y-6"
        >
          {CEFR_TEST_QUESTIONS.map((q, i) => (
            <fieldset key={q.id} className="rounded-lg border bg-card p-5">
              <legend className="px-2 text-sm font-semibold text-muted-foreground">
                Question {i + 1} / {CEFR_TEST_QUESTIONS.length}
              </legend>
              <p className="text-foreground font-medium mb-3">{q.prompt}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {q.options.map((opt, idx) => {
                  const checked = answers[q.id] === idx;
                  return (
                    <label
                      key={idx}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm ${
                        checked ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={idx}
                        checked={checked}
                        onChange={() => handleSelect(q.id, idx)}
                        className="accent-primary"
                      />
                      <span className="text-foreground">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center gap-3 sticky bottom-2 bg-background/95 backdrop-blur p-3 rounded-lg border">
            <button
              type="submit"
              disabled={answeredCount < CEFR_TEST_QUESTIONS.length}
              className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              See my CEFR level
            </button>
            <span className="text-sm text-muted-foreground">
              {answeredCount} / {CEFR_TEST_QUESTIONS.length} answered
            </span>
          </div>
        </form>

        <section className="my-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details key={f.question} className="border rounded-lg p-4">
                <summary className="font-semibold text-foreground cursor-pointer">{f.question}</summary>
                <p className="mt-2 text-muted-foreground text-sm">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="p-8 bg-primary/5 rounded-lg text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Turn the result into a lesson</h2>
          <p className="text-muted-foreground mb-6">
            Edooqoo creates printable worksheets using teacher-selected CEFR levels. Free plan, no credit card.
          </p>
          <Link
            to="/signup"
            state={fromState}
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90"
          >
            Try Edooqoo free
          </Link>
        </section>
      </article>
    </div>
  );
};

export default CefrLevelTest;
