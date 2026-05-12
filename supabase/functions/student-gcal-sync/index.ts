import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getValidStudentToken(supabase: any, email: string, teacherId: string): Promise<{ accessToken: string; settings: any } | null> {
  const { data: tokenData } = await supabase
    .from('student_gcal_tokens')
    .select('*')
    .eq('student_email', email.toLowerCase().trim())
    .eq('teacher_id', teacherId)
    .maybeSingle();

  if (!tokenData) return null;

  const studentSettings = tokenData.settings || { auto_add: true, reminder_minutes: 30 };
  if (!studentSettings.auto_add) return null;

  const expiresAt = new Date(tokenData.token_expires_at);
  if (expiresAt > new Date(Date.now() + 60000)) {
    return { accessToken: tokenData.access_token, settings: studentSettings };
  }

  // Refresh token
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (data.error) {
    console.error('Student token refresh failed:', data);
    return null;
  }

  await supabase.from('student_gcal_tokens').update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', tokenData.id);

  return { accessToken: data.access_token, settings: studentSettings };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, teacherId, slotId, action } = await req.json();

    if (!email || !teacherId || !slotId) {
      return new Response(JSON.stringify({ skipped: true, reason: 'missing params' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const tokenResult = await getValidStudentToken(supabase, email, teacherId);
    if (!tokenResult) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no student gcal token or auto_add disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { accessToken, settings: studentSettings } = tokenResult;

    // Get slot details
    const { data: slot } = await supabase.from('calendar_slots')
      .select('*, students(name)')
      .eq('id', slotId)
      .single();

    if (!slot) {
      return new Response(JSON.stringify({ skipped: true, reason: 'slot not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check sync toggles
    const isPending = slot.status === 'booked' && !slot.confirmed_at;
    if (isPending && studentSettings.sync_pending === false) {
      return new Response(JSON.stringify({ skipped: true, reason: 'pending sync disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isPending && slot.status === 'booked' && studentSettings.sync_booked === false) {
      return new Response(JSON.stringify({ skipped: true, reason: 'booked sync disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const calendarId = 'primary';
    const reminderMinutes = studentSettings.reminder_minutes || 30;

    // Determine effective status
    const effectiveStatus = isPending ? 'pending' : slot.status;

    // Per-status colors
    const statusColorMap: Record<string, string> = {
      booked: studentSettings.color_booked || '3',   // Grape
      pending: studentSettings.color_pending || '5',  // Banana
      completed: studentSettings.color_completed || '10', // Basil
      no_show: studentSettings.color_no_show || '6',  // Tangerine
    };
    const colorId = statusColorMap[effectiveStatus] || studentSettings.color_id || '9';

    // Get teacher name
    const { data: teacher } = await supabase.from('profiles')
      .select('first_name, last_name')
      .eq('id', teacherId)
      .maybeSingle();
    const teacherName = [teacher?.first_name, teacher?.last_name].filter(Boolean).join(' ') || 'Teacher';

    // Build summary with status suffix
    const statusSuffix: Record<string, string> = {
      booked: ' — Booked',
      pending: ' — Pending',
      completed: ' — Completed',
      no_show: ' — No Show',
    };
    let summary = `English Lesson with ${teacherName}`;
    if (slot.cancelled_by) {
      if (slot.cancelled_by === 'system' && slot.cancellation_reason?.includes('Rescheduled')) {
        summary += ' — Rescheduled';
      } else {
        summary += slot.cancelled_by === 'student' ? ' — Student Cancellation' : ' — Teacher Cancellation';
      }
    } else if (statusSuffix[effectiveStatus]) {
      summary += statusSuffix[effectiveStatus];
    }

    const startDateTime = `${slot.slot_date}T${slot.start_time}`;
    const endDateTime = `${slot.slot_date}T${slot.end_time}`;

    // Get timezone from teacher settings
    const { data: calSettings } = await supabase.from('calendar_settings')
      .select('timezone').eq('teacher_id', teacherId).maybeSingle();
    const timezone = calSettings?.timezone || 'Europe/Warsaw';

    const eventBody: any = {
      summary,
      start: { dateTime: startDateTime, timeZone: timezone },
      end: { dateTime: endDateTime, timeZone: timezone },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: reminderMinutes }],
      },
      colorId,
      extendedProperties: {
        private: { edooqoo_slot_id: slotId },
      },
    };

    // Meeting link — from slot or per-student settings
    let meetingLink = slot.meeting_link;
    if (!meetingLink && slot.student_id) {
      const { data: css } = await supabase.from('calendar_student_settings')
        .select('default_meeting_link')
        .eq('student_id', slot.student_id)
        .eq('teacher_id', teacherId)
        .maybeSingle();
      if (css?.default_meeting_link) meetingLink = css.default_meeting_link;
    }

    if (meetingLink) {
      eventBody.description = `Join: ${meetingLink}`;
      eventBody.location = meetingLink;
    }

    if (action === 'delete') {
      // Find and delete the event
      const searchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?privateExtendedProperty=edooqoo_slot_id%3D${slotId}`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const searchData = await searchRes.json();
      if (searchData.items?.length > 0) {
        for (const item of searchData.items) {
          await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${item.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
      }
      return new Response(JSON.stringify({ success: true, action: 'deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert: find existing or create
    const searchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?privateExtendedProperty=edooqoo_slot_id%3D${slotId}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();

    if (searchData.items?.length > 0) {
      // Update existing
      const eventId = searchData.items[0].id;
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody),
      });
      return new Response(JSON.stringify({ success: true, action: 'updated', eventId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Create new
      const createRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody),
      });
      const created = await createRes.json();
      return new Response(JSON.stringify({ success: true, action: 'created', eventId: created.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('Error in student-gcal-sync:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
