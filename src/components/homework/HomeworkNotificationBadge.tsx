import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface AppNotification {
  id: string;
  homework_id: string;
  student_id: string;
  message: string;
  notification_type: string;
  created_at: string;
  is_read: boolean;
  share_token?: string;
}

/** Unified Notification Badge - handles homework + welcome test notifications */
export function HomeworkNotificationBadge() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    
    const channel = supabase
      .channel('homework_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'homework_notifications'
        },
        (payload) => {
          const newNotification = payload.new as AppNotification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          const isWelcome = newNotification.notification_type === 'welcome_test_completed';
          toast.success(isWelcome 
            ? `Welcome Test completed! ${newNotification.message}`
            : `New notification: ${newNotification.message}`
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use separate query without join to handle nullable homework_id
      const { data, error } = await supabase
        .from('homework_notifications')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;

      // Fetch share_tokens for homework notifications that have homework_id
      const homeworkIds = (data || []).filter(n => n.homework_id).map(n => n.homework_id);
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

      const notificationsWithToken = (data || []).map(n => ({
        ...n,
        share_token: n.homework_id ? homeworkTokenMap[n.homework_id] || null : null,
      }));

      setNotifications(notificationsWithToken);
      setUnreadCount(notificationsWithToken.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('homework_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
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
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (notification.notification_type === 'welcome_test_completed') {
      // Navigate to student's Tests tab
      navigate(`/student/${notification.student_id}?tab=tests`);
    } else if (notification.share_token) {
      navigate(`/homework/${notification.share_token}`);
    } else {
      navigate(`/student/${notification.student_id}`);
    }
    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    if (type === 'welcome_test_completed') {
      return <Sparkles className="h-4 w-4 mt-0.5 text-primary" />;
    }
    return <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground" />;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors ${
                  !notification.is_read ? 'bg-muted/30' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-2">
                  {getNotificationIcon(notification.notification_type)}
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
