import { describe, expect, it } from 'vitest';
import { filterStudents, pickRecentStudents, studentPrepPath, type QuickAccessStudent } from '../quickAccess';

const students: QuickAccessStudent[] = [
  { id: 'a', name: 'Anna Kowalska', student_email: 'anna@example.com', main_goal: 'work', updated_at: '2026-09-01T10:00:00Z' },
  { id: 'b', name: 'Bartek Nowak', student_email: 'bartek@mail.com', main_goal: 'Prepare for football match', updated_at: '2026-09-05T10:00:00Z' },
  { id: 'c', name: 'Céline Dupont', student_email: null, main_goal: 'exam', updated_at: '2026-08-20T10:00:00Z' },
];

describe('filterStudents', () => {
  it('matches by name, case-insensitive', () => {
    expect(filterStudents(students, 'bar').map((s) => s.id)).toEqual(['b']);
  });

  it('matches by email', () => {
    expect(filterStudents(students, 'anna@ex').map((s) => s.id)).toEqual(['a']);
  });

  it('matches by formatted goal label', () => {
    expect(filterStudents(students, 'exam prep').map((s) => s.id)).toEqual(['c']);
  });

  it('ignores diacritics', () => {
    expect(filterStudents(students, 'celine').map((s) => s.id)).toEqual(['c']);
  });

  it('ranks name matches above goal/email matches', () => {
    const list: QuickAccessStudent[] = [
      { id: 'x', name: 'Zoe', main_goal: 'work meetings with Ann' },
      { id: 'y', name: 'Ann Smith' },
    ];
    expect(filterStudents(list, 'ann').map((s) => s.id)).toEqual(['y', 'x']);
  });

  it('returns the head of the list for an empty query and respects the limit', () => {
    expect(filterStudents(students, '   ', 2).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('returns nothing when there is no match', () => {
    expect(filterStudents(students, 'zzz')).toEqual([]);
  });
});

describe('pickRecentStudents', () => {
  it('sorts by updated_at desc', () => {
    expect(pickRecentStudents(students).map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('excludes ids already shown elsewhere', () => {
    expect(pickRecentStudents(students, ['b']).map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('applies the limit', () => {
    expect(pickRecentStudents(students, [], 1).map((s) => s.id)).toEqual(['b']);
  });

  it('treats a missing updated_at as oldest', () => {
    const list = [...students, { id: 'd', name: 'No date' }];
    expect(pickRecentStudents(list).at(-1)?.id).toBe('d');
  });
});

describe('studentPrepPath', () => {
  it('points straight into prep', () => {
    expect(studentPrepPath('abc')).toBe('/student/abc?tab=prep');
  });
});
