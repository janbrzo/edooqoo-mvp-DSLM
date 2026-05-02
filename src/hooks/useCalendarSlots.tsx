import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDemoContext } from '@/contexts/DemoContext';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays, addMonths, addWeeks } from 'date-fns';

export type ViewMode = 'day' | 'week' | 'month' | 'schedule';

export interface CalendarSlot {
  id: string;
  teacher_id: string;
  student_id: string | null;
  title: string | null;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked' | 'completed' | 'cancelled' | 'no_show' | 'deleted' | 'needs_review';
  booking_type: 'manual' | 'student_booked' | 'recurring_instance';
  recurrence_rule_id: string | null;
  worksheet_id: string | null;
  notes: string | null;
  student_notes: string | null;
  booked_at: string | null;
  booked_by: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  is_paid: boolean;
  created_at: string;
  updated_at: string;
  slot_type?: string; // 'slot' | 'block'
  discount_percent?: number | null;
  meeting_link?: string | null;
}

export interface CreateSlotInput {
  slot_date: string;
  start_time: string;
  end_time: string;
  student_id?: string | null;
  title?: string;
  notes?: string;
  booking_type?: string;
  status?: string;
  worksheet_id?: string | null;
  slot_type?: string;
  discount_percent?: number | null;
}

export interface UseCalendarSlotsOptions {
  studentId?: string;
  /** Skip the past-booked → needs_review auto-update (used when scoped to a single student view) */
  skipAutoMarkNeedsReview?: boolean;
}

