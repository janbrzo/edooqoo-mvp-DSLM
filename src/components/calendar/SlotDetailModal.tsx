import React, { useState, useEffect, useMemo } from 'react';
import { DraggableDialog, DraggableDialogContent, DraggableDialogHeader, DraggableDialogTitle, DraggableDialogFooter } from '@/components/ui/draggable-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/AutoResizeTextarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarSlot } from '@/hooks/useCalendarSlots';
import { format, differenceInMinutes } from 'date-fns';
import { Check, X, Trash2, FileText, ExternalLink, AlertTriangle, Link2, Undo2, UserMinus, Repeat, Ban, ChevronsUpDown, History, Lock, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Student {
  id: string;
  name: string;
}

interface SlotLog {
  id: string;
  action: string;
  actor: string;
  details: any;
  created_at: string;
}

interface SlotDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: CalendarSlot | null;
  studentName?: string;
  students: Student[];
  onUpdate: (id: string, updates: Partial<CalendarSlot>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLinkWorksheet?: (slot: CalendarSlot, studentId?: string | null) => void; // kept for backward compat, no longer used
  onNotificationsChanged?: () => void;
}

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  available: { label: 'Available', variant: 'outline' },
  booked: { label: 'Booked', variant: 'default' },
  completed: { label: 'Completed', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  no_show: { label: 'No Show', variant: 'destructive' },
  deleted: { label: 'Deleted', variant: 'destructive' },
  needs_review: { label: 'Needs Review', variant: 'secondary' },
};

const DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
  { value: '90', label: '90 min' },
  { value: '120', label: '120 min' },
];

// Safe default for hooks — NEVER do early return before hooks
const EMPTY_SLOT = {
  slot_date: '', start_time: '00:00', end_time: '01:00', notes: '',
  student_id: null, status: 'available', teacher_id: '', id: '',
  recurrence_rule_id: null, cancelled_at: null, cancelled_by: null,
  student_notes: null, worksheet_id: null, confirmed_at: null,
  booked_at: null, booked_by: null, cancellation_reason: null,
  booking_type: 'manual', is_paid: false, title: null,
  created_at: '', updated_at: '', slot_type: 'slot',
  meeting_link: null,
} as unknown as CalendarSlot;

