
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { useAuthUser } from '@/hooks/useAuthUser';

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
  pageSize: number = 20
) => {
  const [worksheets, setWorksheets] = useState<WorksheetHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { isDemoMode, demoData } = useDemoContext();
  const { data: user } = useAuthUser();

  // Demo mode: return hardcoded worksheets (handles async demoData load)
  useEffect(() => {
    if (!isDemoMode) return;
    if (!demoData) { setLoading(true); return; }
    let ws = demoData.worksheets as WorksheetHistoryItem[];
    if (studentId) {
      ws = ws.filter(w => w.student_id === studentId);
    }
    setWorksheets(ws);
    setTotalCount(ws.length);
    setLoading(false);
  }, [isDemoMode, demoData, studentId]);

  const fetchWorksheets = async () => {
    if (isDemoMode) return;
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

      query = query.order('created_at', { ascending: false });

      if (listView) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      if (lightweight && !listView) {
        query = query.limit(10);
      }

      const { data, error, count } = await query as any;
      if (error) throw error;
      
      setWorksheets(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('[useWorksheetHistory] error:', error);
      setWorksheets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isDemoMode) fetchWorksheets();
  }, [studentId, page, pageSize, user?.id, isDemoMode]);

  const refetchWorksheets = async () => {
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
