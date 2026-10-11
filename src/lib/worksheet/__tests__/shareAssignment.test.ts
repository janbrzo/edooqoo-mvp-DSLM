import { describe, it, expect } from 'vitest';
import { isKnownUnassigned } from '../shareAssignment';

describe('isKnownUnassigned', () => {
  it('treats an unreadable row (anonymous student, RLS) as unknown, not unassigned', () => {
    expect(isKnownUnassigned(null)).toBe(false);
    expect(isKnownUnassigned(undefined)).toBe(false);
  });

  it('flags a readable row without a student', () => {
    expect(isKnownUnassigned({ student_id: null })).toBe(true);
    expect(isKnownUnassigned({})).toBe(true);
  });

  it('does not flag an assigned worksheet', () => {
    expect(isKnownUnassigned({ student_id: '97111a78-cb3f-44d4-9137-27c9fe811e5b' })).toBe(false);
  });
});