export function SlotDetailModal({ open, onOpenChange, slot, studentName, students, onUpdate, onDelete, onLinkWorksheet, onNotificationsChanged }: SlotDetailModalProps) {
  // Use safeSlot for all hooks to ensure consistent hook order
  const safeSlot = slot || EMPTY_SLOT;
  const navigate = useNavigate();

  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStudentId, setEditStudentId] = useState<string>('none');
  const [showStudentSelect, setShowStudentSelect] = useState(false);
  const [studentComboOpen, setStudentComboOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slotLogs, setSlotLogs] = useState<SlotLog[]>([]);
  const [editMeetingLink, setEditMeetingLink] = useState('');
  const [editWorksheetId, setEditWorksheetId] = useState<string>('none');
  const [studentWorksheets, setStudentWorksheets] = useState<Array<{ id: string; title: string }>>([]);
  const [paymentTrackingEnabled, setPaymentTrackingEnabled] = useState(false);
  const [defaultLessonPrice, setDefaultLessonPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [editDiscountPercent, setEditDiscountPercent] = useState<string>('');
  const [showInlineComment, setShowInlineComment] = useState(false);
  const [inlineComment, setInlineComment] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    if (slot) {
      setEditDate(slot.slot_date);
      setEditStartTime(slot.start_time.slice(0, 5));
      setEditEndTime(slot.end_time.slice(0, 5));
      setEditNotes(slot.notes || '');
      setEditStudentId(slot.student_id || 'none');
      setEditMeetingLink((slot as any).meeting_link || '');
      setEditWorksheetId(slot.worksheet_id || 'none');
      setEditDiscountPercent((slot as any).discount_percent != null ? String((slot as any).discount_percent) : '');
      setShowStudentSelect(false);
      setConfirming(false);
      supabase.from('calendar_slot_logs').select('*').eq('slot_id', slot.id).order('created_at', { ascending: false }).limit(20)
        .then(({ data }) => setSlotLogs((data || []) as SlotLog[]));
    }
  }, [slot?.id, open]);

  // Fetch student worksheets when student changes
  useEffect(() => {
    if (editStudentId && editStudentId !== 'none') {
      supabase.from('worksheets')
        .select('id, title')
        .eq('student_id', editStudentId)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => setStudentWorksheets((data || []) as Array<{ id: string; title: string }>));
    } else {
      setStudentWorksheets([]);
      // If student removed, also remove worksheet
      if (editWorksheetId !== 'none' && editWorksheetId !== (slot?.worksheet_id || 'none')) {
        setEditWorksheetId('none');
      }
    }
  }, [editStudentId]);

  // Fetch payment settings
  useEffect(() => {
    if (slot?.teacher_id) {
      supabase.from('calendar_settings')
        .select('payment_tracking_enabled, default_lesson_price, currency')
        .eq('teacher_id', slot.teacher_id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setPaymentTrackingEnabled(!!(data as any).payment_tracking_enabled);
            setDefaultLessonPrice((data as any).default_lesson_price);
            setCurrency((data as any).currency || 'USD');
          }
        });
    }
  }, [slot?.teacher_id]);

  // Duration calculation — uses safe values
  const durationMinutes = useMemo(() => {
    const [sh, sm] = editStartTime.split(':').map(Number);
    const [eh, em] = editEndTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 60;
    return (eh * 60 + em) - (sh * 60 + sm);
  }, [editStartTime, editEndTime]);

  // Derived values — uses safeSlot
  const isBlock = (safeSlot as any).slot_type === 'block';
  const isPending = safeSlot.status === 'booked' && !safeSlot.confirmed_at;
  const isNeedsReview = (safeSlot.status as string) === 'needs_review';
  const badge = STATUS_BADGES[safeSlot.status] || STATUS_BADGES.available;
  const hasStudent = editStudentId !== 'none';
  const isRecurring = !!safeSlot.recurrence_rule_id;
  const isBooked = !!safeSlot.student_id && (safeSlot.status === 'booked' || isNeedsReview);
  const canUndoCancel = safeSlot.status === 'cancelled' && safeSlot.cancelled_at &&
    differenceInMinutes(new Date(), new Date(safeSlot.cancelled_at)) < 30;
  const hasChanges = editDate !== safeSlot.slot_date ||
    editStartTime !== safeSlot.start_time.slice(0, 5) ||
    editEndTime !== safeSlot.end_time.slice(0, 5) ||
    editNotes !== (safeSlot.notes || '') ||
    editStudentId !== (safeSlot.student_id || 'none') ||
    editWorksheetId !== (safeSlot.worksheet_id || 'none') ||
    editDiscountPercent !== ((safeSlot as any).discount_percent != null ? String((safeSlot as any).discount_percent) : '');

  // CRITICAL: early return AFTER all hooks
  if (!slot) return null;

  const handleStartTimeChange = (newStart: string) => {
    setEditStartTime(newStart);
    const [h, m] = newStart.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return;
    const dur = durationMinutes > 0 ? durationMinutes : 60;
    const totalMin = h * 60 + m + dur;
    const newEnd = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    setEditEndTime(newEnd);
  };

  const handleDurationChange = (newDur: string) => {
    const [h, m] = editStartTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return;
    const totalMin = h * 60 + m + parseInt(newDur);
    const newEnd = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    setEditEndTime(newEnd);
  };

  const resetChanges = () => {
    setEditDate(slot.slot_date);
    setEditStartTime(slot.start_time.slice(0, 5));
    setEditEndTime(slot.end_time.slice(0, 5));
    setEditNotes(slot.notes || '');
    setEditStudentId(slot.student_id || 'none');
    setEditWorksheetId(slot.worksheet_id || 'none');
    setShowStudentSelect(false);
  };

  const handleCancel = () => { resetChanges(); onOpenChange(false); };

  const handleSave = async (opts: { skipClose?: boolean } = {}) => {
    // v6.9.8 — demo guard (modal can open in demo, save is blocked)
    if (typeof window !== 'undefined' && localStorage.getItem('edooqoo_demo_mode') === 'true') {
      toast.info('Demo mode — Saving slot changes is disabled.');
      return;
    }
    setSaving(true);
    const updates: any = {
      slot_date: editDate, start_time: editStartTime, end_time: editEndTime, notes: editNotes || null,
      meeting_link: editMeetingLink || null,
      worksheet_id: editWorksheetId !== 'none' ? editWorksheetId : null,
      discount_percent: editDiscountPercent ? Number(editDiscountPercent) : null,
    };

    let logActionName = 'updated';
    const logDetails: any = { slot_date: editDate, start_time: editStartTime, end_time: editEndTime };

    const studentChanged = editStudentId !== (slot.student_id || 'none');
    const timeChanged = editDate !== slot.slot_date || editStartTime !== slot.start_time.slice(0, 5) || editEndTime !== slot.end_time.slice(0, 5);

    if (studentChanged) {
      if (editStudentId === 'none') {
        updates.student_id = null; updates.status = 'available'; updates.booked_at = null; updates.booked_by = null; updates.confirmed_at = null;
        logActionName = 'student_removed';
        logDetails.previous_student = studentName;
      } else if (slot.student_id) {
        logActionName = 'student_changed';
        logDetails.previous_student = studentName;
        logDetails.student_name = students.find(s => s.id === editStudentId)?.name;
      } else {
        logActionName = 'student_assigned';
        logDetails.student_name = students.find(s => s.id === editStudentId)?.name;
      }
      if (editStudentId !== 'none') {
        updates.student_id = editStudentId; updates.status = 'booked';
        updates.booked_at = new Date().toISOString(); updates.booked_by = 'teacher'; updates.confirmed_at = new Date().toISOString();
      }
    }

    if (timeChanged) {
      if (logActionName === 'updated') logActionName = 'time_changed';
      logDetails.previous_date = slot.slot_date;
      logDetails.previous_time = `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`;

      const { data: conflicts } = await supabase
        .from('calendar_slots')
        .select('id, student_id, status')
        .eq('teacher_id', slot.teacher_id)
        .eq('slot_date', editDate)
        .neq('id', slot.id)
        .neq('status', 'cancelled')
        .neq('status', 'deleted')
        .lt('start_time', editEndTime + ':00')
        .gt('end_time', editStartTime + ':00');

      if (conflicts && conflicts.length > 0) {
        const hasLesson = conflicts.some(c => c.student_id);
        if (hasLesson) {
          toast.error('Cannot change time — conflicts with an existing lesson.');
          setSaving(false);
          return;
        }
        for (const c of conflicts) {
          await supabase.from('calendar_slots').delete().eq('id', c.id);
        }
      }

      if (slot.student_id && slot.status === 'booked') {
        const studentEmail = extractStudentEmail(slot.student_notes);
        if (studentEmail) {
          sendCalendarEmail('lesson_time_changed', {
            oldSlotDate: slot.slot_date, oldSlotTime: slot.start_time.slice(0, 5),
            slotDate: editDate, slotTime: editStartTime,
          });
        }
      }
    }

    if (!studentChanged && !timeChanged && editNotes !== (slot.notes || '')) {
      logActionName = 'notes_updated';
    }

    await onUpdate(slot.id, updates);

    // Notification when teacher assigns student
    if (studentChanged && editStudentId !== 'none') {
      const assignedName = students.find(s => s.id === editStudentId)?.name || '';
      try {
        // Get student email for metadata
        const { data: studentData } = await supabase.from('students').select('student_email').eq('id', editStudentId).maybeSingle();
        await supabase.from('calendar_notifications').insert({
          teacher_id: slot.teacher_id,
          notification_type: 'lesson_created_by_teacher',
          message: `You added a new lesson for ${assignedName} on ${editDate} at ${editStartTime}`,
          student_name: assignedName,
          slot_id: slot.id,
          metadata: { slot_date: editDate, start_time: editStartTime, end_time: editEndTime, student_email: (studentData as any)?.student_email || '' },
        } as any);
      } catch (_) {}
      setTimeout(() => onNotificationsChanged?.(), 300);

      // Send email to student (Problem 5)
      try {
        const { data: studentData } = await supabase.from('students').select('student_email').eq('id', editStudentId).maybeSingle();
        if ((studentData as any)?.student_email) {
          const { data: teacherProfile } = await supabase.from('profiles').select('email, first_name, last_name').eq('id', slot.teacher_id).maybeSingle();
          const { data: calSettings } = await supabase.from('calendar_settings').select('public_calendar_token, notify_email_on_lesson_created').eq('teacher_id', slot.teacher_id).maybeSingle();
          if ((calSettings as any)?.notify_email_on_lesson_created !== false) {
            const tName = [teacherProfile?.first_name, teacherProfile?.last_name].filter(Boolean).join(' ') || 'Your Teacher';
            const bUrl = calSettings?.public_calendar_token ? `${window.location.origin}/book/${calSettings.public_calendar_token}` : '';
            let sharedWsUrl: string | undefined;
            const wsId = slot.worksheet_id || (updates.worksheet_id);
            if (wsId) {
              const { data: ws } = await supabase.from('worksheets').select('share_token').eq('id', wsId).maybeSingle();
              if (ws?.share_token) sharedWsUrl = `${window.location.origin}/shared/${ws.share_token}`;
            }
            supabase.functions.invoke('send-calendar-notification-email', {
              body: {
                type: 'new_booking_student',
                studentEmail: (studentData as any).student_email,
                studentName: assignedName,
                slotDate: editDate,
                slotTime: editStartTime,
                endTime: editEndTime,
                teacherName: tName,
                teacherEmail: teacherProfile?.email || '',
                bookUrl: bUrl,
                sharedWorksheetUrl: sharedWsUrl,
                meetingLink: editMeetingLink || undefined,
              },
            }).catch(console.error);
          }
        }
      } catch (_) {}
    }

    try {
      await supabase.from('calendar_slot_logs').insert({
        slot_id: slot.id, teacher_id: slot.teacher_id, action: logActionName, actor: 'teacher',
        details: logDetails,
      } as any);
    } catch (_) {}
    setSaving(false);
    if (!opts.skipClose) onOpenChange(false);
  };

  const extractStudentEmail = (notes: string | null): string => {
    if (!notes) return '';
    const match = notes.match(/\(([^)]+@[^)]+)\)/);
    return match ? match[1] : '';
  };

  const resolveNotifications = async (slotId: string, types: string[], resolvedAction?: string) => {
    try {
      const updatePayload: any = { is_resolved: true };
      if (resolvedAction) updatePayload.resolved_action = resolvedAction;
      await supabase
        .from('calendar_notifications')
        .update(updatePayload)
        .eq('teacher_id', slot.teacher_id)
        .eq('slot_id', slotId)
        .in('notification_type', types);
    } catch (_) {}
  };

  const sendCalendarEmail = async (type: string, extraParams: Record<string, any> = {}) => {
    const studentEmail = extractStudentEmail(slot.student_notes);
    if (!studentEmail) return;
    try {
      const { data: teacherProfile } = await supabase.from('profiles').select('email, first_name, last_name').eq('id', slot.teacher_id).maybeSingle();
      const teacherName = [teacherProfile?.first_name, teacherProfile?.last_name].filter(Boolean).join(' ') || 'Your Teacher';
      const teacherEmail = teacherProfile?.email || '';
      const { data: calSettings } = await supabase.from('calendar_settings').select('hub_token, public_calendar_token').eq('teacher_id', slot.teacher_id).maybeSingle();
      const hubToken = calSettings?.hub_token || calSettings?.public_calendar_token;
      const bookUrl = hubToken ? `${window.location.origin}/my/${hubToken}/lessons` : '';
      const calendarUrl = `${window.location.origin}/calendar`;

      let worksheetUrl: string | undefined;
      let sharedWorksheetUrl: string | undefined;
      if (slot.worksheet_id) {
        worksheetUrl = `${window.location.origin}/worksheet/${slot.worksheet_id}`;
        const { data: ws } = await supabase.from('worksheets').select('share_token').eq('id', slot.worksheet_id).maybeSingle();
        if (ws?.share_token) {
          sharedWorksheetUrl = `${window.location.origin}/shared/${ws.share_token}`;
        }
      }

      // Get meeting link: slot > per-student > none
      let meetingLink: string | undefined = (slot as any).meeting_link || undefined;
      if (!meetingLink && slot.student_id) {
        const { data: studentSettings } = await supabase
          .from('calendar_student_settings')
          .select('default_meeting_link')
          .eq('student_id', slot.student_id)
          .eq('teacher_id', slot.teacher_id)
          .maybeSingle();
        meetingLink = studentSettings?.default_meeting_link || undefined;
      }

      supabase.functions.invoke('send-calendar-notification-email', {
        body: {
          type, studentEmail, studentName: studentName || 'Student',
          slotDate: extraParams.slotDate || slot.slot_date, slotTime: extraParams.slotTime || slot.start_time.slice(0, 5),
          endTime: extraParams.endTime || slot.end_time.slice(0, 5),
          teacherName, teacherEmail, bookUrl, calendarUrl,
          worksheetUrl, sharedWorksheetUrl, meetingLink,
          ...extraParams,
        },
      }).catch(console.error);
    } catch (_) {}
  };

  const shouldSendEmail = async (settingKey: string): Promise<boolean> => {
    try {
      const { data } = await supabase.from('calendar_settings').select(settingKey).eq('teacher_id', slot.teacher_id).maybeSingle();
      return data ? (data as any)[settingKey] !== false : true;
    } catch { return true; }
  };

  // Batch logic disabled — handled exclusively via RecurringBookingModal from notifications
  const getValidBatchSlotIds = async (): Promise<string[] | null> => {
    return null;
  };

  const handleConfirm = async () => {
    setActionInProgress(true);
    try {
      const isReschedule = !!(slot as any).reschedule_request_from_slot_id;
      const batchSlotIds = await getValidBatchSlotIds();

      if (isReschedule) {
        const { error } = await supabase.functions.invoke('calendar-handle-reschedule-decision', {
          body: { action: 'confirm', newSlotId: slot.id },
        });
        if (error) throw error;
        toast.success('Reschedule confirmed');
      } else if (batchSlotIds) {
        // Direct batch update instead of looping onUpdate to avoid race conditions
        const { error } = await supabase.from('calendar_slots')
          .update({ confirmed_at: new Date().toISOString() } as any)
          .in('id', batchSlotIds)
          .eq('teacher_id', slot.teacher_id);
        if (error) throw error;
        toast.success(`Confirmed ${batchSlotIds.length} lessons`);
        const canSend = await shouldSendEmail('notify_email_on_confirmation');
        if (canSend) await sendCalendarEmail('booking_confirmation', { confirmationComment: inlineComment || undefined });
      } else {
        await onUpdate(slot.id, { confirmed_at: new Date().toISOString() } as any);
        const canSend = await shouldSendEmail('notify_email_on_confirmation');
        if (canSend) await sendCalendarEmail('booking_confirmation', { confirmationComment: inlineComment || undefined });
        // Student GCal sync — update from Pending to Booked
        const sEmail = extractStudentEmail(slot.student_notes);
        if (sEmail) {
          supabase.functions.invoke('student-gcal-sync', {
            body: { email: sEmail, teacherId: slot.teacher_id, slotId: slot.id, action: 'upsert' },
          }).catch(console.error);
        }
      }

      try {
        await supabase.from('calendar_slot_logs').insert({
          slot_id: slot.id, teacher_id: slot.teacher_id, action: 'confirmed', actor: 'teacher',
          details: { student_name: studentName, student_email: extractStudentEmail(slot.student_notes), slot_date: slot.slot_date, start_time: slot.start_time, end_time: slot.end_time, source: isReschedule ? 'reschedule_confirm' : 'booking_confirm', batch: batchSlotIds ? batchSlotIds.length : undefined, comment: inlineComment || undefined },
        } as any);
      } catch (_) {}

      if (batchSlotIds) {
        for (const sid of batchSlotIds) {
          await resolveNotifications(sid, ['booking_pending', 'reschedule_request', 'reschedule'], 'approved');
        }
      } else {
        await resolveNotifications(slot.id, ['booking_pending', 'reschedule_request', 'reschedule'], 'approved');
      }
      
      setShowInlineComment(false);
      setInlineComment('');
      setTimeout(() => onNotificationsChanged?.(), 300);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Confirm failed:', err);
      toast.error(err.message || 'Failed to confirm booking');
      // Do NOT close dialogs on error — let user retry
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async () => {
    setActionInProgress(true);
    try {
      const isReschedule = !!(slot as any).reschedule_request_from_slot_id;
      const batchSlotIds = await getValidBatchSlotIds();
      const rejectUpdates = {
        status: 'available', student_id: null, booked_at: null, booked_by: null, confirmed_at: null, student_notes: null, title: null,
      };

      if (isReschedule) {
        const { error } = await supabase.functions.invoke('calendar-handle-reschedule-decision', {
          body: { action: 'reject', newSlotId: slot.id },
        });
        if (error) throw error;
        toast.success('Reschedule rejected');
      } else if (batchSlotIds) {
        // Direct batch update instead of looping onUpdate
        const { error } = await supabase.from('calendar_slots')
          .update(rejectUpdates as any)
          .in('id', batchSlotIds)
          .eq('teacher_id', slot.teacher_id);
        if (error) throw error;
        toast.success(`Rejected ${batchSlotIds.length} bookings`);
        const canSend = await shouldSendEmail('notify_email_on_rejection');
        if (canSend) await sendCalendarEmail('booking_rejected', { rejectionReason: inlineComment || undefined });
      } else {
        await onUpdate(slot.id, rejectUpdates as any);
        const canSend = await shouldSendEmail('notify_email_on_rejection');
        if (canSend) await sendCalendarEmail('booking_rejected', { rejectionReason: inlineComment || undefined });
        // Student GCal sync — delete rejected booking
        const sEmail = extractStudentEmail(slot.student_notes);
        if (sEmail) {
          supabase.functions.invoke('student-gcal-sync', {
            body: { email: sEmail, teacherId: slot.teacher_id, slotId: slot.id, action: 'delete' },
          }).catch(console.error);
        }
        toast.success('Booking rejected, slot is available again');
      }

      try {
        await supabase.from('calendar_slot_logs').insert({
          slot_id: slot.id, teacher_id: slot.teacher_id, action: 'rejected', actor: 'teacher',
          details: { student_name: studentName, student_email: extractStudentEmail(slot.student_notes), slot_date: slot.slot_date, start_time: slot.start_time, end_time: slot.end_time, comment: inlineComment || undefined },
        } as any);
      } catch (_) {}

      if (batchSlotIds) {
        for (const sid of batchSlotIds) {
          await resolveNotifications(sid, ['booking_pending', 'reschedule_request', 'reschedule'], 'rejected');
        }
      } else {
        await resolveNotifications(slot.id, ['booking_pending', 'reschedule_request', 'reschedule'], 'rejected');
      }

      setShowInlineComment(false);
      setInlineComment('');
      setTimeout(() => onNotificationsChanged?.(), 300);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Reject failed:', err);
      toast.error(err.message || 'Failed to reject booking');
      // Do NOT close dialogs on error
    } finally {
      setActionInProgress(false);
    }
  };

  const handleUndoCancel = async () => {
    await onUpdate(slot.id, { status: slot.student_id ? 'booked' : 'available', cancelled_at: null, cancelled_by: null, cancellation_reason: null } as any);
    onOpenChange(false);
  };

  const handleTeacherCancellation = async () => {
    if (!window.confirm('Cancel this lesson as teacher cancellation? The slot will become available again.')) return;
    const cancelledStudentName = students.find(s => s.id === slot.student_id)?.name || studentName || 'unknown';
    await onUpdate(slot.id, {
      status: 'available', student_id: null,
      title: null, worksheet_id: null, notes: null,
      cancelled_at: new Date().toISOString(), cancelled_by: 'teacher',
      cancellation_reason: `Teacher cancellation. Student was: ${cancelledStudentName}`,
      booked_at: null, booked_by: null, confirmed_at: null, student_notes: null,
      recurrence_rule_id: null,
    } as any);
    try {
      await supabase.from('calendar_slot_logs').insert({
        slot_id: slot.id, teacher_id: slot.teacher_id, action: 'cancelled_by_teacher', actor: 'teacher',
        details: { student_name: cancelledStudentName, student_id: slot.student_id, slot_date: slot.slot_date, start_time: slot.start_time, end_time: slot.end_time },
      } as any);
    } catch (_) {}
    const canSend = await shouldSendEmail('notify_email_on_cancellation');
    if (canSend) await sendCalendarEmail('cancellation_student');
    await resolveNotifications(slot.id, ['booking_pending', 'booking_confirmed'], 'cancelled');
    // GCal: update to Available or delete based on settings
    supabase.functions.invoke('gcal-sync', { body: { teacherId: slot.teacher_id, slotId: slot.id, action: 'cancel' } }).catch(console.error);
    // Student GCal sync — delete cancelled lesson
    const tcEmail = extractStudentEmail(slot.student_notes);
    if (tcEmail) {
      supabase.functions.invoke('student-gcal-sync', {
        body: { email: tcEmail, teacherId: slot.teacher_id, slotId: slot.id, action: 'delete' },
      }).catch(console.error);
    }
    setTimeout(() => onNotificationsChanged?.(), 300);
    onOpenChange(false);
  };

  const handleStudentCancellation = async () => {
    if (!window.confirm('Cancel this lesson as student cancellation? The slot will become available again.')) return;
    const cancelledStudentName = students.find(s => s.id === slot.student_id)?.name || studentName || 'unknown';
    await onUpdate(slot.id, {
      status: 'available', student_id: null,
      title: null, worksheet_id: null, notes: null,
      cancelled_at: new Date().toISOString(), cancelled_by: 'student',
      cancellation_reason: `Student cancellation. Student was: ${cancelledStudentName}`,
      booked_at: null, booked_by: null, confirmed_at: null, student_notes: null,
      recurrence_rule_id: null,
    } as any);
    try {
      await supabase.from('calendar_slot_logs').insert({
        slot_id: slot.id, teacher_id: slot.teacher_id, action: 'cancelled_by_student', actor: 'teacher',
        details: { student_name: cancelledStudentName, student_id: slot.student_id, slot_date: slot.slot_date, start_time: slot.start_time, end_time: slot.end_time },
      } as any);
    } catch (_) {}
    await resolveNotifications(slot.id, ['booking_pending', 'booking_confirmed'], 'cancelled');
    // GCal: same behavior as teacher cancellation — update to Available or delete
    supabase.functions.invoke('gcal-sync', { body: { teacherId: slot.teacher_id, slotId: slot.id, action: 'cancel' } }).catch(console.error);
    // Student GCal sync — delete cancelled lesson
    const scEmail = extractStudentEmail(slot.student_notes);
    if (scEmail) {
      supabase.functions.invoke('student-gcal-sync', {
        body: { email: scEmail, teacherId: slot.teacher_id, slotId: slot.id, action: 'delete' },
      }).catch(console.error);
    }
    setTimeout(() => onNotificationsChanged?.(), 300);
    onOpenChange(false);
  };

  const handleStatusChange = async (status: string) => {
    const updates: any = { status };
    if (status === 'cancelled') { updates.cancelled_at = new Date().toISOString(); updates.cancelled_by = 'teacher'; }
    await onUpdate(slot.id, updates);
    try {
      await supabase.from('calendar_slot_logs').insert({
        slot_id: slot.id, teacher_id: slot.teacher_id, action: 'status_changed', actor: 'teacher',
        details: { old_status: slot.status, new_status: status, student_name: studentName, slot_date: slot.slot_date, start_time: slot.start_time },
      } as any);
    } catch (_) {}
    // GCal: update color based on status (completed=Basil/dark green, no_show=Tangerine/orange)
    if (status === 'completed' || status === 'no_show') {
      const colorMap: Record<string, string> = { completed: '10', no_show: '6' };
      supabase.functions.invoke('gcal-sync', {
        body: { teacherId: slot.teacher_id, slotId: slot.id, action: 'upsert', colorOverride: colorMap[status] },
      }).catch(console.error);
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (confirming) {
      const hasHistory = !!slot.cancelled_at;
      if (hasHistory) {
        await onUpdate(slot.id, { status: 'deleted' } as any);
      } else {
        await onDelete(slot.id);
      }
      try {
        await supabase.from('calendar_slot_logs').insert({
          slot_id: slot.id, teacher_id: slot.teacher_id, action: 'deleted', actor: 'teacher',
          details: { slot_date: slot.slot_date, start_time: slot.start_time, had_history: hasHistory },
        } as any);
      } catch (_) {}
      onOpenChange(false);
    } else setConfirming(true);
  };

  const handleEditSeries = async () => {
    if (!slot.recurrence_rule_id) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data: seriesSlots } = await supabase
      .from('calendar_slots')
      .select('id, slot_date, start_time, end_time')
      .eq('recurrence_rule_id', slot.recurrence_rule_id)
      .gte('slot_date', today)
      .neq('status', 'completed');
    
    if (seriesSlots) {
      for (const ss of seriesSlots) {
        const { data: conflicts } = await supabase
          .from('calendar_slots')
          .select('id')
          .eq('teacher_id', slot.teacher_id)
          .eq('slot_date', ss.slot_date)
          .neq('id', ss.id)
          .is('student_id', null)
          .neq('status', 'cancelled')
          .neq('status', 'deleted')
          .lt('start_time', editEndTime + ':00')
          .gt('end_time', editStartTime + ':00');
        
        if (conflicts) {
          for (const c of conflicts) {
            await supabase.from('calendar_slots').delete().eq('id', c.id);
          }
        }
      }
    }

    const updates: any = { start_time: editStartTime, end_time: editEndTime, notes: editNotes || null };
    if (editStudentId !== (slot.student_id || 'none')) {
      if (editStudentId === 'none') { updates.student_id = null; updates.status = 'available'; }
      else { updates.student_id = editStudentId; updates.status = 'booked'; updates.confirmed_at = new Date().toISOString(); }
    }
    const { error } = await supabase.from('calendar_slots').update(updates).eq('recurrence_rule_id', slot.recurrence_rule_id).gte('slot_date', today).neq('status', 'completed');
    
    await supabase.from('calendar_recurrence_rules')
      .update({ start_time: editStartTime, end_time: editEndTime } as any)
      .eq('id', slot.recurrence_rule_id);

    if (error) toast.error('Failed to update series'); else toast.success('Series updated');
    onOpenChange(false);
  };

  const selectedStudentName = students.find(s => s.id === editStudentId)?.name || '';

  return (
    <>
    <DraggableDialog open={open} onOpenChange={onOpenChange}>
      <DraggableDialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DraggableDialogHeader>
          <DraggableDialogTitle className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2 flex-wrap">
            {isBlock ? '🔒 Block' : hasStudent ? 'Lesson' : 'Available Slot'}
            <Badge variant={isPending ? 'outline' : badge.variant} className={isPending ? 'border-amber-400 text-amber-700 bg-amber-50' : ''}>
              {isPending ? 'Pending' : badge.label}
            </Badge>
            {isRecurring && <Badge variant="outline" className="text-xs"><Repeat className="h-3 w-3 mr-0.5" /> Recurring</Badge>}
          </DraggableDialogTitle>
        </DraggableDialogHeader>

        <div className="space-y-2">
          {!isBlock && (
            <>
              {hasStudent && !showStudentSelect ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label className="text-xs text-muted-foreground">Student</Label>
                    <div className="font-medium text-sm truncate">{selectedStudentName || studentName}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowStudentSelect(true)}>Change</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setEditStudentId('none')}>
                      <UserMinus className="h-3 w-3 mr-0.5" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">{hasStudent ? 'Change Student' : 'Assign Student'}</Label>
                  <div className="flex gap-2">
                    <Popover open={studentComboOpen} onOpenChange={setStudentComboOpen} modal={false}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={studentComboOpen} className="flex-1 h-9 justify-between text-sm font-normal">
                          {editStudentId !== 'none' ? selectedStudentName : 'Select a student...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start" onPointerDownOutside={e => e.preventDefault()}>
                        <Command>
                          <CommandInput placeholder="Search students..." autoFocus />
                          <CommandList>
                            <CommandEmpty>No student found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem value="__none__" onSelect={() => { setEditStudentId('none'); setStudentComboOpen(false); setShowStudentSelect(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", editStudentId === 'none' ? "opacity-100" : "opacity-0")} />
                                No student (Available)
                              </CommandItem>
                              {students.map(s => (
                                <CommandItem key={s.id} value={`${s.name}__${s.id}`} onSelect={() => { setEditStudentId(s.id); setStudentComboOpen(false); setShowStudentSelect(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", editStudentId === s.id ? "opacity-100" : "opacity-0")} />
                                  {s.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {showStudentSelect && (
                      <Button variant="ghost" size="sm" className="h-9" onClick={() => { setEditStudentId(slot.student_id || 'none'); setShowStudentSelect(false); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-4 gap-2">
            <div><Label className="text-xs">Date</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Start</Label><Input type="time" value={editStartTime} onChange={e => handleStartTimeChange(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">End</Label><Input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} className="h-8 text-xs" /></div>
            <div>
              <Label className="text-xs">Duration</Label>
              <Select value={String(durationMinutes)} onValueChange={handleDurationChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Duration" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isBlock && (
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <div>
                <Label className="text-xs">Worksheet</Label>
                {hasStudent ? (
                  <div className="flex items-center gap-2">
                    <Select value={editWorksheetId} onValueChange={setEditWorksheetId}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="No worksheet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No worksheet</SelectItem>
                        {studentWorksheets.map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.title || 'Untitled'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editWorksheetId !== 'none' && (
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => window.open(`/worksheet/${editWorksheetId}`, '_blank')}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Select a student first</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Discount %</Label>
                <Input type="number" min="0" max="100" value={editDiscountPercent} onChange={e => setEditDiscountPercent(e.target.value)} placeholder="e.g. 10" className="h-8 text-xs" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Notes</Label><AutoResizeTextarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={1} className="min-h-[32px] text-xs" /></div>
            {!isBlock && hasStudent && (
              <div>
                <Label className="text-xs">Meeting Link</Label>
                <Input value={editMeetingLink} onChange={e => setEditMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." className="h-8 text-xs" />
                {editMeetingLink && (
                  <Button variant="link" size="sm" className="h-5 p-0 text-xs mt-0.5" onClick={() => window.open(editMeetingLink, '_blank')}>
                    Join ↗
                  </Button>
                )}
              </div>
            )}
          </div>

          {slot.student_notes && (
            <div className="bg-muted/50 rounded-md px-3 py-2">
              <Label className="text-xs text-muted-foreground">Student booking info</Label>
              <p className="text-xs mt-0.5">{slot.student_notes}</p>
            </div>
          )}

          {slot.status === 'cancelled' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 text-xs space-y-1">
              <p className="font-medium text-red-700 dark:text-red-400">Cancelled</p>
              {slot.cancelled_at && <p>When: {format(new Date(slot.cancelled_at), 'MMM d, yyyy HH:mm')}</p>}
              {slot.cancelled_by && <p>By: {slot.cancelled_by}</p>}
              {slot.cancellation_reason && <p>{slot.cancellation_reason}</p>}
            </div>
          )}

          {slot.status === 'available' && slot.cancelled_at && slot.cancelled_by && (() => {
            const isRescheduledSlot = slot.cancelled_by === 'system' && slot.cancellation_reason?.includes('Rescheduled');
            return (
              <div className={cn(
                "border rounded-md px-3 py-2 text-xs space-y-1",
                isRescheduledSlot ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200' :
                slot.cancelled_by === 'student' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200'
              )}>
                <p className="font-medium">{isRescheduledSlot ? 'Previous lesson was rescheduled' : 'Previous lesson was cancelled'}</p>
                {slot.cancelled_at && <p>When: {format(new Date(slot.cancelled_at), 'MMM d, yyyy HH:mm')}</p>}
                <p>By: {slot.cancelled_by}</p>
                {slot.cancellation_reason && <p>{slot.cancellation_reason}</p>}
              </div>
            );
          })()}

          {slotLogs.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors w-full">
                <History className="h-3 w-3" /> History ({slotLogs.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {slotLogs.map(log => (
                  <div key={log.id} className="text-xs border-l-2 border-border pl-2 py-1">
                    <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                    <span className="text-muted-foreground ml-1">by {log.actor}</span>
                    <span className="text-muted-foreground ml-1">{format(new Date(log.created_at), 'MMM d HH:mm')}</span>
                    {log.details?.student_name && <span className="text-muted-foreground"> — {log.details.student_name}</span>}
                    {log.details?.slot_date && <span className="text-muted-foreground"> — {log.details.slot_date}</span>}
                    {log.details?.start_time && <span className="text-muted-foreground"> at {String(log.details.start_time).slice(0, 5)}</span>}
                    {log.details?.old_status && <span className="text-muted-foreground"> ({log.details.old_status} → {log.details.new_status})</span>}
                    {log.details?.previous_student && <span className="text-muted-foreground"> (was: {log.details.previous_student})</span>}
                    {log.details?.previous_time && <span className="text-muted-foreground"> (was: {log.details.previous_time})</span>}
                    {log.details?.student_email && <span className="text-muted-foreground"> ({log.details.student_email})</span>}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DraggableDialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-1.5">
          <div className="flex gap-1 flex-wrap w-full">
            {canUndoCancel && (
              <Button size="sm" variant="outline" onClick={handleUndoCancel} className="text-xs h-7"><Undo2 className="h-3 w-3 mr-1" /> Undo Cancel</Button>
            )}
            {isPending && (
              <div className="w-full space-y-2">
                <div className="flex gap-1">
                  <Button size="sm" onClick={handleConfirm} disabled={actionInProgress} className="bg-green-600 hover:bg-green-700 text-white text-xs h-7">
                    <Check className="h-3 w-3 mr-1" /> {actionInProgress ? 'Processing...' : 'Confirm'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReject} disabled={actionInProgress} className="text-destructive text-xs h-7">
                    <Ban className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="inline-comment-check" checked={showInlineComment} onChange={e => setShowInlineComment(e.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
                  <label htmlFor="inline-comment-check" className="text-xs text-muted-foreground cursor-pointer">Add comment</label>
                </div>
                {showInlineComment && (
                  <AutoResizeTextarea value={inlineComment} onChange={e => setInlineComment(e.target.value)} placeholder="Optional note for the student..." rows={2} className="text-xs" />
                )}
              </div>
            )}
            {((slot.status === 'booked' && slot.confirmed_at) || isNeedsReview) && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('completed')} className="text-xs h-7"><Check className="h-3 w-3 mr-1" /> Complete</Button>
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('no_show')} className="text-xs h-7"><AlertTriangle className="h-3 w-3 mr-1" /> No Show</Button>
              </>
            )}
            {isBooked && !isPending && slot.status !== 'cancelled' && (
              <>
                <Button size="sm" variant="outline" className="text-blue-600 text-xs h-7" onClick={handleTeacherCancellation}>
                  Teacher Cancellation
                </Button>
                <Button size="sm" variant="outline" className="text-amber-600 text-xs h-7" onClick={handleStudentCancellation}>
                  Student Cancellation
                </Button>
              </>
            )}
          </div>
          {isRecurring && hasChanges && (
            <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={handleEditSeries}>
              <Repeat className="h-3 w-3 mr-1" /> Save for Entire Series
            </Button>
          )}
          <div className="flex gap-2 w-full justify-end flex-wrap">
            {slot.status === 'deleted' && (
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={async () => {
                await onUpdate(slot.id, { status: 'available' } as any);
                try {
                  await supabase.from('calendar_slot_logs').insert({
                    slot_id: slot.id, teacher_id: slot.teacher_id, action: 'restored', actor: 'teacher',
                    details: { slot_date: slot.slot_date, start_time: slot.start_time },
                  } as any);
                } catch (_) {}
                toast.success('Slot restored to available');
                onOpenChange(false);
              }}>
                <Undo2 className="h-3 w-3 mr-1" /> Turn Available
              </Button>
            )}
            {!isBooked && slot.status !== 'completed' && slot.status !== 'deleted' && (
              <Button size="sm" variant="ghost" className="text-destructive text-xs h-8" onClick={handleDelete}>
                <Trash2 className="h-3 w-3 mr-1" /> {confirming ? 'Confirm Delete?' : 'Delete Slot'}
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={handleCancel}>Cancel</Button>
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs h-8">{saving ? 'Saving...' : 'Save Changes'}</Button>
            )}
          </div>
        </DraggableDialogFooter>
      </DraggableDialogContent>
    </DraggableDialog>

    </>
  );
}
