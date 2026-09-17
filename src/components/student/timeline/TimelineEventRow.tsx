/**
 * TimelineEventRow — one event in the Timeline stream (v6.9.111, M5 step 3).
 *
 * A thin adapter over the shared `EntityRow` (M2): it only picks the icon for
 * the event type, formats the timestamp and forwards navigation upwards. Every
 * other decision (title, subtitle, needsAction, actionLabel, href) already
 * arrives resolved from `@/lib/students/timelineEvents`.
 *
 * Navigation is delegated via `onNavigate` because timeline hrefs come in two
 * shapes: real routes (`/worksheet/:id`) and in-page tab aliases (`?tab=...`).
 * Only the page that owns the tabs can resolve the second form.
 */

import React from 'react';
import {
  Activity,
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  Send,
  StickyNote,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { EntityRow } from '@/components/student/EntityRow';
import {
  formatEventTime,
  type TimelineEvent,
  type TimelineEventType,
  type TimelineGroupKey,
} from '@/lib/students/timelineEvents';

const EVENT_ICONS: Record<TimelineEventType, LucideIcon> = {
  lesson: CalendarDays,
  worksheet: FileText,
  homework_sent: Send,
  homework_returned: BookOpen,
  note: StickyNote,
  test_result: GraduationCap,
  mastery_change: TrendingUp,
};

export interface TimelineEventRowProps {
  event: TimelineEvent;
  group: TimelineGroupKey;
  /** Receives either a route (`/worksheet/1`) or a tab alias (`?tab=tests`). */
  onNavigate: (href: string) => void;
}

export const TimelineEventRow: React.FC<TimelineEventRowProps> = ({
  event,
  group,
  onNavigate,
}) => {
  const Icon = EVENT_ICONS[event.type] ?? Activity;
  const href = event.href;

  return (
    <EntityRow
      dense
      icon={Icon}
      title={event.title}
      subtitle={event.subtitle}
      meta={formatEventTime(event.at, group)}
      needsAction={event.needsAction}
      actionLabel={event.actionLabel}
      onAction={href ? () => onNavigate(href) : undefined}
      onClick={href ? () => onNavigate(href) : undefined}
      data-testid={`timeline-event-${event.id}`}
    />
  );
};

export default TimelineEventRow;
