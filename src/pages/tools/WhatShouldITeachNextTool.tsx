import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, ClipboardCopy, Link2 } from 'lucide-react';
import { PageSeo, buildFaqPageLd } from '@/components/seo/PageSeo';
import { useEventTracking } from '@/hooks/useEventTracking';
import {
  CEFR_LEVELS,
  DEFAULT_DECISION_INPUT,
  GOALS,
  HOMEWORK_RESULTS,
  INDEPENDENCE,
  MASTERY,
  RECURRING_ERRORS,
  UPCOMING_SITUATIONS,
  decideNextLesson,
  parseDecisionInput,
  serializeDecisionInput,
  type DecisionInput,
  type DecisionResult,
} from '@/lib/decisionTool/decisionRules.mjs';

const FAQS = [
  {
    question: 'Does this tool use AI or upload student data?',
    answer: 'No. The decision is calculated locally in the browser with fixed rules. The form contains no student name, email, notes, or free-text personal data.',
  },
  {
    question: 'What is the difference between Repair, Continue, and Advance?',
    answer: 'Repair addresses a blocking gap, Continue reduces support or gathers stronger evidence for the current objective, and Advance transfers secure independent performance to a harder context.',
  },
  {
    question: 'Is the result a complete lesson plan?',
    answer: 'No. It is a bounded teaching decision with an objective, activity structure, worksheet brief, and evidence criteria for an adult one-to-one lesson.',
  },
];

const FIELD_OPTIONS = [
  { key: 'level', label: 'CEFR level', options: Object.fromEntries(CEFR_LEVELS.map((level) => [level, level])) },
  { key: 'goal', label: 'Learner goal', options: GOALS },
  { key: 'mastery', label: 'Previous objective', options: MASTERY },
  { key: 'independence', label: 'Independent use', options: INDEPENDENCE },
  { key: 'recurringError', label: 'Recurring error', options: RECURRING_ERRORS },
  { key: 'homework', label: 'Homework evidence', options: HOMEWORK_RESULTS },
  { key: 'upcoming', label: 'Upcoming communication situation', options: UPCOMING_SITUATIONS },
] as const;

function resultText(result: DecisionResult) {
  return [
    `Decision: ${result.decision}`,
    '',
    `Rationale: ${result.rationale}`,
    '',
    `Next lesson objective: ${result.lessonObjective}`,
    '',
    'Activity sequence:',
    ...result.activitySequence.map((item, index) => `${index + 1}. ${item}`),
    '',
    `Worksheet brief: ${result.worksheetBrief}`,
    '',
    'Evidence to collect:',
    ...result.evidenceToCollect.map((item) => `- ${item}`),
  ].join('\n');
}

