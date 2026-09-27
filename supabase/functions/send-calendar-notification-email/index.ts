import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { appHosts, escapeHtml, jsonResponse, resolveCaller, safeUrl, teacherIdOf } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate "Add to Google Calendar" link
const generateGcalLink = (title: string, slotDate: string, startTime: string, endTime: string, timezone: string) => {
  const start = `${slotDate.replace(/-/g, '')}T${(startTime || '').replace(':', '')}00`;
  const end = `${slotDate.replace(/-/g, '')}T${(endTime || startTime || '').replace(':', '')}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    ctz: timezone || 'Europe/Warsaw',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/** Slot plus its booker: an existing student row, else the "Booked by: Name (email)" note. */
// deno-lint-ignore no-explicit-any
async function loadSlotContext(admin: any, slotId: string) {
  const { data: slot } = await admin.from('calendar_slots')
    .select('id, teacher_id, student_id, booked_by, booked_at, slot_date, start_time, end_time, meeting_link, worksheet_id, student_notes')
    .eq('id', slotId).maybeSingle();
  if (!slot) return null;
  let bookerEmail = '';
  let bookerName = '';
  let studentMeetingLink: string | null = null;
  let studentGeneratedLink: string | null = null;
  if (slot.student_id) {
    const { data: st } = await admin.from('students').select('name, student_email').eq('id', slot.student_id).maybeSingle();
    bookerEmail = (st?.student_email || '').trim().toLowerCase();
    bookerName = st?.name || '';
    const { data: css } = await admin.from('calendar_student_settings')
      .select('default_meeting_link, generated_meeting_link')
      .eq('teacher_id', slot.teacher_id).eq('student_id', slot.student_id).maybeSingle();
    studentMeetingLink = css?.default_meeting_link ?? null;
    studentGeneratedLink = css?.generated_meeting_link ?? null;
  }
  if (!bookerEmail) {
    const notes: string = slot.student_notes || '';
    bookerEmail = (notes.match(/\(([^)]+@[^)]+)\)/)?.[1] || '').trim().toLowerCase();
    bookerName = bookerName || notes.match(/^Booked by: (.*?) \(/)?.[1] || '';
  }
  return { slot, bookerEmail, bookerName, studentMeetingLink, studentGeneratedLink };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const type: string = body.type;
    let { studentEmail, studentName, slotDate, slotTime, endTime, teacherEmail, teacherName, oldSlotDate, oldSlotTime, calendarUrl, bookUrl, worksheetUrl, sharedWorksheetUrl, meetingLink, timezone, rejectionReason, confirmationComment } = body;

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.log('RESEND_API_KEY not configured, skipping email');
      return new Response(JSON.stringify({ skipped: true, reason: 'No RESEND_API_KEY' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Caller authorisation ────────────────────────────────────────────────
    // Recipients, names and links must not be attacker-controlled: this
    // function sends from notifications@edooqoo.com. Service-role callers
    // (other edge functions) are trusted; a signed-in teacher may only email
    // themselves or their own students; the public booking page may only send
    // the booking emails of a slot that was just booked through it, with every
    // value re-derived from the database.
    const caller = await resolveCaller(req);
    const normEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
    const TEACHER_FACING = new Set(['new_booking_teacher', 'cancellation_teacher', 'reschedule_request_teacher', 'batch_booking_teacher']);
    const PUBLIC_TYPES = new Set(['booking_confirmation', 'booking_pending', 'new_booking_teacher']);
    const appBase = (Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com').replace(/\/+$/, '');

    if (caller.kind !== 'service') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      let teacherId = teacherIdOf(caller);
      const slotCtx = typeof body.slotId === 'string' ? await loadSlotContext(admin, body.slotId) : null;

      if (teacherId) {
        if (body.teacherId && body.teacherId !== teacherId) {
          return jsonResponse({ error: 'Forbidden' }, 403, corsHeaders);
        }
        if (typeof body.slotId === 'string' && slotCtx?.slot.teacher_id !== teacherId) {
          return jsonResponse({ error: 'Forbidden' }, 403, corsHeaders);
        }
        // Callers that only pass a slot (recurring confirm / reject) get the
        // booker and lesson time from it.
        if (slotCtx) {
          if (!normEmail(studentEmail)) studentEmail = slotCtx.bookerEmail;
          if (!studentName) studentName = slotCtx.bookerName;
          if (!slotDate) slotDate = slotCtx.slot.slot_date;
          if (!slotTime) slotTime = String(slotCtx.slot.start_time).slice(0, 5);
          if (!endTime) endTime = String(slotCtx.slot.end_time).slice(0, 5);
        }
        if (!TEACHER_FACING.has(type)) {
          const recipient = normEmail(studentEmail);
          let allowed = !!recipient && slotCtx?.bookerEmail === recipient;
          if (!allowed && recipient) {
            const { data: ownStudent } = await admin.from('students')
              .select('id').eq('teacher_id', teacherId).is('deleted_at', null)
              .ilike('student_email', recipient.replace(/[%_\\]/g, '\\$&'))
              .limit(1).maybeSingle();
            allowed = !!ownStudent;
          }
          if (!allowed) {
            return jsonResponse({ error: 'Recipient is not one of your students' }, 403, corsHeaders);
          }
        }
      } else {
        // Public booking page (no teacher session): only the booking emails of
        // a slot this booker just booked, with every value from the database.
        const bookedRecently = slotCtx?.slot.booked_at
          && Date.now() - new Date(slotCtx.slot.booked_at).getTime() < 30 * 60 * 1000;
        if (!PUBLIC_TYPES.has(type) || !slotCtx || slotCtx.slot.booked_by !== 'student' || !bookedRecently
          || !slotCtx.bookerEmail || slotCtx.bookerEmail !== normEmail(studentEmail)) {
          return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
        }
        const { slot } = slotCtx;
        const { data: settings } = await admin.from('calendar_settings')
          .select('public_calendar_enabled, public_calendar_token, hub_token, default_meeting_link, timezone')
          .eq('teacher_id', slot.teacher_id).maybeSingle();
        if (!settings?.public_calendar_enabled || (body.publicToken && body.publicToken !== settings.public_calendar_token)) {
          return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
        }

        teacherId = slot.teacher_id;
        studentEmail = slotCtx.bookerEmail;
        studentName = slotCtx.bookerName || studentName;
        slotDate = slot.slot_date;
        slotTime = String(slot.start_time).slice(0, 5);
        endTime = String(slot.end_time).slice(0, 5);
        timezone = settings.timezone || timezone;
        bookUrl = `${appBase}/my/${settings.hub_token || settings.public_calendar_token}/lessons`;
        calendarUrl = `${appBase}/calendar`;
        worksheetUrl = slot.worksheet_id ? `${appBase}/worksheet/${slot.worksheet_id}` : undefined;
        sharedWorksheetUrl = undefined;
        if (slot.worksheet_id) {
          const { data: ws } = await admin.from('worksheets').select('share_token').eq('id', slot.worksheet_id).maybeSingle();
          if (ws?.share_token) sharedWorksheetUrl = `${appBase}/shared/${ws.share_token}`;
        }
        // Meeting link only if it is one the teacher configured.
        const knownLinks = [slotCtx.studentMeetingLink, slotCtx.studentGeneratedLink, slot.meeting_link, settings.default_meeting_link]
          .filter((l): l is string => typeof l === 'string' && l.length > 0);
        meetingLink = knownLinks.includes(meetingLink) ? meetingLink : knownLinks[0];
        oldSlotDate = undefined;
        oldSlotTime = undefined;
        rejectionReason = undefined;
        confirmationComment = undefined;
      }

      // Teacher identity always comes from the database.
      const { data: profile } = await admin.from('profiles')
        .select('email, first_name, last_name').eq('id', teacherId!).maybeSingle();
      const profileName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
      teacherEmail = normEmail(profile?.email) || (caller.kind === 'user' ? normEmail(caller.user.email) : '');
      if (profileName) teacherName = profileName;
    }

    // ── Sanitise everything that reaches the HTML ───────────────────────────
    const recipientStudentEmail = normEmail(studentEmail);
    const recipientTeacherEmail = normEmail(teacherEmail);
    const plainStudentName = String(studentName ?? '').replace(/[\r\n]+/g, ' ').slice(0, 120);
    const plainTeacherName = String(teacherName ?? '').replace(/[\r\n]+/g, ' ').slice(0, 120);
    const hosts = appHosts();
    calendarUrl = escapeHtml(safeUrl(calendarUrl, hosts));
    bookUrl = escapeHtml(safeUrl(bookUrl, hosts));
    worksheetUrl = escapeHtml(safeUrl(worksheetUrl, hosts));
    sharedWorksheetUrl = escapeHtml(safeUrl(sharedWorksheetUrl, hosts));
    // Teachers use their own Zoom/Meet/Teams links, so any https URL is allowed;
    // public calls were already limited to links configured in the database.
    meetingLink = escapeHtml(safeUrl(meetingLink));
    studentName = escapeHtml(plainStudentName);
    teacherName = escapeHtml(plainTeacherName);
    studentEmail = escapeHtml(recipientStudentEmail);
    teacherEmail = escapeHtml(recipientTeacherEmail);
    slotDate = escapeHtml(slotDate);
    slotTime = escapeHtml(slotTime);
    endTime = escapeHtml(endTime);
    oldSlotDate = escapeHtml(oldSlotDate);
    oldSlotTime = escapeHtml(oldSlotTime);
    rejectionReason = escapeHtml(rejectionReason);
    confirmationComment = escapeHtml(confirmationComment);

    let to: string;
    let subject: string;
    let html: string;

    const lessonInfo = `${slotDate} at ${slotTime}`;
    
    const isStudentEmail = ['booking_confirmation', 'booking_pending', 'booking_rejected', 'cancellation_student', 'cancellation_confirmed_by_student', 'reschedule_confirmation', 'reschedule_pending', 'reschedule_rejected', 'lesson_reminder', 'lesson_time_changed', 'new_booking_student'].includes(type);
    const fromName = isStudentEmail
      ? `${plainTeacherName.replace(/[<>"]/g, '') || 'Your Teacher'} via Edooqoo`
      : 'Edooqoo';
    
    const teacherButton = calendarUrl 
      ? `<div style="margin-top: 20px;"><a href="${calendarUrl}" style="display: inline-block; padding: 10px 24px; background: #2563eb; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">Open Calendar</a></div>` 
      : '';
    const studentButton = bookUrl 
      ? `<div style="margin-top: 20px;"><a href="${bookUrl}" style="display: inline-block; padding: 10px 24px; background: #2563eb; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">View Bookings</a></div>` 
      : '';
    
    const teacherWorksheetButton = worksheetUrl
      ? `<div style="margin-top: 12px;"><a href="${worksheetUrl}" style="display: inline-block; padding: 8px 20px; background: #16a34a; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">Open Worksheet</a></div>`
      : '';
    const studentWorksheetButton = sharedWorksheetUrl
      ? `<div style="margin-top: 12px;"><a href="${sharedWorksheetUrl}" style="display: inline-block; padding: 8px 20px; background: #16a34a; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">Open Worksheet</a></div>`
      : '';

    const meetingButton = meetingLink
      ? `<div style="margin-top: 12px;"><a href="${meetingLink}" style="display: inline-block; padding: 8px 20px; background: #7c3aed; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">Join Meeting</a></div>`
      : '';

    // "Add to Google Calendar" button for student emails with lesson info
    const addToCalendarBtn = (isStudentEmail && slotDate && slotTime)
      ? `<div style="margin-top: 12px;"><a href="${generateGcalLink('English Lesson' + (plainTeacherName ? ' with ' + plainTeacherName : ''), slotDate, slotTime, endTime || slotTime, timezone || 'Europe/Warsaw')}" target="_blank" style="display: inline-block; padding: 8px 20px; background: #4285f4; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">📅 Add to Google Calendar</a></div>`
      : '';

    switch (type) {
      case 'booking_confirmation':
        to = recipientStudentEmail;
        subject = 'Your lesson is confirmed!';
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Lesson Confirmed ✓</h2>
            <p>Hi ${studentName},</p>
            <p>Your English lesson has been confirmed:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${slotDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${slotTime}</p>
            </div>
            ${confirmationComment ? `<div style="background: #f0fdf4; padding: 12px; border-radius: 8px; margin: 12px 0; border-left: 3px solid #22c55e;"><p style="margin: 0; font-weight: 500;">Teacher's note:</p><p style="margin: 4px 0 0;">${confirmationComment}</p></div>` : ''}
            <p>See you there!</p>
            ${meetingButton}
            ${studentWorksheetButton}
            ${addToCalendarBtn}
            ${studentButton}
          </div>`;
        break;

      case 'booking_pending':
        to = recipientStudentEmail;
        subject = 'Booking request sent';
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Booking Request Sent ⏳</h2>
            <p>Hi ${studentName},</p>
            <p>Your booking request for ${lessonInfo} has been sent to the teacher.</p>
            <p>You will receive a confirmation once the teacher approves your booking.</p>
            ${meetingButton}
            ${studentButton}
          </div>`;
        break;

      case 'booking_rejected':
        to = recipientStudentEmail;
        subject = 'Booking request declined';
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Booking Declined ❌</h2>
            <p>Hi ${studentName},</p>
            <p>Unfortunately, your booking request for ${lessonInfo} was not approved.</p>
            ${rejectionReason ? `<div style="background: #fef2f2; padding: 12px; border-radius: 8px; margin: 12px 0; border-left: 3px solid #ef4444;"><p style="margin: 0; font-weight: 500;">Teacher's note:</p><p style="margin: 4px 0 0;">${rejectionReason}</p></div>` : ''}
            <p>Please check the booking page for other available times.</p>
            ${studentButton}
          </div>`;
        break;

      case 'new_booking_teacher':
        to = recipientTeacherEmail;
        subject = `New booking: ${plainStudentName} — ${lessonInfo}`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">New Booking 📅</h2>
            <p>A student has booked a lesson:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Student:</strong> ${studentName} (${studentEmail})</p>
              <p style="margin: 4px 0;"><strong>Date:</strong> ${slotDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${slotTime}</p>
            </div>
            ${teacherWorksheetButton}
            ${teacherButton}
          </div>`;
        break;

      case 'cancellation_teacher':
        to = recipientTeacherEmail;
        subject = `Lesson cancelled: ${plainStudentName} — ${lessonInfo}`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Lesson Cancelled ❌</h2>
            <p>${studentName} (${studentEmail}) has cancelled their lesson on ${lessonInfo}.</p>
            <p>The time slot is now available again.</p>
            ${teacherButton}
          </div>`;
        break;

      case 'cancellation_student':
        to = recipientStudentEmail;
        subject = `Lesson cancelled: ${lessonInfo}`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Lesson Cancelled ❌</h2>
            <p>Hi ${studentName},</p>
            <p>Your lesson on ${lessonInfo} has been cancelled by the teacher.</p>
            <p>Please check the booking page for available alternative times.</p>
            ${studentButton}
          </div>`;
        break;

      case 'cancellation_confirmed_by_student':
        to = recipientStudentEmail;
        subject = `Cancellation confirmed: ${lessonInfo}`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Cancellation Confirmed ✓</h2>
            <p>Hi ${studentName},</p>
            <p>Your lesson on ${lessonInfo} has been successfully cancelled.</p>
            <p>If you'd like to book a new time, visit the booking page.</p>
            ${studentButton}
          </div>`;
        break;

      case 'reschedule_confirmation':
        to = recipientStudentEmail;
        subject = `Lesson rescheduled to ${lessonInfo}`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Lesson Rescheduled ✓</h2>
            <p>Hi ${studentName},</p>
            <p>Your lesson has been rescheduled:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              ${oldSlotDate ? `<p style="margin: 4px 0;"><strong>From:</strong> ${oldSlotDate} at ${oldSlotTime || 'N/A'}</p>` : ''}
              <p style="margin: 4px 0;"><strong>New date:</strong> ${slotDate}</p>
              <p style="margin: 4px 0;"><strong>New time:</strong> ${slotTime}</p>
            </div>
            <p>See you there!</p>
            ${meetingButton}
            ${studentWorksheetButton}
            ${addToCalendarBtn}
            ${studentButton}
          </div>`;
        break;

      case 'reschedule_pending':
        to = recipientStudentEmail;
        subject = 'Reschedule request received';
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Reschedule Request Sent ⏳</h2>
            <p>Hi ${studentName},</p>
            <p>Your reschedule request to ${lessonInfo} has been sent to the teacher.</p>
            <p>You will receive a confirmation once approved.</p>
            ${studentButton}
          </div>`;
        break;

      case 'reschedule_rejected':
        to = recipientStudentEmail;
        subject = 'Reschedule request declined';
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Reschedule Declined ❌</h2>
            <p>Hi ${studentName},</p>
            <p>Your reschedule request to ${lessonInfo} was not approved.</p>
            <p>Your original lesson remains unchanged. Please contact your teacher if you need to discuss.</p>
            ${studentButton}
          </div>`;
        break;

      case 'reschedule_request_teacher':
        to = recipientTeacherEmail;
        subject = `Reschedule request: ${plainStudentName}`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Reschedule Request 🔄</h2>
            <p>${studentName} (${studentEmail}) requests to reschedule:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>From:</strong> ${oldSlotDate || 'N/A'} at ${oldSlotTime || 'N/A'}</p>
              <p style="margin: 4px 0;"><strong>To:</strong> ${slotDate} at ${slotTime}</p>
            </div>
            <p>Check your calendar to confirm or reject.</p>
            ${teacherButton}
          </div>`;
        break;

      case 'lesson_reminder':
        to = recipientStudentEmail;
        subject = `Reminder: Lesson tomorrow at ${slotTime}`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Lesson Reminder 🔔</h2>
            <p>Hi ${studentName},</p>
            <p>This is a reminder that you have a lesson scheduled:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${slotDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${slotTime}</p>
            </div>
            <p>See you soon!</p>
            ${meetingButton}
            ${studentWorksheetButton}
            ${addToCalendarBtn}
            ${studentButton}
          </div>`;
        break;

      case 'lesson_time_changed':
        to = recipientStudentEmail;
        subject = `Lesson time changed: ${lessonInfo}`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Lesson Time Changed 🔄</h2>
            <p>Hi ${studentName},</p>
            <p>Your teacher has changed the time of your lesson:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              ${oldSlotDate ? `<p style="margin: 4px 0;"><strong>Previous:</strong> ${oldSlotDate} at ${oldSlotTime || 'N/A'}</p>` : ''}
              <p style="margin: 4px 0;"><strong>New date:</strong> ${slotDate}</p>
              <p style="margin: 4px 0;"><strong>New time:</strong> ${slotTime}</p>
            </div>
            <p>If you have any questions, please contact your teacher.</p>
            ${meetingButton}
            ${studentWorksheetButton}
            ${addToCalendarBtn}
            ${studentButton}
          </div>`;
        break;

      case 'batch_booking_teacher':
        to = recipientTeacherEmail;
        subject = `${plainStudentName} booked multiple lessons`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Weekly Booking 📅</h2>
            <p>${studentName} (${studentEmail}) has booked multiple lessons.</p>
            <p>Check your calendar for details.</p>
            ${teacherButton}
          </div>`;
        break;

      case 'batch_booking_student':
        to = recipientStudentEmail;
        subject = 'Your weekly lessons have been submitted';
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Weekly Lessons Submitted ⏳</h2>
            <p>Hi ${studentName},</p>
            <p>Your weekly lesson bookings have been submitted to the teacher.</p>
            <p>You will receive confirmations as the teacher approves each one.</p>
            ${studentButton}
          </div>`;
        break;

      case 'new_booking_student':
        to = recipientStudentEmail;
        subject = `New lesson scheduled: ${lessonInfo}`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">New Lesson Scheduled 📅</h2>
            <p>Hi ${studentName},</p>
            <p>Your teacher has scheduled a new lesson for you:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${slotDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${slotTime}</p>
            </div>
            ${meetingButton}
            ${studentWorksheetButton}
            ${addToCalendarBtn}
            ${studentButton}
          </div>`;
        break;

      default:
        return new Response(JSON.stringify({ error: 'Unknown notification type' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (!to) {
      return jsonResponse({ error: 'No recipient' }, 400, corsHeaders);
    }

    const emailPayload: any = {
      from: `${fromName} <notifications@edooqoo.com>`,
      to: [to],
      subject,
      html,
    };

    if (isStudentEmail && recipientTeacherEmail) {
      emailPayload.reply_to = recipientTeacherEmail;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload),
    });

    const result = await res.json();
    console.log('Email sent:', type, to, result);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error sending calendar email:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
