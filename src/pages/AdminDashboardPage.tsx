/**
 * AdminDashboardPage - Admin panel for viewing teachers and impersonating them
 * Only accessible by users with 'admin' role in user_roles
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageLoadingState } from '@/components/ui/PageLoadingState';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { ShieldAlert, Users, Search, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TeacherProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  subscription_type: string | null;
  subscription_status: string | null;
  available_tokens: number;
  total_worksheets_created: number | null;
  created_at: string;
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuthFlow();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Check admin role
  useEffect(() => {
    if (!user) return;
    
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
      
      setIsAdmin(!!data);
      if (!data) {
        navigate('/dashboard');
        return;
      }
      
      // Load teachers
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, subscription_type, subscription_status, available_tokens, total_worksheets_created, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      setTeachers((profiles as TeacherProfile[]) || []);
      setIsLoading(false);
    };
    
    checkAdmin();
  }, [user, navigate]);

  const handleImpersonate = async (teacherId: string) => {
    setImpersonatingId(teacherId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-impersonate', {
        body: { target_teacher_id: teacherId },
      });

      if (error) throw error;
      if (!data?.impersonation_url) throw new Error('No URL returned');

      // Open in new tab (incognito recommended)
      window.open(data.impersonation_url, '_blank');
      
      toast({
        title: `Impersonation link opened`,
        description: `Viewing as ${data.teacher_email}. Open in incognito for best results.`,
      });
    } catch (err: any) {
      toast({
        title: 'Impersonation failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setImpersonatingId(null);
    }
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const anonCount = teachers.filter(t => !t.email).length;

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-anonymous-users');
      if (error) throw error;
      toast({ title: `Cleaned up ${data?.deleted_count || 0} anonymous accounts` });
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, subscription_type, subscription_status, available_tokens, total_worksheets_created, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      setTeachers((profiles as TeacherProfile[]) || []);
    } catch (err: any) {
      toast({ title: 'Cleanup failed', description: err.message, variant: 'destructive' });
    } finally { setIsCleaningUp(false); }
  };

  const filteredTeachers = teachers.filter(t => {
    if (!t.email) return false; // Hide anonymous accounts
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.email?.toLowerCase().includes(q) ||
      t.first_name?.toLowerCase().includes(q) ||
      t.last_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-red-500" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Badge variant="destructive">Admin Only</Badge>
        <div className="ml-auto">
          <Link to="/admin/error-logs">
            <Button variant="outline" size="sm">Error Logs &amp; Bug Reports</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Teachers</div>
            <div className="text-2xl font-bold">{teachers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">With Subscription</div>
            <div className="text-2xl font-bold">
              {teachers.filter(t => t.subscription_status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Worksheets</div>
            <div className="text-2xl font-bold">
              {teachers.reduce((sum, t) => sum + (t.total_worksheets_created || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Tokens</div>
            <div className="text-2xl font-bold">
              {teachers.reduce((sum, t) => sum + t.available_tokens, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cleanup anonymous accounts */}
      {anonCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-amber-800">{anonCount} anonymous accounts (no email)</div>
              <div className="text-xs text-amber-600">Legacy ghost accounts. Safe to remove.</div>
            </div>
            <Button variant="outline" size="sm" onClick={handleCleanup} disabled={isCleaningUp}
              className="border-amber-400 text-amber-700 hover:bg-amber-100">
              {isCleaningUp ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Clean up
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Teachers list */}
      <div className="space-y-2">
        {isLoading ? (
          <PageLoadingState label="Loading teachers" cards={3} inline />
        ) : filteredTeachers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No teachers found</div>
        ) : (
          filteredTeachers.map(teacher => (
            <Card key={teacher.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {teacher.first_name || teacher.last_name 
                        ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim()
                        : 'No name'}
                    </span>
                    {teacher.subscription_type && (
                      <Badge variant="secondary" className="text-xs">
                        {teacher.subscription_type}
                      </Badge>
                    )}
                    {teacher.subscription_status === 'active' && (
                      <Badge className="bg-green-500 text-white text-xs">Active</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{teacher.email}</div>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span>Tokens: {teacher.available_tokens}</span>
                    <span>Worksheets: {teacher.total_worksheets_created || 0}</span>
                    <span>Joined: {new Date(teacher.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImpersonate(teacher.id)}
                  disabled={impersonatingId === teacher.id}
                  className="gap-1.5 shrink-0"
                >
                  {impersonatingId === teacher.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  Login as...
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
