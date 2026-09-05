import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';

/**
 * useActiveHomeworkCount — v6.9.109 (Phase 5).
 * Single HEAD count of the teacher's homework assignments that are not yet
 * completed. Replaces the old "fetch everything then filter" approach used by
 * the dashboard stats strip. Returns 0 on error (graceful degradation) and
 * short-circuits in demo mode (no Supabase calls).
 */
export const useActiveHomeworkCount = () => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { isDemoMode, demoData } = useDemoContext();

  useEffect(() => {
    if (isDemoMode) {
      const homework = (demoData as { homework?: Array<{ completed_at?: string | null }> } | null)?.homework ?? [];
      setCount(homework.filter(h => !h.completed_at).length);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) setCount(0); return; }
        const { count: c, error } = await supabase
          .from('homework_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', user.id)
          .is('completed_at', null);
        if (error) throw error;
        if (!cancelled) setCount(c ?? 0);
      } catch (e) {
        console.error('useActiveHomeworkCount error:', e);
        if (!cancelled) setCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isDemoMode, demoData]);

  return { count, loading };
};
