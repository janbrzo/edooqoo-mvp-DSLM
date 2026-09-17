/**
 * TimelineTab — the Timeline tab composition (v6.9.111, M5 step 4).
 *
 * One stream of everything that happened for this student: lessons,
 * worksheets, homework, notes, mastery changes and tests. The tab owns no
 * data and no rules — it receives already-grouped events from
 * `useStudentTimeline` and renders filters, sticky date headers, rows and the
 * "Load more" pager.
 *
 * Loading shows five skeleton rows (never a spinner): the layout the teacher
 * is about to read stays stable.
 */

import React from 'react';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TimelineFilters } from './TimelineFilters';
import { TimelineEventRow } from './TimelineEventRow';
import type {
  TimelineFilter,
  TimelineGroup,
} from '@/lib/students/timelineEvents';

export interface TimelineTabProps {
  groups: TimelineGroup[];
  counts: Record<TimelineFilter, number>;
  filter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
  isLoading?: boolean;
  isEmpty: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  /** Route (`/worksheet/:id`) or in-page tab alias (`?tab=tests`). */
  onNavigate: (href: string) => void;
  onGoToPrep: () => void;
}

const SkeletonRows: React.FC = () => (
  <div className="space-y-2" aria-hidden="true">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
        <Skeleton className="h-4 w-4 rounded" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
        <Skeleton className="h-3 w-10" />
      </div>
    ))}
  </div>
);

export const TimelineTab: React.FC<TimelineTabProps> = ({
  groups,
  counts,
  filter,
  onFilterChange,
  isLoading,
  isEmpty,
  hasMore,
  onLoadMore,
  onNavigate,
  onGoToPrep,
}) => (
  <Card>
    <CardContent className="space-y-4 p-4 sm:p-6">
      <TimelineFilters value={filter} counts={counts} onChange={onFilterChange} />

      {isLoading ? (
        <SkeletonRows />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Activity className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium">Nothing has happened yet</p>
            <p className="text-sm text-muted-foreground">
              Lessons, worksheets, homework and notes will appear here.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onGoToPrep}>
            Go to Prep
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No events match this filter.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h3 className="sticky top-0 z-20 -mx-1 bg-background/95 px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                {group.label}
              </h3>
              <div className="mt-2 space-y-2">
                {group.events.map((event) => (
                  <TimelineEventRow
                    key={event.id}
                    event={event}
                    group={group.key}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </section>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={onLoadMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </CardContent>
  </Card>
);

export default TimelineTab;
