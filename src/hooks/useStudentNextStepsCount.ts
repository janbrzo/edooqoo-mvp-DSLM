import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * v6.9.15a — lightweight check whether a student has any pending Next Steps.
 * Returns null while loading, then 0 / >0. Used by WorksheetForm StudentContextHint.
 */
export function useStudentNextStepsCount(studentId: string | null | undefined) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!studentId) {
      setCount(null);
      return;
    }
    setCount(null);
    (async () => {
      const { count: c, error } = await supabase
        .from('future_worksheet_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('is_used', false)
        .is('deleted_at', null);
      if (cancelled) return;
      if (error) {
        console.warn('[useStudentNextStepsCount]', error);
        setCount(0);
        return;
      }
      setCount(c ?? 0);
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  return count;
}