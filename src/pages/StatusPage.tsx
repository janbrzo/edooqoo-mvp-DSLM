/**
 * StatusPage — public status of Edooqoo's components over the last 24 hours.
 * Calls the get_public_status() RPC. Never reveals error details — only a
 * status (operational / degraded / down) and a count.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import GlobalFooter from '@/components/GlobalFooter';
import { Link } from 'react-router-dom';

interface ComponentStatus {
  component: string;
  status: 'operational' | 'degraded' | 'down';
  last_incident_at: string | null;
  error_count_24h: number;
}

interface ModelIssue {
  provider: string;
  model: string;
  last_seen: string;
  count: number;
}

const LABELS: Record<string, string> = {
  worksheets: 'Worksheets',
  homework: 'Homework',
  live: 'Live Sessions',
  calendar: 'Calendar & Booking',
  ai: 'AI Generation',
  auth: 'Authentication',
};

export default function StatusPage() {
  const [items, setItems] = useState<ComponentStatus[]>([]);
  const [modelIssues, setModelIssues] = useState<ModelIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    document.title = 'System Status — Edooqoo';
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', "Live status of Edooqoo systems: worksheets, homework, live sessions, calendar, AI generation, authentication.");
    let alive = true;
    const load = async () => {
      const [{ data, error }, mi] = await Promise.all([
        supabase.rpc('get_public_status' as any),
        supabase.rpc('get_active_model_issues' as any),
      ]);
      if (!alive) return;
      if (!error && data) setItems(data as ComponentStatus[]);
      if (!mi.error && mi.data) setModelIssues(mi.data as ModelIssue[]);
      setUpdatedAt(new Date());
      setLoading(false);
    };
    load();
    const i = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(i); };
  }, []);

  const overall: 'operational' | 'degraded' | 'down' = items.some((i) => i.status === 'down')
    ? 'down'
    : items.some((i) => i.status === 'degraded')
      ? 'degraded'
      : 'operational';

  const banner = {
    operational: { icon: <CheckCircle2 className="h-6 w-6 text-green-600" />, text: 'All systems operational', cls: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900' },
    degraded:    { icon: <AlertTriangle className="h-6 w-6 text-amber-600" />, text: 'Some systems are degraded',  cls: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900' },
    down:        { icon: <XCircle className="h-6 w-6 text-red-600" />,           text: 'Service disruption detected', cls: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900' },
  }[overall];

  const badge = (s: ComponentStatus['status']) => {
    if (s === 'operational') return <Badge className="bg-green-600 hover:bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" />Operational</Badge>;
    if (s === 'degraded') return <Badge className="bg-amber-500 hover:bg-amber-500 gap-1"><AlertTriangle className="h-3 w-3" />Degraded</Badge>;
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Down</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
        <div className="container mx-auto py-12 px-4 max-w-3xl">
          <div className="mb-6">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Back to Edooqoo</Link>
          </div>
          <h1 className="text-3xl font-bold mb-1">System Status</h1>
          <p className="text-muted-foreground mb-6 text-sm">Real-time health of Edooqoo's core systems over the last 24 hours.</p>

          <div className={`rounded-lg border p-4 mb-6 flex items-center gap-3 ${banner.cls}`}>
            {banner.icon}
            <div className="font-semibold">{banner.text}</div>
          </div>

          {modelIssues.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-red-900 dark:text-red-200 mb-1">
                    Active AI model issues
                  </div>
                  <p className="text-sm text-red-800 dark:text-red-300 mb-2">
                    We're investigating issues with the following AI providers. Audio or worksheet generation may be temporarily affected.
                  </p>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                    {modelIssues.map((m) => (
                      <li key={`${m.provider}-${m.model}`}>
                        <span className="font-mono">{m.provider}</span> · {m.model} — {m.count} incident{m.count === 1n || m.count === 1 ? '' : 's'} (last {new Date(m.last_seen).toLocaleTimeString()})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Components</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
              ) : items.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">Status feed unavailable.</div>
              ) : (
                <ul className="divide-y">
                  {items.map((it) => (
                    <li key={it.component} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-sm">{LABELS[it.component] ?? it.component}</div>
                        {it.error_count_24h > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {it.error_count_24h} incident{it.error_count_24h === 1 ? '' : 's'} in last 24h
                          </div>
                        )}
                      </div>
                      {badge(it.status)}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {updatedAt && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Last updated {updatedAt.toLocaleTimeString()} · refreshes every minute
            </p>
          )}
        </div>
        <GlobalFooter />
      </div>
  );
}