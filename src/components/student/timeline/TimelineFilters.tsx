/**
 * TimelineFilters — the filter pill row of the Timeline tab
 * (v6.9.111, M5 step 3).
 *
 * Purely presentational: the six pills are always rendered in a fixed order so
 * the row never reflows while the teacher scans it. A pill with a count of 0
 * stays visible but is muted and disabled — absence of data is information too.
 *
 * All rules (order, labels, counts) come from `@/lib/students/timelineEvents`.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  TIMELINE_FILTERS,
  TIMELINE_FILTER_LABELS,
  type TimelineFilter,
} from '@/lib/students/timelineEvents';

export interface TimelineFiltersProps {
  value: TimelineFilter;
  counts: Record<TimelineFilter, number>;
  onChange: (filter: TimelineFilter) => void;
  className?: string;
}

export const TimelineFilters: React.FC<TimelineFiltersProps> = ({
  value,
  counts,
  onChange,
  className,
}) => (
  <div
    role="tablist"
    aria-label="Timeline filters"
    className={cn('flex flex-wrap items-center gap-2', className)}
  >
    {TIMELINE_FILTERS.map((filter) => {
      const count = counts[filter] ?? 0;
      const active = filter === value;
      const empty = count === 0 && filter !== value;

      return (
        <Button
          key={filter}
          type="button"
          role="tab"
          aria-selected={active}
          size="sm"
          variant={active ? 'default' : 'outline'}
          disabled={empty}
          onClick={() => onChange(filter)}
          className={cn(
            'h-8 rounded-full px-3 text-xs font-medium',
            empty && 'opacity-50',
          )}
          data-testid={`timeline-filter-${filter}`}
        >
          {TIMELINE_FILTER_LABELS[filter]}
          <span
            className={cn(
              'ml-1.5 tabular-nums',
              active ? 'text-primary-foreground/80' : 'text-muted-foreground',
            )}
          >
            {count}
          </span>
        </Button>
      );
    })}
  </div>
);

export default TimelineFilters;
