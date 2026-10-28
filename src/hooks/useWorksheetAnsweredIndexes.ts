import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { answeredIndexesFromRows } from '@/lib/worksheetEditor/answerProtection';
import { devWarn } from '@/utils/logger';

/**
 * Exercise indices of a worksheet that already have student answers, loaded once
 * for the owner (independent of the Live Session view, which clears its answers
 * when the teacher switches view). Used to protect those exercises from edits
 * that would detach the answers (see `answerProtection`).
 */
export function useWorksheetAnsweredIndexes(worksheetId?: string | null, enabled = true): ReadonlySet<number> {
  const { isDemoMode } = useDemoContext();
  const [indexes, setIndexes] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    if (!enabled || !worksheetId || isDemoMode) {
      setIndexes(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_worksheet_live_answers', { p_worksheet_id: worksheetId });
        if (error) throw error;
        if (!cancelled) setIndexes(answeredIndexesFromRows(data as Array<{ exercise_index?: unknown }> | null));
      } catch (error) {
        devWarn('[useWorksheetAnsweredIndexes] could not load answers', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worksheetId, enabled, isDemoMode]);

  return indexes;
}
