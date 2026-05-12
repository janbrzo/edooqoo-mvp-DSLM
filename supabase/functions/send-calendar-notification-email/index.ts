import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, teacherId, studentEmail, studentName, slotDate, slotTime, endTime, teacherEmail, teacherName, oldSlotDate, oldSlotTime, calendarUrl, bookUrl, worksheetUrl, sharedWorksheetUrl, meetingLink, timezone, rejectionReason, confirmationComment } = await req.json();

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.log('RESEND_API_KEY not configured, skipping email');
      return new Response(JSON.stringify({ skipped: true, reason: 'No RESEND_API_KEY' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let to: string;
    let subject: string;
    let html: string;

    const lessonInfo = `${slotDate} at ${slotTime}`;
    
    const isStudentEmail = ['booking_confirmation', 'booking_pending', 'booking_rejected', 'cancellation_student', 'cancellation_confirmed_by_student', 'reschedule_confirmation', 'reschedule_pending', 'reschedule_rejected', 'lesson_reminder', 'lesson_time_changed', 'new_booking_student'].includes(type);
    const fromName = isStudentEmail
      ? `${teacherName || 'Your Teacher'} via EDOQOO`
      : 'EDOQOO';
    
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
      ? `<div style="margin-top: 12px;"><a href="${generateGcalLink('English Lesson' + (teacherName ? ' with ' + teacherName : ''), slotDate, slotTime, endTime || slotTime, timezone || 'Europe/Warsaw')}" target="_blank" style="display: inline-block; padding: 8px 20px; background: #4285f4; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">📅 Add to Google Calendar</a></div>`
      : '';

    switch (type) {
      case 'booking_confirmation':
        to = studentEmail;
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
        to = studentEmail;
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
        to = studentEmail;
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
        to = teacherEmail;
        subject = `New booking: ${studentName} — ${lessonInfo}`;
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
        to = teacherEmail;
        subject = `Lesson cancelled: ${studentName} — ${lessonInfo}`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Lesson Cancelled ❌</h2>
            <p>${studentName} (${studentEmail}) has cancelled their lesson on ${lessonInfo}.</p>
            <p>The time slot is now available again.</p>
            ${teacherButton}
          </div>`;
        break;

      case 'cancellation_student':
        to = studentEmail;
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
        to = studentEmail;
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
        to = studentEmail;
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
        to = studentEmail;
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
        to = studentEmail;
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
        to = teacherEmail;
        subject = `Reschedule request: ${studentName}`;
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
        to = studentEmail;
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
        to = studentEmail;
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
        to = teacherEmail;
        subject = `${studentName} booked multiple lessons`;
        html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Weekly Booking 📅</h2>
            <p>${studentName} (${studentEmail}) has booked multiple lessons.</p>
            <p>Check your calendar for details.</p>
            ${teacherButton}
          </div>`;
        break;

      case 'batch_booking_student':
        to = studentEmail;
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
        to = studentEmail;
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

    const emailPayload: any = {
      from: `${fromName} <notifications@edooqoo.com>`,
      to: [to],
      subject,
      html,
    };

    if (isStudentEmail && teacherEmail) {
      emailPayload.reply_to = teacherEmail;
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
