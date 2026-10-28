import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Pause, Play } from 'lucide-react';
import FeatureScreenshotFrame from '@/components/features/FeatureScreenshotFrame';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { studentTabPath } from '@/lib/students/workspaceTabs';
import {
  generationModalSlides,
  GENERATION_SLIDE_INTERVAL_MS,
  type GenerationContextVariant,
} from './generationModalSlides';

interface GenerationContextPanelProps {
  variant: GenerationContextVariant;
  studentName?: string;
  studentId?: string | null;
}

const GenerationContextPanel: React.FC<GenerationContextPanelProps> = ({
  variant,
  studentName,
  studentId,
}) => {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setActiveSlideIndex(0);
  }, [variant, studentId, studentName]);

  useEffect(() => {
    if (hovered || focused || paused || reducedMotion) return;
    const interval = window.setInterval(() => {
      setActiveSlideIndex(current => (current + 1) % generationModalSlides.length);
    }, GENERATION_SLIDE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [hovered, focused, paused, reducedMotion, activeSlideIndex]);

  const slide = generationModalSlides[activeSlideIndex] ?? generationModalSlides[0];
  if (!slide) return null;
  const copy = slide.contexts[variant];
  const learnerName = studentName?.trim();
  const learnerId = studentId?.trim();
  const planPath = variant === 'authenticated' && learnerId
    ? studentTabPath(learnerId, 'model', { view: 'pathway' })
    : null;

  const goToPrevious = () => {
    setActiveSlideIndex(current => (current - 1 + generationModalSlides.length) % generationModalSlides.length);
  };

  const goToNext = () => {
    setActiveSlideIndex(current => (current + 1) % generationModalSlides.length);
  };

  return (
    <aside
      aria-label="Lesson preparation ideas"
      aria-roledescription="carousel"
      className="flex min-h-0 min-w-0 flex-col rounded-lg bg-muted/40 p-4"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="min-h-24 min-w-0">
        <p className="text-[11px] font-semibold uppercase text-primary [overflow-wrap:anywhere]">
          {variant === 'authenticated' && activeSlideIndex === 0
            ? `NEXT STEPS FOR ${learnerName || 'THIS LEARNER'}`
            : copy.eyebrow}
        </p>
        <h3 className="mt-2 text-xl font-semibold leading-snug text-foreground">{copy.title}</h3>
      </div>

      <FeatureScreenshotFrame
        src={copy.screenshot.src}
        alt={copy.screenshot.alt}
        imageClassName="aspect-[16/8] h-auto"
        objectPosition={copy.screenshot.objectPosition ?? 'center top'}
        className="mt-3 rounded-md shadow-none"
        loading="eager"
      />

      <ul className={cn('mt-4 space-y-3', variant === 'anonymous' ? 'min-h-28' : 'min-h-40')}>
        {copy.items.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="flex min-w-0 gap-3">
            {variant === 'authenticated' && activeSlideIndex === 0
              ? <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
              : <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
            <div className="min-w-0 text-sm leading-snug">
              <p className="font-semibold text-foreground">{title}</p>
              <p className="mt-0.5 text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      {variant === 'anonymous' ? (
        <Button asChild className="mt-4 h-auto min-h-11 w-full whitespace-normal px-3 py-2.5 text-sm leading-snug">
          <a href="/signup" target="_blank" rel="noopener noreferrer">
            <span>Create free account to track progress</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </a>
        </Button>
      ) : planPath ? (
        <Button asChild variant="link" className="mt-3 h-auto min-h-10 justify-start whitespace-normal px-0 text-left leading-snug">
          <a href={planPath} target="_blank" rel="noopener noreferrer">
            <span>{learnerName ? `Open ${learnerName}'s Learning Plan` : 'Open Learning Plan'}</span>
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          </a>
        </Button>
      ) : (
        <p className="mt-3 min-h-10 text-xs leading-snug text-muted-foreground">
          Ready to assign right after generation completes.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Show previous generation context slide" title="Previous slide" onClick={goToPrevious}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div className="flex items-center gap-1">
          {generationModalSlides.map((dot, index) => (
            <Button
              key={dot.id}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={`Show slide ${index + 1}`}
              title={`Slide ${index + 1}`}
              aria-current={index === activeSlideIndex ? 'true' : undefined}
              onClick={() => setActiveSlideIndex(index)}
            >
              <span className={cn('h-2 w-2 rounded-full transition-colors motion-reduce:transition-none', index === activeSlideIndex ? 'bg-primary' : 'bg-muted-foreground/30')} />
            </Button>
          ))}
          {!reducedMotion && (
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={paused ? 'Resume slides' : 'Pause slides'} title={paused ? 'Resume slides' : 'Pause slides'} onClick={() => setPaused(current => !current)}>
              {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </Button>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Show next generation context slide" title="Next slide" onClick={goToNext}>
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </aside>
  );
};

export default GenerationContextPanel;
