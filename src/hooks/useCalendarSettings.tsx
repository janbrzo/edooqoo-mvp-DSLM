import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDemoContext } from '@/contexts/DemoContext';

export interface CalendarSettings {
  id: string;
  teacher_id: string;
  default_booking_mode: 'auto_confirm' | 'requires_confirmation';
  max_slots_per_student_per_week: number | null;
  enforce_slot_limit: boolean;
  default_lesson_duration_minutes: number;
  public_calendar_enabled: boolean;
  public_calendar_token: string | null;
  notify_on_booking: boolean;
  notify_on_cancellation: boolean;
  notify_student_reminder_hours: number | null;
  notify_payment_reminder: boolean;
  payment_tracking_enabled: boolean;
  default_lesson_price: number | null;
  currency: string | null;
  min_cancellation_hours: number | null;
  gcal_integration_enabled: boolean;
  gcal_default_color: string | null;
  gcal_default_reminder_minutes: number | null;
  gcal_color_booked: string | null;
  gcal_color_available: string | null;
  gcal_color_pending: string | null;
  gcal_color_completed: string | null;
  gcal_color_no_show: string | null;
  gcal_sync_mode: string;
  gcal_sync_booked: boolean;
  gcal_sync_pending: boolean;
  gcal_sync_available_new: boolean;
  gcal_sync_available_on_cancel: boolean;
  auto_create_meet_link: boolean;
  timezone: string;
  display_start_hour: number;
  display_end_hour: number;
  allow_student_reschedule: boolean;
  buffer_minutes: number;
  notify_email_on_booking: boolean;
  notify_email_on_cancellation: boolean;
  notify_email_on_reschedule: boolean;
  notify_email_on_confirmation: boolean;
  notify_email_on_rejection: boolean;
  notify_email_on_lesson_created: boolean;
}

const DEFAULT_SETTINGS: Omit<CalendarSettings, 'id' | 'teacher_id'> = {
  default_booking_mode: 'requires_confirmation',
  max_slots_per_student_per_week: null,
  enforce_slot_limit: false,
  default_lesson_duration_minutes: 60,
  public_calendar_enabled: true,
  public_calendar_token: null,
  notify_on_booking: true,
  notify_on_cancellation: true,
  notify_student_reminder_hours: 24,
  notify_payment_reminder: false,
  payment_tracking_enabled: false,
  default_lesson_price: null,
  currency: 'USD',
  min_cancellation_hours: 24,
  gcal_integration_enabled: false,
  gcal_default_color: '9',
  gcal_default_reminder_minutes: 30,
  gcal_color_booked: '9',
  gcal_color_available: '2',
  gcal_color_pending: '5',
  gcal_color_completed: '10',
  gcal_color_no_show: '6',
  gcal_sync_mode: 'booked_only',
  gcal_sync_booked: true,
  gcal_sync_pending: true,
  gcal_sync_available_new: false,
  gcal_sync_available_on_cancel: true,
  auto_create_meet_link: false,
  timezone: 'Europe/Warsaw',
  display_start_hour: 7,
  display_end_hour: 22,
  allow_student_reschedule: false,
  buffer_minutes: 0,
  notify_email_on_booking: true,
  notify_email_on_cancellation: true,
  notify_email_on_reschedule: true,
  notify_email_on_confirmation: true,
  notify_email_on_rejection: true,
  notify_email_on_lesson_created: true,
};

export function useCalendarSettings(teacherId?: string) {
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();

  const fetchSettings = useCallback(async () => {
    if (isDemoMode) {
      setSettings({
        id: 'demo-calendar-settings',
        teacher_id: 'demo-teacher',
        ...DEFAULT_SETTINGS,
        public_calendar_enabled: true,
        public_calendar_token: 'demo-public-token',
        payment_tracking_enabled: true,
      } as CalendarSettings);
      setLoading(false);
      return;
    }
    if (!teacherId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calendar_settings')
        .select('*')
        .eq('teacher_id', teacherId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as unknown as CalendarSettings);
      } else {
        // Auto-generate public calendar token for new settings
        const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const { data: newData, error: insertError } = await supabase
          .from('calendar_settings')
          .insert({ teacher_id: teacherId, ...DEFAULT_SETTINGS, public_calendar_enabled: true, public_calendar_token: token })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newData as unknown as CalendarSettings);
      }
    } catch (err) {
      console.error('Error fetching calendar settings:', err);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSettings = useCallback(async (updates: Partial<CalendarSettings>) => {
    if (isDemoMode) { showDemoBlockedToast('Editing calendar settings'); return; }
    if (!settings) return;
    try {
      const { error } = await supabase
        .from('calendar_settings')
        .update(updates as any)
        .eq('id', settings.id);

      if (error) throw error;
      setSettings(prev => prev ? { ...prev, ...updates } : prev);
      toast({ title: 'Settings saved' });
    } catch (err: any) {
      toast({ title: 'Error saving settings', description: err.message, variant: 'destructive' });
    }
  }, [settings, toast]);

  const generatePublicToken = useCallback(async () => {
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    await updateSettings({ public_calendar_enabled: true, public_calendar_token: token });
    return token;
  }, [updateSettings]);

  return { settings, loading, updateSettings, generatePublicToken, refetch: fetchSettings };
}
