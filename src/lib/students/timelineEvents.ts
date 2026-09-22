/**
 * timelineEvents — pure data rules for the Timeline tab of the Student
 * Workspace (v6.9.111, M5 step 1).
 *
 * `TimelineTab`, `TimelineFilters` and `TimelineEventRow` must stay purely
 * presentational, so every decision about *what counts as an event*, how it is
 * phrased, when it needs the teacher's attention, how events are ordered,
 * counted, grouped and time-stamped lives here.
 *
 * No React, no Supabase, no globals — every rule below is unit-testable.
 */

export type TimelineEventType =
  | 'lesson'
  | 'worksheet'
  | 'homework_sent'
  | 'homework_returned'
  | 'note'
  | 'test_result'
  | 'mastery_change';

export type TimelineFilter =
  | 'all'
  | 'lessons'
  | 'worksheets'
  | 'homework'
  | 'notes'
  | 'tests';

export interface TimelineEvent {
  /** `${type}:${sourceId}` — dedupe key. */
  id: string;
  type: TimelineEventType;
  /** ISO 8601; descending sort key. */
  at: string;
  title: string;
  subtitle?: string;
  needsAction: boolean;
  href?: string;
  /** Rendered only when `needsAction` is true. */
  actionLabel?: string;
}

export type TimelineGroupKey = 'today' | 'yesterday' | 'week' | 'earlier';

export interface TimelineGroup {
  key: TimelineGroupKey;
  label: string;
  events: TimelineEvent[];
}

export const TIMELINE_PAGE_SIZE = 25;
export const NOTE_TITLE_MAX_LEN = 80;

export const FILTER_TYPES: Record<TimelineFilter, readonly TimelineEventType[]> = {
  all: [
    'lesson',
    'worksheet',
    'homework_sent',
    'homework_returned',
    'note',
    'test_result',
    'mastery_change',
  ],
  lessons: ['lesson'],
  worksheets: ['worksheet'],
  homework: ['homework_sent', 'homework_returned'],
  notes: ['note', 'mastery_change'],
  tests: ['test_result'],
};

export const TIMELINE_FILTERS: readonly TimelineFilter[] = [
  'all',
  'lessons',
  'worksheets',
  'homework',
  'notes',
  'tests',
];

export const TIMELINE_FILTER_LABELS: Record<TimelineFilter, string> = {
  all: 'All',
  lessons: 'Lessons',
  worksheets: 'Worksheets',
  homework: 'Homework',
  notes: 'Notes',
  tests: 'Tests',
};

// ---------------------------------------------------------------------------
// Source shapes — structural subsets of the hooks that feed the Timeline.
// Kept local so this module depends on nothing.
// ---------------------------------------------------------------------------

export interface TimelineLessonSource {
  id: string;
  slot_date: string | null;
  start_time: string | null;
  status?: string | null;
}

export interface TimelineWorksheetSource {
  id: string;
  title?: string | null;
  created_at: string | null;
}

export interface TimelineHomeworkSource {
  id: string;
  title?: string | null;
  created_at: string | null;
  completed_at?: string | null;
  completed_by_teacher?: boolean | null;
}

export interface TimelineKnowledgeSource {
  id: string;
  category: string;
  content: string;
  created_at: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  is_outdated?: boolean | null;
  archived_at?: string | null;
  metadata?: { mastery?: number; nano_skill?: string } | null;
}

export interface TimelineTestSource {
  id: string;
  title?: string | null;
  status?: string | null;
  created_at: string | null;
  completed_at?: string | null;
  reviewed_at?: string | null;
  score_percentage?: number | null;
}

