/**
 * usePlanEvidenceMetrics: the student's skill metrics as the plan signals need them
 * (stale plan reminder, phase advance proposal). Effective mastery is applied at read
 * time from `last_event_at`; flashcards are excluded later by the signal helpers.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withEffectiveMastery } from '../../../supabase/functions/_shared/forgetting';

const isDemo = (): boolean => {
  try { return localStorage.getItem('edooqoo_demo_mode') === 'true'; } catch { return false; }
};

export function usePlanEvidenceMetrics(studentId: string, teacherId: string) {
  const query = useQuery({
    queryKey: ['plan-evidence-metrics', studentId, teacherId],
    enabled: !!studentId && !!teacherId && !isDemo(),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_skill_metrics')
        .select('skill_name, skill_category, micro_skill, current_mastery, total_events, trend, last_event_at')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);
      if (error) throw error;
      return withEffectiveMastery((data || []) as any[]);
    },
  });
  return { metrics: query.data ?? [], loaded: query.isSuccess };
}
