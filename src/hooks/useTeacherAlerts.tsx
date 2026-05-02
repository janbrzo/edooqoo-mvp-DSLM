import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useDemoContext } from '@/contexts/DemoContext';

export interface TeacherAlert {
  id: string;
  teacher_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  payload: Record<string, unknown>;
  cta_url: string | null;
  cta_label: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  source_loop_id: string | null;
  created_at: string;
}

const POLL_INTERVAL_MS = 60_000;

/**
 * Closed-Loop Company — teacher alert inbox.
 * Polls every 60s. Returns early in demo mode to avoid UUID errors.
 */
export function useTeacherAlerts() {
  const { data: user } = useAuthUser();
  const { isDemoMode } = useDemoContext();
  const [alerts, setAlerts] = useState<TeacherAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (isDemoMode || !user?.id) {
      setAlerts([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('teacher_alerts')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) setAlerts(data as unknown as TeacherAlert[]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isDemoMode]);

  useEffect(() => {
    fetchAlerts();
    if (isDemoMode || !user?.id) return;
    const id = setInterval(fetchAlerts, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchAlerts, user?.id, isDemoMode]);

  const markRead = useCallback(async (alertId: string) => {
    if (isDemoMode) return;
    await supabase.from('teacher_alerts').update({ is_read: true }).eq('id', alertId);
    setAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, is_read: true } : a)));
  }, [isDemoMode]);

  const dismiss = useCallback(async (alertId: string) => {
    if (isDemoMode) return;
    await supabase.from('teacher_alerts').update({ is_dismissed: true }).eq('id', alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, [isDemoMode]);

  const markAllRead = useCallback(async () => {
    if (isDemoMode || !user?.id) return;
    await supabase
      .from('teacher_alerts')
      .update({ is_read: true })
      .eq('teacher_id', user.id)
      .eq('is_read', false);
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
  }, [isDemoMode, user?.id]);

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return { alerts, loading, unreadCount, markRead, dismiss, markAllRead, refresh: fetchAlerts };
}