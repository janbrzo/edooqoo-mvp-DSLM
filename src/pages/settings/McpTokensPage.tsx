import React, { useEffect, useState } from 'react';
import { AuthenticatedPageShell } from '@/components/AuthenticatedPageShell';
import StickyNav from '@/components/landing/StickyNav';
import { useNavigate } from 'react-router-dom';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useTokenSystem } from '@/hooks/useTokenSystem';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Copy, Plus, Trash2, KeyRound, ArrowLeft, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

interface McpTokenRow {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

const MCP_ENDPOINT = `https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/mcp`;

const McpTokensPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isRegisteredUser } = useAuthFlow();
  const { tokenLeft } = useTokenSystem(user?.id);
  const [tokens, setTokens] = useState<McpTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isRegisteredUser)) navigate('/login');
  }, [authLoading, user, isRegisteredUser, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mcp_tokens')
      .select('id,name,token_prefix,created_at,last_used_at,expires_at,revoked_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    if (error) toast.error(`Failed to load tokens: ${error.message}`);
    setTokens((data as McpTokenRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user && isRegisteredUser) load(); }, [user, isRegisteredUser]);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Give the token a name'); return; }
    setCreating(true);
    const { data, error } = await supabase.rpc('create_mcp_token', { _name: newName.trim() });
    setCreating(false);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.token) { toast.error('Server did not return a token'); return; }
    setFreshToken(row.token as string);
    setNewName('');
    setCreateOpen(false);
    await load();
  };

  const handleRevoke = async (id: string) => {
    const { error } = await supabase.rpc('revoke_mcp_token', { _id: id });
    if (error) { toast.error(`Failed to revoke: ${error.message}`); return; }
    toast.success('Token revoked');
    await load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <AuthenticatedPageShell>
      <StickyNav user={user} isRegisteredUser={!!isRegisteredUser} tokenLeft={tokenLeft} />
      <div className="container mx-auto max-w-4xl px-4 pt-24 pb-16">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="mb-6 flex items-center gap-3">
          <KeyRound className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Agent integrations (MCP)</h1>
            <p className="text-sm text-muted-foreground">
              Personal tokens let AI assistants (Claude, ChatGPT, Cursor, Codex) access your Edooqoo data through the Model Context Protocol.
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> How to connect
            </CardTitle>
            <CardDescription>Read-only access scoped to your account. Revoke any time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="mb-1 text-muted-foreground">MCP endpoint</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs">{MCP_ENDPOINT}</code>
                <Button size="sm" variant="outline" onClick={() => copy(MCP_ENDPOINT)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Generate a Personal MCP Token below (shown only once — copy immediately).</li>
              <li>In your AI client (e.g. Claude Desktop), add an MCP server with URL <code>{MCP_ENDPOINT}</code> and header <code>Authorization: Bearer &lt;your token&gt;</code>.</li>
              <li>The assistant will see tools: <code>list_students</code>, <code>get_student_summary</code>, <code>list_recent_worksheets</code> (plus public catalog tools).</li>
            </ol>
          </CardContent>
        </Card>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your tokens</h2>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Generate token</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Personal MCP Token</DialogTitle>
                <DialogDescription>Give the token a memorable name (e.g. "Claude Desktop").</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="mcp-token-name">Token name</Label>
                <Input id="mcp-token-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Claude Desktop" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating}>{creating ? 'Generating…' : 'Generate'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : tokens.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No tokens yet. Generate one to connect an AI assistant.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <Card key={t.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant="outline" className="font-mono text-xs">{t.token_prefix}…</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Created {format(new Date(t.created_at), 'PP')}
                      {t.last_used_at ? ` · Last used ${format(new Date(t.last_used_at), 'PP')}` : ' · Never used'}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
                        <AlertDialogDescription>
                          AI assistants using this token will lose access immediately. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRevoke(t.id)}>Revoke</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!freshToken} onOpenChange={(o) => { if (!o) setFreshToken(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copy your token now</DialogTitle>
              <DialogDescription>
                This is the only time you will see this token. Store it in your AI client's MCP settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <code className="block break-all rounded bg-muted p-3 text-xs">{freshToken}</code>
              <Button size="sm" variant="outline" onClick={() => freshToken && copy(freshToken)}>
                <Copy className="mr-2 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setFreshToken(null)}>I've saved it</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedPageShell>
  );
};

export default McpTokensPage;