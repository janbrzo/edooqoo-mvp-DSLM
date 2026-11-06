import React, { useState } from 'react';
import { ArrowDown, ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEventTracking } from '@/hooks/useEventTracking';
import OneMinutePrepHeroProofSwitcher from '@/components/landing/OneMinutePrepHeroProofSwitcher';

const canonicalCitationLinks = [
  { href: '/one-minute-prep', label: '1-Minute Prep' },
  { href: '/ai-worksheet-generator-for-english-teachers.html', label: 'AI worksheet generator' },
  { href: '/esl-student-progress-tracking-tool.html', label: 'Progress tracking' },
  { href: '/ai-grading-tool-for-english-homework.html', label: 'Homework review' },
  { href: '/vocabulary-exercise-generator.html', label: 'Vocabulary tools' },
];

interface HeroHeadlineProps {
  onTryWorksheetGenerator: (topic?: string) => void;
}

const HeroHeadline: React.FC<HeroHeadlineProps> = ({ onTryWorksheetGenerator }) => {
  const { trackEvent } = useEventTracking();
  const [lessonTopic, setLessonTopic] = useState('');

  const handleTopicSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    trackEvent({
      eventType: 'one_minute_secondary_cta_click',
      eventData: { target: 'worksheet-form', source: 'hero-topic', hasTopic: lessonTopic.trim().length > 0 },
    });
    onTryWorksheetGenerator(lessonTopic);
  };

  const handleDemoClick = () => {
    trackEvent({
      eventType: 'one_minute_hero_cta_click',
      eventData: { target: 'one-minute-prep' },
    });
  };

  return (
    <section className="relative overflow-hidden px-4 pb-12 pt-9 sm:pt-12 lg:pb-16 lg:pt-14">
      <div className="pointer-events-none absolute -right-24 top-0 -z-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />

      <div className="mx-auto grid w-full min-w-0 max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:gap-14">
        <div className="min-w-0 max-w-full text-center lg:text-left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <Clock3 className="h-3.5 w-3.5" />
            1-Minute Prep for recurring lessons
          </div>

          <h1 className="max-w-full break-words text-[2.55rem] font-extrabold leading-[1.06] tracking-tight text-foreground sm:text-6xl lg:text-[4rem] xl:text-[4.65rem]">
            <span className="block">AI Worksheet Generator</span>
            <span className="mt-1 block pb-2 text-primary">for 1:1 English Teachers</span>
          </h1>

          <p
            className="mx-auto mb-7 mt-5 max-w-full text-lg leading-relaxed text-muted-foreground sm:max-w-2xl sm:text-xl lg:mx-0 lg:max-w-[39rem]"
            // @ts-expect-error fetchpriority is valid HTML but not yet typed in React
            fetchpriority="high"
          >
            Create adult-focused lesson materials with audio, vocabulary and speaking practice. Start with a topic, then connect every worksheet to student goals, homework and learning history.
          </p>

          <form onSubmit={handleTopicSubmit} className="mx-auto max-w-2xl lg:mx-0" aria-label="Start a worksheet from a lesson topic">
            <label htmlFor="hero-lesson-topic" className="sr-only">Lesson topic</label>
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-2 shadow-lg shadow-primary/10 sm:flex-row sm:rounded-full">
              <Input
                id="hero-lesson-topic"
                name="heroLessonTopic"
                value={lessonTopic}
                onChange={(event) => setLessonTopic(event.target.value)}
                maxLength={200}
                autoComplete="off"
                placeholder="e.g. Negotiating a deadline with a client"
                className="h-12 min-w-0 flex-1 border-0 bg-transparent px-4 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-12"
              />
              <Button type="submit" size="lg" className="h-12 shrink-0 rounded-xl px-5 text-base font-semibold sm:rounded-full sm:px-6">
                Generate free worksheet
                <ArrowDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2.5 text-xs leading-5 text-muted-foreground sm:text-sm">
              Start with a topic. Review your options before generating.
            </p>
          </form>

          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" />No signup needed</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" />No credit card</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" />2 worksheets free</span>
          </div>

          <Link
            to="/demo"
            onClick={handleDemoClick}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Explore the full teacher toolkit
            <ArrowRight className="h-4 w-4" />
          </Link>

          <nav aria-label="Edooqoo canonical teacher workflows" className="sr-only">
            {canonicalCitationLinks.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>
        </div>

        <div className="mx-auto w-full min-w-0 max-w-full sm:max-w-[500px] lg:mx-0 lg:justify-self-end">
          <OneMinutePrepHeroProofSwitcher />
        </div>
      </div>
    </section>
  );
};

export default HeroHeadline;
