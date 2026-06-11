import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generationModalSlides, MAX_LEFT_CARD_ITEMS } from './generationModalSlides';

interface WorkflowSummaryCardProps {
  activeSlideIndex: number;
  onSlideChange: (index: number) => void;
  className?: string;
}

const WorkflowSummaryCard: React.FC<WorkflowSummaryCardProps> = ({
  activeSlideIndex,
  onSlideChange,
  className,
}) => {
  const slide = generationModalSlides[activeSlideIndex] ?? generationModalSlides[0];
  const PhaseIcon = slide.phaseIcon;

  return (
    <section className={cn('rounded-xl border p-3', slide.tone, className)} aria-label="1-Minute Prep workflow phase">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-background/80 p-2">
          <PhaseIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className={cn('text-[10px] font-semibold uppercase tracking-widest leading-tight', slide.eyebrowTone)}>
            {slide.phaseLabel}
          </p>
          <h4 className="mt-1 text-sm font-semibold leading-tight text-foreground">
            {slide.phaseTitle}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {slide.phaseDescription}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {slide.items.slice(0, MAX_LEFT_CARD_ITEMS).map(({ icon: Icon, label, badge, nowrap }) => (
          <div
            key={label}
            className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className={cn('min-w-0 flex-1 leading-tight', nowrap && 'truncate')}>{label}</span>
            {badge ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[8px] font-semibold uppercase text-primary">
                {badge}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {generationModalSlides.map((dot, index) => (
            <button
              key={dot.id}
              type="button"
              aria-label={`Show ${dot.phaseLabel}`}
              aria-current={index === activeSlideIndex ? 'true' : undefined}
              onClick={() => onSlideChange(index)}
              className={cn(
                'h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                index === activeSlideIndex ? 'w-6 bg-primary' : 'w-2 bg-primary/25 hover:bg-primary/40'
              )}
            />
          ))}
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          One phase at a time
        </span>
      </div>
    </section>
  );
};

export default WorkflowSummaryCard;
