import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudentHubLayout } from '@/components/student-hub/StudentHubLayout';
import { useStudentHubData, getSavedHubEmail } from '@/hooks/useStudentHubData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowRight, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const StudentHubWorksheets = () => {
  const { teacherToken } = useParams<{ teacherToken: string }>();
  const navigate = useNavigate();
  const email = getSavedHubEmail();

  useEffect(() => { if (!email) navigate('/my'); }, [email, navigate]);

  const { data, loading } = useStudentHubData(teacherToken, email || undefined);

  if (!email) return null;

  const worksheets = data?.sharedWorksheets || [];

  return (
    <StudentHubLayout studentName={data?.studentName} teacherName={data?.teacherName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-5 w-5" /> Shared Worksheets</h1>
          <p className="text-sm text-muted-foreground mt-1">All worksheets shared with you</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : worksheets.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No worksheets shared yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {worksheets.map(ws => (
              <Card key={ws.id} className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => window.open(`/shared/${ws.share_token}`, '_blank')}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-sm">{ws.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ws.english_level && <Badge variant="outline" className="text-xs">{ws.english_level}</Badge>}
                      <span className="text-xs text-muted-foreground">{ws.exercises_count} exercises</span>
                      {ws.linked_slot_date && (
                        <Badge variant="secondary" className="text-xs">📅 Lesson: {format(parseISO(ws.linked_slot_date), 'MMM d')}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Created: {format(parseISO(ws.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StudentHubLayout>
  );
};

export default StudentHubWorksheets;
