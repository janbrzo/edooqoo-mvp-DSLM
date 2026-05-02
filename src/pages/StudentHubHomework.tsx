import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudentHubLayout } from '@/components/student-hub/StudentHubLayout';
import { useStudentHubData, getSavedHubEmail } from '@/hooks/useStudentHubData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, ArrowRight, Loader2 } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';

type Filter = 'all' | 'pending' | 'completed' | 'overdue';

const StudentHubHomework = () => {
  const { teacherToken } = useParams<{ teacherToken: string }>();
  const navigate = useNavigate();
  const email = getSavedHubEmail();
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => { if (!email) navigate('/my'); }, [email, navigate]);

  const { data, loading } = useStudentHubData(teacherToken, email || undefined);

  if (!email) return null;

  const homeworks = data?.homeworks || [];
  const filtered = homeworks.filter(hw => {
    if (filter === 'pending') return !hw.completed_at;
    if (filter === 'completed') return !!hw.completed_at;
    if (filter === 'overdue') return !hw.completed_at && hw.deadline && isPast(parseISO(hw.deadline));
    return true;
  });

  return (
    <StudentHubLayout studentName={data?.studentName} teacherName={data?.teacherName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Homework</h1>
          <p className="text-sm text-muted-foreground mt-1">All your homework assignments</p>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'pending', 'completed', 'overdue'] as Filter[]).map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" className="text-xs h-7 capitalize"
              onClick={() => setFilter(f)}>
              {f}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No homework found.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(hw => {
              const isOverdue = !hw.completed_at && hw.deadline && isPast(parseISO(hw.deadline));
              return (
                <Card key={hw.id} className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => window.open(`/homework/${hw.share_token}`, '_blank')}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-sm">{hw.title}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {hw.source_worksheet_title && (
                          <span className="text-xs text-muted-foreground">From: {hw.source_worksheet_title}</span>
                        )}
                        {hw.deadline && (
                          <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            Due: {format(parseISO(hw.deadline), 'MMM d, yyyy')}
                          </span>
                        )}
                        <Badge variant={hw.completed_at ? 'default' : 'secondary'} className="text-xs">
                          {hw.completed_at ? '✓ Completed' : `${hw.completed_exercises_count}/${hw.exercises_count} done`}
                        </Badge>
                        {hw.reviewed_at && <Badge variant="outline" className="text-xs">📝 Reviewed</Badge>}
                        {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Assigned: {format(parseISO(hw.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </StudentHubLayout>
  );
};

export default StudentHubHomework;
