import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SlotLog {
  id: string;
  slot_id: string;
  teacher_id: string;
  action: string;
  actor: string;
  details: any;
  created_at: string;
}

export function useCalendarSlotLogs(teacherId?: string) {
  const [logs, setLogs] = useState<SlotLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async (opts?: { page?: number; limit?: number; action?: string; dateFrom?: string; dateTo?: string }) => {
    if (!teacherId) return;
    setLoading(true);
    try {
      const page = opts?.page || 0;
      const limit = opts?.limit || 50;
      let query = supabase
        .from('calendar_slot_logs')
        .select('*', { count: 'exact' })
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);
      
      if (opts?.action) query = query.eq('action', opts.action);
      if (opts?.dateFrom) query = query.gte('created_at', opts.dateFrom);
      if (opts?.dateTo) query = query.lte('created_at', opts.dateTo);

      const { data, error, count } = await query;
      if (error) throw error;
      setLogs((data || []) as SlotLog[]);
      setTotal(count || 0);
    } catch (err) {
      console.error('Error fetching slot logs:', err);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  return { logs, loading, total, fetchLogs };
}
