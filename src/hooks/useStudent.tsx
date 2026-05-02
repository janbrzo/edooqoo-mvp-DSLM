import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useDemoContext } from '@/contexts/DemoContext';

type Student = Tables<'students'>;

/**
 * Fetch a single student by id (cached). Replaces the old pattern of
 * pulling the entire students list and using `.find()`.
 */
export const useStudent = (studentId?: string) => {
  const { isDemoMode, demoData } = useDemoContext();

  return useQuery<Student | null>({
    queryKey: ['student', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      if (isDemoMode && demoData) {
        const found = (demoData.students as unknown as Student[]).find(s => s.id === studentId);
        return found ?? null;
      }
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Student | null;
    },
    enabled: !!studentId,
  });
};
