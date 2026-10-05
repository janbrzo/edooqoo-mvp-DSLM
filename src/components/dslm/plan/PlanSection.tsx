/**
 * PlanSection — heading + body for one Learning plan section.
 * Typography instead of frames: the heading style matches the dashboard
 * zones, sections are separated by spacing, never by a card around a card.
 */
import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface PlanSectionProps {
  id: string;
  title: string;
  /** Right-aligned controls next to the heading. */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  /** Onboarding spotlight target id (see SpotlightOverlay). */
  spotlight?: string;
}

export const PlanSection = forwardRef<HTMLElement, PlanSectionProps>(
  ({ id, title, action, className, children, spotlight }, ref) => (
    <section
      ref={ref}
      aria-labelledby={`${id}-heading`}
      className={cn('scroll-mt-24 space-y-3', className)}
      data-spotlight={spotlight}
      data-testid={id}
    >
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h3
          id={`${id}-heading`}
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {title}
        </h3>
        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      {children}
    </section>
  ),
);
PlanSection.displayName = 'PlanSection';
