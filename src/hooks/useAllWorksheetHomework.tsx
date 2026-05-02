import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { useAuthUser } from '@/hooks/useAuthUser';

export interface HomeworkAssignment {
  id: string;
  title: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  selected_exercises: any;
  deadline: string | null;
  share_token: string | null;
  view_count: number;
  viewed_at: string | null;
  created_at: string;
  completed_at: string | null;
  completed_by_teacher: boolean | null;
  reminder_hours: number | null;
  reminder_sent_at: string | null;
  reminder_scheduled_at: string | null;
}

interface GroupedHomework {
  [worksheetId: string]: HomeworkAssignment[];
}

export const useAllWorksheetHomework = (worksheetIds: string[], studentId?: string) => {
  const [homeworkByWorksheet, setHomeworkByWorksheet] = useState<GroupedHomework>({});
  const [loading, setLoading] = useState(false);
  const { isDemoMode } = useDemoContext();
  const { data: user } = useAuthUser();

  const fetchAllHomework = async () => {
    if (worksheetIds.length === 0) {
      setHomeworkByWorksheet({});
      return;
    }

    if (isDemoMode) {
      setHomeworkByWorksheet({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (!user) return;

      let query = supabase
        .from('homework_assignments')
        .select(`
          id,
          title,
          student_id,
          selected_exercises,
          deadline,
          share_token,
          view_count,
          viewed_at,
          created_at,
          completed_at,
          completed_by_teacher,
          reminder_hours,
          reminder_sent_at,
          reminder_scheduled_at,
          source_worksheet_id,
          students (
            name,
            student_email
          )
        `)
        .eq('teacher_id', user.id)
        .in('source_worksheet_id', worksheetIds);
      
      // Add student filter if provided
      if (studentId) {
        query = query.eq('student_id', studentId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Group homework by worksheet ID
      const grouped: GroupedHomework = {};
      data?.forEach((hw: any) => {
        const worksheetId = hw.source_worksheet_id;
        if (!grouped[worksheetId]) {
          grouped[worksheetId] = [];
        }
        grouped[worksheetId].push({
          id: hw.id,
          title: hw.title,
          student_id: hw.student_id,
          student_name: hw.students?.name || 'Unknown Student',
          student_email: hw.students?.student_email || null,
          selected_exercises: hw.selected_exercises,
          deadline: hw.deadline,
          share_token: hw.share_token,
          view_count: hw.view_count,
          viewed_at: hw.viewed_at,
          created_at: hw.created_at,
          completed_at: hw.completed_at,
          completed_by_teacher: hw.completed_by_teacher,
          reminder_hours: hw.reminder_hours || null,
          reminder_sent_at: hw.reminder_sent_at || null,
          reminder_scheduled_at: hw.reminder_scheduled_at || null,
        });
      });

      setHomeworkByWorksheet(grouped);
    } catch (error) {
      console.error('Error fetching homework assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllHomework();
  }, [worksheetIds.join(','), isDemoMode, user?.id]);

  // Listen for homework creation events
  useEffect(() => {
    if (isDemoMode) return;
    const handleHomeworkCreated = (event: CustomEvent) => {
      const { worksheetId } = event.detail;
      if (worksheetIds.includes(worksheetId)) {
        fetchAllHomework();
      }
    };

    window.addEventListener('homeworkCreated' as any, handleHomeworkCreated);
    return () => {
      window.removeEventListener('homeworkCreated' as any, handleHomeworkCreated);
    };
  }, [worksheetIds, isDemoMode]);

  return {
    homeworkByWorksheet,
    loading,
    refetch: fetchAllHomework,
  };
};
