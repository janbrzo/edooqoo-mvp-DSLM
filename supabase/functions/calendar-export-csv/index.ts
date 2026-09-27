import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { teacherId, dateFrom, dateTo } = await req.json();

    if (!teacherId || !dateFrom || !dateTo) {
      return new Response(JSON.stringify({ error: 'teacherId, dateFrom and dateTo are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: slots } = await supabase
      .from('calendar_slots')
      .select('id, slot_date, start_time, end_time, status, notes, is_paid, title, student_id, confirmed_at, cancelled_at, cancelled_by, meeting_link, cancellation_reason, booking_type, recurrence_rule_id, slot_type, student_notes, worksheet_id')
      .eq('teacher_id', teacherId)
      .gte('slot_date', dateFrom)
      .lte('slot_date', dateTo)
      .order('slot_date')
      .order('start_time');

    // Get student names
    const studentIds = [...new Set((slots || []).filter((s: any) => s.student_id).map((s: any) => s.student_id))];
    const studentMap: Record<string, { name: string; email: string }> = {};
    
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id, name, student_email')
        .in('id', studentIds);
      (students || []).forEach((s: any) => {
        studentMap[s.id] = { name: s.name, email: s.student_email || '' };
      });
    }

    // Get payment records
    const slotIds = (slots || []).map((s: any) => s.id);
    const paymentMap: Record<string, { amount: number; currency: string; payment_method: string }> = {};
    if (slotIds.length > 0) {
      const { data: payments } = await supabase
        .from('calendar_payment_records')
        .select('slot_id, amount, currency, payment_method')
        .eq('teacher_id', teacherId)
        .in('slot_id', slotIds);
      (payments || []).forEach((p: any) => {
        paymentMap[p.slot_id] = { amount: p.amount, currency: p.currency, payment_method: p.payment_method };
      });
    }

    // Get worksheet titles
    const worksheetIds = [...new Set((slots || []).filter((s: any) => s.worksheet_id).map((s: any) => s.worksheet_id))];
    const worksheetMap: Record<string, string> = {};
    if (worksheetIds.length > 0) {
      const { data: worksheets } = await supabase
        .from('worksheets')
        .select('id, title')
        .in('id', worksheetIds);
      (worksheets || []).forEach((w: any) => {
        worksheetMap[w.id] = w.title || '';
      });
    }

    // Escape CSV field for semicolon-separated
    const esc = (val: string) => {
      if (!val) return '';
      if (val.includes(';') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const headers = ['Date', 'Day', 'Start', 'End', 'Duration (min)', 'Student', 'Student Email', 'Status', 'Lesson Title', 'Notes', 'Paid', 'Amount', 'Currency', 'Payment Method', 'Confirmed', 'Confirmed Date', 'Cancelled By', 'Cancellation Reason', 'Meeting Link', 'Worksheet', 'Recurring', 'Type'];
    
    const rows = (slots || []).map((s: any) => {
      const st = s.student_id ? studentMap[s.student_id] : null;
      const pay = paymentMap[s.id];
      const wsTitle = s.worksheet_id ? worksheetMap[s.worksheet_id] : '';

      // Calculate duration
      const [sh, sm] = (s.start_time || '00:00').split(':').map(Number);
      const [eh, em] = (s.end_time || '00:00').split(':').map(Number);
      const duration = (eh * 60 + em) - (sh * 60 + sm);

      // Day of week
      const dayOfWeek = DAY_NAMES[new Date(s.slot_date + 'T00:00:00').getDay()] || '';

      // Effective status
      let effectiveStatus = s.status;
      if (s.status === 'booked' && !s.confirmed_at) effectiveStatus = 'pending';
      if (s.status === 'available' && s.cancelled_by === 'student') effectiveStatus = 'student_cancelled';
      if (s.status === 'available' && s.cancelled_by === 'teacher') effectiveStatus = 'teacher_cancelled';

      return [
        s.slot_date,
        dayOfWeek,
        s.start_time?.slice(0, 5),
        s.end_time?.slice(0, 5),
        duration > 0 ? String(duration) : '',
        esc(st?.name || ''),
        esc(st?.email || ''),
        effectiveStatus,
        esc(s.title || ''),
        esc(s.notes || ''),
        s.is_paid ? 'Yes' : 'No',
        pay ? String(pay.amount) : '',
        pay ? pay.currency : '',
        pay ? (pay.payment_method || '') : '',
        s.confirmed_at ? 'Yes' : 'No',
        s.confirmed_at ? s.confirmed_at.slice(0, 10) : '',
        s.cancelled_by || '',
        esc(s.cancellation_reason || ''),
        esc(s.meeting_link || ''),
        esc(wsTitle),
        s.recurrence_rule_id ? 'Yes' : 'No',
        s.slot_type || 'slot',
      ].join(';');
    });

    const BOM = '\uFEFF';
    const csv = BOM + [headers.join(';'), ...rows].join('\r\n');

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="calendar-export-${dateFrom}-${dateTo}.csv"`,
      },
    });
  } catch (err) {
    console.error('Error in calendar-export-csv:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
