import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CalendarSettings } from '@/hooks/useCalendarSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, X, ArrowRightLeft, Info, FileText, History, Video, List, CalendarDays, CalendarRange } from 'lucide-react';
import { format, parseISO, differenceInHours, isBefore, isAfter, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { toast } from 'sonner';

interface Booking {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  confirmed_at: string | null;
  student_notes: string | null;
  worksheet_id?: string | null;
  share_token?: string | null;
  notes?: string | null;
  meeting_link?: string | null;
  discount_percent?: number | null;
  reschedule_to?: { slot_date: string; start_time: string; end_time: string } | null;
  reschedule_from?: { slot_date: string; start_time: string; end_time: string } | null;
}

interface StudentBookingsSectionProps {
  settings: CalendarSettings;
  token: string;
  availableSlots: Array<{ id: string; slot_date: string; start_time: string; end_time: string }>;
  onBookingChanged: () => void;
  onRescheduleStart?: (bookingId: string) => void;
  rescheduleBookingId?: string | null;
  defaultEmail?: string;
}

type ViewMode = 'schedule' | 'month' | 'range';

const STATUS_FILTERS = [
  { key: 'completed', label: 'Completed' },
  { key: 'no_show', label: 'No Show' },
  { key: 'student_cancelled', label: 'Student Cancellation' },
  { key: 'teacher_cancelled', label: 'Teacher Cancellation' },
];

const STATUS_TOOLTIPS: Record<string, string> = {
  confirmed: 'Your lesson is confirmed and scheduled',
  pending: 'Waiting for teacher to confirm your booking',
  completed: 'This lesson has been completed',
  no_show: 'You were marked as absent for this lesson',
  needs_review: "Teacher hasn't reviewed this lesson yet",
  student_cancelled: 'You cancelled this lesson',
  teacher_cancelled: 'Teacher cancelled this lesson',
};

function formatLogAction(log: any): React.ReactNode {
  const action = log.action?.replace(/_/g, ' ');
  const d = log.details || {};
  const parts: React.ReactNode[] = [];
  parts.push(<span key="action" className="font-medium">{action}</span>);
  parts.push(<span key="actor" className="text-muted-foreground ml-1">by {log.actor}</span>);
  parts.push(<span key="time" className="text-muted-foreground ml-1">{format(new Date(log.created_at), 'MMM d HH:mm')}</span>);
  if (d.student_name) parts.push(<span key="sn" className="text-muted-foreground"> — {d.student_name}</span>);
  if (d.slot_date) parts.push(<span key="sd" className="text-muted-foreground"> — {d.slot_date}</span>);
  if (d.start_time) parts.push(<span key="st" className="text-muted-foreground"> at {String(d.start_time).slice(0, 5)}</span>);
  if (d.old_status) parts.push(<span key="os" className="text-muted-foreground"> ({d.old_status} → {d.new_status})</span>);
  if (d.previous_student) parts.push(<span key="ps" className="text-muted-foreground"> (was: {d.previous_student})</span>);
  if (d.previous_time) parts.push(<span key="pt" className="text-muted-foreground"> (was: {d.previous_time})</span>);
  if (d.previous_date) parts.push(<span key="pd" className="text-muted-foreground"> (was: {d.previous_date})</span>);
  if (d.student_email) parts.push(<span key="se" className="text-muted-foreground"> ({d.student_email})</span>);
  if (d.was_pending) parts.push(<span key="wp" className="text-muted-foreground"> (was pending)</span>);
  return <>{parts}</>;
}

export function StudentBookingsSection({ settings, token, availableSlots, onBookingChanged, onRescheduleStart, rescheduleBookingId, defaultEmail }: StudentBookingsSectionProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<Record<string, any[]>>({});
  const [showPast, setShowPast] = useState(true);
  const [showCancelled, setShowCancelled] = useState(false);
  const [cancelledBookings, setCancelledBookings] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('schedule');
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedMonthDay, setSelectedMonthDay] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  const email = defaultEmail || '';

  const fetchBookings = useCallback(async () => {
    if (!email.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-student-bookings', {
        body: { token, email: email.trim(), includePast: showPast },
      });
      if (error) throw error;
      setBookings(data?.bookings || []);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      toast.error('Could not fetch bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [email, token, showPast]);

  useEffect(() => {
    if (email.trim()) fetchBookings();
  }, [email, token, showPast]);

  // Realtime subscription + polling fallback for live updates
  useEffect(() => {
    if (!settings?.teacher_id || !email.trim()) return;
    const channel = supabase
      .channel(`student-bookings-${settings.teacher_id}-${email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_slots', filter: `teacher_id=eq.${settings.teacher_id}` },
        () => { fetchBookings(); }
      )
      .subscribe();
    const interval = setInterval(fetchBookings, 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [settings?.teacher_id, email, fetchBookings]);

  useEffect(() => {
    if (showCancelled && email.trim()) {
      supabase.functions.invoke('get-student-bookings', {
        body: { token, email: email.trim(), action: 'get_cancelled' },
      }).then(({ data }) => {
        setCancelledBookings(data?.cancelledBookings || []);
      }).catch(() => setCancelledBookings([]));
    }
  }, [showCancelled, email, token]);

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this lesson?')) return;
    try {
      const { error } = await supabase.functions.invoke('get-student-bookings', {
        body: { token, email: email.trim(), action: 'cancel', slotId: bookingId },
      });
      if (error) throw error;
      toast.success('Lesson cancelled');
      await fetchBookings();
      onBookingChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  };

  const handleRescheduleClick = (bookingId: string) => {
    if (onRescheduleStart) onRescheduleStart(bookingId);
  };

  const fetchLogs = async (slotId: string) => {
    try {
      const { data } = await supabase.functions.invoke('get-student-bookings', {
        body: { token, email: email.trim(), action: 'get_logs', slotId },
      });
      setHistoryLogs(prev => ({ ...prev, [slotId]: data?.logs || [] }));
    } catch (_) {}
  };

  const toggleHistory = (slotId: string) => {
    if (expandedHistory === slotId) {
      setExpandedHistory(null);
    } else {
      setExpandedHistory(slotId);
      if (!historyLogs[slotId]) fetchLogs(slotId);
    }
  };

  const canCancel = (booking: Booking) => {
    const isPending = booking.status === 'booked' && !booking.confirmed_at;
    if (isPending) return true;
    if (!settings.min_cancellation_hours) return true;
    const lessonTime = parseISO(`${booking.slot_date}T${booking.start_time}`);
    return differenceInHours(lessonTime, new Date()) >= settings.min_cancellation_hours;
  };

  // Filtered bookings based on status filter
  // Auto-enable showCancelled when cancellation filter is active
  useEffect(() => {
    if ((statusFilter === 'student_cancelled' || statusFilter === 'teacher_cancelled') && !showCancelled) {
      setShowCancelled(true);
    }
  }, [statusFilter, showCancelled]);

  const filteredBookings = useMemo(() => {
    let result = bookings;
    if (statusFilter) {
      if (statusFilter === 'completed') result = result.filter(b => b.status === 'completed');
      else if (statusFilter === 'no_show') result = result.filter(b => b.status === 'no_show');
      else if (statusFilter === 'student_cancelled' || statusFilter === 'teacher_cancelled') {
        result = []; // cancelled bookings come from cancelledBookings, not main bookings
      }
    }
    return result;
  }, [bookings, statusFilter]);

  // Filtered cancelled bookings
  const filteredCancelled = useMemo(() => {
    if (!statusFilter) return cancelledBookings;
    if (statusFilter === 'student_cancelled') return cancelledBookings.filter((cb: any) => cb.cancelled_by === 'student');
    if (statusFilter === 'teacher_cancelled') return cancelledBookings.filter((cb: any) => cb.cancelled_by === 'teacher');
    return [];
  }, [cancelledBookings, statusFilter]);

  // View-specific filtering
  const viewFilteredBookings = useMemo(() => {
    if (viewMode === 'month') {
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      return filteredBookings.filter(b => {
        const d = parseISO(b.slot_date);
        return !isBefore(d, start) && !isAfter(d, end);
      });
    }
    if (viewMode === 'range' && rangeFrom && rangeTo) {
      return filteredBookings.filter(b => b.slot_date >= rangeFrom && b.slot_date <= rangeTo);
    }
    return filteredBookings;
  }, [filteredBookings, viewMode, monthDate, rangeFrom, rangeTo]);

  // Merge cancelled into main list
  const allBookings = useMemo(() => {
    let result = [...viewFilteredBookings];
    if (showCancelled && filteredCancelled.length > 0) {
      const cancelledMapped = filteredCancelled.map((cb: any) => ({
        ...cb,
        status: cb.cancelled_by === 'student' ? 'student_cancelled' : 'teacher_cancelled',
        confirmed_at: null,
      }));
      result = [...result, ...cancelledMapped];
    }
    // Single descending sort — newest first
    result.sort((a: any, b: any) => 
      `${b.slot_date}${b.start_time}`.localeCompare(`${a.slot_date}${a.start_time}`)
    );
    return result;
  }, [viewFilteredBookings, showCancelled, filteredCancelled]);

  const listRef = React.useRef<HTMLDivElement>(null);

  const scrollToToday = useCallback(() => {
    if (!listRef.current) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const allDateEls = Array.from(listRef.current.querySelectorAll('[data-date]'));
    if (allDateEls.length === 0) return;
    // Descending: find first element with date <= today
    let targetIdx = -1;
    for (let i = 0; i < allDateEls.length; i++) {
      const d = allDateEls[i].getAttribute('data-date') || '';
      if (d <= todayStr) { targetIdx = i; break; }
    }
    if (targetIdx === -1) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      return;
    }
    const scrollIdx = Math.max(0, targetIdx - 1);
    const targetEl = allDateEls[scrollIdx] as HTMLElement;
    if (targetEl && listRef.current) {
      const containerTop = listRef.current.getBoundingClientRect().top;
      const elTop = targetEl.getBoundingClientRect().top;
      const offset = elTop - containerTop + listRef.current.scrollTop;
      listRef.current.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }, []);

  // Auto-scroll to today on initial load — only once
  const hasScrolledRef = React.useRef(false);
  useEffect(() => {
    if (allBookings.length > 0 && !loading && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      const timer = setTimeout(() => scrollToToday(), 150);
      return () => clearTimeout(timer);
    }
  }, [allBookings, loading]);

  if (!email || (bookings.length === 0 && !loading && !searched)) return null;

  const renderBookingCard = (booking: any) => {
    const isCancelled = booking.status === 'student_cancelled' || booking.status === 'teacher_cancelled';
    const isPending = booking.status === 'booked' && !booking.confirmed_at;
    const isActiveReschedule = rescheduleBookingId === booking.id;
    const isPast = isBefore(parseISO(`${booking.slot_date}T${booking.end_time}`), new Date());
    const canCancelResult = !isCancelled && canCancel(booking);

    return (
      <div key={booking.id} data-date={booking.slot_date} className={`border rounded-lg p-3 space-y-2 ${isCancelled ? 'opacity-60' : ''} ${isActiveReschedule ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{format(parseISO(booking.slot_date), 'EEE, MMM d, yyyy')}</span>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{booking.start_time.slice(0, 5)} – {booking.end_time.slice(0, 5)}</span>
            {booking.discount_percent != null && booking.discount_percent > 0 && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-red-50 text-red-600 border-red-200 font-bold">-{booking.discount_percent}%</Badge>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {booking.confirmed_at && !isPending && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-700" title={STATUS_TOOLTIPS.confirmed}>Confirmed</Badge>
            )}
            {isPending && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700" title={STATUS_TOOLTIPS.pending}>Pending</Badge>
            )}
            {booking.status === 'completed' && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700" title={STATUS_TOOLTIPS.completed}>✓ Completed</Badge>
            )}
            {booking.status === 'no_show' && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700" title={STATUS_TOOLTIPS.no_show}>NS No Show</Badge>
            )}
            {booking.status === 'student_cancelled' && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700" title={STATUS_TOOLTIPS.student_cancelled}>SC Cancelled</Badge>
            )}
            {booking.status === 'teacher_cancelled' && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700" title={STATUS_TOOLTIPS.teacher_cancelled}>TC Cancelled</Badge>
            )}
          </div>
        </div>

        {booking.notes && <p className="text-xs text-muted-foreground">{booking.notes}</p>}

        {booking.reschedule_to && (
          <div className="flex items-start gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded px-2 py-1">
            <ArrowRightLeft className="h-3 w-3 mt-0.5 shrink-0" />
            <span>You requested to reschedule this to {booking.reschedule_to.slot_date} {booking.reschedule_to.start_time.slice(0,5)}–{booking.reschedule_to.end_time.slice(0,5)}</span>
          </div>
        )}
        {booking.reschedule_from && (
          <div className="flex items-start gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 rounded px-2 py-1">
            <ArrowRightLeft className="h-3 w-3 mt-0.5 shrink-0" />
            <span>This is a reschedule from {booking.reschedule_from.slot_date} {booking.reschedule_from.start_time.slice(0,5)}–{booking.reschedule_from.end_time.slice(0,5)}</span>
          </div>
        )}

        <div className="flex gap-2 flex-wrap items-center">
          {canCancelResult && !isPast && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleCancel(booking.id)}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          )}
          {!canCancelResult && !isPast && booking.status === 'booked' && (
            <span className="text-xs text-muted-foreground">
              Cancellation window closed ({settings.min_cancellation_hours}h before lesson)
            </span>
          )}
          {!isPast && (
            <Button
              variant={isActiveReschedule ? 'default' : 'outline'}
              size="sm" className="text-xs h-7"
              onClick={() => handleRescheduleClick(booking.id)}
            >
              <ArrowRightLeft className="h-3 w-3 mr-1" /> Reschedule
            </Button>
          )}
          {booking.share_token && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => window.open(`/shared/${booking.share_token}`, '_blank')}>
              <FileText className="h-3 w-3 mr-1" /> Open Worksheet
            </Button>
          )}
          {booking.meeting_link && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => window.open(booking.meeting_link!, '_blank')}>
              <Video className="h-3 w-3 mr-1" /> Join Meeting
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => toggleHistory(booking.id)}>
            <History className="h-3 w-3 mr-1" /> History
          </Button>
        </div>

        {expandedHistory === booking.id && renderHistoryLogs(booking.id)}

        {isActiveReschedule && (
          <div className="border-t pt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>Click on an available slot in the calendar above to reschedule this lesson.</p>
          </div>
        )}
      </div>
    );
  };

  const renderHistoryLogs = (slotId: string) => (
    <div className="border-t pt-2 space-y-1">
      {!historyLogs[slotId] ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : historyLogs[slotId].length === 0 ? (
        <p className="text-xs text-muted-foreground">No history</p>
      ) : (
        historyLogs[slotId].map((log: any, i: number) => (
          <div key={i} className="text-xs border-l-2 border-border pl-2 py-0.5">
            {formatLogAction(log)}
          </div>
        ))
      )}
    </div>
  );

  const renderMonthView = () => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start, end });

    // Group bookings by date
    const bookingsByDate: Record<string, Booking[]> = {};
    viewFilteredBookings.forEach(b => {
      if (!bookingsByDate[b.slot_date]) bookingsByDate[b.slot_date] = [];
      bookingsByDate[b.slot_date].push(b);
    });

    const selectedDay = selectedMonthDay;
    const setSelectedDay = setSelectedMonthDay;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>←</Button>
          <span className="text-sm font-medium">{format(monthDate, 'MMMM yyyy')}</span>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>→</Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => <div key={d} className="font-medium text-muted-foreground">{d}</div>)}
          {/* Offset for first day */}
          {Array.from({ length: (start.getDay() + 6) % 7 }, (_, i) => <div key={`empty-${i}`} />)}
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const count = bookingsByDate[dateStr]?.length || 0;
            const isSelected = selectedDay === dateStr;
            return (
              <button
                key={dateStr}
                className={`py-1 rounded text-xs transition-colors ${count > 0 ? 'font-bold' : 'text-muted-foreground'} ${isSelected ? 'bg-primary text-primary-foreground' : count > 0 ? 'hover:bg-muted' : ''} ${isSameDay(day, new Date()) ? 'ring-1 ring-primary' : ''}`}
                onClick={() => count > 0 && setSelectedDay(isSelected ? null : dateStr)}
              >
                {format(day, 'd')}
                {count > 0 && <div className="w-1.5 h-1.5 rounded-full bg-primary mx-auto mt-0.5" />}
              </button>
            );
          })}
        </div>
        {selectedDay && bookingsByDate[selectedDay] && (
          <div className="space-y-2 border-t pt-2">
            <h4 className="text-xs font-medium">{format(parseISO(selectedDay), 'EEEE, MMM d')}</h4>
            {bookingsByDate[selectedDay].map(renderBookingCard)}
          </div>
        )}
      </div>
    );
  };

  const renderRangeView = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      {rangeFrom && rangeTo && viewFilteredBookings.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No lessons in this range.</p>
      )}
      <div className="space-y-2">
        {viewFilteredBookings.map(renderBookingCard)}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Your Lessons
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View mode switcher */}
            <div className="flex border rounded-md overflow-hidden">
              <button className={`px-2 py-1 text-xs flex items-center gap-1 ${viewMode === 'schedule' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} onClick={() => setViewMode('schedule')}>
                <List className="h-3.5 w-3.5" /> Schedule
              </button>
              <button className={`px-2 py-1 text-xs flex items-center gap-1 ${viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} onClick={() => setViewMode('month')}>
                <CalendarDays className="h-3.5 w-3.5" /> Month
              </button>
              <button className={`px-2 py-1 text-xs flex items-center gap-1 ${viewMode === 'range' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} onClick={() => setViewMode('range')}>
                <CalendarRange className="h-3.5 w-3.5" /> Date Range
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch checked={showPast} onCheckedChange={setShowPast} id="show-past" />
              <Label htmlFor="show-past" className="text-xs cursor-pointer">Show past</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch checked={showCancelled} onCheckedChange={setShowCancelled} id="show-cancelled" />
              <Label htmlFor="show-cancelled" className="text-xs cursor-pointer">Show cancelled</Label>
            </div>
          </div>
        </div>
        {/* Status filters */}
        <div className="flex gap-1 flex-wrap mt-2">
          {STATUS_FILTERS.map(f => (
            <Button key={f.key} variant={statusFilter === f.key ? 'default' : 'outline'} size="sm" className="text-xs h-6 px-2"
              onClick={() => setStatusFilter(statusFilter === f.key ? null : f.key)}>
              {f.label}
            </Button>
          ))}
          {statusFilter && (
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setStatusFilter(null)}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && allBookings.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Loading your lessons...</p>}

        {searched && allBookings.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">No lessons found.</p>
        )}

        {/* Main view */}
        {viewMode === 'schedule' && allBookings.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7 shrink-0 self-start" onClick={scrollToToday}>
              Today
            </Button>
            <div ref={listRef} className="space-y-2 max-h-[560px] overflow-y-auto flex-1 pr-1">
              {allBookings.map(renderBookingCard)}
            </div>
          </div>
        )}

        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'range' && renderRangeView()}
      </CardContent>
    </Card>
  );
}
