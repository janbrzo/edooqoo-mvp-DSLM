import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useDemoContext } from '@/contexts/DemoContext';
import { useUpcomingLessonsCount } from '@/hooks/useUpcomingLessonsCount';
import { devWarn } from '@/utils/logger';

/**
 * useDashboardCounts — lightweight numbers for the Today dashboard header
 * and the "Everything else" zone.
 *
 * - worksheetsCount: HEAD count of non-deleted worksheets (no row transfer).
 * - lessonsThisWeek: reuses `useUpcomingLessonsCount` (booked slots, next 7 days).
 * - studentsCount is intentionally NOT here — take `students.length` from `useStudents`.
 *
 * Demo mode: counts derived from `demoData`, zero Supabase calls for worksheets.
 */
export function useDashboardCounts(): { worksheetsCount: number; lessonsThisWeek: number; loading: boolean } {
  const { data: user } = useAuthUser();
  const teacherId = user?.id;
  const { isDemoMode, demoData } = useDemoContext();
  const { count: upcomingLessons, loading: lessonsLoading } = useUpcomingLessonsCount();

  const worksheetsQuery = useQuery<number>({
    queryKey: ['dashboard-worksheets-count', teacherId, isDemoMode],
    enabled: isDemoMode ? !!demoData : !!teacherId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (isDemoMode) return demoData?.worksheets.length ?? 0;
      const { count, error } = await supabase
        .from('worksheets')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', teacherId!)
        .is('deleted_at', null);
      if (error) {
        devWarn('useDashboardCounts worksheets error:', error.message);
        return 0;
      }
      return count ?? 0;
    },
  });

  const lessonsThisWeek = isDemoMode
    ? (() => {
        if (!demoData) return 0;
        const today = new Date().toISOString().slice(0, 10);
        const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
        return demoData.calendarSlots.filter(
          (s) => s.status === 'booked' && s.slot_date >= today && s.slot_date <= in7,
        ).length;
      })()
    : upcomingLessons;

  return {
    worksheetsCount: worksheetsQuery.data ?? 0,
    lessonsThisWeek,
    loading: (isDemoMode && !demoData) || worksheetsQuery.isLoading || (!isDemoMode && lessonsLoading),
  };
}
