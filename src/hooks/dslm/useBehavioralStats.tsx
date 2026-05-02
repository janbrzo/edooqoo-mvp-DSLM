/**
 * Hook for calculating behavioral statistics from system data
 * Used in DSLM Profile view for engagement metrics
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BehavioralStats {
  lessonsPerWeek: number | null;
  totalLessons: number;
  cancellationRate: number | null;
  cancellationsLast30d: number;
  homeworkTotal: number;
  homeworkCompleted: number;
  homeworkCompletionRate: number | null;
  flashcardSetsCount: number;
  totalFlashcardReviews: number;
  daysSinceLastActivity: number | null;
}

interface UseBehavioralStatsProps {
  studentId: string;
  teacherId: string;
}

export const useBehavioralStats = ({ studentId, teacherId }: UseBehavioralStatsProps) => {
  return useQuery({
    queryKey: ['behavioral-stats', studentId, teacherId],
    queryFn: async (): Promise<BehavioralStats> => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [homeworkRes, flashcardSetsRes, flashcardReviewsRes, calendarRes, lastActivityRes] = await Promise.all([
        // 1. Homework completion
        supabase
          .from('homework_assignments')
          .select('id, completed_at', { count: 'exact' })
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId),

        // 2. Flashcard sets count
        supabase
          .from('flashcard_sets')
          .select('id', { count: 'exact' })
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .is('deleted_at', null),

        // 3. Flashcard reviews (from student_events)
        supabase
          .from('student_events')
          .select('id', { count: 'exact' })
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .eq('event_source', 'flashcard'),

        // 4. Calendar slots (last 90 days)
        supabase
          .from('calendar_slots')
          .select('id, status, slot_date, created_at')
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .in('status', ['booked', 'completed', 'cancelled'])
          .gte('slot_date', ninetyDaysAgo.split('T')[0]),

        // 5. Last activity
        supabase
          .from('student_events')
          .select('created_at')
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      // Process homework
      const homeworkData = homeworkRes.data || [];
      const homeworkTotal = homeworkRes.count || homeworkData.length;
      const homeworkCompleted = homeworkData.filter(h => h.completed_at !== null).length;

      // Process calendar
      const calendarData = calendarRes.data || [];
      const totalLessons = calendarData.filter(s => s.status === 'completed' || s.status === 'booked').length;
      const cancelledLast30d = calendarData.filter(s => 
        s.status === 'cancelled' && s.slot_date >= thirtyDaysAgo.split('T')[0]
      ).length;
      const totalLast30d = calendarData.filter(s => s.slot_date >= thirtyDaysAgo.split('T')[0]).length;

      // Lessons per week (last 90 days)
      const weeksInRange = Math.max(1, 90 / 7);
      const lessonsPerWeek = totalLessons > 0 ? Math.round((totalLessons / weeksInRange) * 10) / 10 : null;

      // Cancellation rate
      const cancellationRate = totalLast30d > 0 ? Math.round((cancelledLast30d / totalLast30d) * 100) : null;

      // Days since last activity
      const lastActivityData = lastActivityRes.data;
      let daysSinceLastActivity: number | null = null;
      if (lastActivityData && lastActivityData.length > 0) {
        const lastDate = new Date(lastActivityData[0].created_at);
        daysSinceLastActivity = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        lessonsPerWeek,
        totalLessons,
        cancellationRate,
        cancellationsLast30d: cancelledLast30d,
        homeworkTotal,
        homeworkCompleted,
        homeworkCompletionRate: homeworkTotal > 0 ? Math.round((homeworkCompleted / homeworkTotal) * 100) : null,
        flashcardSetsCount: flashcardSetsRes.count || 0,
        totalFlashcardReviews: flashcardReviewsRes.count || 0,
        daysSinceLastActivity,
      };
    },
    enabled: !!studentId && !!teacherId,
    staleTime: 5 * 60 * 1000,
  });
};
