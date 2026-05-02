import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { addDays, format } from 'date-fns';
import { useDemoContext } from '@/contexts/DemoContext';

export interface RecurrenceRule {
  id: string;
  teacher_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_until: string | null;
  is_active: boolean;
  auto_generate_weeks_ahead: number;
  student_id: string | null;
  title: string | null;
  created_at: string;
}

export interface CreateRecurrenceInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  effective_from?: string;
  effective_until?: string | null;
  auto_generate_weeks_ahead?: number;
  student_id?: string | null;
  title?: string;
}

export function useCalendarRecurrence(teacherId?: string) {
  const [rules, setRules] = useState<RecurrenceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isDemoMode } = useDemoContext();

  const fetchRules = useCallback(async () => {
    if (!teacherId || isDemoMode) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calendar_recurrence_rules')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;
      setRules((data || []) as unknown as RecurrenceRule[]);
    } catch (err) {
      console.error('Error fetching recurrence rules:', err);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const createRule = useCallback(async (input: CreateRecurrenceInput) => {
    if (!teacherId) return null;
    try {
      const { data, error } = await supabase
        .from('calendar_recurrence_rules')
        .insert({
          teacher_id: teacherId,
          day_of_week: input.day_of_week,
          start_time: input.start_time,
          end_time: input.end_time,
          effective_from: input.effective_from || format(new Date(), 'yyyy-MM-dd'),
          effective_until: input.effective_until || null,
          auto_generate_weeks_ahead: input.auto_generate_weeks_ahead || 4,
          student_id: input.student_id || null,
          title: input.title || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const rule = data as unknown as RecurrenceRule;
      await generateSlotsForRule(rule);
      await fetchRules();
      const hasStudent = !!rule.student_id;
      toast({ title: hasStudent ? 'Recurring lesson created' : 'Recurring slot created' });
      return rule;
    } catch (err: any) {
      toast({ title: 'Error creating recurring slot', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [teacherId, toast, fetchRules]);

  // Day-by-day iteration instead of week-based
  const generateSlotsForRule = useCallback(async (rule: RecurrenceRule) => {
    if (!teacherId) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const effectiveFrom = new Date(rule.effective_from + 'T00:00:00');
    const startDate = effectiveFrom > today ? effectiveFrom : today;
    
    // Determine end date
    let endDate: Date;
    if (rule.effective_until) {
      endDate = new Date(rule.effective_until + 'T00:00:00');
    } else {
      endDate = addDays(startDate, (rule.auto_generate_weeks_ahead || 4) * 7);
    }

    // Map our day_of_week (0=Mon) to JS getDay() (0=Sun)
    const jsDayMap = [1, 2, 3, 4, 5, 6, 0]; // Mon=1, Tue=2, ..., Sun=0
    const targetJsDay = jsDayMap[rule.day_of_week];

    const slotsToCreate: any[] = [];

    // Iterate day by day
    let d = new Date(startDate);
    while (d <= endDate) {
      if (d.getDay() === targetJsDay) {
        const slotDateStr = format(d, 'yyyy-MM-dd');
        slotsToCreate.push({
          teacher_id: teacherId,
          slot_date: slotDateStr,
          start_time: rule.start_time,
          end_time: rule.end_time,
          status: rule.student_id ? 'booked' : 'available',
          booking_type: 'recurring_instance',
          recurrence_rule_id: rule.id,
          student_id: rule.student_id || null,
          title: rule.title || null,
          booked_at: rule.student_id ? new Date().toISOString() : null,
          confirmed_at: rule.student_id ? new Date().toISOString() : null,
        });
      }
      d = addDays(d, 1);
    }

    if (slotsToCreate.length === 0) return;

    // Check for existing slots to avoid duplicates
    const dates = slotsToCreate.map(s => s.slot_date);
    const { data: existing } = await supabase
      .from('calendar_slots')
      .select('slot_date, start_time, student_id, id')
      .eq('teacher_id', teacherId)
      .in('slot_date', dates)
      .neq('status', 'cancelled');

    const existingByKey = new Map<string, { student_id: string | null; id: string }>();
    for (const e of (existing || []) as any[]) {
      const key = `${e.slot_date}_${(e.start_time as string).slice(0, 5)}`;
      existingByKey.set(key, { student_id: e.student_id, id: e.id });
    }

    const newSlots: any[] = [];
    const toDelete: string[] = [];

    for (const s of slotsToCreate) {
      const key = `${s.slot_date}_${(s.start_time as string).slice(0, 5)}`;
      const ex = existingByKey.get(key);
      if (ex) {
        if (ex.student_id && s.student_id) {
          // Lesson vs lesson overlap — skip (overbooking protection)
          continue;
        }
        if (!ex.student_id && s.student_id) {
          // Available slot → replace with lesson
          toDelete.push(ex.id);
        } else {
          // Same type exists — skip
          continue;
        }
      }
      newSlots.push(s);
    }

    // Delete replaceable available slots
    if (toDelete.length > 0) {
      await supabase.from('calendar_slots').delete().in('id', toDelete);
    }

    if (newSlots.length > 0) {
      const { error } = await supabase.from('calendar_slots').insert(newSlots);
      if (error) console.error('Error generating recurring slots:', error);
    }
  }, [teacherId]);

  const deleteRule = useCallback(async (ruleId: string) => {
    try {
      const { error } = await supabase.from('calendar_recurrence_rules').delete().eq('id', ruleId);
      if (error) throw error;
      await fetchRules();
      toast({ title: 'Recurring rule deleted' });
    } catch (err: any) {
      toast({ title: 'Error deleting rule', description: err.message, variant: 'destructive' });
    }
  }, [fetchRules, toast]);

  const toggleRule = useCallback(async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('calendar_recurrence_rules').update({ is_active: isActive } as any).eq('id', ruleId);
      if (error) throw error;
      await fetchRules();
    } catch (err: any) {
      toast({ title: 'Error updating rule', description: err.message, variant: 'destructive' });
    }
  }, [fetchRules, toast]);

  return { rules, loading, createRule, deleteRule, toggleRule, generateSlotsForRule, refetch: fetchRules };
}
