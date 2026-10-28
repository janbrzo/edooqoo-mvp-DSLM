
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { applyWorksheetListOptions, type WorksheetListOptions } from '@/lib/worksheetEditor/listQuery';

interface WorksheetHistoryItem {
  id: string;
  title: string;
  created_at: string;
  form_data: any;
  ai_response: string;
  html_content: string;
  student_id?: string;
  generation_time_seconds?: number;
  share_token?: string | null;
}

export const useWorksheetHistory = (
  studentId?: string, 
  lightweight: boolean = false, 
  listView: boolean = false,
  page: number = 1,
  pageSize: number = 20,
  listOptions?: WorksheetListOptions
) => {
  const [worksheets, setWorksheets] = useState<WorksheetHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { isDemoMode, demoData } = useDemoContext();
  const { data: user } = useAuthUser();
  // Only the latest request may update the list (search typing, page and tab changes overlap).
  const requestIdRef = useRef(0);
  const listOptionsKey = JSON.stringify(listOptions ?? null);

  // Demo mode: return hardcoded worksheets (handles async demoData load)
  useEffect(() => {
    if (!isDemoMode) return;
    if (!demoData) { setLoading(true); return; }
    let ws = demoData.worksheets as WorksheetHistoryItem[];
    if (studentId) {
      ws = ws.filter(w => w.student_id === studentId);
    }
    const term = (listOptions?.search ?? '').trim().toLowerCase();
    if (term) {
      ws = ws.filter(w => `${w.title ?? ''} ${w.form_data?.lessonTopic ?? ''}`.toLowerCase().includes(term));
    }
    setWorksheets(ws);
    setTotalCount(ws.length);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, demoData, studentId, listOptionsKey]);

  const fetchWorksheets = async () => {
    if (isDemoMode) return;
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      if (!user) {
        setWorksheets([]);
        setLoading(false);
        return;
      }

      const selectQuery = listView 
        ? 'id, title, created_at, student_id, generation_time_seconds, form_data, audio_url, audio_duration, audio_voice, selected_audio, selected_image, media_metadata, share_token'
        : '*';
      
      let query = supabase
        .from('worksheets')
        .select(selectQuery, { count: 'exact' })
        .eq('teacher_id', user.id)
        .is('deleted_at', null);

      if (studentId) {
        if (studentId === 'unassigned') {
          query = query.is('student_id', null);
        } else {
          query = query.eq('student_id', studentId);
        }
      }

      query = applyWorksheetListOptions(query, listOptions, 'created_at');

      if (listView) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      if (lightweight && !listView) {
        query = query.limit(10);
      }

      const { data, error, count } = await query as any;
      if (requestId !== requestIdRef.current) return;
      if (error) throw error;
      
      setWorksheets(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      if (requestId !== requestIdRef.current) return;
      console.error('[useWorksheetHistory] error:', error);
      setWorksheets([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isDemoMode) fetchWorksheets();
  }, [studentId, page, pageSize, user?.id, isDemoMode, listOptionsKey]);

  const refetchWorksheets = async () => {
    // Demo data is derived synchronously from context; fetchWorksheets is a no-op
    // there and would never clear the loading flag set below.
    if (isDemoMode) return;
    setLoading(true);
    await fetchWorksheets();
  };

  const deleteWorksheet = async (worksheetId: string) => {
    try {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase.rpc('soft_delete_worksheet' as any, {
        p_worksheet_id: worksheetId,
        p_teacher_id: user.id
      });
      if (error) throw error;
      await fetchWorksheets();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting worksheet:', error);
      return { success: false, error: error.message };
    }
  };

  const getRecentWorksheets = (limit: number = 3) => worksheets.slice(0, limit);

  const restoreWorksheet = async (worksheetId: string) => {
    try {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('worksheets')
        .update({ deleted_at: null })
        .eq('id', worksheetId)
        .eq('teacher_id', user.id);
      if (error) throw error;
      await fetchWorksheets();
      return { success: true };
    } catch (error: any) {
      console.error('Error restoring worksheet:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    worksheets,
    loading,
    getRecentWorksheets,
    refetch: refetchWorksheets,
    deleteWorksheet,
    restoreWorksheet,
    totalCount
  };
};
