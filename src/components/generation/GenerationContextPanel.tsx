import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import FeatureScreenshotFrame from '@/components/features/FeatureScreenshotFrame';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  generationModalSlides,
  type GenerationContextVariant,
} from './generationModalSlides';

interface GenerationContextPanelProps {
  variant: GenerationContextVariant;
  activeSlideIndex: number;
  onSlideChange: (index: number) => void;
}

const GenerationContextPanel: React.FC<GenerationContextPanelProps> = ({
  variant,
  activeSlideIndex,
  onSlideChange,
}) => {
  const slide = generationModalSlides[activeSlideIndex] ?? generationModalSlides[0];
  const copy = slide.contexts[variant];

  const goToPrevious = () => {
    onSlideChange((activeSlideIndex - 1 + generationModalSlides.length) % generationModalSlides.length);
  };

  const goToNext = () => {
    onSlideChange((activeSlideIndex + 1) % generationModalSlides.length);
  };

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-border bg-secondary/25 p-3 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{copy.eyebrow}</p>
          <h3 className="mt-1 text-sm lg:text-base font-semibold leading-tight text-foreground">{copy.title}</h3>
          <p className="mt-1 text-[11px] lg:text-xs leading-snug text-muted-foreground line-clamp-3">{copy.description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Show previous generation context slide"
            onClick={goToPrevious}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Show next generation context slide"
            onClick={goToNext}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <FeatureScreenshotFrame
        src={copy.screenshot.src}
        alt={copy.screenshot.alt}
        imageClassName="h-28 sm:h-32 lg:h-32"
        objectPosition={copy.screenshot.objectPosition ?? 'center top'}
        className="mt-2 rounded-lg shadow-none"
        loading="eager"
      />

      <div className="mt-2 space-y-1">
        {copy.items.map((item) => (
          <div key={item} className="flex gap-2 rounded-lg border border-border bg-background px-2.5 py-1 text-[12px] leading-snug text-foreground">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5">
        {generationModalSlides.map((dot, index) => (
          <button
            key={dot.id}
            type="button"
            aria-label={`Show ${dot.phaseLabel}`}
            aria-current={index === activeSlideIndex ? 'true' : undefined}
            onClick={() => onSlideChange(index)}
            className={cn(
              'h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              index === activeSlideIndex ? 'w-7 bg-primary' : 'w-2 bg-primary/25 hover:bg-primary/40'
            )}
          />
        ))}
      </div>

      {variant === 'anonymous' ? (
        // v6.9.54 — open signup in a new tab so worksheet generation in
        // the current tab is not interrupted.
        <Button asChild className="mt-2 rounded-full h-9">
          <a href="/signup" target="_blank" rel="noopener noreferrer">
            Create free account
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      ) : (
        <p className="mt-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
          {copy.footer ?? 'Teacher review remains part of the loop. Edooqoo uses saved context to support the next focus, not to replace your decision.'}
        </p>
      )}
    </aside>
  );
};

export default GenerationContextPanel;
