import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface HomeworkStats {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
}

export function HomeworkOverviewWidget() {
  const [stats, setStats] = useState<HomeworkStats>({
    total: 0,
    pending: 0,
    completed: 0,
    overdue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('homework_assignments')
        .select('id, deadline, completed_at')
        .eq('teacher_id', user.id);

      if (error) throw error;

      const now = new Date();
      const total = data?.length || 0;
      const completed = data?.filter(h => h.completed_at).length || 0;
      const pending = total - completed;
      const overdue = data?.filter(h => 
        !h.completed_at && h.deadline && new Date(h.deadline) < now
      ).length || 0;

      setStats({ total, pending, completed, overdue });
    } catch (error) {
      console.error('Error fetching homework stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Homework Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Homework Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
          
          {stats.overdue > 0 && (
            <div className="flex items-center gap-2 col-span-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
