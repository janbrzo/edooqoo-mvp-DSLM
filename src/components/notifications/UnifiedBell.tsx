/**
 * UnifiedBell — single notification entry-point combining:
 *   1. Notifications (homework events + welcome_test_completed) — `homework_notifications` table
 *   2. Alerts (Closed-Loop Company: pacing/engagement/tokens) — `teacher_alerts` table
 *
 * Replaces the side-by-side `<HomeworkNotificationBadge />` + `<TeacherAlertsBell />`
 * pair in StickyNav (v6.8.4 — Problem 4). Both legacy components remain in code
 * for use elsewhere (WorksheetHeader, WorksheetPage).
 *
 * Tabs: "Notifications" is the default (more frequent traffic). Each tab shows
 * its own unread count badge in the tab header. Combined unread count is shown
 * on the bell badge itself, capped at "9+".
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BookOpen, Sparkles, AlertCircle, AlertTriangle, Info, Check, X as XIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useHomeworkNotifications, type AppNotification } from '@/hooks/useHomeworkNotifications';
import { useTeacherAlerts, type TeacherAlert } from '@/hooks/useTeacherAlerts';

const severityIcon = (s: TeacherAlert['severity']) => {
  if (s === 'high') return <AlertCircle className="h-4 w-4 text-destructive" />;
  if (s === 'medium') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
};

const notifIcon = (type: string) => {
  if (type === 'welcome_test_completed') return <Sparkles className="h-4 w-4 mt-0.5 text-primary" />;
  return <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground" />;
};

export function UnifiedBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'alerts'>('notifications');

  const {
    notifications,
    unreadCount: notifUnread,
    markAsRead: markNotifRead,
    markAllAsRead: markAllNotifRead,
  } = useHomeworkNotifications();

  const {
    alerts,
    unreadCount: alertUnread,
    markRead: markAlertRead,
    dismiss: dismissAlert,
    markAllRead: markAllAlertsRead,
  } = useTeacherAlerts();

  const totalUnread = notifUnread + alertUnread;

  // Dashboard Today ("View all in notifications") opens the bell via a global event.
  useEffect(() => {
    const handler = () => {
      setActiveTab('notifications');
      setOpen(true);
    };
    window.addEventListener('unifiedBell:open', handler);
    return () => window.removeEventListener('unifiedBell:open', handler);
  }, []);

  const handleNotifClick = (n: AppNotification) => {
    if (!n.is_read) markNotifRead(n.id);
    if (n.notification_type === 'welcome_test_completed') {
      navigate(`/student/${n.student_id}?tab=tests`);
    } else if (n.share_token) {
      navigate(`/homework/${n.share_token}`);
    } else {
      navigate(`/student/${n.student_id}`);
    }
    setOpen(false);
  };

  const handleAlertClick = async (alert: TeacherAlert) => {
    if (!alert.is_read) await markAlertRead(alert.id);
    if (alert.cta_url) {
      setOpen(false);
      if (alert.cta_url.startsWith('http')) {
        window.open(alert.cta_url, '_blank', 'noopener');
      } else {
        navigate(alert.cta_url);
      }
    }
  };

  const topAlerts = alerts.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications & Alerts">
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center p-0 text-xs"
            >
              {totalUnread > 9 ? '9+' : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'notifications' | 'alerts')}>
          <TabsList className="grid w-full grid-cols-2 rounded-none border-b">
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-3.5 w-3.5" />
              Notifications
              {notifUnread > 0 && (
                <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                  {notifUnread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Alerts
              {alertUnread > 0 && (
                <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                  {alertUnread}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Notifications tab */}
          <TabsContent value="notifications" className="m-0">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-medium">Notifications</span>
              {notifUnread > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllNotifRead}>
                  Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet</div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      'px-3 py-2 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors',
                      !n.is_read && 'bg-primary/5',
                    )}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div className="flex items-start gap-2">
                      {notifIcon(n.notification_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Alerts tab */}
          <TabsContent value="alerts" className="m-0">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-medium">Alerts</span>
              {alertUnread > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAlertsRead}>
                  Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {topAlerts.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No alerts. You're all caught up.
                </div>
              ) : (
                topAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className={cn(
                      'px-3 py-2 border-b last:border-b-0 hover:bg-muted/50',
                      !alert.is_read && 'bg-primary/5',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{severityIcon(alert.severity)}</div>
                      <button
                        type="button"
                        onClick={() => handleAlertClick(alert)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-medium truncate">{alert.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </p>
                      </button>
                      <div className="flex flex-col gap-1">
                        {!alert.is_read && (
                          <button
                            type="button"
                            onClick={() => markAlertRead(alert.id)}
                            className="p-1 hover:bg-muted rounded"
                            title="Mark read"
                            aria-label={`Mark notification "${alert.title}" as read`}
                          >
                            <Check className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => dismissAlert(alert.id)}
                          className="p-1 hover:bg-muted rounded"
                          title="Dismiss"
                          aria-label={`Dismiss notification "${alert.title}"`}
                        >
                          <XIcon className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setOpen(false);
                  navigate('/teacher/alerts');
                }}
              >
                View all alerts
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}