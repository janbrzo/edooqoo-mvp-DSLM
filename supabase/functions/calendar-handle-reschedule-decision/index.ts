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
    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, newSlotId } = await req.json();
    if (!action || !newSlotId) {
      return new Response(JSON.stringify({ error: 'action and newSlotId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the new slot
    const { data: newSlot, error: nsErr } = await supabase
      .from('calendar_slots')
      .select('*')
      .eq('id', newSlotId)
      .eq('teacher_id', user.id)
      .single();

    if (nsErr || !newSlot) {
      return new Response(JSON.stringify({ error: 'Slot not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const oldSlotId = newSlot.reschedule_request_from_slot_id;

    // Helper: resolve notifications
    const resolveNotifications = async (slotIds: string[], types: string[]) => {
      if (slotIds.length === 0) return;
      await supabase
        .from('calendar_notifications')
        .update({ is_resolved: true })
        .eq('teacher_id', user.id)
        .in('slot_id', slotIds)
        .in('notification_type', types);
    };

    // Helper: log action
    const logAction = async (slotId: string, logAction: string, details: Record<string, unknown> = {}) => {
      try {
        await supabase.from('calendar_slot_logs').insert({
          slot_id: slotId, teacher_id: user.id, action: logAction, actor: 'teacher', details,
        });
      } catch (_) {}
    };

    // Helper: get student email from slot notes
    const extractStudentEmail = (notes: string | null): string => {
      if (!notes) return '';
      const match = notes.match(/\(([^)]+@[^)]+)\)/);
      return match ? match[1] : '';
    };

    // Helper: get student name
    const getStudentName = async (studentId: string | null, notes: string | null): Promise<string> => {
      if (studentId) {
        const { data } = await supabase.from('students').select('name').eq('id', studentId).maybeSingle();
        if (data?.name) return data.name;
      }
      if (notes) {
        const match = notes.match(/^Booked by: ([^(]+)/);
        if (match) return match[1].trim();
      }
      return 'Student';
    };

    // Get teacher info for emails
    const { data: teacherProfile } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();
    const teacherName = [teacherProfile?.first_name, teacherProfile?.last_name].filter(Boolean).join(' ') || 'Your Teacher';
    const teacherEmail = teacherProfile?.email || '';

    // Get calendar settings for bookUrl
    const { data: calSettings } = await supabase
      .from('calendar_settings')
      .select('public_calendar_token')
      .eq('teacher_id', user.id)
      .maybeSingle();

    const studentEmail = extractStudentEmail(newSlot.student_notes);
    const studentName = await getStudentName(newSlot.student_id, newSlot.student_notes);
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com';
    const bookUrl = calSettings?.public_calendar_token ? `${appBaseUrl}/book/${calSettings.public_calendar_token}` : '';
    const calendarUrl = `${appBaseUrl}/calendar`;

    if (action === 'confirm') {
      // Confirm the new slot
      await supabase
        .from('calendar_slots')
        .update({
          confirmed_at: new Date().toISOString(),
          reschedule_request_from_slot_id: null,
        })
        .eq('id', newSlotId);

      await logAction(newSlotId, 'confirmed', {
        student_name: studentName, student_email: studentEmail,
        slot_date: newSlot.slot_date, start_time: newSlot.start_time, end_time: newSlot.end_time,
        source: 'reschedule_confirm',
      });

      // Revert old slot to available
      if (oldSlotId) {
        await supabase
          .from('calendar_slots')
          .update({
            student_id: null, status: 'available', booking_type: 'manual',
            booked_at: null, booked_by: null, confirmed_at: null,
            student_notes: null, title: null, worksheet_id: null,
            reschedule_request_to_slot_id: null,
            cancelled_at: new Date().toISOString(), cancelled_by: 'system',
            cancellation_reason: `Rescheduled to ${newSlot.slot_date} ${newSlot.start_time.slice(0, 5)}`,
          })
          .eq('id', oldSlotId);

        await logAction(oldSlotId, 'freed_by_reschedule', {
          new_slot_id: newSlotId, student_name: studentName,
          slot_date: newSlot.slot_date, start_time: newSlot.start_time,
        });
      }

      // Resolve notifications
      const slotIds = [newSlotId];
      if (oldSlotId) slotIds.push(oldSlotId);
      await resolveNotifications(slotIds, ['reschedule_request', 'booking_pending', 'reschedule']);

      // Send email: reschedule_confirmation to student
      if (studentEmail) {
        const { data: oldSlotData } = oldSlotId
          ? await supabase.from('calendar_slots').select('slot_date, start_time').eq('id', oldSlotId).maybeSingle()
          : { data: null };

        // Get meeting link for new slot
        let meetingLink = newSlot.meeting_link || '';
        if (!meetingLink && newSlot.student_id) {
          const { data: css } = await supabase.from('calendar_student_settings')
            .select('default_meeting_link')
            .eq('student_id', newSlot.student_id)
            .eq('teacher_id', user.id)
            .maybeSingle();
          if (css?.default_meeting_link) meetingLink = css.default_meeting_link;
        }

        await fetch(`${supabaseUrl}/functions/v1/send-calendar-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'reschedule_confirmation', studentEmail, studentName,
            slotDate: newSlot.slot_date, slotTime: newSlot.start_time.slice(0, 5),
            teacherName, teacherEmail, bookUrl, calendarUrl,
            oldSlotDate: oldSlotData?.slot_date, oldSlotTime: oldSlotData?.start_time?.slice(0, 5),
            meetingLink,
          }),
        }).catch(console.error);
      }

      // GCal sync — teacher: upsert old (now available/rescheduled) + upsert new (now confirmed)
      try {
        if (oldSlotId) {
          await fetch(`${supabaseUrl}/functions/v1/gcal-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ teacherId: user.id, slotId: oldSlotId, action: 'upsert' }),
          });
        }
        await fetch(`${supabaseUrl}/functions/v1/gcal-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({ teacherId: user.id, slotId: newSlotId, action: 'upsert' }),
        });
      } catch (_) {}
      // Student GCal sync — delete old event, upsert new as Booked
      if (studentEmail) {
        try {
          if (oldSlotId) {
            await fetch(`${supabaseUrl}/functions/v1/student-gcal-sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
              body: JSON.stringify({ email: studentEmail, teacherId: user.id, slotId: oldSlotId, action: 'delete' }),
            });
          }
          await fetch(`${supabaseUrl}/functions/v1/student-gcal-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ email: studentEmail, teacherId: user.id, slotId: newSlotId, action: 'upsert' }),
          });
        } catch (_) {}
      }

      return new Response(JSON.stringify({ success: true, action: 'confirmed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'reject') {
      // Revert new slot to available
      await supabase
        .from('calendar_slots')
        .update({
          student_id: null, status: 'available', booking_type: 'manual',
          booked_at: null, booked_by: null, confirmed_at: null,
          student_notes: null, title: null, reschedule_request_from_slot_id: null,
        })
        .eq('id', newSlotId);

      await logAction(newSlotId, 'reschedule_rejected', {
        student_name: studentName, student_email: studentEmail,
        slot_date: newSlot.slot_date, start_time: newSlot.start_time,
      });

      // Clean up old slot's pointer
      if (oldSlotId) {
        await supabase
          .from('calendar_slots')
          .update({ reschedule_request_to_slot_id: null })
          .eq('id', oldSlotId);
      }

      // Resolve notifications
      const slotIds = [newSlotId];
      if (oldSlotId) slotIds.push(oldSlotId);
      await resolveNotifications(slotIds, ['reschedule_request', 'booking_pending', 'reschedule']);

      // Send email: reschedule_rejected to student
      if (studentEmail) {
        await fetch(`${supabaseUrl}/functions/v1/send-calendar-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'reschedule_rejected', studentEmail, studentName,
            slotDate: newSlot.slot_date, slotTime: newSlot.start_time.slice(0, 5),
            teacherName, teacherEmail, bookUrl, calendarUrl,
          }),
        }).catch(console.error);
      }

      // GCal sync — remove pending from both calendars
      try {
        await fetch(`${supabaseUrl}/functions/v1/gcal-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({ teacherId: user.id, slotId: newSlotId, action: 'cancel' }),
        });
      } catch (_) {}
      if (studentEmail) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/student-gcal-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ email: studentEmail, teacherId: user.id, slotId: newSlotId, action: 'delete' }),
          });
        } catch (_) {}
      }

      return new Response(JSON.stringify({ success: true, action: 'rejected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in calendar-handle-reschedule-decision:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
