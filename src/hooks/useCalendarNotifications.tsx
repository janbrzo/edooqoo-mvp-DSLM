import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';

export interface CalendarNotification {
  id: string;
  teacher_id: string;
  notification_type: string;
  message: string;
  slot_id: string | null;
  student_name: string | null;
  is_read: boolean;
  is_resolved: boolean;
  resolved_action: string | null;
  created_at: string;
  metadata: any;
}

export function useCalendarNotifications(teacherId?: string) {
  const [notifications, setNotifications] = useState<CalendarNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { isDemoMode } = useDemoContext();

  const fetchNotifications = useCallback(async () => {
    if (!teacherId || isDemoMode) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('calendar_notifications')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      const items = (data || []) as unknown as CalendarNotification[];
      setNotifications(items);
      setUnreadCount(items.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Error fetching calendar notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Supabase Realtime
  useEffect(() => {
    if (!teacherId || isDemoMode) return;
    const channel = supabase
      .channel(`calendar-notifications-${teacherId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_notifications', filter: `teacher_id=eq.${teacherId}` },
        () => { fetchNotifications(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teacherId, fetchNotifications]);

  const markAllRead = useCallback(async () => {
    if (!teacherId || isDemoMode) return;
    const unread = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unread.length === 0) return;
    await supabase
      .from('calendar_notifications')
      .update({ is_read: true } as any)
      .eq('teacher_id', teacherId)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [teacherId, notifications]);

  return { notifications, unreadCount, loading, markAllRead, refetch: fetchNotifications };
}
