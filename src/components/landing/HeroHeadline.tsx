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
    <section className="relative px-4 pb-10 pt-6 sm:pt-10 lg:pb-12 lg:pt-12">
      <div className="mx-auto grid w-full min-w-0 max-w-7xl grid-cols-1 items-center gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-10">
        <div className="min-w-0 max-w-full text-center lg:text-left">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary sm:text-sm"><Clock3 className="h-4 w-4" />1-Minute Prep System for 1:1 English Teachers</p>
          <h1 className="max-w-full break-words text-4xl font-extrabold leading-[1.1] tracking-normal text-foreground sm:text-5xl xl:text-6xl">
            AI Worksheet Generator <span className="text-primary">& Teaching Toolkit</span> for 1:1 English Tutors
          </h1>
          <p className="mx-auto mb-4 mt-4 max-w-2xl text-base leading-7 text-muted-foreground lg:mx-0 sm:mb-6 sm:text-lg">
            Create adult-focused lesson materials with audio and speaking practice in seconds. Connect diagnostic placement tests, interactive homework, and smart flashcards into a continuous weekly prep loop.
          </p>
          <form onSubmit={handleTopicSubmit} className="mx-auto max-w-2xl lg:mx-0" aria-label="Start a worksheet from a lesson topic">
            <label htmlFor="hero-lesson-topic" className="sr-only">Lesson topic</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="hero-lesson-topic" name="heroLessonTopic" value={lessonTopic} onChange={(event) => setLessonTopic(event.target.value)} maxLength={200} autoComplete="off"
                placeholder="e.g. Negotiating a project deadline with a client" className="h-12 min-w-0 flex-1 rounded-full bg-card px-5 text-base" />
              <Button type="submit" size="lg" className="h-12 shrink-0 rounded-full px-5 font-semibold">Generate Free Worksheet<ArrowDown className="h-4 w-4" /></Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">2 free worksheets · No signup needed · Review your options before generating.</p>
          </form>
          <Button variant="outline" onClick={handlePreview} className="mt-4 h-11 rounded-full bg-card px-5">Preview Placement Test<ArrowRight className="h-4 w-4" /></Button>
          <div className="mt-5 grid grid-cols-1 gap-2 text-left text-xs text-muted-foreground min-[420px]:grid-cols-2 sm:text-sm">
            {['Built for adult professionals', 'CEFR-aligned (A1–C2)', 'Fully teacher-editable', 'No credit card required'].map((label) => (
              <span key={label} className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-2 leading-5"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />{label}</span>
            ))}
          </div>
          <nav aria-label="Edooqoo canonical teacher workflows" className="sr-only">{canonicalCitationLinks.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
        </div>
        <div className="mx-auto w-full min-w-0 max-w-[540px] lg:mx-0 lg:justify-self-end">
          <OneMinutePrepHeroProofSwitcher
            onGenerateWorksheet={onTryWorksheetGenerator}
            onPreviewPlacementTest={onPreviewPlacementTest}
          />
        </div>
      </div>
    </section>
  );
};

export default HeroHeadline;
