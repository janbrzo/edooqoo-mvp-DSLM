import { describe, it, expect } from 'vitest';
import {
  buildTimelineEvents,
  countByFilter,
  filterEvents,
  formatEventTime,
  groupEventsByDate,
  resolveGroupKey,
  sortAndDedupe,
  combineSlotDateTime,
  TIMELINE_PAGE_SIZE,
  type TimelineEvent,
} from '../timelineEvents';

const iso = (local: string) => new Date(local).toISOString();

function event(partial: Partial<TimelineEvent> & { id: string; at: string }): TimelineEvent {
  return {
    type: 'note',
    title: 'x',
    needsAction: false,
    ...partial,
  } as TimelineEvent;
}

describe('combineSlotDateTime', () => {
  it('combines date and time into a valid ISO string', () => {
    const result = combineSlotDateTime('2026-09-10', '18:00:00');
    expect(result).toBe(new Date('2026-09-10T18:00:00').toISOString());
  });

  it('accepts HH:mm and defaults a missing time to midnight', () => {
    expect(combineSlotDateTime('2026-09-10', '18:00')).toBe(
      new Date('2026-09-10T18:00:00').toISOString(),
    );
    expect(combineSlotDateTime('2026-09-10', null)).toBe(
      new Date('2026-09-10T00:00:00').toISOString(),
    );
  });

  it('returns null without a date', () => {
    expect(combineSlotDateTime(null, '18:00')).toBeNull();
  });
});

