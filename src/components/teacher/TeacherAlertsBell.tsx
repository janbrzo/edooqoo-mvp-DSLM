import { useState } from 'react';
import { Bell, Check, X as XIcon, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTeacherAlerts, type TeacherAlert } from '@/hooks/useTeacherAlerts';
import { formatDistanceToNow } from 'date-fns';

const severityIcon = (s: TeacherAlert['severity']) => {
  if (s === 'high') return <AlertCircle className="h-4 w-4 text-destructive" />;
  if (s === 'medium') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
};

/**
 * Closed-Loop Company — bell badge in teacher header.
 * Shows top 5 unread/recent alerts, links to /teacher/alerts for the full inbox.
 */
export function TeacherAlertsBell() {
  const navigate = useNavigate();
  const { alerts, unreadCount, markRead, dismiss } = useTeacherAlerts();
  const [open, setOpen] = useState(false);

  const top = alerts.slice(0, 5);

  const handleAction = async (alert: TeacherAlert) => {
    if (!alert.is_read) await markRead(alert.id);
    if (alert.cta_url) {
      setOpen(false);
      if (alert.cta_url.startsWith('http')) {
        window.open(alert.cta_url, '_blank', 'noopener');
      } else {
        navigate(alert.cta_url);
      }
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Alerts">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-tight bg-destructive text-destructive-foreground border-0"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium">Alerts</span>
          <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
        </div>
        {top.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No alerts. You're all caught up.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {top.map(alert => (
              <div
                key={alert.id}
                className={`px-3 py-2 border-b last:border-b-0 hover:bg-muted/50 ${
                  !alert.is_read ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{severityIcon(alert.severity)}</div>
                  <button
                    type="button"
                    onClick={() => handleAction(alert)}
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
                        onClick={() => markRead(alert.id)}
                        className="p-1 hover:bg-muted rounded"
                        title="Mark read"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => dismiss(alert.id)}
                      className="p-1 hover:bg-muted rounded"
                      title="Dismiss"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}