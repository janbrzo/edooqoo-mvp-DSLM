import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useDemoContext } from '@/contexts/DemoContext';
import { devWarn } from '@/utils/logger';

/**
 * useStudentsOverview — worksheet counts per student for `/students`.
 *
 * One batched query instead of a `useWorksheetHistory` per row (the old
 * dashboard `StudentCard` N+1). Counting happens client-side; the default
 * PostgREST page is 1000 rows, so a teacher with >1000 live worksheets would
 * see a floor value here. Acceptable today — revisit with a per-student
 * `count` RPC if that ceiling is ever reached.
 *
 * Demo mode: counts from `demoData.worksheets`, zero Supabase calls.
 */
export type WorksheetCountByStudent = Record<string, number>;

export function countByStudent(rows: Array<{ student_id: string | null }>): WorksheetCountByStudent {
  const map: WorksheetCountByStudent = {};
  for (const row of rows) {
    if (!row.student_id) continue;
    map[row.student_id] = (map[row.student_id] ?? 0) + 1;
  }
  return map;
}

export function useStudentsOverview(studentIds: string[]): {
  worksheetCountByStudent: WorksheetCountByStudent;
  loading: boolean;
} {
  const { data: user } = useAuthUser();
  const teacherId = user?.id;
  const { isDemoMode, demoData } = useDemoContext();

  const query = useQuery<WorksheetCountByStudent>({
    queryKey: ['students-overview', teacherId, studentIds.join(','), isDemoMode],
    enabled: (isDemoMode ? !!demoData : !!teacherId) && studentIds.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (isDemoMode) {
        if (!demoData) return {};
        return countByStudent(
          (demoData.worksheets as Array<{ student_id: string | null; deleted_at?: string | null }>).filter(
            (w) => !w.deleted_at,
          ),
        );
      }

      const { data, error } = await supabase
        .from('worksheets')
        .select('student_id')
        .eq('teacher_id', teacherId!)
        .is('deleted_at', null)
        .in('student_id', studentIds);

      if (error) {
        devWarn('useStudentsOverview error:', error.message);
        return {};
      }
      return countByStudent((data ?? []) as Array<{ student_id: string | null }>);
    },
  });

  const waitingForDemo = isDemoMode && !demoData;
  return {
    worksheetCountByStudent: query.data ?? {},
    loading: waitingForDemo || (studentIds.length > 0 && query.isLoading),
  };
}
