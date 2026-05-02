import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDemoContext } from '@/contexts/DemoContext';

export interface TeacherVacation {
  id: string;
  teacher_id: string;
  start_date: string;
  end_date: string;
  label: string;
  created_at: string;
}

export function useCalendarVacations(teacherId?: string) {
  const [vacations, setVacations] = useState<TeacherVacation[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemoMode } = useDemoContext();

  const fetchVacations = useCallback(async () => {
    if (!teacherId || isDemoMode) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('calendar_teacher_vacations')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('start_date');
      if (error) throw error;
      setVacations((data || []) as TeacherVacation[]);
    } catch (err) {
      console.error('Error fetching vacations:', err);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { fetchVacations(); }, [fetchVacations]);

  const addVacation = useCallback(async (start_date: string, end_date: string, label: string = 'Vacation') => {
    if (!teacherId || isDemoMode) return;
    try {
      const { error } = await supabase.from('calendar_teacher_vacations').insert({
        teacher_id: teacherId, start_date, end_date, label,
      } as any);
      if (error) throw error;
      toast.success('Vacation added');
      await fetchVacations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add vacation');
    }
  }, [teacherId, fetchVacations]);

  const removeVacation = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('calendar_teacher_vacations').delete().eq('id', id);
      if (error) throw error;
      toast.success('Vacation removed');
      await fetchVacations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove vacation');
    }
  }, [fetchVacations]);

  return { vacations, loading, addVacation, removeVacation, refetch: fetchVacations };
}
