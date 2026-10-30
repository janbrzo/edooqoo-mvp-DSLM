import { describe, expect, it } from 'vitest';
import { filterHubHomework, homeworkLifecycle } from '../homeworkLifecycle';

const now = Date.parse('2026-10-30T07:05:00Z');
const submitted = '2026-10-29T10:00:00Z';
const reviewed = '2026-10-29T12:00:00Z';

describe('Student Hub lifecycle uses the canonical homework state', () => {
  it('keeps open homework To Do even with a stray review or draft progress', () => {
    expect(homeworkLifecycle({ completed_at: null, reviewed_at: reviewed }, now).state).toBe('open');
    expect(filterHubHomework([{ id: 'draft', completed_at: null, completed_exercises_count: 5 }], 'to_do').map(hw => hw.id)).toEqual(['draft']);
  });
  it('places a student submission in review without waiting for AI', () => {
    expect(homeworkLifecycle({ completed_at: submitted, reviewed_at: null }, now)).toMatchObject({ state: 'submitted', canReadFeedback: false });
  });
  it('exposes feedback only for a returned and reviewed assignment', () => {
    expect(homeworkLifecycle({ completed_at: submitted, reviewed_at: reviewed }, now)).toMatchObject({ state: 'reviewed', canReadFeedback: true });
  });
  it.each([null, reviewed])('teacher closure is not a student review (%s)', reviewedAt => {
    expect(homeworkLifecycle({ completed_at: submitted, completed_by_teacher: true, reviewed_at: reviewedAt }, now)).toMatchObject({ state: 'closed', canReadFeedback: false });
  });
  it('missing teacher flag preserves older payload compatibility', () => {
    expect(homeworkLifecycle({ completed_at: submitted }, now).state).toBe('submitted');
  });
  it('a teacher-authorized redo becomes To Do again', () => {
    expect(homeworkLifecycle({ completed_at: null, reviewed_at: null, completed_by_teacher: false }, now).state).toBe('open');
  });
  const rows = [
    { id: 'open', completed_at: null },
    { id: 'submitted', completed_at: submitted },
    { id: 'reviewed', completed_at: submitted, reviewed_at: reviewed },
    { id: 'closed', completed_at: submitted, completed_by_teacher: true },
  ];
  it.each([
    ['all', ['open', 'submitted', 'reviewed', 'closed']],
    ['to_do', ['open']], ['in_review', ['submitted']], ['reviewed', ['reviewed']],
  ] as const)('%s contains only its lifecycle members', (filter, expected) => {
    expect(filterHubHomework(rows, filter).map(hw => hw.id)).toEqual(expected);
  });
});

describe('Overdue is a deadline flag, not completion', () => {
  it('uses a strict past deadline for open homework', () => {
    expect(homeworkLifecycle({ deadline: '2026-10-30T07:04:59Z' }, now).overdue).toBe(true);
  });
  it.each(['2026-10-30T07:05:00Z', '2026-10-30T07:05:01Z', null, '', 'invalid'])('does not mark %s overdue', deadline => {
    expect(homeworkLifecycle({ deadline }, now).overdue).toBe(false);
  });
  it('equivalent time zone offsets produce the same deadline flag', () => {
    expect(homeworkLifecycle({ deadline: '2026-10-30T08:04:59+01:00' }, now).overdue).toBe(true);
  });
  it.each([
    { completed_at: submitted }, { completed_at: submitted, reviewed_at: reviewed },
    { completed_at: submitted, completed_by_teacher: true },
  ])('finished homework is never currently overdue: %j', fields => {
    expect(homeworkLifecycle({ ...fields, deadline: '2026-01-01' }, now).overdue).toBe(false);
  });
});