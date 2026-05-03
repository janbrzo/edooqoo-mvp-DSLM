import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * useUpcomingLessonsCount — counts teacher's calendar slots in the next 7 days
 * with status 'confirmed' or 'pending'. Single fetch on mount, no realtime.
 * Returns 0 on error (graceful degradation).
 */
export const useUpcomingLessonsCount = () => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setCount(0); return; }
        const today = new Date();
        const in7 = new Date();
        in7.setDate(today.getDate() + 7);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from('calendar_slots')
          .select('id')
          .eq('teacher_id', user.id)
          .gte('slot_date', fmt(today))
          .lte('slot_date', fmt(in7))
          .in('status', ['confirmed', 'pending']);
        if (error) throw error;
        setCount(data?.length || 0);
      } catch (e) {
        console.error('useUpcomingLessonsCount error:', e);
        setCount(0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { count, loading };
};