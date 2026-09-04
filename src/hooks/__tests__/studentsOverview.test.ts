import { describe, expect, it } from 'vitest';
import { countByStudent } from '@/hooks/useStudentsOverview';
import { sortStudents } from '@/pages/AllStudentsPage';
import type { Tables } from '@/integrations/supabase/types';

const s = (id: string, name: string) => ({ id, name }) as Tables<'students'>;

describe('countByStudent', () => {
  it('counts worksheets per student and skips null student_id', () => {
    expect(countByStudent([{ student_id: 'a' }, { student_id: 'a' }, { student_id: 'b' }, { student_id: null }]))
      .toEqual({ a: 2, b: 1 });
  });
});

describe('sortStudents', () => {
  const students = [s('1', 'Zoe'), s('2', 'Adam'), s('3', 'Maya')];
  it('keeps input order for recent', () => {
    expect(sortStudents(students, 'recent', {}).map((x) => x.id)).toEqual(['1', '2', '3']);
  });
  it('sorts by name', () => {
    expect(sortStudents(students, 'name-asc', {}).map((x) => x.name)).toEqual(['Adam', 'Maya', 'Zoe']);
    expect(sortStudents(students, 'name-desc', {}).map((x) => x.name)).toEqual(['Zoe', 'Maya', 'Adam']);
  });
  it('puts students with a lesson first, soonest first', () => {
    const lessons = { '3': { date: '2026-09-05', time: '10:00:00' }, '2': { date: '2026-09-04', time: '18:00:00' }, '1': null };
    expect(sortStudents(students, 'next-lesson', lessons).map((x) => x.id)).toEqual(['2', '3', '1']);
  });
});
