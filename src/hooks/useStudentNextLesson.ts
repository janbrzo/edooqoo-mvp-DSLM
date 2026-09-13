/**
 * useStudentNextLesson — the single booked lesson shown in the Student
 * Workspace header (v6.9.111, M3).
 *
 * Deliberately NOT `useCalendarSlots`: that hook loads a whole view range,
 * subscribes to realtime and can write `needs_review` back to the database.
 * The header needs one row, so this reads one row.
 *
 * Demo mode derives the answer from `demoData` and issues zero Supabase calls.
 * Any failure degrades to "no lesson booked" — a summary line must never break
 * the student page.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { devWarn } from '@/utils/logger';
import type { StudentNextLesson } from '@/lib/students/studentSnapshot';

export interface UseStudentNextLessonResult {
  lesson: StudentNextLesson | null;
  isLoading: boolean;
}

interface NextLessonRow {
  slot_date: string;
  start_time: string;
}

/** Local `YYYY-MM-DD` — the calendar stores plain calendar days, not instants. */
function todayKey(now: Date = new Date()): string {
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/**
 * Pure picker — exported for tests and demo reuse.
 * Returns the earliest booked slot from today onward.
 */
export function pickNextLesson(
  rows: readonly NextLessonRow[] | null | undefined,
  today: string,
): StudentNextLesson | null {
  if (!rows || rows.length === 0) return null;
  const upcoming = rows
    .filter((r) => !!r.slot_date && !!r.start_time && r.slot_date >= today)
    .sort((a, b) =>
      `${a.slot_date} ${a.start_time}`.localeCompare(`${b.slot_date} ${b.start_time}`),
    );
  const first = upcoming[0];
  return first ? { date: first.slot_date, time: first.start_time } : null;
}

export function useStudentNextLesson(
  studentId?: string,
  teacherId?: string,
): UseStudentNextLessonResult {
  const { isDemoMode, demoData } = useDemoContext();

  const enabled = isDemoMode ? !!demoData && !!studentId : !!studentId && !!teacherId;

  const query = useQuery<StudentNextLesson | null>({
    queryKey: ['student-next-lesson', teacherId ?? null, studentId ?? null, isDemoMode],
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const today = todayKey();

      if (isDemoMode) {
        const rows = (demoData?.calendarSlots ?? [])
          .filter(
            (slot: { student_id?: string | null; status?: string }) =>
              slot.student_id === studentId && slot.status === 'booked',
          )
          .map((slot: { slot_date: string; start_time: string }) => ({
            slot_date: slot.slot_date,
            start_time: slot.start_time,
          }));
        return pickNextLesson(rows, today);
      }

      const { data, error } = await supabase
        .from('calendar_slots')
        .select('slot_date, start_time')
        .eq('teacher_id', teacherId!)
        .eq('student_id', studentId!)
        .eq('status', 'booked')
        .gte('slot_date', today)
        .order('slot_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(1);

      if (error) {
        devWarn('useStudentNextLesson error:', error.message);
        return null;
      }

      return pickNextLesson((data ?? []) as NextLessonRow[], today);
    },
  });

  return {
    lesson: query.data ?? null,
    isLoading: enabled && query.isLoading,
  };
}
