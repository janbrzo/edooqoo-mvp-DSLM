import React, { useMemo } from 'react';
import { useCalendarSlots, CalendarSlot } from '@/hooks/useCalendarSlots';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, FileText, ExternalLink, TrendingUp } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface StudentCalendarTabProps {
  studentId: string;
  teacherId: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  booked: { label: 'Booked', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  no_show: { label: 'No Show', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  available: { label: 'Scheduled', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
};

export function StudentCalendarTab({ studentId, teacherId }: StudentCalendarTabProps) {
  const { slots, loading } = useCalendarSlots(teacherId, { studentId, skipAutoMarkNeedsReview: true });
  const navigate = useNavigate();

  const studentSlots = useMemo(() => {
    return [...slots].sort((a, b) => {
      const dateCompare = b.slot_date.localeCompare(a.slot_date);
      if (dateCompare !== 0) return dateCompare;
      return b.start_time.localeCompare(a.start_time);
    });
  }, [slots]);

  const upcoming = studentSlots.filter(s => !isPast(parseISO(s.slot_date)) && s.status !== 'cancelled' && s.status !== 'completed' && s.status !== 'no_show');
  const past = studentSlots.filter(s => isPast(parseISO(s.slot_date)) || s.status === 'completed' || s.status === 'cancelled' || s.status === 'no_show');

  // Attendance stats
  const attendanceStats = useMemo(() => {
    const completed = studentSlots.filter(s => s.status === 'completed').length;
    const noShow = studentSlots.filter(s => s.status === 'no_show').length;
    const cancelled = studentSlots.filter(s => s.status === 'cancelled').length;
    const total = completed + noShow;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, noShow, cancelled, total, rate };
  }, [studentSlots]);

  if (loading) {
    return <p className="text-muted-foreground text-center py-8">Loading calendar...</p>;
  }

  const renderSlot = (slot: CalendarSlot) => {
    const cfg = STATUS_CONFIG[slot.status] || STATUS_CONFIG.booked;
    return (
      <Card key={slot.id}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center min-w-[50px]">
              <p className="text-xs text-muted-foreground">{format(parseISO(slot.slot_date), 'EEE')}</p>
              <p className="text-lg font-bold">{format(parseISO(slot.slot_date), 'd')}</p>
              <p className="text-xs text-muted-foreground">{format(parseISO(slot.slot_date), 'MMM')}</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</span>
                <Badge className={cfg.className}>{cfg.label}</Badge>
              </div>
              {slot.title && <p className="text-sm text-muted-foreground mt-1">{slot.title}</p>}
              {slot.notes && <p className="text-xs text-muted-foreground mt-0.5">{slot.notes}</p>}
            </div>
          </div>
          {slot.worksheet_id && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/worksheet/${slot.worksheet_id}`)}>
              <FileText className="h-3 w-3 mr-1" /> Worksheet <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Lessons
        </h2>
        <Button variant="outline" size="sm" onClick={() => navigate('/calendar')}>
          Open Calendar
        </Button>
      </div>

      {/* Attendance Stats */}
      {attendanceStats.total > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Attendance</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-semibold text-lg text-primary">{attendanceStats.rate}%</span>
              <span className="text-muted-foreground">
                {attendanceStats.completed}/{attendanceStats.total} lessons attended
              </span>
              {attendanceStats.noShow > 0 && (
                <span className="text-destructive text-xs">({attendanceStats.noShow} no-shows)</span>
              )}
              {attendanceStats.cancelled > 0 && (
                <span className="text-muted-foreground text-xs">({attendanceStats.cancelled} cancelled)</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {studentSlots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No lessons scheduled for this student yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Upcoming ({upcoming.length})</h3>
              {upcoming.map(renderSlot)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Past ({past.length})</h3>
              {past.map(renderSlot)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
