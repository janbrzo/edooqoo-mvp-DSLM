import { describe, it, expect } from 'vitest';
import {
  hasStudentReturnedHomework,
  homeworkReviewPath,
  isHomeworkAwaitingReview,
} from '../reviewState';

const RETURNED = '2026-10-01T09:00:00.000Z';
const REVIEWED = '2026-10-02T09:00:00.000Z';

describe('isHomeworkAwaitingReview', () => {
  it('is false while the student has not returned the homework', () => {
    expect(isHomeworkAwaitingReview({ completed_at: null, reviewed_at: null })).toBe(false);
  });

  it('is true for a student return without review', () => {
    expect(isHomeworkAwaitingReview({ completed_at: RETURNED, reviewed_at: null })).toBe(true);
    expect(
      isHomeworkAwaitingReview({ completed_at: RETURNED, reviewed_at: null, completed_by_teacher: false }),
    ).toBe(true);
  });

  it('is false once the teacher sent the review', () => {
    expect(isHomeworkAwaitingReview({ completed_at: RETURNED, reviewed_at: REVIEWED })).toBe(false);
  });

  it('is false when the teacher marked the homework done themselves', () => {
    expect(
      isHomeworkAwaitingReview({ completed_at: RETURNED, reviewed_at: null, completed_by_teacher: true }),
    ).toBe(false);
  });
});

describe('hasStudentReturnedHomework', () => {
  it('keeps reviewed student returns reachable', () => {
    expect(hasStudentReturnedHomework({ completed_at: RETURNED, reviewed_at: REVIEWED })).toBe(true);
  });

  it('excludes open homework and teacher-marked completion', () => {
    expect(hasStudentReturnedHomework({ completed_at: null })).toBe(false);
    expect(hasStudentReturnedHomework({ completed_at: RETURNED, completed_by_teacher: true })).toBe(false);
  });
});

describe('homeworkReviewPath', () => {
  it('points at the teacher review page by homework id', () => {
    expect(homeworkReviewPath('hw-1')).toBe('/homework/hw-1/review');
  });
});
