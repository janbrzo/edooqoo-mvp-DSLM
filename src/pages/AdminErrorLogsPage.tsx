/**
 * AdminErrorLogsPage — admin-only page listing recent error_logs and bug_reports.
 * Read-only listing with severity/component filters; click a row to expand details.
 * Allows marking error_logs as resolved with a short note.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { AuthenticatedPageShell } from '@/components/AuthenticatedPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Bug } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ErrorLog {
  id: string;
  source: string;
  source_name: string;
  severity: 'warning' | 'error' | 'fatal';
  component: string | null;
  message: string;
  error_code: string | null;
  stack: string | null;
  context: Record<string, unknown>;
  user_id: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

interface BugReport {
  id: string;
  teacher_id: string;
  title: string;
  description: string;
  page_url: string | null;
  viewport: string | null;
  user_agent: string | null;
  console_errors: unknown;
  attachment_paths: string[];
  status: string;
  created_at: string;
  email_status?: string | null;
  email_error?: string | null;
  resolution_note?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
}

interface ReporterProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

export default function AdminErrorLogsPage() {
  const { user, loading: authLoading } = useAuthFlow();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [reporters, setReporters] = useState<Record<string, ReporterProfile>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severity, setSeverity] = useState<string>('all');
  const [component, setComponent] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bugStatusFilter, setBugStatusFilter] = useState<string>('open');
  const [bugSearch, setBugSearch] = useState('');
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({});
  const [pendingNote, setPendingNote] = useState<Record<string, string>>({});

  // Admin gate
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
      setIsAdmin(!!data);
      if (!data) {
        toast({
          title: 'Admin access required',
          description: 'This page is restricted to administrators.',
          variant: 'destructive',
        });
        navigate('/dashboard');
      }
    })();
  }, [user, navigate]);

  const fetchAll = async () => {
    setRefreshing(true);
    const { data: logsData } = await supabase
      .from('error_logs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    const { data: bugsData } = await supabase
      .from('bug_reports' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs((logsData as unknown as ErrorLog[]) || []);
    const bugsList = (bugsData as unknown as BugReport[]) || [];
    setBugs(bugsList);

    // Hydrate reporter profiles for bug reports
    const teacherIds = Array.from(new Set(bugsList.map((b) => b.teacher_id).filter(Boolean)));
    if (teacherIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', teacherIds);
      const map: Record<string, ReporterProfile> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setReporters(map);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const openAttachment = async (path: string) => {
    if (signedUrls[path]) {
      window.open(signedUrls[path], '_blank', 'noopener');
      return;
    }
    const { data, error } = await supabase.storage
      .from('bug-reports')
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not open attachment', description: error?.message ?? 'No URL', variant: 'destructive' });
      return;
    }
    setSignedUrls((s) => ({ ...s, [path]: data.signedUrl }));
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const formatReporter = (teacherId: string) => {
    const p = reporters[teacherId];
    if (!p) return teacherId;
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
    return `${name || '(no name)'} — ${p.email || '(no email)'}`;
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (!showResolved && l.resolved_at) return false;
      if (severity !== 'all' && l.severity !== severity) return false;
      if (component !== 'all' && l.component !== component) return false;
      if (search && !`${l.message} ${l.source_name} ${l.error_code ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, severity, component, showResolved, search]);

  const components = useMemo(() => {
    const s = new Set<string>();
    logs.forEach((l) => l.component && s.add(l.component));
    return Array.from(s).sort();
  }, [logs]);

  const markResolved = async (id: string) => {
    const note = window.prompt('Resolution note (optional):') ?? '';
    const { error } = await supabase
      .from('error_logs' as any)
      .update({ resolved_at: new Date().toISOString(), resolved_by: user?.id, resolution_note: note || null })
      .eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Marked as resolved' });
    fetchAll();
  };

  const BUG_STATUSES = ['new', 'triaged', 'in_progress', 'resolved', 'wontfix'] as const;
  const CLOSED_STATUSES = new Set(['resolved', 'wontfix']);

  const filteredBugs = useMemo(() => {
    return bugs.filter((b) => {
      if (bugStatusFilter === 'open' && CLOSED_STATUSES.has(b.status)) return false;
      if (bugStatusFilter !== 'all' && bugStatusFilter !== 'open' && b.status !== bugStatusFilter) return false;
      if (bugSearch) {
        const hay = `${b.title} ${b.description} ${b.page_url ?? ''}`.toLowerCase();
        if (!hay.includes(bugSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [bugs, bugStatusFilter, bugSearch]);

  const openBugCount = useMemo(
    () => bugs.filter((b) => !CLOSED_STATUSES.has(b.status)).length,
    [bugs],
  );

  const updateBugStatus = async (id: string, newStatus: string, note?: string) => {
    const isClosing = CLOSED_STATUSES.has(newStatus);
    const payload: Record<string, unknown> = {
      status: newStatus,
      resolution_note: note?.trim() ? note.trim() : null,
      resolved_by: isClosing ? user?.id : null,
      resolved_at: isClosing ? new Date().toISOString() : null,
    };
    const { error } = await supabase
      .from('bug_reports' as any)
      .update(payload)
      .eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `Bug status: ${newStatus}` });
    setPendingStatus((s) => { const n = { ...s }; delete n[id]; return n; });
    setPendingNote((s) => { const n = { ...s }; delete n[id]; return n; });
    fetchAll();
  };

  const bugStatusBadge = (status: string) => {
    const map: Record<string, { className: string; label: string }> = {
      new:         { className: 'bg-slate-200 text-slate-800 hover:bg-slate-200',         label: 'New' },
      triaged:     { className: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100', label: 'Triaged' },
      in_progress: { className: 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100', label: 'In progress' },
      resolved:    { className: 'bg-green-600 text-white hover:bg-green-600',             label: 'Resolved' },
      wontfix:     { className: 'bg-zinc-200 text-zinc-700 hover:bg-zinc-200',            label: "Won't fix" },
    };
    const meta = map[status] ?? { className: '', label: status };
    return <Badge className={meta.className} variant="outline">{meta.label}</Badge>;
  };

  const sevBadge = (s: string) => {
    if (s === 'fatal') return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />fatal</Badge>;
    if (s === 'error') return <Badge variant="destructive" className="gap-1 bg-orange-600"><AlertTriangle className="h-3 w-3" />error</Badge>;
    return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />warning</Badge>;
  };

  const emailBadge = (s?: string | null) => {
    if (s === 'sent')    return <Badge className="bg-green-600 hover:bg-green-700">Email: sent</Badge>;
    if (s === 'failed')  return <Badge variant="destructive">Email: failed</Badge>;
    if (s === 'skipped') return <Badge variant="secondary">Email: skipped</Badge>;
    return <Badge variant="outline">Email: pending</Badge>;
  };

  if (authLoading || isAdmin === null) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <AuthenticatedPageShell>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Error Logs &amp; Bug Reports</h1>
            <p className="text-sm text-muted-foreground">Admin-only operational view of system errors and user-submitted bug reports.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>

        <Tabs defaultValue="errors">
          <TabsList>
            <TabsTrigger value="errors">Error Logs ({logs.filter((l) => !l.resolved_at).length})</TabsTrigger>
            <TabsTrigger value="bugs">Bug Reports ({openBugCount})</TabsTrigger>
          </TabsList>

          <TabsContent value="errors" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap gap-3 items-center">
                  <Input placeholder="Search messages…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All severities</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="fatal">Fatal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={component} onValueChange={setComponent}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All components</SelectItem>
                      {components.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant={showResolved ? 'default' : 'outline'} size="sm" onClick={() => setShowResolved((s) => !s)}>
                    {showResolved ? 'Hide resolved' : 'Show resolved'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
                ) : filteredLogs.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-sm">No error logs match your filters.</div>
                ) : (
                  <ul className="divide-y">
                    {filteredLogs.map((l) => (
                      <li key={l.id} className="p-4 hover:bg-muted/30">
                        <button type="button" className="w-full text-left" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {sevBadge(l.severity)}
                            {l.component && <Badge variant="outline">{l.component}</Badge>}
                            <Badge variant="outline" className="font-mono text-[10px]">{l.source_name}</Badge>
                            {l.resolved_at && <Badge variant="outline" className="gap-1 text-green-700 border-green-700"><CheckCircle2 className="h-3 w-3" />resolved</Badge>}
                            <span className="text-xs text-muted-foreground ml-auto">{format(new Date(l.created_at), 'PPpp')}</span>
                          </div>
                          <div className="text-sm font-medium break-words">{l.message}</div>
                          {l.error_code && <div className="text-xs text-muted-foreground mt-0.5">Code: {l.error_code}</div>}
                        </button>
                        {expanded === l.id && (
                          <div className="mt-3 space-y-2 text-xs">
                            {l.stack && (
                              <pre className="bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-64">{l.stack}</pre>
                            )}
                            {l.context && Object.keys(l.context).length > 0 && (
                              <div>
                                <div className="font-semibold mb-1">Context</div>
                                <pre className="bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48">{JSON.stringify(l.context, null, 2)}</pre>
                              </div>
                            )}
                            {!l.resolved_at && (
                              <Button size="sm" variant="outline" onClick={() => markResolved(l.id)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Mark resolved
                              </Button>
                            )}
                            {l.resolution_note && (
                              <div className="text-muted-foreground italic">Note: {l.resolution_note}</div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bugs" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap gap-3 items-center">
                  <Input
                    placeholder="Search title / description / URL…"
                    value={bugSearch}
                    onChange={(e) => setBugSearch(e.target.value)}
                    className="w-72"
                  />
                  <Select value={bugStatusFilter} onValueChange={setBugStatusFilter}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open (default)</SelectItem>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="triaged">Triaged</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="wontfix">Won't fix</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {filteredBugs.length} of {bugs.length} shown · {openBugCount} open
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
                ) : filteredBugs.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-sm">No bug reports match your filters.</div>
                ) : (
                  <ul className="divide-y">
                    {filteredBugs.map((b) => (
                      <li key={b.id} className="p-4 hover:bg-muted/30">
                        <button type="button" className="w-full text-left" onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="inline-flex items-center gap-1"><Bug className="h-3 w-3 text-muted-foreground" />{bugStatusBadge(b.status)}</span>
                            {b.viewport && <Badge variant="outline">{b.viewport}</Badge>}
                            {emailBadge(b.email_status)}
                            <span className="text-xs text-muted-foreground ml-auto">{format(new Date(b.created_at), 'PPpp')}</span>
                          </div>
                          <div className="text-sm font-semibold break-words">{b.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{b.description}</div>
                        </button>
                        {expanded === b.id && (
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="whitespace-pre-wrap bg-muted/40 p-2 rounded">{b.description}</div>
                            <div><strong>Page:</strong> {b.page_url ?? '—'}</div>
                            <div><strong>UA:</strong> <code className="text-[10px] break-all">{b.user_agent ?? '—'}</code></div>
                            <div>
                              <strong>Reporter:</strong>{' '}
                              <span>{formatReporter(b.teacher_id)}</span>{' '}
                              <code className="text-[10px] text-muted-foreground">({b.teacher_id})</code>
                            </div>
                            {b.email_error && (
                              <div className="text-destructive"><strong>Email error:</strong> <code className="text-[10px]">{b.email_error}</code></div>
                            )}
                            {b.resolution_note && (
                              <div className="bg-muted/40 p-2 rounded">
                                <strong>Resolution note:</strong> <span className="italic">{b.resolution_note}</span>
                                {b.resolved_at && (
                                  <span className="text-muted-foreground ml-2">
                                    ({format(new Date(b.resolved_at), 'PPpp')})
                                  </span>
                                )}
                              </div>
                            )}
                            {b.attachment_paths?.length > 0 && (
                              <div>
                                <strong>Attachments:</strong>
                                <ul className="mt-1 space-y-1">
                                  {b.attachment_paths.map((p) => (
                                    <li key={p} className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openAttachment(p)}
                                        className="text-primary underline text-xs hover:no-underline"
                                      >
                                        Open attachment
                                      </button>
                                      <code className="text-[10px] text-muted-foreground break-all">{p}</code>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {Array.isArray(b.console_errors) && (b.console_errors as unknown[]).length > 0 && (
                              <div>
                                <div className="font-semibold mb-1">Recent console errors</div>
                                <pre className="bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48">{JSON.stringify(b.console_errors, null, 2)}</pre>
                              </div>
                            )}
                            <div className="border-t pt-3 mt-3 space-y-2">
                              <div className="font-semibold text-xs">Update status</div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  value={pendingStatus[b.id] ?? b.status}
                                  onValueChange={(v) => setPendingStatus((s) => ({ ...s, [b.id]: v }))}
                                >
                                  <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {BUG_STATUSES.map((s) => (
                                      <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  placeholder="Resolution note (optional, e.g. 'not reproducible' / 'duplicate of #123' / 'waiting for OAuth fix')"
                                  value={pendingNote[b.id] ?? b.resolution_note ?? ''}
                                  onChange={(e) => setPendingNote((s) => ({ ...s, [b.id]: e.target.value }))}
                                  className="flex-1 h-8 text-xs min-w-[280px]"
                                />
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8 text-xs"
                                  onClick={() => updateBugStatus(
                                    b.id,
                                    pendingStatus[b.id] ?? b.status,
                                    pendingNote[b.id] ?? b.resolution_note ?? '',
                                  )}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Update
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                Use <code>wontfix</code> for "not relevant", "not a real bug", or "duplicate" — clarify in the note.
                              </p>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AuthenticatedPageShell>
  );
}