import React, { useState } from 'react';
import { ArrowDown, ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
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
  onPreviewPlacementTest: () => void;
}

const HeroHeadline: React.FC<HeroHeadlineProps> = ({ onTryWorksheetGenerator, onPreviewPlacementTest }) => {
  const { trackEvent } = useEventTracking();
  const [lessonTopic, setLessonTopic] = useState('');

  const handleTopicSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    trackEvent({ eventType: 'one_minute_secondary_cta_click', eventData: { target: 'worksheet-form', source: 'hero-topic', hasTopic: lessonTopic.trim().length > 0 } });
    onTryWorksheetGenerator(lessonTopic);
  };

  const handlePreview = () => {
    trackEvent({ eventType: 'one_minute_hero_cta_click', eventData: { target: 'placement-test-preview' } });
    onPreviewPlacementTest();
  };

  return (
    <section className="relative px-4 pb-10 pt-8 sm:pt-10 lg:pb-12 lg:pt-12">
      <div className="mx-auto grid w-full min-w-0 max-w-7xl grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-10">
        <div className="min-w-0 max-w-full text-center lg:text-left">
          <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-primary sm:text-sm"><Clock3 className="h-4 w-4" />1-Minute Prep System for 1:1 English Teachers</p>
          <h1 className="max-w-full break-words text-4xl font-extrabold leading-[1.1] tracking-normal text-foreground sm:text-5xl xl:text-6xl">
            AI Worksheet Generator <span className="text-primary">& Teaching Toolkit</span>
          </h1>
          <p className="mt-3 text-lg font-semibold leading-7 text-foreground sm:text-xl">Tailored to your 1:1 adult English students</p>
          <p className="mx-auto mb-6 mt-4 max-w-2xl text-base leading-7 text-muted-foreground lg:mx-0 sm:text-lg">
            Placement tests, custom worksheets with audio, AI-assisted homework review and flashcards, in one place. Turn what your student practises into a starting point for the next lesson.
          </p>
          <form onSubmit={handleTopicSubmit} className="mx-auto max-w-2xl lg:mx-0" aria-label="Start a worksheet from a lesson topic">
            <label htmlFor="hero-lesson-topic" className="sr-only">Lesson topic</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="hero-lesson-topic" name="heroLessonTopic" value={lessonTopic} onChange={(event) => setLessonTopic(event.target.value)} maxLength={200} autoComplete="off"
                placeholder="e.g. Negotiating a project deadline" className="h-12 min-w-0 flex-1 bg-card px-3 text-base" />
              <Button type="submit" size="lg" className="h-12 shrink-0 px-4 font-semibold">Generate free worksheet<ArrowDown className="h-4 w-4" /></Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">2 free worksheets. No signup needed. Review your options before generating.</p>
          </form>
          <Button variant="outline" onClick={handlePreview} className="mt-4 h-11 bg-card px-4">Preview Placement Test<ArrowRight className="h-4 w-4" /></Button>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-left text-xs text-muted-foreground sm:text-sm">
            {['Built for adult professionals', 'CEFR-aligned (A1–C2)', 'Fully teacher-editable', 'No credit card required'].map((label) => (
              <span key={label} className="inline-flex min-w-0 items-start gap-1.5 leading-5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{label}</span>
            ))}
          </div>
          <nav aria-label="Edooqoo canonical teacher workflows" className="sr-only">{canonicalCitationLinks.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
        </div>
        <div className="mx-auto w-full min-w-0 max-w-[540px] lg:mx-0 lg:justify-self-end"><OneMinutePrepHeroProofSwitcher /></div>
      </div>
    </section>
  );
};

export default HeroHeadline;
