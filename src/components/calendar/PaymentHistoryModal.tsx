import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DollarSign, CheckCircle } from 'lucide-react';

interface PaymentHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  students: Array<{ id: string; name: string }>;
  settings: any;
  onUpdated: () => void;
}

interface UnpaidSlot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  student_id: string;
  status: string;
  title: string | null;
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  open, onOpenChange, teacherId, students, settings, onUpdated
}) => {
  const [unpaidSlots, setUnpaidSlots] = useState<UnpaidSlot[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  const studentMap = useMemo(() => {
    const m: Record<string, string> = {};
    students.forEach(s => { m[s.id] = s.name; });
    return m;
  }, [students]);

  useEffect(() => {
    if (!open || !teacherId) return;
    setLoading(true);
    supabase
      .from('calendar_slots')
      .select('id, slot_date, start_time, end_time, student_id, status, title')
      .eq('teacher_id', teacherId)
      .eq('is_paid', false)
      .not('student_id', 'is', null)
      .in('status', ['booked', 'completed', 'needs_review'])
      .order('slot_date', { ascending: false })
      .order('start_time')
      .then(({ data, error }) => {
        if (!error) setUnpaidSlots((data || []) as UnpaidSlot[]);
        setLoading(false);
      });
  }, [open, teacherId]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === unpaidSlots.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unpaidSlots.map(s => s.id)));
    }
  };

  const handleMarkPaid = async () => {
    if (selectedIds.size === 0) return;
    setMarking(true);
    try {
      const ids = Array.from(selectedIds);
      // Update slots
      const { error } = await supabase.from('calendar_slots').update({ is_paid: true } as any).in('id', ids);
      if (error) throw error;

      // Create payment records
      const slotsToMark = unpaidSlots.filter(s => ids.includes(s.id));
      const records = await Promise.all(slotsToMark.map(async (slot) => {
        // Get student price override
        let amount = settings?.default_lesson_price || 0;
        try {
          const { data: ss } = await supabase.from('calendar_student_settings')
            .select('lesson_price_override')
            .eq('student_id', slot.student_id)
            .eq('teacher_id', teacherId)
            .maybeSingle();
          if ((ss as any)?.lesson_price_override) amount = (ss as any).lesson_price_override;
        } catch (_) {}
        return {
          teacher_id: teacherId,
          student_id: slot.student_id,
          slot_id: slot.id,
          amount,
          currency: settings?.currency || 'USD',
          payment_type: 'lesson',
          is_confirmed: true,
          confirmed_at: new Date().toISOString(),
          confirmed_by: 'teacher',
          payment_date: slot.slot_date,
        };
      }));

      if (records.length > 0) {
        await supabase.from('calendar_payment_records').insert(records as any);
      }

      toast.success(`${ids.length} lessons marked as paid`);
      setSelectedIds(new Set());
      setUnpaidSlots(prev => prev.filter(s => !ids.includes(s.id)));
      onUpdated();
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'Unknown'));
    } finally {
      setMarking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Unpaid Lessons
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : unpaidSlots.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
            All lessons are paid!
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={toggleAll}>
                {selectedIds.size === unpaidSlots.length ? 'Deselect all' : 'Select all'}
              </Button>
              <Button size="sm" className="h-7 text-xs" disabled={selectedIds.size === 0 || marking} onClick={handleMarkPaid}>
                {marking ? 'Marking...' : `Mark ${selectedIds.size} as paid`}
              </Button>
            </div>

            <div className="space-y-1">
              {unpaidSlots.map(slot => (
                <label
                  key={slot.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={selectedIds.has(slot.id)}
                    onCheckedChange={() => toggleId(slot.id)}
                  />
                  <div className="flex-1">
                    <span className="font-medium">{studentMap[slot.student_id] || 'Unknown'}</span>
                    <span className="text-muted-foreground ml-2">
                      {format(new Date(slot.slot_date), 'MMM d')} {slot.start_time.slice(0, 5)}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">{slot.status}</Badge>
                </label>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
