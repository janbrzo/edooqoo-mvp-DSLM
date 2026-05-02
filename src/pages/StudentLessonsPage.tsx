import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, FileText, ExternalLink } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';

interface LessonSlot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  title: string | null;
  notes: string | null;
  worksheet_id: string | null;
  is_paid: boolean;
  confirmed_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  available: { label: 'Scheduled', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  booked: { label: 'Booked', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  no_show: { label: 'Missed', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
};

const StudentLessonsPage = () => {
  const { token } = useParams<{ token: string }>();
  const [lessons, setLessons] = useState<LessonSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchLessons = async () => {
      try {
        // Token is student_id for now (simplified approach)
        const { data, error: err } = await supabase
          .from('calendar_slots')
          .select('id, slot_date, start_time, end_time, status, title, notes, worksheet_id, is_paid, confirmed_at')
          .eq('student_id', token)
          .neq('status', 'available')
          .order('slot_date', { ascending: false })
          .order('start_time', { ascending: false });

        if (err) throw err;
        setLessons((data || []) as LessonSlot[]);
      } catch (err) {
        setError('Could not load lessons.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Loading lessons...</p></div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-destructive">{error}</p></div>;
  }

  const upcoming = lessons.filter(l => !isPast(parseISO(l.slot_date)) && l.status !== 'cancelled' && l.status !== 'completed' && l.status !== 'no_show');
  const past = lessons.filter(l => isPast(parseISO(l.slot_date)) || l.status === 'completed' || l.status === 'cancelled' || l.status === 'no_show');

  const renderLesson = (lesson: LessonSlot) => {
    const cfg = STATUS_CONFIG[lesson.status] || STATUS_CONFIG.booked;
    return (
      <Card key={lesson.id} className="hover:shadow-sm transition-shadow">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center min-w-[60px]">
              <p className="text-xs text-muted-foreground">{format(parseISO(lesson.slot_date), 'EEE')}</p>
              <p className="text-lg font-bold">{format(parseISO(lesson.slot_date), 'd')}</p>
              <p className="text-xs text-muted-foreground">{format(parseISO(lesson.slot_date), 'MMM')}</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{lesson.start_time.slice(0, 5)} – {lesson.end_time.slice(0, 5)}</span>
                <Badge className={cfg.className}>{cfg.label}</Badge>
              </div>
              {lesson.title && <p className="text-sm text-muted-foreground mt-1">{lesson.title}</p>}
              {lesson.notes && <p className="text-xs text-muted-foreground mt-0.5">{lesson.notes}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lesson.worksheet_id && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/worksheet/${lesson.worksheet_id}`} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3 w-3 mr-1" /> Worksheet <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <Calendar className="h-8 w-8 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">My Lessons</h1>
        </div>

        {upcoming.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Upcoming</h2>
            {upcoming.map(renderLesson)}
          </div>
        )}

        {past.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-muted-foreground">Past Lessons</h2>
            {past.map(renderLesson)}
          </div>
        )}

        {lessons.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No lessons found.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StudentLessonsPage;