export function useCalendarSlots(teacherId?: string, options: UseCalendarSlotsOptions = {}) {
  const { studentId, skipAutoMarkNeedsReview } = options;
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDeleted, setShowDeleted] = useState(true);
  const { toast } = useToast();
  const { isDemoMode } = useDemoContext();
  const fetchingRef = useRef(false);
  const pendingRefetch = useRef(false);

  const dateRange = useMemo(() => {
    if (viewMode === 'day') return { from: currentDate, to: currentDate };
    if (viewMode === 'week') {
      return { from: startOfWeek(currentDate, { weekStartsOn: 1 }), to: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    }
    if (viewMode === 'schedule') {
      return { from: currentDate, to: addWeeks(currentDate, 2) };
    }
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    return { from: startOfWeek(ms, { weekStartsOn: 1 }), to: endOfWeek(me, { weekStartsOn: 1 }) };
  }, [viewMode, currentDate]);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);

  // Core fetch query — extracted to avoid duplication
  const runFetchQuery = useCallback(async () => {
    const from = format(dateRange.from, 'yyyy-MM-dd');
    const to = format(dateRange.to, 'yyyy-MM-dd');
    let query = supabase
      .from('calendar_slots')
      .select('*')
      .eq('teacher_id', teacherId!)
      .gte('slot_date', from)
      .lte('slot_date', to)
      .order('slot_date')
      .order('start_time');
    if (studentId) {
      query = query.eq('student_id', studentId);
    }
    if (!showDeleted) {
      query = query.neq('status', 'deleted');
    }
    return query;
  }, [teacherId, studentId, dateRange, showDeleted]);

  // Auto-mark past booked+confirmed as needs_review
  const autoMarkNeedsReview = useCallback((data: any[]) => {
    if (skipAutoMarkNeedsReview) return data;
    const now = new Date();
    const pastBooked = data.filter((s: any) => {
      if (s.status !== 'booked' || !s.confirmed_at || !s.student_id) return false;
      const slotEnd = new Date(`${s.slot_date}T${s.end_time}`);
      return slotEnd < now;
    });
    if (pastBooked.length > 0) {
      const ids = pastBooked.map((s: any) => s.id);
      // Fire-and-forget
      supabase.from('calendar_slots')
        .update({ status: 'needs_review' } as any)
        .in('id', ids)
        .then(() => {}, (err: any) => console.error('needs_review auto-update failed:', err));
      return data.map((s: any) => ids.includes(s.id) ? { ...s, status: 'needs_review' } : s);
    }
    return data;
  }, [skipAutoMarkNeedsReview]);

  const fetchSlots = useCallback(async () => {
    if (!teacherId || isDemoMode) { setLoading(false); return; }
    if (fetchingRef.current) {
      pendingRefetch.current = true;
      return;
    }
    fetchingRef.current = true;
    setLoading(true);
    try {
      const { data, error } = await runFetchQuery();
      if (error) throw error;
      const processed = autoMarkNeedsReview(data || []);
      setSlots(processed as unknown as CalendarSlot[]);
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
      if (pendingRefetch.current) {
        pendingRefetch.current = false;
        fetchSlots();
      }
    }
  }, [teacherId, isDemoMode, runFetchQuery, autoMarkNeedsReview]);

  // Silent refetch — same query but WITHOUT setLoading(true)
  const silentRefetch = useCallback(async () => {
    if (!teacherId || isDemoMode) return;
    if (fetchingRef.current) {
      pendingRefetch.current = true;
      return;
    }
    fetchingRef.current = true;
    try {
      const { data, error } = await runFetchQuery();
      if (error) throw error;
      const processed = autoMarkNeedsReview(data || []);
      setSlots(processed as unknown as CalendarSlot[]);
    } catch (err) {
      console.error('Silent refetch error:', err);
    } finally {
      fetchingRef.current = false;
      if (pendingRefetch.current) {
        pendingRefetch.current = false;
        silentRefetch();
      }
    }
  }, [teacherId, isDemoMode, runFetchQuery, autoMarkNeedsReview]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Supabase Realtime — use silentRefetch to avoid loading flash
  useEffect(() => {
    if (!teacherId || isDemoMode) return;
    const channel = supabase
      .channel(`calendar-slots-${teacherId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_slots', filter: `teacher_id=eq.${teacherId}` },
        () => { silentRefetch(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teacherId, isDemoMode, silentRefetch]);

  const normalizeTimeForQuery = (t: string) => {
    return t.length === 5 ? t + ':00' : t;
  };

  const logAction = async (slotId: string, action: string, actor: string = 'teacher', details: any = {}) => {
    if (!teacherId) return;
    try {
      await supabase.from('calendar_slot_logs').insert({
        slot_id: slotId, teacher_id: teacherId, action, actor, details,
      } as any);
    } catch (_) {}
  };

  const triggerGcalSync = async (slotId: string, action: 'upsert' | 'delete') => {
    if (!teacherId) return;
    try {
      const { data: calSettings } = await supabase.from('calendar_settings')
        .select('gcal_integration_enabled').eq('teacher_id', teacherId).maybeSingle();
      if (!(calSettings as any)?.gcal_integration_enabled) return;
      const { data: gcalToken } = await supabase.from('calendar_gcal_tokens')
        .select('id').eq('teacher_id', teacherId).maybeSingle();
      if (!gcalToken) return;
      supabase.functions.invoke('gcal-sync', {
        body: { teacherId, slotId, action },
      }).catch(console.error);
    } catch (_) {}
  };

  const createSlot = useCallback(async (input: CreateSlotInput) => {
    if (!teacherId || isDemoMode) return null;
    try {
      const { data: existing } = await supabase
        .from('calendar_slots')
        .select('id, student_id')
        .eq('teacher_id', teacherId)
        .eq('slot_date', input.slot_date)
        .neq('status', 'cancelled')
        .neq('status', 'deleted')
        .lt('start_time', normalizeTimeForQuery(input.end_time))
        .gt('end_time', normalizeTimeForQuery(input.start_time));

      if (existing && existing.length > 0) {
        const hasLessonConflict = existing.some((e: any) => e.student_id && input.student_id);
        const hasBlockedByLesson = existing.some((e: any) => e.student_id) && !input.student_id;
        if (hasLessonConflict || hasBlockedByLesson) {
          toast({ title: 'Time conflict', description: 'This slot overlaps with an existing lesson.', variant: 'destructive' });
          return null;
        }
        if (input.student_id) {
          for (const e of existing.filter((e: any) => !e.student_id)) {
            await supabase.from('calendar_slots').delete().eq('id', e.id);
          }
        }
      }

      // Auto-fill meeting link from student settings if not provided
      let autoMeetingLink: string | null = null;
      if (input.student_id) {
        try {
          const { data: studentSettings } = await supabase.from('calendar_student_settings')
            .select('default_meeting_link').eq('student_id', input.student_id).eq('teacher_id', teacherId).maybeSingle();
          if ((studentSettings as any)?.default_meeting_link) {
            autoMeetingLink = (studentSettings as any).default_meeting_link;
          }
        } catch (_) {}
      }

      const { data, error } = await supabase
        .from('calendar_slots')
        .insert({
          teacher_id: teacherId,
          slot_date: input.slot_date,
          start_time: input.start_time,
          end_time: input.end_time,
          student_id: input.student_id || null,
          title: input.title || null,
          notes: input.notes || null,
          booking_type: input.booking_type || 'manual',
          status: input.student_id ? 'booked' : (input.status || 'available'),
          worksheet_id: input.worksheet_id || null,
          confirmed_at: input.student_id ? new Date().toISOString() : null,
          booked_at: input.student_id ? new Date().toISOString() : null,
          booked_by: input.student_id ? 'teacher' : null,
          slot_type: input.slot_type || 'slot',
          meeting_link: autoMeetingLink,
          discount_percent: input.discount_percent ?? null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // OPTIMISTIC: immediately add to UI
      setSlots(prev => [...prev, data as unknown as CalendarSlot].sort((a, b) =>
        a.slot_date.localeCompare(b.slot_date) || a.start_time.localeCompare(b.start_time)
      ));

      // Fire-and-forget side effects — don't block UI
      logAction(data.id, 'created', 'teacher', {
        slot_type: input.slot_type || 'slot',
        student_id: input.student_id,
        slot_date: input.slot_date,
        start_time: input.start_time,
        end_time: input.end_time,
      }).catch(() => {});

      // Teacher notification + email for lesson — fire-and-forget
      if (input.student_id) {
        const studentLabel = input.title?.split(' — ')[0] || 'Student';
        (async () => {
          let studentEmail = '';
          try {
            const { data: studentData } = await supabase.from('students').select('student_email').eq('id', input.student_id!).maybeSingle();
            studentEmail = (studentData as any)?.student_email || '';
          } catch (_) {}

          supabase.from('calendar_notifications').insert({
            teacher_id: teacherId,
            notification_type: 'lesson_created_by_teacher',
            message: `You added a new lesson for ${studentLabel} on ${input.slot_date} at ${input.start_time.slice(0, 5)}`,
            student_name: studentLabel,
            slot_id: data.id,
            metadata: { slot_date: input.slot_date, start_time: input.start_time.slice(0, 5), end_time: input.end_time.slice(0, 5), student_email: studentEmail },
          } as any).then(() => {}, () => {});

          if (studentEmail) {
            try {
              const { data: teacherProfile } = await supabase.from('profiles').select('email, first_name, last_name').eq('id', teacherId).maybeSingle();
              const { data: calSettings } = await supabase.from('calendar_settings').select('public_calendar_token, notify_email_on_lesson_created').eq('teacher_id', teacherId).maybeSingle();
              
              if ((calSettings as any)?.notify_email_on_lesson_created !== false) {
                const teacherName = [teacherProfile?.first_name, teacherProfile?.last_name].filter(Boolean).join(' ') || 'Your Teacher';
                const bookUrl = calSettings?.public_calendar_token ? `${window.location.origin}/book/${calSettings.public_calendar_token}` : '';
                
                let sharedWorksheetUrl: string | undefined;
                if (input.worksheet_id) {
                  const { data: wsData } = await supabase.from('worksheets').select('share_token').eq('id', input.worksheet_id).maybeSingle();
                  if (wsData?.share_token) {
                    sharedWorksheetUrl = `${window.location.origin}/shared/${wsData.share_token}`;
                  }
                }

                supabase.functions.invoke('send-calendar-notification-email', {
                  body: {
                    type: 'new_booking_student',
                    studentEmail,
                    studentName: studentLabel,
                    slotDate: input.slot_date,
                    slotTime: input.start_time.slice(0, 5),
                    endTime: input.end_time.slice(0, 5),
                    teacherName,
                    teacherEmail: teacherProfile?.email || '',
                    bookUrl,
                    sharedWorksheetUrl,
                  },
                }).catch(console.error);
              }
            } catch (_) {}
          }
        })().catch(() => {});
      }

      // Silent refetch to sync with DB (non-blocking)
      silentRefetch();

      // GCal sync — fire-and-forget
      (async () => {
        try {
          const { data: syncSettings } = await supabase.from('calendar_settings')
            .select('gcal_sync_booked, gcal_sync_pending, gcal_sync_available_new, gcal_integration_enabled')
            .eq('teacher_id', teacherId).maybeSingle();
          if (syncSettings?.gcal_integration_enabled) {
            const isPendingSlot = input.student_id && !(input as any).confirmed_at;
            const isBookedSlot = input.student_id && !!(input as any).confirmed_at;
            const shouldSync = 
              (isBookedSlot && (syncSettings as any).gcal_sync_booked !== false) ||
              (isPendingSlot && (syncSettings as any).gcal_sync_pending !== false) ||
              (!input.student_id && (syncSettings as any).gcal_sync_available_new === true);
            if (shouldSync) triggerGcalSync(data.id, 'upsert');
          }
        } catch (_) {}
      })().catch(() => {});

      toast({ title: input.slot_type === 'block' ? 'Block created' : input.student_id ? 'Lesson created' : 'Slot created' });
      return data;
    } catch (err: any) {
      toast({ title: 'Error creating slot', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [teacherId, isDemoMode, silentRefetch, toast]);

  const createSlotsBatch = useCallback(async (inputs: CreateSlotInput[]) => {
    if (!teacherId || isDemoMode || inputs.length === 0) return null;
    try {
      for (const input of inputs) {
        const { data: existing } = await supabase
          .from('calendar_slots')
          .select('id, student_id')
          .eq('teacher_id', teacherId)
          .eq('slot_date', input.slot_date)
          .neq('status', 'cancelled')
          .neq('status', 'deleted')
          .lt('start_time', normalizeTimeForQuery(input.end_time))
          .gt('end_time', normalizeTimeForQuery(input.start_time));

        if (existing && existing.length > 0) {
          if (existing.some((e: any) => e.student_id && input.student_id)) {
            toast({ title: 'Overbooking blocked', description: `Lesson conflict on ${input.slot_date} ${input.start_time}`, variant: 'destructive' });
            return null;
          }
          if (existing.some((e: any) => e.student_id) && !input.student_id) {
            toast({ title: 'Conflict', description: `Cannot add available slot over existing lesson on ${input.slot_date}`, variant: 'destructive' });
            return null;
          }
          if (input.student_id) {
            for (const e of existing.filter((e: any) => !e.student_id)) {
              await supabase.from('calendar_slots').delete().eq('id', e.id);
            }
          }
        }
      }

      // Fetch per-student meeting links for batch
      const studentIds = [...new Set(inputs.filter(i => i.student_id).map(i => i.student_id!))];
      const studentMeetingLinks: Record<string, string> = {};
      if (studentIds.length > 0) {
        const { data: studentSettings } = await supabase.from('calendar_student_settings')
          .select('student_id, default_meeting_link')
          .in('student_id', studentIds)
          .eq('teacher_id', teacherId);
        if (studentSettings) {
          for (const ss of studentSettings) {
            if (ss.default_meeting_link) studentMeetingLinks[ss.student_id] = ss.default_meeting_link;
          }
        }
      }

      const rows = inputs.map(input => ({
        teacher_id: teacherId,
        slot_date: input.slot_date,
        start_time: input.start_time,
        end_time: input.end_time,
        student_id: input.student_id || null,
        title: input.title || null,
        notes: input.notes || null,
        booking_type: input.booking_type || 'manual',
        status: input.student_id ? 'booked' : (input.status || 'available'),
        worksheet_id: input.worksheet_id || null,
        confirmed_at: input.student_id ? new Date().toISOString() : null,
        booked_at: input.student_id ? new Date().toISOString() : null,
        booked_by: input.student_id ? 'teacher' : null,
        slot_type: input.slot_type || 'slot',
        discount_percent: input.discount_percent ?? null,
        meeting_link: input.student_id ? (studentMeetingLinks[input.student_id] || null) : null,
      }));

      const { error } = await supabase.from('calendar_slots').insert(rows as any);
      if (error) throw error;

      // Silent refetch instead of fetchSlots to avoid loading flash
      silentRefetch();

      const hasStudents = inputs.some(i => i.student_id);
      toast({ title: `${inputs.length} ${hasStudents ? 'lessons' : 'slots'} created` });
      return true;
    } catch (err: any) {
      toast({ title: 'Error creating slots', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [teacherId, isDemoMode, silentRefetch, toast]);

  const updateSlot = useCallback(async (slotId: string, updates: Partial<CalendarSlot>) => {
    if (isDemoMode) return;
    try {
      // OPTIMISTIC: immediately update in UI
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, ...updates } as CalendarSlot : s));

      const { error } = await supabase.from('calendar_slots').update(updates as any).eq('id', slotId);
      if (error) throw error;

      // Silent refetch for consistency
      silentRefetch();
      triggerGcalSync(slotId, 'upsert');
      toast({ title: 'Slot updated' });
    } catch (err: any) {
      // Revert on error
      silentRefetch();
      toast({ title: 'Error updating slot', description: err.message, variant: 'destructive' });
    }
  }, [isDemoMode, silentRefetch, toast]);

  // Hard delete (for slots without history)
  const hardDeleteSlot = useCallback(async (slotId: string) => {
    if (isDemoMode) return;
    try {
      // OPTIMISTIC: immediately remove from UI
      setSlots(prev => prev.filter(s => s.id !== slotId));

      triggerGcalSync(slotId, 'delete');
      const { error } = await supabase.from('calendar_slots').delete().eq('id', slotId);
      if (error) throw error;
      logAction(slotId, 'hard_deleted', 'teacher', {}).catch(() => {});
      silentRefetch();
      toast({ title: 'Slot deleted' });
    } catch (err: any) {
      silentRefetch();
      toast({ title: 'Error deleting slot', description: err.message, variant: 'destructive' });
    }
  }, [isDemoMode, silentRefetch, toast]);

  // Soft delete (for slots with history)
  const deleteSlot = useCallback(async (slotId: string) => {
    if (isDemoMode) return;
    try {
      // OPTIMISTIC: immediately mark as deleted in UI
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, status: 'deleted' } as CalendarSlot : s));

      triggerGcalSync(slotId, 'delete');
      const { error } = await supabase.from('calendar_slots').update({ status: 'deleted' } as any).eq('id', slotId);
      if (error) throw error;
      logAction(slotId, 'deleted', 'teacher', {}).catch(() => {});
      silentRefetch();
      toast({ title: 'Slot deleted' });
    } catch (err: any) {
      silentRefetch();
      toast({ title: 'Error deleting slot', description: err.message, variant: 'destructive' });
    }
  }, [isDemoMode, silentRefetch, toast]);

  const deleteSlotsBatch = useCallback(async (slotIds: string[]) => {
    if (isDemoMode || slotIds.length === 0) return;
    try {
      // OPTIMISTIC: immediately remove/mark deleted
      setSlots(prev => prev.filter(s => !slotIds.includes(s.id) || !!s.cancelled_at).map(s => 
        slotIds.includes(s.id) && !!s.cancelled_at ? { ...s, status: 'deleted' } as CalendarSlot : s
      ));

      const slotsToCheck = slots.filter(s => slotIds.includes(s.id));
      const hardDeleteIds = slotsToCheck.filter(s => !s.cancelled_at).map(s => s.id);
      const softDeleteIds = slotsToCheck.filter(s => !!s.cancelled_at).map(s => s.id);

      if (hardDeleteIds.length > 0) {
        const { error } = await supabase.from('calendar_slots').delete().in('id', hardDeleteIds);
        if (error) throw error;
      }
      if (softDeleteIds.length > 0) {
        const { error } = await supabase.from('calendar_slots').update({ status: 'deleted' } as any).in('id', softDeleteIds);
        if (error) throw error;
      }
      silentRefetch();
      toast({ title: `${slotIds.length} slots deleted` });
    } catch (err: any) {
      silentRefetch();
      toast({ title: 'Error deleting slots', description: err.message, variant: 'destructive' });
    }
  }, [isDemoMode, silentRefetch, toast, slots]);

  const navigate = useCallback((direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') { setCurrentDate(new Date()); return; }
    setCurrentDate(prev => {
      if (viewMode === 'day') return addDays(prev, direction === 'next' ? 1 : -1);
      if (viewMode === 'week') return addDays(prev, direction === 'next' ? 7 : -7);
      if (viewMode === 'schedule') return addDays(prev, direction === 'next' ? 14 : -14);
      return addMonths(prev, direction === 'next' ? 1 : -1);
    });
  }, [viewMode]);

  const getSlotsForDay = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return slots.filter(s => s.slot_date === dateStr);
  }, [slots]);

  return {
    slots, loading, viewMode, setViewMode, currentDate, setCurrentDate,
    weekStart, weekEnd, dateRange, showDeleted, setShowDeleted,
    createSlot, createSlotsBatch, updateSlot, deleteSlot, hardDeleteSlot, deleteSlotsBatch,
    navigate, getSlotsForDay, refetch: fetchSlots,
  };
}
