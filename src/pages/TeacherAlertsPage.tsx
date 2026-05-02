import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, AlertTriangle, Info, Check, X as XIcon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthenticatedPageShell } from '@/components/AuthenticatedPageShell';
import { useTeacherAlerts, type TeacherAlert } from '@/hooks/useTeacherAlerts';
import { formatDistanceToNow } from 'date-fns';

const severityMeta = (s: TeacherAlert['severity']) => {
  if (s === 'high') return { icon: <AlertCircle className="h-5 w-5 text-destructive" />, label: 'High', variant: 'destructive' as const };
  if (s === 'medium') return { icon: <AlertTriangle className="h-5 w-5 text-amber-500" />, label: 'Medium', variant: 'secondary' as const };
  return { icon: <Info className="h-5 w-5 text-muted-foreground" />, label: 'Low', variant: 'outline' as const };
};

/**
 * Closed-Loop Company — full teacher alerts inbox.
 * Lists all non-dismissed alerts with details + CTA actions.
 */
export default function TeacherAlertsPage() {
  const navigate = useNavigate();
  const { alerts, loading, unreadCount, markRead, dismiss, markAllRead } = useTeacherAlerts();

  const handleCta = (alert: TeacherAlert) => {
    if (!alert.cta_url) return;
    if (!alert.is_read) markRead(alert.id);
    if (alert.cta_url.startsWith('http')) {
      window.open(alert.cta_url, '_blank', 'noopener');
    } else {
      navigate(alert.cta_url);
    }
  };

  return (
    <AuthenticatedPageShell>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <Check className="h-4 w-4 mr-2" />
              Mark all read ({unreadCount})
            </Button>
          )}
        </div>

        <h1 className="text-2xl font-bold mb-1">Alerts</h1>
        <p className="text-sm text-muted-foreground mb-6">
          System signals from Edooqoo Closed-Loop Company. Each alert highlights an action you may want to take for your students or your account.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : alerts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No alerts. You're all caught up.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => {
              const meta = severityMeta(alert.severity);
              return (
                <Card key={alert.id} className={!alert.is_read ? 'border-primary/30 bg-primary/5' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{meta.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{alert.title}</h3>
                          <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                          {alert.source_loop_id && (
                            <Badge variant="outline" className="text-[10px]">{alert.source_loop_id}</Badge>
                          )}
                          {!alert.is_read && <Badge className="text-[10px]">New</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </p>
                        {alert.cta_url && (
                          <Button size="sm" variant="outline" className="mt-3" onClick={() => handleCta(alert)}>
                            {alert.cta_label || 'Open'}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {!alert.is_read && (
                          <button onClick={() => markRead(alert.id)} className="p-1 hover:bg-muted rounded" title="Mark read">
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => dismiss(alert.id)} className="p-1 hover:bg-muted rounded" title="Dismiss">
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AuthenticatedPageShell>
  );
}