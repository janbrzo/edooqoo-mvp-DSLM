
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useWorksheetStats = () => {
  const [thisMonthCount, setThisMonthCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorksheetStats();
  }, []);

  const fetchWorksheetStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate start of current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Query ALL worksheets (including deleted ones) created this month
      const { data, error } = await supabase
        .from('worksheets')
        .select('id')
        .eq('teacher_id', user.id)
        .gte('created_at', startOfMonth.toISOString());

      if (error) throw error;
      
      setThisMonthCount(data?.length || 0);
    } catch (error: any) {
      console.error('Error fetching worksheet stats:', error);
      setThisMonthCount(0);
    } finally {
      setLoading(false);
    }
  };

  return {
    thisMonthCount,
    loading,
    refetch: fetchWorksheetStats
  };
};
