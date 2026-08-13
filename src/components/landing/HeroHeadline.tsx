import React from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEventTracking } from '@/hooks/useEventTracking';
import type { OneMinutePrepCalculatorInput } from '@/components/PricingCalculator';
import OneMinutePrepHeroProofSwitcher from '@/components/landing/OneMinutePrepHeroProofSwitcher';

const canonicalCitationLinks = [
  { href: '/one-minute-prep', label: '1-Minute Prep' },
  { href: '/ai-worksheet-generator-for-english-teachers.html', label: 'AI worksheet generator' },
  { href: '/esl-student-progress-tracking-tool.html', label: 'Progress tracking' },
  { href: '/ai-grading-tool-for-english-homework.html', label: 'Homework review' },
  { href: '/vocabulary-exercise-generator.html', label: 'Vocabulary tools' },
];

interface HeroHeadlineProps {
  calculatorValue: OneMinutePrepCalculatorInput;
  onCalculatorChange: (value: OneMinutePrepCalculatorInput) => void;
  onStartOneMinutePrep: () => void;
  onTryWorksheetGenerator: () => void;
}

const HeroHeadline: React.FC<HeroHeadlineProps> = ({
  calculatorValue,
  onCalculatorChange,
  onStartOneMinutePrep,
  onTryWorksheetGenerator,
}) => {
  const { trackEvent } = useEventTracking();

  const handlePrimaryCta = () => {
    trackEvent({
      eventType: 'one_minute_hero_cta_click',
      eventData: { target: 'signup-modal' },
    });
    onStartOneMinutePrep();
  };

  const handleSecondaryCta = () => {
    trackEvent({
      eventType: 'one_minute_secondary_cta_click',
      eventData: { target: 'worksheet-form' },
    });
    onTryWorksheetGenerator();
  };

  return (
    <section className="relative px-4 pt-12 pb-14 sm:pt-16 lg:pt-24 lg:pb-28 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-100/30 via-transparent to-transparent pointer-events-none"></div>

      <div className="w-full min-w-0 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] gap-10 lg:gap-14 items-start">
        <div className="min-w-0 max-w-full text-center lg:text-left">
          {/* Headline */}
          {/* v6.9.36 — leading + span padding so gradient-clipped descenders
              (lowercase "g" in "teachers") are not cut on Safari/Chrome. */}
          <h1 className="max-w-full break-words text-[2.5rem] sm:text-5xl md:text-6xl lg:text-[4rem] xl:text-[5rem] 2xl:text-[5.5rem] font-extrabold tracking-tight text-foreground mb-8 leading-[1.12]">
            <span className="block">1-Minute Prep</span>
            <span className="block max-w-full whitespace-normal text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 pb-2 leading-[1.18]">
              for 1:1 English teachers
            </span>
          </h1>

          {/* Subheadline — LCP element, hint browser to prioritize */}
          <p
            className="max-w-full text-lg sm:text-xl lg:text-[1.5rem] text-muted-foreground mb-8 sm:max-w-2xl lg:max-w-[36rem] mx-auto lg:mx-0 leading-relaxed"
            // @ts-expect-error fetchpriority is valid HTML but not yet typed in React
            fetchpriority="high"
          >
            Edooqoo turns student goals, lesson notes, homework and flashcard progress into a clear next focus — and a ready-to-teach worksheet with audio, images and AI-assisted review.
          </p>

          {/* CTA Area */}
          <div className="flex max-w-full flex-col items-center lg:items-start gap-4 mb-8">
            <div className="flex w-full max-w-full flex-col sm:w-auto sm:flex-row gap-3">
              <Button
                onClick={handlePrimaryCta}
                size="lg"
                className="h-[3.25rem] sm:h-[4.25rem] w-full sm:w-auto justify-center px-5 sm:px-8 text-base sm:text-[1.35rem] max-w-full whitespace-normal sm:whitespace-nowrap font-semibold rounded-full shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:-translate-y-0.5 transition-all duration-200">
                <span className="sm:hidden">Start Free</span>
                <span className="hidden sm:inline">Start 1-Minute Prep Free</span>
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                type="button"
                onClick={handleSecondaryCta}
                size="lg"
                variant="outline"
                className="h-[3.25rem] sm:h-[4.25rem] w-full sm:w-auto justify-center px-5 sm:px-7 text-base sm:text-xl font-semibold rounded-full bg-white/90"
              >
                Try worksheet generator now
                <ArrowDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-sm sm:text-lg text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-violet-500" />No credit card</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-violet-500" />2 worksheets free</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-violet-500" />Best with profile + goals</span>
            </div>
            <p className="max-w-full text-sm sm:text-base text-muted-foreground sm:max-w-2xl">
              Worksheet generator works instantly. 1-Minute Prep starts when you create a student profile.
            </p>
          </div>

          <nav
            aria-label="Edooqoo canonical teacher workflows"
            className="sr-only"
          >
            {canonicalCitationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full border border-border bg-white/80 px-3 py-1.5 font-medium text-foreground/75 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="w-full max-w-full sm:max-w-[460px] mx-auto lg:mx-0 lg:justify-self-end">
          <OneMinutePrepHeroProofSwitcher
            calculatorValue={calculatorValue}
            onCalculatorChange={onCalculatorChange}
          />
        </div>
      </div>
    </section>);

};

export default HeroHeadline;
