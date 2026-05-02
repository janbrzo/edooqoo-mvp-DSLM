import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AutoResizeTextarea } from '@/components/ui/AutoResizeTextarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarNotification } from '@/hooks/useCalendarNotifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, Ban, Loader2, Calendar, Info } from 'lucide-react';
import { format } from 'date-fns';

interface Student {
  id: string;
  name: string;
}

interface RecurringBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: CalendarNotification;
  teacherId: string;
  students: Student[];
  onDone: () => void;
}

interface SlotInfo {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  confirmed_at: string | null;
  student_id: string | null;
}

export function RecurringBookingModal({ open, onOpenChange, notification, teacherId, students, onDone }: RecurringBookingModalProps) {
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const slotIds = (notification.metadata as any)?.slot_ids || [];
  const studentName = notification.student_name || 'Student';
  const studentEmail = (notification.metadata as any)?.student_email || '';

  const fetchSlots = () => {
    if (slotIds.length === 0) return;
    setLoading(true);
    supabase.from('calendar_slots')
      .select('id, slot_date, start_time, end_time, status, confirmed_at, student_id')
      .in('id', slotIds)
      .order('slot_date', { ascending: true })
      .then(({ data }) => {
        setSlots((data || []) as SlotInfo[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    fetchSlots();
  }, [open, notification.id]);

  const pendingSlots = slots.filter(s => s.status === 'booked' && !s.confirmed_at);
  const pendingIds = pendingSlots.map(s => s.id);

  const actionIds = selectedIds.size > 0 ? Array.from(selectedIds) : pendingIds;
  const actionCount = actionIds.length;
  const isPartial = selectedIds.size > 0 && selectedIds.size < pendingIds.length;

  const handleConfirmSelected = async (ids: string[]) => {
    if (ids.length === 0) return;
    setActionInProgress(true);
    try {
      const { error } = await supabase.from('calendar_slots')
        .update({ confirmed_at: new Date().toISOString() } as any)
        .in('id', ids)
        .eq('teacher_id', teacherId);
      if (error) throw error;

      for (const id of ids) {
        supabase.from('calendar_slot_logs').insert({
          slot_id: id, teacher_id: teacherId, action: 'confirmed', actor: 'teacher',
          details: { batch: true, recurring: true, comment: comment || undefined },
        } as any).then(() => {});
        supabase.functions.invoke('gcal-sync', {
          body: { teacherId, slotId: id, action: 'upsert' },
        }).catch(console.error);
        // Student GCal sync
        if (studentEmail) {
          supabase.functions.invoke('student-gcal-sync', {
            body: { email: studentEmail, teacherId, slotId: id, action: 'upsert' },
          }).catch(console.error);
        }
      }

      const allHandled = ids.length >= pendingIds.length;

      if (allHandled) {
        await supabase.from('calendar_notifications')
          .update({ is_resolved: true, resolved_action: 'approved' } as any)
          .eq('id', notification.id);
      }

      // Send confirmation email
      try {
        const firstSlot = pendingSlots[0];
        if (firstSlot) {
          await supabase.functions.invoke('send-calendar-notification-email', {
            body: {
              teacherId,
              slotId: firstSlot.id,
              type: 'booking_confirmation',
              confirmationComment: comment || undefined,
            },
          });
        }
      } catch (_) {}

      toast.success(`Confirmed ${ids.length} recurring lessons`);

      if (allHandled) {
        onDone();
      } else {
        // Partial — refresh slots, clear selection
        setSelectedIds(new Set());
        fetchSlots();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRejectSelected = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`Reject ${ids.length} booking(s)?`)) return;
    setActionInProgress(true);
    try {
      const { error } = await supabase.from('calendar_slots')
        .update({
          status: 'available', student_id: null, booked_at: null,
          booked_by: null, confirmed_at: null, student_notes: null, title: null,
        } as any)
        .in('id', ids)
        .eq('teacher_id', teacherId);
      if (error) throw error;

      for (const id of ids) {
        supabase.from('calendar_slot_logs').insert({
          slot_id: id, teacher_id: teacherId, action: 'rejected', actor: 'teacher',
          details: { batch: true, recurring: true, comment: comment || undefined },
        } as any).then(() => {});
        supabase.functions.invoke('gcal-sync', {
          body: { teacherId, slotId: id, action: 'cancel' },
        }).catch(console.error);
        // Student GCal sync
        if (studentEmail) {
          supabase.functions.invoke('student-gcal-sync', {
            body: { email: studentEmail, teacherId, slotId: id, action: 'delete' },
          }).catch(console.error);
        }
      }

      const allHandled = ids.length >= pendingIds.length;

      if (allHandled) {
        await supabase.from('calendar_notifications')
          .update({ is_resolved: true, resolved_action: 'rejected' } as any)
          .eq('id', notification.id);
      }

      // Send rejection email
      try {
        const firstSlot = pendingSlots[0];
        if (firstSlot) {
          await supabase.functions.invoke('send-calendar-notification-email', {
            body: {
              teacherId,
              slotId: firstSlot.id,
              type: 'booking_rejected',
              rejectionReason: comment || undefined,
            },
          });
        }
      } catch (_) {}

      toast.success(`Rejected ${ids.length} recurring bookings`);

      if (allHandled) {
        onDone();
      } else {
        setSelectedIds(new Set());
        fetchSlots();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject');
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Recurring Booking Request
          </DialogTitle>
          <DialogDescription>
            {studentName} {studentEmail && `(${studentEmail})`} requested {slotIds.length} recurring lessons.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select All */}
            {pendingIds.length > 1 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === pendingIds.length && pendingIds.length > 0}
                  onCheckedChange={(checked) => {
                    setSelectedIds(checked ? new Set(pendingIds) : new Set());
                  }}
                />
                <span className="text-xs font-medium">Select All ({pendingIds.length} pending)</span>
              </div>
            )}

            {/* Slot list */}
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
              {slots.map(s => {
                const isPending = s.status === 'booked' && !s.confirmed_at;
                const isConfirmed = s.status === 'booked' && !!s.confirmed_at;
                return (
                  <div key={s.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-b-0">
                    {isPending && (
                      <Checkbox
                        checked={selectedIds.has(s.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            checked ? next.add(s.id) : next.delete(s.id);
                            return next;
                          });
                        }}
                      />
                    )}
                    <span className="font-medium flex-1">
                      {format(new Date(s.slot_date), 'EEE, MMM d')} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </span>
                    <span className={isPending ? 'text-amber-600' : isConfirmed ? 'text-green-600' : 'text-muted-foreground'}>
                      {isPending ? 'Pending' : isConfirmed ? 'Confirmed' : s.status}
                    </span>
                  </div>
                );
              })}
            </div>

            {pendingIds.length < slotIds.length && pendingIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {slotIds.length - pendingIds.length} of {slotIds.length} lessons already confirmed or changed.
                Actions below apply to {pendingIds.length} pending lessons only.
              </p>
            )}

            {pendingIds.length === 0 && (
              <p className="text-xs text-muted-foreground">All lessons have already been confirmed or changed.</p>
            )}

            <div className="flex items-start gap-2 bg-muted/50 rounded-md p-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>You can also confirm or reject individual lessons by clicking on them in the calendar.</span>
            </div>

            {/* Inline comment */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="recurring-comment" checked={showComment} onChange={e => setShowComment(e.target.checked)} className="h-3.5 w-3.5 rounded" />
                <label htmlFor="recurring-comment" className="text-xs text-muted-foreground cursor-pointer">Add comment</label>
              </div>
              {showComment && (
                <AutoResizeTextarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional note for the student..." rows={2} className="text-xs" />
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button size="sm" onClick={() => handleConfirmSelected(actionIds)} disabled={actionInProgress || actionCount === 0} className="bg-green-600 hover:bg-green-700 text-white text-xs">
            <Check className="h-3 w-3 mr-1" /> {actionInProgress ? 'Processing...' : isPartial ? `Confirm Selected (${actionCount})` : `Confirm All (${actionCount})`}
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleRejectSelected(actionIds)} disabled={actionInProgress || actionCount === 0} className="text-destructive text-xs">
            <Ban className="h-3 w-3 mr-1" /> {isPartial ? `Reject Selected (${actionCount})` : `Reject All (${actionCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
