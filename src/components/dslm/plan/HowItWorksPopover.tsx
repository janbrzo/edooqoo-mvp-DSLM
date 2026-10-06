/**
 * HowItWorksPopover: the one place that explains the Learning plan (and
 * names DSLM). Replaces the dismissible "What is DSLM?" banner: the
 * explanation stays one click away instead of pushing the plan below the fold.
 */
import React from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const STEPS = [
  { title: 'Goal', body: 'You set what the student needs English for, and by when.' },
  { title: 'Roadmap', body: 'Edooqoo splits the way to the goal into phases.' },
  { title: 'Up next', body: 'It proposes the next lessons. You approve, edit or skip them. Prep always shows #1.' },
] as const;

export const HowItWorksPopover: React.FC = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="sm" className="h-9 shrink-0 gap-1.5 px-2 text-muted-foreground">
        <Info className="h-4 w-4" aria-hidden="true" />
        How it works
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 space-y-3 text-sm">
      <p className="font-semibold text-foreground">How the learning plan works</p>
      <ol className="space-y-2">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
              {index + 1}
            </span>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{step.title}.</span> {step.body}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground">
        Every lesson, homework answer, test result and note sharpens the plan. It is powered by DSLM
        (Dynamic Student Learning Model), Edooqoo's student model.
      </p>
      <Button asChild variant="link" size="sm" className="h-auto px-0">
        <a href="/features/dslm" target="_blank" rel="noopener noreferrer">
          Learn more <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
        </a>
      </Button>
    </PopoverContent>
  </Popover>
);
