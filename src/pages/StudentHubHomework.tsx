import React, { useEffect, useState } from 'react';
import { hubLandingPath } from '@/lib/studentHub/hubLandingPath';
import { useParams, useNavigate } from 'react-router-dom';
import { StudentHubLayout } from '@/components/student-hub/StudentHubLayout';
import { useStudentHubData, getSavedHubEmail } from '@/hooks/useStudentHubData';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ClipboardList, Loader2, RotateCw } from 'lucide-react';
import { useForceLightTheme } from '@/hooks/useForceLightTheme';
import { StudentHubHomeworkRow } from '@/components/student-hub/StudentHubHomeworkRow';
import { HomeworkFeedbackModal } from '@/components/student-hub/HomeworkFeedbackModal';
import { filterHubHomework, HOMEWORK_FILTERS, homeworkLifecycle, type HomeworkFilter } from '@/lib/studentHub/homeworkLifecycle';

const StudentHubHomework = () => {
  useForceLightTheme();
  const { teacherToken } = useParams<{ teacherToken: string }>();
  const navigate = useNavigate();
  const email = getSavedHubEmail();
  const [filter, setFilter] = useState<HomeworkFilter>('all');
  const [feedbackId, setFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    setFeedbackId(null);
    if (!email) navigate(hubLandingPath(teacherToken));
  }, [teacherToken, email, navigate]);

  const { data, loading, error, refetch } = useStudentHubData(teacherToken, email || undefined);

  if (!email) return null;

  const homeworks = data?.homeworks || [];
  const now = Date.now();
  const feedbackHomework = !loading && !error ? homeworks.find(hw => hw.id === feedbackId && homeworkLifecycle(hw, now).canReadFeedback) : undefined;
  const feedbackScope = data && teacherToken && feedbackHomework
    ? { teacherToken, email: data.studentEmail, homework: feedbackHomework } : null;

  return (
    <StudentHubLayout studentName={data?.studentName} teacherName={data?.teacherName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Homework</h1>
        </div>

        <Tabs value={filter} onValueChange={value => {
          if (HOMEWORK_FILTERS.some(item => item.value === value)) setFilter(value as HomeworkFilter);
        }}>
          <TabsList aria-label="Homework status" className="grid grid-cols-4 w-full sm:w-auto sm:inline-flex">
            {HOMEWORK_FILTERS.map(item => (
              <TabsTrigger key={item.value} value={item.value} className="text-xs px-2 sm:px-3">{item.label}</TabsTrigger>
            ))}
          </TabsList>
          {HOMEWORK_FILTERS.map(item => (
            <TabsContent key={item.value} value={item.value} className="mt-4">
              {loading ? (
                <div role="status" aria-label="Loading homework" className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : error || !data ? (
                <div role="alert" className="py-12 text-center space-y-3">
                  <p className="text-sm text-destructive">{error || 'Could not load homework.'}</p>
                  <Button variant="outline" onClick={refetch}><RotateCw /> Try again</Button>
                  <Button variant="ghost" onClick={() => navigate(hubLandingPath(teacherToken))}>Sign in again</Button>
                </div>
              ) : filterHubHomework(homeworks, item.value).length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">No homework found.</p>
              ) : (
                <div className="space-y-2">
                  {filterHubHomework(homeworks, item.value).map(hw => (
                    <StudentHubHomeworkRow key={hw.id} homework={hw} now={now} onFeedback={setFeedbackId} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
        <HomeworkFeedbackModal scope={feedbackScope} teacherName={data?.teacherName} onClose={() => setFeedbackId(null)} />
      </div>
    </StudentHubLayout>
  );
};

export default StudentHubHomework;
