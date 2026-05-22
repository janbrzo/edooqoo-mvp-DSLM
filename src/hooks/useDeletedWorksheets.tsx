import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useDemoContext } from '@/contexts/DemoContext';

interface DeletedWorksheetItem {
  id: string;
  title: string;
  created_at: string;
  deleted_at: string;
  form_data: any;
  ai_response: string;
  html_content: string;
  student_id?: string;
  generation_time_seconds?: number;
}

export const useDeletedWorksheets = (
  studentId?: string, 
  lightweight: boolean = false, 
  listView: boolean = false,
  page: number = 1,
  pageSize: number = 20
) => {
  const [deletedWorksheets, setDeletedWorksheets] = useState<DeletedWorksheetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { data: user } = useAuthUser();
  const { isDemoMode } = useDemoContext();

  useEffect(() => {
    if (isDemoMode) {
      // Demo has no deleted worksheets — resolve immediately to clear loading.
      setDeletedWorksheets([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    fetchDeletedWorksheets();
  }, [studentId, page, pageSize, user?.id, isDemoMode]);

  const fetchDeletedWorksheets = async () => {
    try {
      if (!user) { setLoading(false); return; }

      const selectQuery = listView
        ? 'id, title, created_at, deleted_at, student_id, generation_time_seconds, form_data, audio_url, audio_duration, audio_voice, selected_audio, selected_image, media_metadata'
        : '*';

      let query = supabase
        .from('worksheets')
        .select(selectQuery, { count: 'exact' })
        .eq('teacher_id', user.id)
        .not('deleted_at', 'is', null);

      if (studentId) {
        if (studentId === 'unassigned') {
          query = query.is('student_id', null);
        } else {
          query = query.eq('student_id', studentId);
        }
      }

      query = query.order('deleted_at', { ascending: false });

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
      setDeletedWorksheets(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching deleted worksheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const restoreWorksheet = async (worksheetId: string) => {
    try {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('worksheets')
        .update({ deleted_at: null })
        .eq('id', worksheetId)
        .eq('teacher_id', user.id);
      if (error) throw error;
      await fetchDeletedWorksheets();
      return { success: true };
    } catch (error: any) {
      console.error('Error restoring worksheet:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    deletedWorksheets,
    loading,
    refetch: fetchDeletedWorksheets,
    restoreWorksheet,
    totalCount
  };
};