const WhatShouldITeachNextTool: React.FC = () => {
  const location = useLocation();
  const { trackEvent } = useEventTracking();
  const startedRef = useRef(false);
  const [input, setInput] = useState<DecisionInput>(() => {
    try {
      return location.search ? parseDecisionInput(location.search) : DEFAULT_DECISION_INPUT;
    } catch {
      return DEFAULT_DECISION_INPUT;
    }
  });
  const [result, setResult] = useState<DecisionResult | null>(() => (
    location.search ? decideNextLesson(parseDecisionInput(location.search)) : null
  ));
  const [copyStatus, setCopyStatus] = useState<'result' | 'link' | null>(null);

  useEffect(() => {
    trackEvent({
      eventType: 'content_view',
      eventData: { contentType: 'decision_tool', route: '/tools/what-should-i-teach-next' },
    });
  }, [trackEvent]);

  const update = (key: keyof DecisionInput, value: string) => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent({ eventType: 'decision_tool_start', eventData: { entry: location.search ? 'shared_link' : 'blank_form' } });
    }
    setInput((previous) => ({ ...previous, [key]: value }));
  };

  const generate = (event: React.FormEvent) => {
    event.preventDefault();
    const nextResult = decideNextLesson(input);
    setResult(nextResult);
    trackEvent({
      eventType: 'decision_tool_complete',
      eventData: {
        decision: nextResult.decision,
        level: input.level,
        goal: input.goal,
        mastery: input.mastery,
        independence: input.independence,
        recurringError: input.recurringError,
        homework: input.homework,
        upcoming: input.upcoming,
      },
    });
    window.setTimeout(() => document.getElementById('decision-result')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(resultText(result));
    setCopyStatus('result');
    trackEvent({ eventType: 'decision_tool_copy', eventData: { copyType: 'result', decision: result.decision } });
    window.setTimeout(() => setCopyStatus(null), 2000);
  };

  const copySafeLink = async () => {
    const url = `${window.location.origin}/tools/what-should-i-teach-next?${serializeDecisionInput(input)}`;
    await navigator.clipboard.writeText(url);
    setCopyStatus('link');
    trackEvent({ eventType: 'decision_tool_copy', eventData: { copyType: 'safe_link', decision: result?.decision || null } });
    window.setTimeout(() => setCopyStatus(null), 2000);
  };

  const pageUrl = 'https://edooqoo.com/tools/what-should-i-teach-next';
  const faqLd = buildFaqPageLd(FAQS);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: faqLd.mainEntity,
      },
      {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Next Lesson Decision Tool',
      url: pageUrl,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web browser',
      isAccessibleForFree: true,
      description: 'A local rule-based tool that helps adult one-to-one English tutors choose Repair, Continue, or Advance for the next lesson.',
      provider: { '@type': 'Organization', name: 'Edooqoo', url: 'https://edooqoo.com/' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://edooqoo.com/' },
          { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://edooqoo.com/tools' },
          { '@type': 'ListItem', position: 3, name: 'Next Lesson Decision Tool', item: pageUrl },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="What Should I Teach Next? — Decision Tool for English Tutors"
        description="Choose Repair, Continue, or Advance for an adult 1:1 English student. Local rule-based tool with a next objective, lesson structure, worksheet brief, and evidence criteria."
        path="/tools/what-should-i-teach-next"
        jsonLd={jsonLd}
      />
      <article className="container mx-auto max-w-4xl px-4 py-12 md:py-16">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <Link to="/tools" className="hover:text-primary">Tools</Link>
          <span aria-hidden="true"> / </span>
          <span className="text-foreground">Next Lesson Decision Tool</span>
        </nav>

        <header className="mb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Local decision tool for adult 1:1 tutors</p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">What Should I Teach Next?</h1>
          <p className="mt-5 max-w-3xl text-xl leading-relaxed text-muted-foreground">
            Enter bounded teaching evidence. The tool applies transparent rules and returns Repair, Continue, or Advance with a usable next-lesson brief.
          </p>
          <p className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            Runs locally. No AI, account, student name, email, notes, or worksheet-generation call.
          </p>
        </header>

        <form onSubmit={generate} className="rounded-xl border bg-card p-6 md:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            {FIELD_OPTIONS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-2 block text-sm font-semibold text-foreground">{field.label}</span>
                <select
                  value={input[field.key]}
                  onChange={(event) => update(field.key, event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-3 text-sm"
                >
                  {Object.entries(field.options as Record<string, string>).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button type="submit" className="mt-7 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90">
            Decide the next lesson
          </button>
        </form>

        {result && (
          <section id="decision-result" className="mt-12 rounded-xl border bg-card p-6 md:p-8" aria-live="polite">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Decision</p>
            <h2 className="mt-2 text-4xl font-bold text-foreground">{result.decision}</h2>

            <div className="mt-8 space-y-8">
              <div>
                <h3 className="text-xl font-bold text-foreground">Why</h3>
                <p className="mt-2 leading-7 text-muted-foreground">{result.rationale}</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Next lesson objective</h3>
                <p className="mt-2 border-l-4 border-primary pl-4 leading-7 text-foreground">{result.lessonObjective}</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Work structure</h3>
                <ol className="mt-3 space-y-2">
                  {result.activitySequence.map((item, index) => (
                    <li key={item} className="flex gap-3 text-muted-foreground">
                      <span className="font-semibold text-primary">{index + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Worksheet brief</h3>
                <p className="mt-2 rounded-lg bg-muted/50 p-4 leading-7 text-muted-foreground">{result.worksheetBrief}</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Evidence to collect next</h3>
                <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
                  {result.evidenceToCollect.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 border-t pt-6">
              <button type="button" onClick={copyResult} className="inline-flex items-center gap-2 rounded-lg border border-input px-5 py-3 text-sm font-semibold hover:bg-accent">
                {copyStatus === 'result' ? <CheckCircle2 className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                {copyStatus === 'result' ? 'Result copied' : 'Copy result'}
              </button>
              <button type="button" onClick={copySafeLink} className="inline-flex items-center gap-2 rounded-lg border border-input px-5 py-3 text-sm font-semibold hover:bg-accent">
                {copyStatus === 'link' ? <CheckCircle2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                {copyStatus === 'link' ? 'Safe link copied' : 'Copy safe link'}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">The link contains only the seven selected teaching categories. It cannot contain student notes or identity data.</p>
          </section>
        )}

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-foreground">Decision rules</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-5">
              <h3 className="font-bold text-foreground">Repair</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Use when the previous objective was not mastered or a recurring error blocks the communication goal.</p>
            </div>
            <div className="rounded-lg border p-5">
              <h3 className="font-bold text-foreground">Continue</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Use when evidence is incomplete, control is partial, or success still depends on prompts.</p>
            </div>
            <div className="rounded-lg border p-5">
              <h3 className="font-bold text-foreground">Advance</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Use after accurate independent performance with no established recurring target error.</p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-foreground">Frequently asked questions</h2>
          <div className="mt-5 space-y-3">
            {FAQS.map((item) => (
              <details key={item.question} className="rounded-lg border p-4">
                <summary className="cursor-pointer font-semibold text-foreground">{item.question}</summary>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
};

export default WhatShouldITeachNextTool;
