import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { StudentHubLayout } from '@/components/student-hub/StudentHubLayout';
import { getSavedHubEmail } from '@/hooks/useStudentHubData';
import { usePublicBooking } from '@/hooks/usePublicBooking';
import { useCalendarVacations } from '@/hooks/useCalendarVacations';
import { StudentBookingsSection } from '@/components/calendar/StudentBookingsSection';
import { CalendarSlot } from '@/hooks/useCalendarSlots';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Calendar, Clock, AlertTriangle, Palmtree, Loader2 } from 'lucide-react';
import { format, addDays, parseISO, isToday, isBefore, addWeeks, isSameDay } from 'date-fns';
import { toStudentLocalTimeRange, getStudentTimeZone } from '@/utils/timezoneUtils';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const StudentHubLessons = () => {
  const { toast } = useToast();
  const { teacherToken } = useParams<{ teacherToken: string }>();
  const navigate = useNavigate();
  const email = getSavedHubEmail();

  useEffect(() => { if (!email) navigate('/my'); }, [email, navigate]);

  const { settings, slots, loading, error, weekStart, weekEnd, bookSlot, navigateWeek, getSlotsForDay, refetchSlots } = usePublicBooking(teacherToken);
  const { vacations } = useCalendarVacations(settings?.teacher_id);

  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookWeekly, setBookWeekly] = useState(false);
  const [untilDate, setUntilDate] = useState('');
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  const studentTz = useMemo(() => getStudentTimeZone(), []);
  const teacherTz = settings?.timezone || 'Europe/Warsaw';
  const showTzInfo = studentTz !== teacherTz;

  const formatSlotTime = useCallback((slot: { slot_date: string; start_time: string; end_time: string }) => {
    if (!showTzInfo) return { primary: `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`, secondary: null };
    const conv = toStudentLocalTimeRange(slot.slot_date, slot.start_time, slot.end_time, teacherTz, studentTz);
    return { primary: `${conv.studentStartHHMM}–${conv.studentEndHHMM}`, secondary: `Teacher: ${conv.teacherStartHHMM}–${conv.teacherEndHHMM}` };
  }, [showTzInfo, teacherTz, studentTz]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const recurringCount = useMemo(() => {
    if (!bookWeekly || !untilDate || !selectedSlot) return 0;
    let d = addWeeks(parseISO(selectedSlot.slot_date), 1);
    const end = parseISO(untilDate);
    let count = 1;
    while (!isBefore(end, d)) { count++; d = addWeeks(d, 1); }
    return count;
  }, [bookWeekly, untilDate, selectedSlot]);

  const handleSlotClick = (slot: CalendarSlot) => {
    if (rescheduling) return;
    if (rescheduleBookingId) {
      handleReschedule(rescheduleBookingId, slot.id);
      return;
    }
    setSelectedSlot(slot);
  };

  const handleReschedule = async (oldSlotId: string, newSlotId: string) => {
    if (!email || !teacherToken) return;
    setRescheduling(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-student-bookings', {
        body: {
          token: teacherToken,
          email: email.trim(),
          action: 'reschedule',
          slotId: oldSlotId,
          newSlotId,
        },
      });
      if (error) throw error;
      if (data?.autoRescheduled) {
        toast({ title: 'Lesson rescheduled successfully' });
      } else if (data?.success) {
        toast({ title: 'Reschedule request sent — awaiting teacher confirmation' });
      } else {
        toast({ title: data?.error || 'Could not reschedule', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Reschedule failed', description: err.message, variant: 'destructive' });
    }
    setRescheduleBookingId(null);
    setRescheduling(false);
    refetchSlots();
  };

  const handleBook = async () => {
    if (!selectedSlot || !email || !settings) return;
    setBooking(true);
    const name = email.split('@')[0];

    if (bookWeekly && untilDate) {
      const allSlotIds: string[] = [selectedSlot.id];
      let d = addWeeks(parseISO(selectedSlot.slot_date), 1);
      const end = parseISO(untilDate);
      while (!isBefore(end, d)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        const { data: daySlots } = await supabase
          .from('calendar_slots')
          .select('id, start_time')
          .eq('teacher_id', settings.teacher_id)
          .eq('slot_date', dateStr)
          .eq('status', 'available')
          .is('student_id', null);
        const match = (daySlots || []).find(s => s.start_time.slice(0, 5) === selectedSlot.start_time.slice(0, 5));
        if (match) allSlotIds.push(match.id);
        d = addWeeks(d, 1);
      }

      if (allSlotIds.length > 1) {
        try {
          const { data, error } = await supabase.functions.invoke('get-student-bookings', {
            body: {
              token: teacherToken,
              email: email.trim(),
              action: 'book_batch',
              slotIds: allSlotIds,
              studentName: name,
            },
          });
          if (error) throw error;
          const booked = data?.booked || 0;
          const failed = data?.failed || 0;
          if (booked > 0) {
            toast({ title: `Booked ${booked} lesson${booked > 1 ? 's' : ''}${failed > 0 ? ` (${failed} unavailable)` : ''}` });
          } else {
            toast({ title: 'No slots could be booked', variant: 'destructive' });
          }
        } catch (err: any) {
          toast({ title: 'Booking failed', description: err.message, variant: 'destructive' });
        }
      } else {
        await bookSlot(selectedSlot.id, name, email);
      }
    } else {
      await bookSlot(selectedSlot.id, name, email);
    }

    setBooking(false);
    setSelectedSlot(null);
    setBookWeekly(false);
    setUntilDate('');
    refetchSlots();
  };

  if (!email || !teacherToken) return null;

  if (loading) {
    return (
      <StudentHubLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </StudentHubLayout>
    );
  }

  if (error) {
    return (
      <StudentHubLayout>
        <div className="text-center py-20 text-destructive">{error}</div>
      </StudentHubLayout>
    );
  }

  const availableSlots = slots.filter(s => s.status === 'available' && !s.student_id);

  return (
    <StudentHubLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="h-5 w-5" /> Lessons & Booking</h1>
          <p className="text-sm text-muted-foreground mt-1">Book new lessons and view your upcoming schedule</p>
          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
              <span>Pending</span>
            </div>
          </div>
        </div>

        {/* Your Classroom — universal meeting link */}
        {settings && (settings as any).default_meeting_link && (
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Your Classroom</p>
                  <p className="text-xs text-muted-foreground">Join your teacher's virtual meeting room</p>
                </div>
              </div>
              <Button size="sm" onClick={() => window.open((settings as any).default_meeting_link, '_blank')}>
                Join Lesson
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Reschedule banner */}
        {rescheduleBookingId && (
          <div className="bg-primary/10 border border-primary/30 rounded-md p-2 flex items-center justify-between text-sm">
            {rescheduling ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing reschedule...</span>
            ) : (
              <span>Select a new time slot to reschedule your lesson</span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setRescheduleBookingId(null)} disabled={rescheduling}>Cancel</Button>
          </div>
        )}

        {/* Available Slots Grid */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={() => navigateWeek('prev')}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="font-medium text-sm">{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => navigateWeek('today')}>Today</Button>
                <Button variant="ghost" size="sm" onClick={() => navigateWeek('next')}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const daySlots = getSlotsForDay(day).filter(s => s.status === 'available' && !s.student_id);
                const isVacation = vacations.some(v => !isBefore(day, parseISO(v.start_date)) && !isBefore(parseISO(v.end_date), day));
                const isPast = isBefore(day, new Date()) && !isToday(day);

                return (
                  <div key={dateStr} className={cn('min-h-[80px] border rounded-md p-1', isToday(day) && 'border-primary', isPast && 'opacity-40')}>
                    <div className="text-xs font-medium text-center mb-1">
                      <span className="text-muted-foreground">{format(day, 'EEE')}</span>
                      <br />
                      <span className={isToday(day) ? 'text-primary font-bold' : ''}>{format(day, 'd')}</span>
                    </div>
                    {isVacation ? (
                      <div className="text-xs text-center text-muted-foreground flex items-center justify-center gap-0.5"><Palmtree className="h-3 w-3" /></div>
                    ) : (
                      <div className="space-y-0.5">
                        {daySlots.map(slot => {
                          const time = formatSlotTime(slot);
                          return (
                            <button key={slot.id} className={cn("w-full text-xs rounded px-1 py-0.5 text-center transition-colors relative", rescheduleBookingId ? "bg-blue-100 hover:bg-blue-200 text-blue-800 ring-1 ring-blue-300" : "bg-green-100 hover:bg-green-200 text-green-800")} onClick={() => !isPast && handleSlotClick(slot)} disabled={isPast}>
                              {time.primary}
                              {(slot as any).discount_percent > 0 && (
                                <span className="absolute -top-1 -right-1 text-[9px] font-bold text-red-600 bg-red-50 rounded px-0.5">-{(slot as any).discount_percent}%</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {availableSlots.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-4">No available slots this week. Try navigating to another week.</p>
            )}
          </CardContent>
        </Card>

        {/* Your Bookings */}
        {settings && (
          <StudentBookingsSection
            settings={settings as any}
            token={teacherToken}
            availableSlots={availableSlots}
            onBookingChanged={() => refetchSlots()}
            defaultEmail={email}
            onRescheduleStart={(bookingId) => setRescheduleBookingId(bookingId)}
            rescheduleBookingId={rescheduleBookingId}
          />
        )}
      </div>

      {/* Booking Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={open => { if (!open) setSelectedSlot(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book this lesson?</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 space-y-1 text-sm">
                <p><strong>Date:</strong> {format(parseISO(selectedSlot.slot_date), 'EEEE, MMMM d, yyyy')}</p>
                <p><strong>Time:</strong> {formatSlotTime(selectedSlot).primary}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={bookWeekly} onCheckedChange={setBookWeekly} />
                <Label className="text-sm">Book weekly (recurring)</Label>
              </div>
              {bookWeekly && (
                <div>
                  <Label className="text-xs">Until date</Label>
                  <Input type="date" value={untilDate} onChange={e => setUntilDate(e.target.value)} className="h-9" />
                  {recurringCount > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">This will book up to {recurringCount} lessons (weekly)</p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSlot(null)}>Cancel</Button>
            <Button onClick={handleBook} disabled={booking}>{booking ? 'Booking...' : 'Confirm Booking'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudentHubLayout>
  );
};

export default StudentHubLessons;
