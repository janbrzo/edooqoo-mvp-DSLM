/**
 * useStudentTimelineSources — the three extra reads the Timeline tab needs
 * (v6.9.111, M5 step 2).
 *
 * Worksheets and knowledge entries are already loaded by `StudentPage`, so this
 * hook only fetches what nothing else on the page provides: lessons, homework
 * assignments and tests. It is deliberately `enabled`-gated: the queries fire
 * the first time the Timeline tab is opened, never on page load.
 *
 * Demo mode answers from `demoData` and issues zero Supabase calls. Any failure
 * degrades to an empty list — the timeline must never break the student page.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { devWarn } from '@/utils/logger';
import type {
  TimelineHomeworkSource,
  TimelineLessonSource,
  TimelineTestSource,
} from '@/lib/students/timelineEvents';

export interface StudentTimelineSources {
  lessons: TimelineLessonSource[];
  homework: TimelineHomeworkSource[];
  tests: TimelineTestSource[];
  isLoading: boolean;
}

const LESSON_LOOKBACK_DAYS = 180;
const LESSON_LIMIT = 100;
const HOMEWORK_LIMIT = 100;
const TEST_LIMIT = 50;

const EMPTY: Omit<StudentTimelineSources, 'isLoading'> = {
  lessons: [],
  homework: [],
  tests: [],
};

/** Local `YYYY-MM-DD` for `now - days`; calendar rows store plain days. */
function lookbackKey(days: number, now: Date = new Date()): string {
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  const m = `${from.getMonth() + 1}`.padStart(2, '0');
  const d = `${from.getDate()}`.padStart(2, '0');
  return `${from.getFullYear()}-${m}-${d}`;
}

export function useStudentTimelineSources(
  studentId?: string,
  teacherId?: string,
  enabledFlag: boolean = true,
): StudentTimelineSources {
  const { isDemoMode, demoData } = useDemoContext();

  const enabled =
    enabledFlag &&
    !!studentId &&
    (isDemoMode ? !!demoData : !!teacherId);

  const query = useQuery<Omit<StudentTimelineSources, 'isLoading'>>({
    queryKey: ['student-timeline-sources', teacherId ?? null, studentId ?? null, isDemoMode],
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (isDemoMode) {
        const lessons = (demoData?.calendarSlots ?? [])
          .filter((slot: { student_id?: string | null }) => slot.student_id === studentId)
          .map((slot: { id: string; slot_date: string; start_time: string; status?: string }) => ({
            id: slot.id,
            slot_date: slot.slot_date,
            start_time: slot.start_time,
            status: slot.status ?? null,
          }));

        const homework = (demoData?.homework ?? [])
          .filter((hw: { student_id?: string | null }) => hw.student_id === studentId)
          .map((hw: Record<string, unknown>) => ({
            id: String(hw.id),
            title: (hw.title as string | null) ?? null,
            created_at: (hw.created_at as string | null) ?? null,
            completed_at: (hw.completed_at as string | null) ?? null,
            completed_by_teacher: (hw.completed_by_teacher as boolean | null) ?? null,
          }));

        return { lessons, homework, tests: [] };
      }

      const [lessonsRes, homeworkRes, testsRes] = await Promise.all([
        supabase
          .from('calendar_slots')
          .select('id, slot_date, start_time, status')
          .eq('teacher_id', teacherId!)
          .eq('student_id', studentId!)
          .neq('status', 'deleted')
          .gte('slot_date', lookbackKey(LESSON_LOOKBACK_DAYS))
          .order('slot_date', { ascending: false })
          .order('start_time', { ascending: false })
          .limit(LESSON_LIMIT),
        supabase
          .from('homework_assignments')
          .select('id, title, created_at, completed_at, completed_by_teacher')
          .eq('student_id', studentId!)
          .order('created_at', { ascending: false })
          .limit(HOMEWORK_LIMIT),
        supabase
          .from('student_tests')
          .select('id, title, status, created_at, completed_at, reviewed_at, score_percentage')
          .eq('student_id', studentId!)
          .eq('teacher_id', teacherId!)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(TEST_LIMIT),
      ]);

      if (lessonsRes.error) devWarn('useStudentTimelineSources lessons:', lessonsRes.error.message);
      if (homeworkRes.error) devWarn('useStudentTimelineSources homework:', homeworkRes.error.message);
      if (testsRes.error) devWarn('useStudentTimelineSources tests:', testsRes.error.message);

      return {
        lessons: (lessonsRes.data ?? []) as TimelineLessonSource[],
        homework: (homeworkRes.data ?? []) as TimelineHomeworkSource[],
        tests: (testsRes.data ?? []) as TimelineTestSource[],
      };
    },
  });

  const data = query.data ?? EMPTY;

  return {
    lessons: data.lessons,
    homework: data.homework,
    tests: data.tests,
    isLoading: enabled && query.isLoading,
  };
}
