import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AppNotification {
  id: string;
  homework_id: string | null;
  student_id: string;
  message: string;
  notification_type: string;
  created_at: string;
  is_read: boolean;
  share_token?: string | null;
}

/**
 * Shared notifications hook used by both the legacy `HomeworkNotificationBadge`
 * and the new `UnifiedBell` (v6.8.4 — Problem 4: merge Alerts + Notifications).
 *
 * Source: `homework_notifications` table — covers homework events AND
 * `welcome_test_completed` notifications.
 */
export function useHomeworkNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('homework_notifications')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;

      const homeworkIds = (data || []).filter(n => n.homework_id).map(n => n.homework_id as string);
      let homeworkTokenMap: Record<string, string> = {};
      if (homeworkIds.length > 0) {
        const { data: hwData } = await supabase
          .from('homework_assignments')
          .select('id, share_token')
          .in('id', homeworkIds);
        if (hwData) {
          homeworkTokenMap = Object.fromEntries(hwData.map(h => [h.id, h.share_token || '']));
        }
      }

      const enriched: AppNotification[] = (data || []).map(n => ({
        ...(n as any),
        share_token: n.homework_id ? homeworkTokenMap[n.homework_id as string] || null : null,
      }));

      setNotifications(enriched);
      setUnreadCount(enriched.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('[useHomeworkNotifications] fetch failed', err);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('homework_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[useHomeworkNotifications] markAsRead failed', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('homework_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('teacher_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('[useHomeworkNotifications] markAllAsRead failed', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel('homework_notifications_unified')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'homework_notifications' },
        (payload) => {
          const n = payload.new as AppNotification;
          setNotifications(prev => [n, ...prev]);
          setUnreadCount(prev => prev + 1);
          const isWelcome = n.notification_type === 'welcome_test_completed';
          toast.success(
            isWelcome
              ? `Welcome Test completed! ${n.message}`
              : `New notification: ${n.message}`,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  return { notifications, unreadCount, markAsRead, markAllAsRead, refresh: fetchNotifications };
}