describe('buildTimelineEvents — type mapping', () => {
  it('maps a lesson with needs_review to an actionable event', () => {
    const [e] = buildTimelineEvents({
      lessons: [{ id: 'l1', slot_date: '2026-09-10', start_time: '18:00:00', status: 'needs_review' }],
    });
    expect(e.id).toBe('lesson:l1');
    expect(e.type).toBe('lesson');
    expect(e.subtitle).toBe('Needs review');
    expect(e.needsAction).toBe(true);
    expect(e.actionLabel).toBe('Mark done');
    expect(e.href).toBe('?tab=calendar');
  });

  it('maps a completed lesson without an action', () => {
    const [e] = buildTimelineEvents({
      lessons: [{ id: 'l2', slot_date: '2026-09-10', start_time: '18:00:00', status: 'completed' }],
    });
    expect(e.subtitle).toBe('Completed');
    expect(e.needsAction).toBe(false);
    expect(e.actionLabel).toBeUndefined();
  });

  it('maps a worksheet and falls back on a missing title', () => {
    const events = buildTimelineEvents({
      worksheets: [
        { id: 'w1', title: '  Business small talk  ', created_at: iso('2026-09-10T17:05:00') },
        { id: 'w2', title: null, created_at: iso('2026-09-09T17:05:00') },
      ],
    });
    expect(events[0].title).toBe('Business small talk');
    expect(events[0].href).toBe('/worksheet/w1');
    expect(events[1].title).toBe('Untitled worksheet');
  });

  it('maps a note from the first non-empty line and truncates at 80 chars', () => {
    const long = 'a'.repeat(120);
    const events = buildTimelineEvents({
      knowledgeEntries: [
        {
          id: 'n1',
          category: 'Notes',
          content: '\n  asked about conditionals  \nsecond line',
          created_at: iso('2026-09-10T08:40:00'),
        },
        { id: 'n2', category: 'Notes', content: long, created_at: iso('2026-09-09T08:40:00') },
      ],
    });
    expect(events[0].title).toBe('asked about conditionals');
    expect(events[0].href).toBe('?tab=knowledge');
    expect(events[1].title).toHaveLength(80);
    expect(events[1].title.endsWith('…')).toBe(true);
  });

  it('maps a Skill Assessment entry with mastery to mastery_change, not a note', () => {
    const events = buildTimelineEvents({
      knowledgeEntries: [
        {
          id: 'k1',
          category: 'Skill Assessment',
          content: 'past simple weak',
          created_at: iso('2026-09-01T10:00:00'),
          updated_at: iso('2026-09-10T10:00:00'),
          metadata: { mastery: 42, nano_skill: 'past simple' },
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('mastery_change');
    expect(events[0].title).toBe('past simple — mastery 42%');
    expect(events[0].at).toBe(iso('2026-09-10T10:00:00'));
    expect(events[0].href).toBe('?tab=dslm');
  });

  it('drops Skill Assessment entries without a mastery value', () => {
    const events = buildTimelineEvents({
      knowledgeEntries: [
        {
          id: 'k2',
          category: 'Skill Assessment',
          content: 'no mastery here',
          created_at: iso('2026-09-10T10:00:00'),
        },
      ],
    });
    expect(events).toEqual([]);
  });

  it('maps a completed but unreviewed test as actionable', () => {
    const [e] = buildTimelineEvents({
      tests: [
        {
          id: 't1',
          title: 'Placement check',
          created_at: iso('2026-09-01T10:00:00'),
          completed_at: iso('2026-09-10T10:00:00'),
          reviewed_at: null,
          score_percentage: 71.4,
        },
      ],
    });
    expect(e.type).toBe('test_result');
    expect(e.at).toBe(iso('2026-09-10T10:00:00'));
    expect(e.subtitle).toBe('Score 71%');
    expect(e.needsAction).toBe(true);
    expect(e.actionLabel).toBe('Review');
  });

  it('falls back to created_at and status for a test that was never completed', () => {
    const [e] = buildTimelineEvents({
      tests: [{ id: 't2', title: null, status: 'assigned', created_at: iso('2026-09-05T10:00:00') }],
    });
    expect(e.at).toBe(iso('2026-09-05T10:00:00'));
    expect(e.title).toBe('Untitled test');
    expect(e.subtitle).toBe('Status assigned');
    expect(e.needsAction).toBe(false);
  });
});

describe('buildTimelineEvents — homework pairing', () => {
  it('emits two events for a returned homework', () => {
    const events = buildTimelineEvents({
      homework: [
        {
          id: 'h1',
          title: 'Past Simple drill',
          created_at: iso('2026-09-08T09:00:00'),
          completed_at: iso('2026-09-10T09:12:00'),
          completed_by_teacher: null,
        },
      ],
    });
    expect(events.map((e) => e.type)).toEqual(['homework_returned', 'homework_sent']);
    expect(events[0].title).toBe('Homework returned — Past Simple drill');
    expect(events[0].needsAction).toBe(true);
    expect(events[0].subtitle).toBe('Waiting for your review');
    expect(events[1].needsAction).toBe(false);
  });

  it('marks a teacher-reviewed return as not actionable', () => {
    const events = buildTimelineEvents({
      homework: [
        {
          id: 'h2',
          title: 'Drill',
          created_at: iso('2026-09-08T09:00:00'),
          completed_at: iso('2026-09-10T09:12:00'),
          completed_by_teacher: true,
        },
      ],
    });
    const returned = events.find((e) => e.type === 'homework_returned')!;
    expect(returned.needsAction).toBe(false);
    expect(returned.subtitle).toBe('Reviewed');
    expect(returned.actionLabel).toBeUndefined();
  });

  it('emits only the sent event when homework is still open', () => {
    const events = buildTimelineEvents({
      homework: [{ id: 'h3', title: 'Open', created_at: iso('2026-09-08T09:00:00') }],
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('homework_sent');
  });
});

describe('buildTimelineEvents — exclusions', () => {
  it('skips deleted, outdated and archived knowledge entries', () => {
    const events = buildTimelineEvents({
      knowledgeEntries: [
        { id: 'a', category: 'Notes', content: 'deleted', created_at: iso('2026-09-10T10:00:00'), deleted_at: iso('2026-09-11T10:00:00') },
        { id: 'b', category: 'Notes', content: 'outdated', created_at: iso('2026-09-10T10:00:00'), is_outdated: true },
        { id: 'c', category: 'Notes', content: 'archived', created_at: iso('2026-09-10T10:00:00'), archived_at: iso('2026-09-11T10:00:00') },
        { id: 'd', category: 'Notes', content: 'kept', created_at: iso('2026-09-10T10:00:00') },
      ],
    });
    expect(events.map((e) => e.id)).toEqual(['note:d']);
  });

  it('skips rows without a usable date', () => {
    const events = buildTimelineEvents({
      lessons: [{ id: 'l', slot_date: null, start_time: '18:00' }],
      worksheets: [{ id: 'w', title: 'x', created_at: null }],
      homework: [{ id: 'h', title: 'x', created_at: 'not-a-date' }],
      knowledgeEntries: [{ id: 'n', category: 'Notes', content: 'x', created_at: null }],
      tests: [{ id: 't', title: 'x', created_at: null }],
    });
    expect(events).toEqual([]);
  });

  it('skips notes whose content is blank', () => {
    const events = buildTimelineEvents({
      knowledgeEntries: [{ id: 'n', category: 'Notes', content: '   \n  ', created_at: iso('2026-09-10T10:00:00') }],
    });
    expect(events).toEqual([]);
  });
});

describe('sortAndDedupe', () => {
  it('sorts newest first', () => {
    const sorted = sortAndDedupe([
      event({ id: 'a', at: iso('2026-09-01T10:00:00') }),
      event({ id: 'b', at: iso('2026-09-10T10:00:00') }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('breaks ties by id for a stable order', () => {
    const at = iso('2026-09-10T10:00:00');
    const sorted = sortAndDedupe([event({ id: 'z', at }), event({ id: 'a', at })]);
    expect(sorted.map((e) => e.id)).toEqual(['a', 'z']);
  });

  it('keeps the first occurrence of a duplicate id', () => {
    const at = iso('2026-09-10T10:00:00');
    const sorted = sortAndDedupe([
      event({ id: 'a', at, title: 'first' }),
      event({ id: 'a', at, title: 'second' }),
    ]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].title).toBe('first');
  });
});

describe('counts and filters', () => {
  const events = buildTimelineEvents({
    lessons: [{ id: 'l1', slot_date: '2026-09-10', start_time: '18:00:00', status: 'completed' }],
    worksheets: [{ id: 'w1', title: 'W', created_at: iso('2026-09-09T10:00:00') }],
    homework: [
      {
        id: 'h1',
        title: 'H',
        created_at: iso('2026-09-08T10:00:00'),
        completed_at: iso('2026-09-09T12:00:00'),
      },
    ],
    knowledgeEntries: [
      { id: 'n1', category: 'Notes', content: 'note', created_at: iso('2026-09-07T10:00:00') },
      {
        id: 'k1',
        category: 'Skill Assessment',
        content: 'skill',
        created_at: iso('2026-09-06T10:00:00'),
        updated_at: iso('2026-09-06T10:00:00'),
        metadata: { mastery: 60 },
      },
    ],
    tests: [{ id: 't1', title: 'T', created_at: iso('2026-09-05T10:00:00') }],
  });

  it('counts every filter, including notes covering mastery changes', () => {
    expect(countByFilter(events)).toEqual({
      all: 7,
      lessons: 1,
      worksheets: 1,
      homework: 2,
      notes: 2,
      tests: 1,
    });
  });

  it('filters by type group', () => {
    expect(filterEvents(events, 'homework').map((e) => e.type).sort()).toEqual([
      'homework_returned',
      'homework_sent',
    ]);
    expect(filterEvents(events, 'all')).toHaveLength(7);
    expect(filterEvents(events, 'tests')).toHaveLength(1);
  });
});

describe('grouping and time formatting', () => {
  const now = new Date('2026-09-16T12:00:00');

  it('resolves day boundaries', () => {
    expect(resolveGroupKey(iso('2026-09-16T00:01:00'), now)).toBe('today');
    expect(resolveGroupKey(iso('2026-09-15T23:59:00'), now)).toBe('yesterday');
    expect(resolveGroupKey(iso('2026-09-14T12:00:00'), now)).toBe('week');
    expect(resolveGroupKey(iso('2026-09-10T12:00:00'), now)).toBe('week');
    expect(resolveGroupKey(iso('2026-09-09T12:00:00'), now)).toBe('earlier');
  });

  it('groups in fixed order and omits empty groups', () => {
    const groups = groupEventsByDate(
      sortAndDedupe([
        event({ id: 'a', at: iso('2026-09-16T09:00:00') }),
        event({ id: 'b', at: iso('2026-09-11T09:00:00') }),
        event({ id: 'c', at: iso('2026-08-01T09:00:00') }),
      ]),
      now,
    );
    expect(groups.map((g) => g.key)).toEqual(['today', 'week', 'earlier']);
    expect(groups.map((g) => g.label)).toEqual(['Today', 'This week', 'Earlier']);
    expect(groups[0].events).toHaveLength(1);
  });

  it('shows a clock for recent groups and a date for older ones', () => {
    expect(formatEventTime(iso('2026-09-16T09:05:00'), 'today')).toBe('09:05');
    expect(formatEventTime(iso('2026-09-15T18:30:00'), 'yesterday')).toBe('18:30');
    expect(formatEventTime(iso('2026-09-14T18:30:00'), 'week')).toBe('Mon');
    expect(formatEventTime(iso('2026-08-01T18:30:00'), 'earlier')).toBe('Aug 1');
    expect(formatEventTime('nope', 'today')).toBe('');
  });

  it('exposes a client page size', () => {
    expect(TIMELINE_PAGE_SIZE).toBe(25);
  });
});
