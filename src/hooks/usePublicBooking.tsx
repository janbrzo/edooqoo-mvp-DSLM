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
      // 1. Try hub_token first (Student Hub context — /my/:hubToken/lessons)
      let { data, error: err } = await supabase
        .from('calendar_settings')
        .select('*')
        .eq('hub_token', token)
        .maybeSingle();

      if (data && !err) {
        if (!data.public_calendar_enabled) {
          setError('Your teacher has not enabled their public calendar yet. Please ask them to turn it on in Calendar Settings.');
          setLoading(false);
          return;
        }
        setSettings(data as unknown as CalendarSettings);
        return;
      }

      // 2. Try public_calendar_token (Public booking context — /book/:token)
      if (!data && !err) {
        const result = await supabase
          .from('calendar_settings')
          .select('*')
          .eq('public_calendar_token', token)
          .eq('public_calendar_enabled', true)
          .maybeSingle();
        data = result.data;
        err = result.error;
      }

      // 3. Try slug
      if (!data && !err) {
        const slugResult = await supabase
          .from('calendar_settings')
          .select('*')
          .eq('public_calendar_slug', token)
          .eq('public_calendar_enabled', true)
          .maybeSingle();
        data = slugResult.data;
        err = slugResult.error;
      }

      if (err) throw err;
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

      // Use SECURITY DEFINER function to bypass RLS on students table
      const { data: existingStudentRows } = await supabase
        .rpc('find_student_by_email', {
          p_teacher_id: settings.teacher_id,
          p_email: normalizedEmail,
        });
      const existingStudent = existingStudentRows?.[0] || null;

      const studentId = existingStudent?.id || null;
      const resolvedName = existingStudent?.name || studentName;
      const autoConfirm = settings.default_booking_mode === 'auto_confirm';

      let slot = slots.find(s => s.id === slotId);
      // Slot might be from a different week (recurring booking) — fetch directly from DB
      if (!slot) {
        const { data: dbSlot } = await supabase
          .from('calendar_slots')
          .select('id, slot_date, start_time, end_time, worksheet_id, meeting_link')
          .eq('id', slotId)
          .single();
        if (dbSlot) slot = dbSlot as any;
      }

      const { error: err } = await supabase
        .from('calendar_slots')
        .update({
          student_id: studentId,
          status: 'booked',
          booking_type: 'student_booked',
          booked_at: new Date().toISOString(),
          booked_by: 'student',
          confirmed_at: autoConfirm ? new Date().toISOString() : null,
          student_notes: `Booked by: ${resolvedName} (${normalizedEmail})`,
          title: `${resolvedName} — English lesson`,
        } as any)
        .eq('id', slotId)
        .eq('status', 'available');

      if (err) throw err;

      // Notification for teacher — new vs existing student
      if (!existingStudent) {
        try {
          await supabase.from('calendar_notifications').insert({
            teacher_id: settings.teacher_id,
            notification_type: 'new_student',
            message: `New student signed up: ${studentName} (${normalizedEmail})`,
            student_name: studentName,
            slot_id: slotId,
            metadata: {
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
        await supabase.from('calendar_notifications').insert({
          teacher_id: settings.teacher_id,
          notification_type: autoConfirm ? 'booking_confirmed' : 'booking_pending',
          message: messageText,
          student_name: resolvedName,
          slot_id: slotId,
          metadata: {
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
        const { data: teacherProfile } = await supabase.from('profiles').select('email, first_name, last_name').eq('id', settings.teacher_id).maybeSingle();
        const teacherName = [teacherProfile?.first_name, teacherProfile?.last_name].filter(Boolean).join(' ') || 'Your Teacher';
        const teacherEmail = teacherProfile?.email || '';
        const { data: hubSettings } = await supabase.from('calendar_settings').select('hub_token').eq('teacher_id', settings.teacher_id).maybeSingle();
        const hubToken = hubSettings?.hub_token || settings.public_calendar_token;
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
        const { data: syncSettings } = await supabase.from('calendar_settings')
          .select('gcal_sync_booked, gcal_sync_pending, gcal_integration_enabled')
          .eq('teacher_id', settings.teacher_id).maybeSingle();
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
