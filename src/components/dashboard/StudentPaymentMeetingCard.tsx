import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { DollarSign, Video, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  studentId: string;
  teacherId: string;
}

export const StudentPaymentMeetingCard: React.FC<Props> = ({ studentId, teacherId }) => {
  const [loading, setLoading] = useState(true);
  const [priceOverride, setPriceOverride] = useState<string>('');
  const [prepaidRemaining, setPrepaidRemaining] = useState(0);
  const [meetingLink, setMeetingLink] = useState('');
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [unpaidTotal, setUnpaidTotal] = useState(0);
  const [defaultPrice, setDefaultPrice] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !teacherId) return;
    const fetchData = async () => {
      setLoading(true);
      // Fetch student settings
      const { data: ss } = await supabase.from('calendar_student_settings')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .maybeSingle();

      if (ss) {
        setSettingsId(ss.id);
        setPriceOverride((ss as any).lesson_price_override?.toString() || '');
        setPrepaidRemaining((ss as any).prepaid_lessons_remaining || 0);
        setMeetingLink((ss as any).default_meeting_link || '');
      }

      // Fetch teacher settings
      const { data: ts } = await supabase.from('calendar_settings')
        .select('default_lesson_price, currency, payment_tracking_enabled')
        .eq('teacher_id', teacherId)
        .maybeSingle();

      if (ts) {
        setDefaultPrice(ts.default_lesson_price || 0);
        setCurrency(ts.currency || 'USD');
        setPaymentEnabled(ts.payment_tracking_enabled);
      }

      // Count unpaid lessons
      const { count } = await supabase.from('calendar_slots')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .eq('student_id', studentId)
        .eq('is_paid', false)
        .in('status', ['booked', 'completed', 'needs_review']);

      setUnpaidCount(count || 0);
      const effectivePrice = (ss as any)?.lesson_price_override || ts?.default_lesson_price || 0;
      setUnpaidTotal((count || 0) * effectivePrice);

      setLoading(false);
    };
    fetchData();
  }, [studentId, teacherId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {
        lesson_price_override: priceOverride ? Number(priceOverride) : null,
        prepaid_lessons_remaining: prepaidRemaining,
        default_meeting_link: meetingLink || null,
      };

      if (settingsId) {
        await supabase.from('calendar_student_settings').update(updates).eq('id', settingsId);
      } else {
        await supabase.from('calendar_student_settings').insert({
          student_id: studentId,
          teacher_id: teacherId,
          ...updates,
        } as any);
      }
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base">
          <DollarSign className="h-4 w-4 mr-2" />
          Payment & Meeting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {paymentEnabled && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Default price</span>
              <span>{defaultPrice} {currency}</span>
            </div>
            <div>
              <Label className="text-xs">Price override</Label>
              <Input
                type="number"
                className="h-8 text-sm"
                value={priceOverride}
                onChange={e => setPriceOverride(e.target.value)}
                placeholder={`${defaultPrice} (default)`}
              />
            </div>
            <div>
              <Label className="text-xs">Prepaid lessons remaining</Label>
              <Input
                type="number"
                className="h-8 text-sm"
                value={prepaidRemaining}
                onChange={e => setPrepaidRemaining(Number(e.target.value))}
              />
            </div>
            {unpaidCount > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  💰 {unpaidCount} unpaid ({unpaidTotal} {currency})
                </Badge>
              </div>
            )}
          </>
        )}

        <div>
          <Label className="text-xs flex items-center gap-1">
            <Video className="h-3 w-3" /> Default Meeting Link
          </Label>
          <Input
            className="h-8 text-sm"
            value={meetingLink}
            onChange={e => setMeetingLink(e.target.value)}
            placeholder="https://meet.google.com/..."
          />
          <p className="text-xs text-muted-foreground mt-1">
            Auto-filled for new lessons with this student
          </p>
        </div>

        <Button size="sm" className="w-full h-8" onClick={handleSave} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" /> {saving ? 'Saving...' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
};
