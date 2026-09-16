/**
 * useStudentTimeline — pure composition layer for the Timeline tab
 * (v6.9.111, M5 step 2).
 *
 * Zero queries by design: every source array is passed in by `StudentPage`
 * (worksheets, knowledge entries) or by `useStudentTimelineSources` (lessons,
 * homework, tests). All rules live in `@/lib/students/timelineEvents`, so this
 * hook is nothing more than a memoised call into them.
 */

import { useMemo } from 'react';
import {
  buildTimelineEvents,
  countByFilter,
  filterEvents,
  groupEventsByDate,
  TIMELINE_PAGE_SIZE,
  type TimelineEvent,
  type TimelineFilter,
  type TimelineGroup,
  type TimelineSourceData,
} from '@/lib/students/timelineEvents';

export interface UseStudentTimelineInput extends TimelineSourceData {
  filter: TimelineFilter;
  /** How many events of the active filter to render (client-side paging). */
  visibleCount?: number;
}

export interface UseStudentTimelineResult {
  /** All events, unfiltered — the source of the pill counts. */
  events: TimelineEvent[];
  counts: Record<TimelineFilter, number>;
  /** Events matching the active filter, before paging. */
  filtered: TimelineEvent[];
  /** Grouped page slice, ready to render. */
  groups: TimelineGroup[];
  visibleCount: number;
  hasMore: boolean;
  isEmpty: boolean;
}

export function useStudentTimeline(
  input: UseStudentTimelineInput,
): UseStudentTimelineResult {
  const { lessons, worksheets, homework, knowledgeEntries, tests, filter } = input;
  const visibleCount = input.visibleCount ?? TIMELINE_PAGE_SIZE;

  const events = useMemo(
    () => buildTimelineEvents({ lessons, worksheets, homework, knowledgeEntries, tests }),
    [lessons, worksheets, homework, knowledgeEntries, tests],
  );

  const counts = useMemo(() => countByFilter(events), [events]);

  const filtered = useMemo(() => filterEvents(events, filter), [events, filter]);

  const groups = useMemo(
    () => groupEventsByDate(filtered.slice(0, visibleCount)),
    [filtered, visibleCount],
  );

  return {
    events,
    counts,
    filtered,
    groups,
    visibleCount,
    hasMore: filtered.length > visibleCount,
    isEmpty: events.length === 0,
  };
}
