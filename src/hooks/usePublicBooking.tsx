import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CalendarSlot } from '@/hooks/useCalendarSlots';
import { CalendarSettings } from '@/hooks/useCalendarSettings';
import { startOfWeek, endOfWeek, addDays, format } from 'date-fns';

export function usePublicBooking(token?: string) {
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { toast } = useToast();
  const fetchingRef = useRef(false);
  const pendingRefetch = useRef(false);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      // Token-scoped lookup (hub_token, public_calendar_token or public slug).
      // RLS-safe: the RPC only returns a row for an exact token match.
      const { data: rows, error: err } = await supabase
        .rpc('get_public_calendar_settings', { p_token: token });
      const data = rows?.[0] ?? null;

      if (err) throw err;
      if (data && !data.public_calendar_enabled && data.hub_token === token) {
        setError('Your teacher has not enabled their public calendar yet. Please ask them to turn it on in Calendar Settings.');
        setLoading(false);
        return;
      }
      if (!data) { setError('Calendar not found or not public.'); setLoading(false); return; }
      setSettings(data as unknown as CalendarSettings);
    } catch (err) { setError('Failed to load calendar.'); console.error(err); }
  }, [token]);

  const fetchSlots = useCallback(async () => {
    if (!settings) return;
    if (fetchingRef.current) { pendingRefetch.current = true; return; }
    fetchingRef.current = true;
    try {
      const from = format(weekStart, 'yyyy-MM-dd');
      const to = format(weekEnd, 'yyyy-MM-dd');

      const { data, error: err } = await supabase
        .from('calendar_slots')
        .select('*')
        .eq('teacher_id', settings.teacher_id)
        .neq('slot_type', 'block')
        .gte('slot_date', from)
        .lte('slot_date', to)
        .or('status.eq.available,and(status.eq.booked,confirmed_at.is.null)')
        .order('slot_date')
        .order('start_time');

      if (err) throw err;
      setSlots((data || []) as unknown as CalendarSlot[]);
    } catch (err) { console.error('Error fetching public slots:', err); }
    finally {
      setLoading(false);
      fetchingRef.current = false;
      if (pendingRefetch.current) {
        pendingRefetch.current = false;
        fetchSlots();
      }
    }
  }, [settings, weekStart, weekEnd]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { if (settings) fetchSlots(); }, [settings, fetchSlots]);

  // Supabase Realtime for instant updates
  useEffect(() => {
    if (!settings) return;
    const channel = supabase
      .channel(`public-slots-${settings.teacher_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_slots', filter: `teacher_id=eq.${settings.teacher_id}` },
        () => { fetchSlots(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [settings, fetchSlots]);

  // Polling fallback every 3s
  useEffect(() => {
    if (!settings) return;
    const interval = setInterval(() => { fetchSlots(); }, 2000);
    return () => clearInterval(interval);
  }, [settings, fetchSlots]);

  const bookSlot = useCallback(async (slotId: string, studentName: string, studentEmail: string) => {
    if (!settings) return false;
    try {
      const { data: check } = await supabase
        .from('calendar_slots').select('status, slot_type').eq('id', slotId).single();
      if (!check || check.status !== 'available' || check.slot_type === 'block') {
        toast({ title: 'Slot no longer available', description: 'Please select another time.', variant: 'destructive', duration: 6000 });
        await fetchSlots();
        return false;
      }

      const normalizedEmail = studentEmail.toLowerCase().trim();

      // v6.9.87 — anonymous visitors can no longer update calendar_slots directly.
      // A single SECURITY DEFINER RPC validates the public calendar, locks the slot,
      // resolves an existing student by email and performs the booking atomically.
      const { data: bookingResult, error: err } = await supabase
        .rpc('book_public_slot', {
          p_slot_id: slotId,
          p_student_name: studentName,
          p_student_email: normalizedEmail,
        } as any);

      if (err) throw err;

      const booking = (bookingResult || {}) as Record<string, any>;
      if (!booking.success) {
        toast({ title: 'Slot no longer available', description: 'Please select another time.', variant: 'destructive', duration: 6000 });
        await fetchSlots();
        return false;
      }

      const existingStudent = booking.student_existed
        ? { id: booking.student_id as string, name: booking.student_name as string }
        : null;
      const resolvedName: string = booking.student_name || studentName;
      const autoConfirm: boolean = booking.auto_confirm === true;

      const slot = (slots.find(s => s.id === slotId) || {
        id: slotId,
        slot_date: booking.slot_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        worksheet_id: booking.worksheet_id,
        meeting_link: booking.meeting_link,
      }) as any;

      // Notification for teacher — new vs existing student
      if (!existingStudent) {
        try {
          // v6.9.86 — anonymous visitors insert notifications only through a
          // validated SECURITY DEFINER RPC (teacher must have public booking on).
          await supabase.rpc('insert_public_booking_notification', {
            p_teacher_id: settings.teacher_id,
            p_notification_type: 'new_student',
            p_message: `New student signed up: ${studentName} (${normalizedEmail})`,
            p_student_name: studentName,
            p_slot_id: slotId,
            p_metadata: {
              student_email: normalizedEmail,
              student_name_raw: studentName,
              slot_date: slot?.slot_date,
              start_time: slot?.start_time?.slice(0, 5),
              end_time: slot?.end_time?.slice(0, 5),
            },
          } as any);
        } catch (e) { console.error(e); }
      }

      // Booking notification — Problem 8A: updated message format
      try {
        const messageText = autoConfirm
          ? `${resolvedName} booked a lesson ${slot?.slot_date} at ${slot?.start_time?.slice(0,5)}–${slot?.end_time?.slice(0,5)} (auto-confirmed)`
          : `${resolvedName} requested a lesson ${slot?.slot_date} at ${slot?.start_time?.slice(0,5)}–${slot?.end_time?.slice(0,5)} — awaiting confirmation`;
        await supabase.rpc('insert_public_booking_notification', {
          p_teacher_id: settings.teacher_id,
          p_notification_type: autoConfirm ? 'booking_confirmed' : 'booking_pending',
          p_message: messageText,
          p_student_name: resolvedName,
          p_slot_id: slotId,
          p_metadata: {
            student_email: normalizedEmail,
            slot_date: slot?.slot_date,
            start_time: slot?.start_time?.slice(0, 5),
            end_time: slot?.end_time?.slice(0, 5),
          },
        } as any);
      } catch (e) { console.error(e); }

      // Send email notifications
      if (slot && settings.notify_email_on_booking) {
        const slotDate = slot.slot_date;
        const slotTime = slot.start_time.slice(0, 5);
        // v6.9.84 — anonymous visitors can no longer read `profiles` directly.
        // Token-scoped RPC exposes only teachers with a public booking page.
        const { data: contactRows } = await supabase.rpc('get_public_teacher_contact', {
          p_teacher_id: settings.teacher_id,
        });
        const teacherProfile = Array.isArray(contactRows) ? contactRows[0] : (contactRows as any);
        const teacherName = [teacherProfile?.first_name, teacherProfile?.last_name].filter(Boolean).join(' ') || 'Your Teacher';
        const teacherEmail = teacherProfile?.email || '';
        // Settings already came from the token-scoped RPC — no extra read needed.
        const hubToken = (settings as any).hub_token || settings.public_calendar_token;
        const bookUrl = `${window.location.origin}/my/${hubToken}/lessons`;
        const calendarUrl = `${window.location.origin}/calendar`;

        // Get worksheet shared link if available
        let worksheetUrl: string | undefined;
        let sharedWorksheetUrl: string | undefined;
        if (slot.worksheet_id) {
          worksheetUrl = `${window.location.origin}/worksheet/${slot.worksheet_id}`;
          const { data: ws } = await supabase.from('worksheets').select('share_token').eq('id', slot.worksheet_id).maybeSingle();
          if (ws?.share_token) {
            sharedWorksheetUrl = `${window.location.origin}/shared/${ws.share_token}`;
          }
        }

        // Get per-student meeting link (priority: per-student > slot > global settings)
        let meetingLink: string | undefined;
        if (existingStudent) {
          const { data: studentMeetingLink } = await supabase
            .rpc('get_student_meeting_link', {
              p_teacher_id: settings.teacher_id,
              p_student_id: existingStudent.id,
            });
          meetingLink = studentMeetingLink || (slot as any).meeting_link || (settings as any).default_meeting_link || undefined;
        } else {
          meetingLink = (slot as any).meeting_link || (settings as any).default_meeting_link || undefined;
        }
        
        supabase.functions.invoke('send-calendar-notification-email', {
          body: {
            type: autoConfirm ? 'booking_confirmation' : 'booking_pending',
            studentEmail: normalizedEmail, studentName: resolvedName, slotDate, slotTime,
            teacherName, teacherEmail, bookUrl, calendarUrl,
            worksheetUrl, sharedWorksheetUrl, meetingLink,
          },
        }).catch(console.error);

        if (teacherEmail) {
          supabase.functions.invoke('send-calendar-notification-email', {
            body: {
              type: 'new_booking_teacher',
              teacherEmail, studentEmail: normalizedEmail,
              studentName: resolvedName, slotDate, slotTime,
              teacherName, bookUrl, calendarUrl,
              worksheetUrl,
            },
          }).catch(console.error);
        }
      }

      toast({
        title: autoConfirm ? 'Lesson booked!' : 'Booking request sent!',
        description: autoConfirm ? 'Your lesson is confirmed.' : 'The teacher will confirm your booking soon.',
      });
      await fetchSlots();

      // GCal sync for student booking (teacher's calendar)
      try {
        const syncSettings = settings as any;
        if (syncSettings?.gcal_integration_enabled) {
          const isPending = !autoConfirm;
          const shouldSync = isPending
            ? (syncSettings as any).gcal_sync_pending !== false
            : (syncSettings as any).gcal_sync_booked !== false;
          if (shouldSync) {
            supabase.functions.invoke('gcal-sync', {
              body: { teacherId: settings.teacher_id, slotId, action: 'upsert' },
            }).catch(console.error);
          }
        }
      } catch (e) { console.error('GCal sync error:', e); }

      // Student GCal auto-sync
      supabase.functions.invoke('student-gcal-sync', {
        body: { email: normalizedEmail, teacherId: settings.teacher_id, slotId, action: 'upsert' },
      }).catch(console.error);

      return true;
    } catch (err: any) {
      toast({ title: 'Booking failed', description: err.message, variant: 'destructive' });
      return false;
    }
  }, [settings, toast, fetchSlots, slots]);

  const navigateWeek = useCallback((direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    else setWeekStart(prev => addDays(prev, direction === 'next' ? 7 : -7));
  }, []);

  const getSlotsForDay = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return slots.filter(s => s.slot_date === dateStr);
  }, [slots]);

  return { settings, slots, loading, error, weekStart, weekEnd, bookSlot, navigateWeek, getSlotsForDay, refetchSlots: fetchSlots };
}
