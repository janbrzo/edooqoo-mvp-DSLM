import { describe, it, expect } from 'vitest';
import { suggestDeadlineFromLessons } from '../lessonDeadline';

const now = new Date('2026-10-26T10:00:00Z'); // Monday

describe('suggestDeadlineFromLessons', () => {
  it('sets the deadline 2 h before the next booked lesson in the calendar time zone', () => {
    const r = suggestDeadlineFromLessons([{ slot_date: '2026-10-29', start_time: '16:00:00' }], 'Europe/Warsaw', now);
    // 16:00 CET (UTC+1 after the 25 Oct switch) = 15:00Z, deadline 13:00Z
    expect(r?.lessonAt.toISOString()).toBe('2026-10-29T15:00:00.000Z');
    expect(r?.deadline.toISOString()).toBe('2026-10-29T13:00:00.000Z');
  });

  it('takes the earliest lesson that leaves the student time to work', () => {
    const r = suggestDeadlineFromLessons([
      { slot_date: '2026-10-26', start_time: '14:00' }, // deadline 2 h from now: too soon
      { slot_date: '2026-10-31', start_time: '10:00' },
      { slot_date: '2026-10-28', start_time: '10:00' },
    ], 'Europe/Warsaw', now);
    expect(r?.lessonAt.toISOString()).toBe('2026-10-28T09:00:00.000Z');
  });

  it('gives nothing when there is no lesson or it is too far away', () => {
    expect(suggestDeadlineFromLessons([], 'Europe/Warsaw', now)).toBeNull();
    expect(suggestDeadlineFromLessons([{ slot_date: '2026-12-01', start_time: '10:00' }], 'Europe/Warsaw', now)).toBeNull();
  });

  it('survives a broken slot', () => {
    expect(suggestDeadlineFromLessons([{ slot_date: 'x', start_time: 'y' }], 'Europe/Warsaw', now)).toBeNull();
  });
});