export interface TimelineSourceData {
  lessons?: readonly TimelineLessonSource[];
  worksheets?: readonly TimelineWorksheetSource[];
  homework?: readonly TimelineHomeworkSource[];
  knowledgeEntries?: readonly TimelineKnowledgeSource[];
  tests?: readonly TimelineTestSource[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LESSON_STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  booked: 'Booked',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
  needs_review: 'Needs review',
};

/** Combines a calendar day + wall-clock time into a local ISO timestamp. */
export function combineSlotDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
): string | null {
  if (!date) return null;
  const clock = (time || '00:00:00').slice(0, 8);
  const padded = clock.length === 5 ? `${clock}:00` : clock;
  const parsed = new Date(`${date}T${padded}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function isValidIso(value: string | null | undefined): value is string {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function firstLine(content: string): string {
  const line = (content || '').split('\n').find((l) => l.trim().length > 0) ?? '';
  const trimmed = line.trim();
  if (trimmed.length <= NOTE_TITLE_MAX_LEN) return trimmed;
  return `${trimmed.slice(0, NOTE_TITLE_MAX_LEN - 1).trimEnd()}…`;
}

function isLiveEntry(entry: TimelineKnowledgeSource): boolean {
  return !entry.deleted_at && !entry.is_outdated && !entry.archived_at;
}

function isMasteryEntry(entry: TimelineKnowledgeSource): boolean {
  return (
    entry.category === 'Skill Assessment' &&
    typeof entry.metadata?.mastery === 'number'
  );
}

// ---------------------------------------------------------------------------
// Event construction
// ---------------------------------------------------------------------------

/**
 * Maps every available source row into one flat, deduped, descending stream.
 * Rows without a usable date are dropped — a timeline entry without a moment
 * in time is noise.
 */
export function buildTimelineEvents(input: TimelineSourceData): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const lesson of input.lessons ?? []) {
    const at = combineSlotDateTime(lesson.slot_date, lesson.start_time);
    if (!at) continue;
    const status = lesson.status ?? '';
    const needsAction = status === 'needs_review';
    events.push({
      id: `lesson:${lesson.id}`,
      type: 'lesson',
      at,
      title: 'Lesson',
      subtitle: LESSON_STATUS_LABELS[status] ?? 'Scheduled',
      needsAction,
      href: '?tab=calendar',
      ...(needsAction ? { actionLabel: 'Mark done' } : {}),
    });
  }

  for (const worksheet of input.worksheets ?? []) {
    if (!isValidIso(worksheet.created_at)) continue;
    events.push({
      id: `worksheet:${worksheet.id}`,
      type: 'worksheet',
      at: worksheet.created_at,
      title: worksheet.title?.trim() || 'Untitled worksheet',
      subtitle: 'Worksheet',
      needsAction: false,
      href: `/worksheet/${worksheet.id}`,
    });
  }

  for (const hw of input.homework ?? []) {
    const label = hw.title?.trim() || 'Untitled homework';

    if (isValidIso(hw.created_at)) {
      events.push({
        id: `homework_sent:${hw.id}`,
        type: 'homework_sent',
        at: hw.created_at,
        title: `Homework sent — ${label}`,
        subtitle: 'Sent to student',
        needsAction: false,
        href: '?tab=homework',
      });
    }

    if (isValidIso(hw.completed_at)) {
      const needsAction = hw.completed_by_teacher !== true;
      events.push({
        id: `homework_returned:${hw.id}`,
        type: 'homework_returned',
        at: hw.completed_at,
        title: `Homework returned — ${label}`,
        subtitle: needsAction ? 'Waiting for your review' : 'Reviewed',
        needsAction,
        href: '?tab=homework',
        ...(needsAction ? { actionLabel: 'Review' } : {}),
      });
    }
  }

  for (const entry of input.knowledgeEntries ?? []) {
    if (!isLiveEntry(entry)) continue;

    if (isMasteryEntry(entry)) {
      const at = entry.updated_at ?? entry.created_at;
      if (!isValidIso(at)) continue;
      const skill = entry.metadata?.nano_skill?.trim() || 'Skill';
      events.push({
        id: `mastery_change:${entry.id}`,
        type: 'mastery_change',
        at,
        title: `${skill} — mastery ${entry.metadata?.mastery}%`,
        subtitle: 'Learning model',
        needsAction: false,
        href: '?tab=dslm',
      });
      continue;
    }

    if (entry.category === 'Skill Assessment') continue;
    if (!isValidIso(entry.created_at)) continue;
    const title = firstLine(entry.content);
    if (!title) continue;
    events.push({
      id: `note:${entry.id}`,
      type: 'note',
      at: entry.created_at,
      title,
      subtitle: 'Note',
      needsAction: false,
      href: '?tab=knowledge',
    });
  }

  for (const test of input.tests ?? []) {
    const at = test.completed_at ?? test.created_at;
    if (!isValidIso(at)) continue;
    const needsAction = !!test.completed_at && !test.reviewed_at;
    const subtitle =
      typeof test.score_percentage === 'number'
        ? `Score ${Math.round(test.score_percentage)}%`
        : test.status
          ? `Status ${test.status}`
          : 'Test';
    events.push({
      id: `test_result:${test.id}`,
      type: 'test_result',
      at,
      title: test.title?.trim() || 'Untitled test',
      subtitle,
      needsAction,
      // v6.9.111 M7.5 — deep link straight into the test details panel.
      href: `?tab=timeline&filter=tests&testId=${encodeURIComponent(test.id)}`,
      ...(needsAction ? { actionLabel: 'Review' } : {}),
    });
  }

  return sortAndDedupe(events);
}

/** Newest first; ties broken by id so the order is stable across renders. */
export function sortAndDedupe(events: readonly TimelineEvent[]): TimelineEvent[] {
  const seen = new Map<string, TimelineEvent>();
  for (const event of events) {
    if (!seen.has(event.id)) seen.set(event.id, event);
  }
  return [...seen.values()].sort((a, b) => {
    const diff = new Date(b.at).getTime() - new Date(a.at).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

export function filterEvents(
  events: readonly TimelineEvent[],
  filter: TimelineFilter,
): TimelineEvent[] {
  if (filter === 'all') return [...events];
  const allowed = FILTER_TYPES[filter];
  return events.filter((event) => allowed.includes(event.type));
}

export function countByFilter(
  events: readonly TimelineEvent[],
): Record<TimelineFilter, number> {
  const counts = {
    all: 0,
    lessons: 0,
    worksheets: 0,
    homework: 0,
    notes: 0,
    tests: 0,
  } as Record<TimelineFilter, number>;

  for (const event of events) {
    for (const filter of TIMELINE_FILTERS) {
      if (FILTER_TYPES[filter].includes(event.type)) counts[filter] += 1;
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Date grouping / formatting
// ---------------------------------------------------------------------------

function dayKey(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function resolveGroupKey(iso: string, now: Date = new Date()): TimelineGroupKey {
  const when = new Date(iso);
  const todayKey = dayKey(now);
  const eventKey = dayKey(when);
  if (eventKey === todayKey) return 'today';
  if (eventKey === dayKey(addDays(now, -1))) return 'yesterday';
  if (eventKey > dayKey(addDays(now, -7))) return 'week';
  return 'earlier';
}

const GROUP_LABELS: Record<TimelineGroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  earlier: 'Earlier',
};

const GROUP_ORDER: readonly TimelineGroupKey[] = ['today', 'yesterday', 'week', 'earlier'];

/** Groups an already-sorted stream; empty groups are omitted. */
export function groupEventsByDate(
  events: readonly TimelineEvent[],
  now: Date = new Date(),
): TimelineGroup[] {
  const buckets = new Map<TimelineGroupKey, TimelineEvent[]>();
  for (const event of events) {
    const key = resolveGroupKey(event.at, now);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(event);
    else buckets.set(key, [event]);
  }
  return GROUP_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map((key) => ({
    key,
    label: GROUP_LABELS[key],
    events: buckets.get(key) as TimelineEvent[],
  }));
}

/**
 * Recent groups show a clock, older ones show a date — the teacher never has
 * to guess which "09:12" belongs to which day.
 */
export function formatEventTime(iso: string, group: TimelineGroupKey): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  if (group === 'today' || group === 'yesterday') {
    const h = `${when.getHours()}`.padStart(2, '0');
    const m = `${when.getMinutes()}`.padStart(2, '0');
    return `${h}:${m}`;
  }
  if (group === 'week') {
    return when.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
