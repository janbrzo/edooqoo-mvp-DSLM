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
    const { token, email, action, slotId, newSlotId, slotIds, studentName: reqStudentName, includePast } = await req.json();

    if (!token || !email) {
      return new Response(JSON.stringify({ error: 'Token and email are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token (try hub_token first, fallback to public_calendar_token)
    const selectCols = 'teacher_id, min_cancellation_hours, allow_student_reschedule, timezone, public_calendar_token, default_booking_mode, notify_email_on_booking, notify_email_on_cancellation, notify_email_on_reschedule, notify_email_on_confirmation, notify_email_on_rejection, gcal_on_cancel_action';
    let settingsData;
    const { data: byHub } = await supabase
      .from('calendar_settings')
      .select(selectCols)
      .eq('hub_token', token)
      .maybeSingle();

    if (byHub) {
      settingsData = byHub;
    } else {
      const { data: byCalendar } = await supabase
        .from('calendar_settings')
        .select(selectCols)
        .eq('public_calendar_token', token)
        .eq('public_calendar_enabled', true)
        .maybeSingle();
      settingsData = byCalendar;
    }

    if (!settingsData) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const teacherId = settingsData.teacher_id;
    const teacherTz = settingsData.timezone || 'Europe/Warsaw';

    // Find student by email
    const { data: student } = await supabase
      .from('students')
      .select('id, name')
      .eq('teacher_id', teacherId)
      .ilike('student_email', email.toLowerCase().trim())
      .maybeSingle();

    const studentName = student?.name || email;

    // Helper: get teacher info for emails
    const getTeacherInfo = async () => {
      const { data: p } = await supabase.from('profiles').select('email, first_name, last_name').eq('id', teacherId).maybeSingle();
      const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Your Teacher';
      return { teacherName: name, teacherEmail: p?.email || '' };
    };

    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com';
    const bookUrl = `${appBaseUrl}/book/${settingsData.public_calendar_token}`;
    const calendarUrl = `${appBaseUrl}/calendar`;

    // Helper: send email
    const sendEmail = async (type: string, params: Record<string, any>) => {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-calendar-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, ...params }),
        });
      } catch (e) { console.error('Email send error:', e); }
    };

    // Helper: log action
    const logAction = async (logSlotId: string, logAct: string, details: Record<string, unknown> = {}) => {
      try {
        await supabase.from('calendar_slot_logs').insert({
          slot_id: logSlotId, teacher_id: teacherId, action: logAct, actor: 'student',
          details: { student_email: email, student_name: studentName, ...details },
        });
      } catch (_) {}
    };

    // Helper: resolve notifications
    const resolveNotifications = async (resolveSlotIds: string[], types: string[]) => {
      if (resolveSlotIds.length === 0) return;
      await supabase
        .from('calendar_notifications')
        .update({ is_resolved: true })
        .eq('teacher_id', teacherId)
        .in('slot_id', resolveSlotIds)
        .in('notification_type', types);
    };

    // Helper: calculate hours until lesson using teacher timezone
    const hoursUntilLesson = (slotDate: string, startTime: string): number => {
      const lessonStr = `${slotDate}T${startTime.slice(0, 5)}:00`;
      const lessonDate = new Date(lessonStr);
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: teacherTz, hour: 'numeric', timeZoneName: 'longOffset' });
      const parts = formatter.formatToParts(new Date());
      const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
      const offsetMatch = offsetPart.match(/GMT([+-])(\d{2}):(\d{2})/);
      let tzOffsetMinutes = 0;
      if (offsetMatch) {
        const sign = offsetMatch[1] === '+' ? 1 : -1;
        tzOffsetMinutes = sign * (parseInt(offsetMatch[2]) * 60 + parseInt(offsetMatch[3]));
      }
      const lessonUtc = new Date(lessonDate.getTime() - tzOffsetMinutes * 60 * 1000);
      return (lessonUtc.getTime() - Date.now()) / (1000 * 60 * 60);
    };

    // Handle CANCEL
    if (action === 'cancel' && slotId) {
      const { data: slot } = await supabase
        .from('calendar_slots').select('*').eq('id', slotId).eq('teacher_id', teacherId).single();

      if (!slot) {
        return new Response(JSON.stringify({ error: 'Slot not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const isPending = slot.status === 'booked' && !slot.confirmed_at;
      if (!isPending && settingsData.min_cancellation_hours) {
        const hours = hoursUntilLesson(slot.slot_date, slot.start_time);
        if (hours < settingsData.min_cancellation_hours) {
          return new Response(JSON.stringify({ error: `Cannot cancel less than ${settingsData.min_cancellation_hours} hours before the lesson` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      if (isPending) {
        // Request withdrawal — no cancellation record, no badge C
        await supabase
          .from('calendar_slots')
          .update({
            student_id: null, status: 'available', booking_type: 'manual',
            booked_at: null, booked_by: null, confirmed_at: null,
            student_notes: null, title: null,
            recurrence_rule_id: null,
          })
          .eq('id', slotId);
      } else {
        // Confirmed lesson cancellation — keep cancellation record
        await supabase
          .from('calendar_slots')
          .update({
            student_id: null, status: 'available', booking_type: 'manual',
            booked_at: null, booked_by: null, confirmed_at: null,
            student_notes: null, title: null,
            cancelled_at: new Date().toISOString(), cancelled_by: 'student',
            cancellation_reason: `Cancelled by student (${email})`,
            recurrence_rule_id: null,
          })
          .eq('id', slotId);
      }

      await logAction(slotId, 'cancelled_by_student', {
        slot_date: slot.slot_date, start_time: slot.start_time, end_time: slot.end_time,
        was_pending: isPending,
      });

      await resolveNotifications([slotId], ['booking_pending', 'booking_confirmed']);

      // GCal sync for student cancellation
      if (!isPending && slot.gcal_event_id) {
        try {
          const gcalAction = (settingsData as any).gcal_on_cancel_action === 'delete' ? 'delete' : 'cancel';
          await fetch(`${supabaseUrl}/functions/v1/gcal-sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ teacherId, slotId, action: gcalAction }),
          });
        } catch (gcalErr) {
          console.error('GCal sync failed for student cancellation:', gcalErr);
        }
      }

      // Different message for pending request vs confirmed lesson
      const messageText = isPending
        ? `${studentName} cancelled request for a lesson on ${slot.slot_date} at ${slot.start_time.slice(0, 5)}`
        : `${studentName} cancelled lesson on ${slot.slot_date} at ${slot.start_time.slice(0, 5)}`;

      await supabase.from('calendar_notifications').insert({
        teacher_id: teacherId, notification_type: 'cancellation',
        message: messageText,
        student_name: studentName, slot_id: slotId,
        metadata: { student_email: email, slot_date: slot.slot_date, start_time: slot.start_time.slice(0, 5), end_time: slot.end_time.slice(0, 5), was_pending: isPending },
      });

      const { teacherName, teacherEmail } = await getTeacherInfo();
      if (!isPending && settingsData.notify_email_on_cancellation) {
        await sendEmail('cancellation_teacher', {
          teacherEmail, studentEmail: email, studentName,
          slotDate: slot.slot_date, slotTime: slot.start_time.slice(0, 5),
          teacherName, bookUrl, calendarUrl,
        });
        await sendEmail('cancellation_confirmed_by_student', {
          studentEmail: email, studentName,
          slotDate: slot.slot_date, slotTime: slot.start_time.slice(0, 5),
          teacherName, teacherEmail, bookUrl, calendarUrl,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle RESCHEDULE
    if (action === 'reschedule' && slotId && newSlotId) {
      const { data: oldSlot } = await supabase
        .from('calendar_slots').select('*').eq('id', slotId).single();

      if (!oldSlot) {
        return new Response(JSON.stringify({ error: 'Original slot not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: newSlotData } = await supabase
        .from('calendar_slots').select('slot_date, start_time, end_time').eq('id', newSlotId).single();

      const { teacherName, teacherEmail } = await getTeacherInfo();

      const oldIsPending = oldSlot.status === 'booked' && !oldSlot.confirmed_at;

      if (settingsData.allow_student_reschedule) {
        // AUTO RESCHEDULE
        await supabase
          .from('calendar_slots')
          .update({
            student_id: null, status: 'available', booking_type: 'manual',
            booked_at: null, booked_by: null, confirmed_at: null,
            student_notes: null, title: null,
            cancelled_at: new Date().toISOString(), cancelled_by: 'student',
            cancellation_reason: `Rescheduled by student (${email}) to new slot`,
            recurrence_rule_id: null,
          })
          .eq('id', slotId);

        const { data: updateResult } = await supabase
          .from('calendar_slots')
          .update({
            student_id: oldSlot.student_id,
            status: 'booked', booking_type: 'student_booked',
            booked_at: new Date().toISOString(), booked_by: 'student',
            confirmed_at: new Date().toISOString(),
            student_notes: oldSlot.student_notes,
            title: `${studentName} — English lesson`,
          })
          .eq('id', newSlotId)
          .eq('status', 'available')
          .select();

        if (!updateResult || updateResult.length === 0) {
          return new Response(JSON.stringify({ success: false, error: 'Slot no longer available' }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await logAction(slotId, 'rescheduled', { new_slot_id: newSlotId, slot_date: oldSlot.slot_date, start_time: oldSlot.start_time });
        await logAction(newSlotId, 'booked', { rescheduled_from: slotId, student_email: email, slot_date: newSlotData?.slot_date, start_time: newSlotData?.start_time });

        await resolveNotifications([slotId], ['booking_pending', 'booking_confirmed']);

        await supabase.from('calendar_notifications').insert({
          teacher_id: teacherId, notification_type: 'reschedule',
          message: `${studentName} rescheduled: ${oldSlot.slot_date} ${oldSlot.start_time.slice(0, 5)} → ${newSlotData?.slot_date} ${newSlotData?.start_time?.slice(0, 5)}`,
          student_name: studentName, slot_id: newSlotId,
          metadata: { old_slot_id: slotId, new_slot_id: newSlotId, student_email: email },
        });

        // Get meeting link for reschedule confirmation email
        let rescheduleMeetingLink = updateResult?.[0]?.meeting_link || '';
        if (!rescheduleMeetingLink && oldSlot.student_id) {
          const { data: css } = await supabase.from('calendar_student_settings')
            .select('default_meeting_link')
            .eq('student_id', oldSlot.student_id)
            .eq('teacher_id', teacherId)
            .maybeSingle();
          if (css?.default_meeting_link) rescheduleMeetingLink = css.default_meeting_link;
        }

        await sendEmail('reschedule_confirmation', {
          studentEmail: email, studentName,
          slotDate: newSlotData?.slot_date, slotTime: newSlotData?.start_time?.slice(0, 5),
          teacherName, teacherEmail, bookUrl, calendarUrl,
          oldSlotDate: oldSlot.slot_date, oldSlotTime: oldSlot.start_time.slice(0, 5),
          meetingLink: rescheduleMeetingLink,
        });

        // GCal sync for reschedule — teacher + student
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        try {
          await fetch(`${supabaseUrl}/functions/v1/gcal-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ teacherId, slotId, action: 'cancel' }),
          });
          await fetch(`${supabaseUrl}/functions/v1/gcal-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ teacherId, slotId: newSlotId, action: 'upsert' }),
          });
        } catch (_) {}
        try {
          await fetch(`${supabaseUrl}/functions/v1/student-gcal-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ email, teacherId, slotId, action: 'delete' }),
          });
          await fetch(`${supabaseUrl}/functions/v1/student-gcal-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ email, teacherId, slotId: newSlotId, action: 'upsert' }),
          });
        } catch (_) {}

        return new Response(JSON.stringify({ success: true, autoRescheduled: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // REQUIRES CONFIRMATION
        if (oldIsPending) {
          await supabase
            .from('calendar_slots')
            .update({
              student_id: null, status: 'available', booking_type: 'manual',
              booked_at: null, booked_by: null, confirmed_at: null,
              student_notes: null, title: null,
              cancelled_at: new Date().toISOString(), cancelled_by: 'student',
              cancellation_reason: `Replaced by reschedule request (${email})`,
              recurrence_rule_id: null,
            })
            .eq('id', slotId);

          await resolveNotifications([slotId], ['booking_pending']);
        } else {
          await supabase
            .from('calendar_slots')
            .update({ reschedule_request_to_slot_id: newSlotId })
            .eq('id', slotId);
        }

        const { data: updateResult } = await supabase
          .from('calendar_slots')
          .update({
            student_id: oldSlot.student_id,
            status: 'booked', booking_type: 'student_booked',
            booked_at: new Date().toISOString(), booked_by: 'student',
            confirmed_at: null,
            student_notes: `Reschedule from ${oldSlot.slot_date} ${oldSlot.start_time.slice(0, 5)}. ${oldSlot.student_notes || ''}`.trim(),
            title: `${studentName} — English lesson`,
            reschedule_request_from_slot_id: slotId,
          })
          .eq('id', newSlotId)
          .eq('status', 'available')
          .select();

        if (!updateResult || updateResult.length === 0) {
          if (!oldIsPending) {
            await supabase.from('calendar_slots').update({ reschedule_request_to_slot_id: null }).eq('id', slotId);
          }
          return new Response(JSON.stringify({ success: false, error: 'Slot no longer available' }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await logAction(newSlotId, 'reschedule_requested', {
          old_slot_id: slotId, old_date: oldSlot.slot_date, old_time: oldSlot.start_time,
          slot_date: newSlotData?.slot_date, start_time: newSlotData?.start_time,
        });

        // Problem 8C: updated reschedule message format
        await supabase.from('calendar_notifications').insert({
          teacher_id: teacherId, notification_type: 'reschedule_request',
          message: `${studentName} requests to reschedule: ${oldSlot.slot_date} ${oldSlot.start_time.slice(0, 5)} → ${newSlotData?.slot_date} ${newSlotData?.start_time?.slice(0, 5)} — awaiting confirmation`,
          student_name: studentName, slot_id: newSlotId,
          metadata: { old_slot_id: slotId, new_slot_id: newSlotId, student_email: email, old_date: oldSlot.slot_date, old_time: oldSlot.start_time.slice(0, 5) },
        });

        await sendEmail('reschedule_pending', {
          studentEmail: email, studentName,
          slotDate: newSlotData?.slot_date, slotTime: newSlotData?.start_time?.slice(0, 5),
          teacherName, teacherEmail, bookUrl, calendarUrl,
        });
        await sendEmail('reschedule_request_teacher', {
          teacherEmail, studentEmail: email, studentName,
          slotDate: newSlotData?.slot_date, slotTime: newSlotData?.start_time?.slice(0, 5),
          teacherName, bookUrl, calendarUrl,
          oldSlotDate: oldSlot.slot_date, oldSlotTime: oldSlot.start_time.slice(0, 5),
        });

        // GCal sync for reschedule request — upsert new pending slot
        const supabaseUrl2 = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey2 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        try {
          await fetch(`${supabaseUrl2}/functions/v1/gcal-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey2}` },
            body: JSON.stringify({ teacherId, slotId: newSlotId, action: 'upsert' }),
          });
          await fetch(`${supabaseUrl2}/functions/v1/student-gcal-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey2}` },
            body: JSON.stringify({ email, teacherId, slotId: newSlotId, action: 'upsert' }),
          });
        } catch (_) {}

        return new Response(JSON.stringify({ success: true, autoRescheduled: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle BOOK_BATCH (weekly booking)
    if (action === 'book_batch' && Array.isArray(slotIds) && slotIds.length > 0) {
      const normalizedEmail = email.toLowerCase().trim();
      const batchStudentName = reqStudentName || studentName;
      const autoConfirm = settingsData.default_booking_mode === 'auto_confirm';
      const successIds: string[] = [];
      const failedIds: string[] = [];

      for (const sid of slotIds) {
        const { data: check } = await supabase
          .from('calendar_slots').select('status, slot_type').eq('id', sid).single();
        if (!check || check.status !== 'available' || check.slot_type === 'block') {
          failedIds.push(sid);
          continue;
        }

        const { error: bookErr } = await supabase
          .from('calendar_slots')
          .update({
            student_id: student?.id || null,
            status: 'booked',
            booking_type: 'student_booked',
            booked_at: new Date().toISOString(),
            booked_by: 'student',
            confirmed_at: autoConfirm ? new Date().toISOString() : null,
            student_notes: `Booked by: ${batchStudentName} (${normalizedEmail})`,
            title: `${batchStudentName} — English lesson`,
          })
          .eq('id', sid)
          .eq('status', 'available');

        if (!bookErr) {
          successIds.push(sid);
          await logAction(sid, 'booked', { student_email: normalizedEmail, student_name: batchStudentName, batch: true });
        } else {
          failedIds.push(sid);
        }
      }

      // Problem 8B: One notification with updated batch message format
      if (successIds.length > 0) {
        // Get first slot info for the message
        const { data: firstSlot } = await supabase.from('calendar_slots').select('slot_date, start_time, end_time').eq('id', successIds[0]).single();
        let batchMessage = `${batchStudentName} booked ${successIds.length} weekly lessons`;
        if (firstSlot) {
          const dayName = new Date(firstSlot.slot_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() + 's';
          batchMessage = `${batchStudentName} booked ${successIds.length} weekly lessons since ${firstSlot.slot_date} ${dayName} ${firstSlot.start_time.slice(0,5)}–${firstSlot.end_time.slice(0,5)}${autoConfirm ? ' (auto-confirmed)' : ' — awaiting confirmation'}`;
        }

        await supabase.from('calendar_notifications').insert({
          teacher_id: teacherId,
          notification_type: autoConfirm ? 'booking_confirmed' : 'booking_pending',
          message: batchMessage,
          student_name: batchStudentName,
          slot_id: successIds[0],
          metadata: { student_email: normalizedEmail, slot_ids: successIds, count: successIds.length, batch: true },
        });

        // Send batch emails
        const { teacherName, teacherEmail: tEmail } = await getTeacherInfo();
        if (settingsData.notify_email_on_booking) {
          await sendEmail('batch_booking_teacher', {
            teacherEmail: tEmail, studentEmail: normalizedEmail,
            studentName: batchStudentName, teacherName, bookUrl, calendarUrl,
          });
          await sendEmail('batch_booking_student', {
            studentEmail: normalizedEmail, studentName: batchStudentName,
            teacherName, teacherEmail: tEmail, bookUrl, calendarUrl,
          });
        }
      }

      // GCal sync for batch booking
      if (successIds.length > 0) {
        const { data: syncCfg } = await supabase.from('calendar_settings')
          .select('gcal_sync_booked, gcal_sync_pending, gcal_integration_enabled')
          .eq('teacher_id', teacherId).maybeSingle();
        if (syncCfg?.gcal_integration_enabled) {
          const shouldSync = autoConfirm
            ? syncCfg.gcal_sync_booked !== false
            : syncCfg.gcal_sync_pending !== false;
          if (shouldSync) {
            for (const sid of successIds) {
              try {
                await fetch(`${supabaseUrl}/functions/v1/gcal-sync`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                  body: JSON.stringify({ teacherId, slotId: sid, action: 'upsert' }),
                });
              } catch (_) {}
            }
          }
        }
        // Student GCal auto-sync
        for (const sid of successIds) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/student-gcal-sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
              body: JSON.stringify({ email: normalizedEmail, teacherId, slotId: sid, action: 'upsert' }),
            });
          } catch (_) {}
        }
      }

      return new Response(JSON.stringify({ success: true, booked: successIds.length, failed: failedIds.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle GET_LOGS
    if (action === 'get_logs' && slotId) {
      const { data: logs } = await supabase
        .from('calendar_slot_logs')
        .select('action, actor, details, created_at')
        .eq('slot_id', slotId)
        .order('created_at', { ascending: false })
        .limit(30);
      return new Response(JSON.stringify({ logs: logs || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle GET_CANCELLED (Problem 9C)
    if (action === 'get_cancelled') {
      const { data: cancelledLogs } = await supabase
        .from('calendar_slot_logs')
        .select('slot_id, action, details, created_at')
        .eq('teacher_id', teacherId)
        .in('action', ['cancelled_by_student', 'cancelled_by_teacher'])
        .order('created_at', { ascending: false })
        .limit(20);

      const matchingLogs = (cancelledLogs || []).filter((l: any) =>
        l.details?.student_email?.toLowerCase() === email.toLowerCase().trim()
      );
      const cancelledSlotIds = [...new Set(matchingLogs.map((l: any) => l.slot_id))];
      let cancelledBookingsData: any[] = [];
      if (cancelledSlotIds.length > 0) {
        const { data: cSlots } = await supabase
          .from('calendar_slots')
          .select('id, slot_date, start_time, end_time, cancelled_at, cancelled_by, cancellation_reason')
          .in('id', cancelledSlotIds);
        cancelledBookingsData = cSlots || [];
      }
      return new Response(JSON.stringify({ cancelledBookings: cancelledBookingsData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: fetch bookings
    const today = new Date().toISOString().split('T')[0];
    let query = supabase
      .from('calendar_slots')
      .select('id, slot_date, start_time, end_time, status, confirmed_at, student_notes, worksheet_id, notes, meeting_link, discount_percent, reschedule_request_from_slot_id, reschedule_request_to_slot_id')
      .eq('teacher_id', teacherId)
      .in('status', ['booked', 'completed', 'needs_review', 'no_show'])
      .order('slot_date')
      .order('start_time');

    // Only filter by date if not showing past
    if (!includePast) {
      query = query.gte('slot_date', today);
    }

    if (student?.id) {
      query = query.eq('student_id', student.id);
    } else {
      query = query.ilike('student_notes', `%${email}%`);
    }

    const { data: bookings, error: bookingsError } = await query;
    if (bookingsError) throw bookingsError;

    const bookingsList = bookings || [];
    const worksheetIds = bookingsList.filter((b: any) => b.worksheet_id).map((b: any) => b.worksheet_id);
    let worksheetMap: Record<string, string> = {};
    if (worksheetIds.length > 0) {
      const { data: worksheets } = await supabase.from('worksheets').select('id, share_token').in('id', worksheetIds);
      if (worksheets) {
        for (const w of worksheets) {
          if (w.share_token) worksheetMap[w.id] = w.share_token;
        }
      }
    }

    // Enrich with reschedule info
    const enrichedBookings = await Promise.all(bookingsList.map(async (b: any) => {
      let reschedule_to = null;
      let reschedule_from = null;
      if (b.reschedule_request_to_slot_id) {
        const { data: outgoing } = await supabase.from('calendar_slots')
          .select('slot_date, start_time, end_time')
          .eq('id', b.reschedule_request_to_slot_id)
          .maybeSingle();
        if (outgoing) reschedule_to = { slot_date: outgoing.slot_date, start_time: outgoing.start_time, end_time: outgoing.end_time };
      }
      if (b.reschedule_request_from_slot_id) {
        const { data: incoming } = await supabase.from('calendar_slots')
          .select('slot_date, start_time, end_time')
          .eq('id', b.reschedule_request_from_slot_id)
          .maybeSingle();
        if (incoming) reschedule_from = { slot_date: incoming.slot_date, start_time: incoming.start_time, end_time: incoming.end_time };
      }
      return {
        ...b,
        share_token: b.worksheet_id ? (worksheetMap[b.worksheet_id] || null) : null,
        reschedule_to,
        reschedule_from,
      };
    }));

    return new Response(JSON.stringify({ bookings: enrichedBookings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in get-student-bookings:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
