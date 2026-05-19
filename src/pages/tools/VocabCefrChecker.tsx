import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageSeo, buildFaqPageLd } from '@/components/seo/PageSeo';
import { analyzeVocab, type CefrWordLevel } from '@/data/cefrWordlist';

const FAQS = [
  { question: 'How does the checker decide each word\'s CEFR level?', answer: 'Known words are matched against a built-in English Vocabulary Profile lookup (~480 high-frequency lemmas across A1–C1). Unknown words fall back to a length-and-suffix heuristic.' },
  { question: 'Is my text uploaded anywhere?', answer: 'No. Analysis runs entirely in your browser. Nothing leaves your device.' },
  { question: 'How long can the input be?', answer: 'Up to about 5,000 characters comfortably. Longer texts still work but may pause your tab briefly while tokenizing.' },
  { question: 'Can I export the result?', answer: 'Yes — copy the highlighted text or the per-level breakdown into a Google Doc or share it with the student.' },
];

const LEVEL_COLORS: Record<CefrWordLevel, string> = {
  A1: 'bg-emerald-100 text-emerald-900',
  A2: 'bg-teal-100 text-teal-900',
  B1: 'bg-sky-100 text-sky-900',
  B2: 'bg-amber-100 text-amber-900',
  C1: 'bg-orange-100 text-orange-900',
  C2: 'bg-rose-100 text-rose-900',
};

const SAMPLE = "If the proposal had been clearer, the team would have endorsed it without hesitation. Several stakeholders remain skeptical, citing the ambiguous timeline and the lack of measurable milestones.";

const VocabCefrChecker: React.FC = () => {
  const [text, setText] = useState('');
  const result = useMemo(() => (text.trim() ? analyzeVocab(text) : null), [text]);

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Free CEFR Vocabulary Checker — Estimate A1–C2 Text Level"
        description="Paste any English text and see each word's CEFR level (A1–C2) plus the overall difficulty. Free, browser-only, no sign-up."
        path="/tools/vocab-cefr-checker"
        ogType="article"
        jsonLd={[
          buildFaqPageLd(FAQS),
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Edooqoo CEFR Vocabulary Checker',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
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
            <li className="text-foreground">CEFR Vocabulary Checker</li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">CEFR Vocabulary Checker</h1>
          <p className="text-lg text-muted-foreground">
            Paste any English text. Get a per-word CEFR level (A1–C2) and the overall difficulty of the passage. Useful before assigning a reading task.
          </p>
        </header>

        <aside aria-label="Summary" className="mb-8 rounded-lg border bg-card p-5 text-sm">
          <strong className="block text-foreground mb-1">TL;DR</strong>
          <span className="text-muted-foreground">
            Paste English text → see per-word CEFR colours and a level histogram. Runs locally; no sign-up.
          </span>
        </aside>

        <div className="rounded-lg border bg-card p-4 mb-4">
          <label className="block">
            <span className="block text-sm font-semibold text-foreground mb-2">Your text</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste an article, an email, a worksheet passage…"
              rows={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </label>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setText(SAMPLE)}
              className="px-4 py-2 rounded-md border border-input text-sm font-semibold hover:bg-accent"
            >
              Try a B2/C1 sample
            </button>
            <button
              type="button"
              onClick={() => setText('')}
              className="px-4 py-2 rounded-md border border-input text-sm font-semibold hover:bg-accent"
            >
              Clear
            </button>
          </div>
        </div>

        {result && (
          <section className="mb-10 space-y-4">
            <div className="rounded-lg border bg-card p-5">
              <h2 className="text-xl font-bold text-foreground mb-2">Overall estimated level: {result.estimatedLevel}</h2>
              <p className="text-sm text-muted-foreground mb-3">
                {result.totalTokens} tokens · {result.uniqueWords} unique words
              </p>
              <div className="grid grid-cols-6 gap-2">
                {(Object.keys(result.byLevel) as CefrWordLevel[]).map((lvl) => (
                  <div key={lvl} className={`rounded-md p-2 text-center text-xs font-semibold ${LEVEL_COLORS[lvl]}`}>
                    <div className="text-lg font-bold">{result.byLevel[lvl]}</div>
                    <div>{lvl}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h2 className="text-lg font-bold text-foreground mb-3">Per-word breakdown</h2>
              <p className="leading-loose">
                {result.tokens.map((t, i) => (
                  <span
                    key={i}
                    title={`${t.level}${t.known ? '' : ' (guess)'}`}
                    className={`inline-block px-1.5 py-0.5 mr-1 mb-1 rounded ${LEVEL_COLORS[t.level]} ${t.known ? '' : 'opacity-70'}`}
                  >
                    {t.word}
                  </span>
                ))}
              </p>
              <p className="text-xs text-muted-foreground mt-3">Faded words were not in the lookup and are estimated by length/suffix heuristic.</p>
            </div>
          </section>
        )}

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
          <h2 className="text-2xl font-bold text-foreground mb-2">Lock the level for your next worksheet</h2>
          <p className="text-muted-foreground mb-6">
            Edooqoo generates printable worksheets at any CEFR level in 60 seconds.
          </p>
          <Link to="/signup" className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90">
            Try Edooqoo free
          </Link>
        </section>
      </article>
    </div>
  );
};

export default VocabCefrChecker;