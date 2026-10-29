import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { escapeHtml, jsonResponse, resolveCaller, safeUrl, appHosts, teacherIdOf } from '../_shared/auth.ts';
import {
  buildFlashcardEmail,
  buildHubUrl,
  buildSetUrl,
  cleanText,
  normalizeBaseUrl,
  validateRecipientEmail,
} from './emailContent.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEND_LIMIT = 30;
const SEND_WINDOW_SECONDS = 3600;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authorisation: a signed-in (non-anonymous) teacher or the service role.
    // The anon key, a missing token or an anonymous session is rejected.
    const caller = await resolveCaller(req);
    const callerTeacherId = teacherIdOf(caller);
    if (caller.kind !== 'service' && !callerTeacherId) {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }
    if (!body || typeof body !== 'object') {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    const isAllSets = body.isAllSets === true;
    const recipient = validateRecipientEmail(body.recipientEmail);
    if (!recipient) {
      return jsonResponse({ error: 'Invalid recipientEmail' }, 400, corsHeaders);
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('[send-flashcard-email] RESEND_API_KEY not configured');
      return jsonResponse({ error: 'Email service not configured' }, 500, corsHeaders);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const baseUrl = normalizeBaseUrl(Deno.env.get('APP_BASE_URL'));

    let ownerTeacherId: string | null = callerTeacherId;
    let url: string;
    let setTitle = '';
    let auditId = '';

    if (isAllSets) {
      // studentId is optional: the hub link is teacher level, so older clients that
      // do not send it still work. With it the student is verified and named.
      const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
      let hubTeacherId: string | null = callerTeacherId;
      let studentName = '';
      if (studentId) {
        const { data: student, error: studentError } = await admin
          .from('students')
          .select('id, name, teacher_id')
          .eq('id', studentId)
          .is('deleted_at', null)
          .maybeSingle();
        if (studentError) {
          console.error('[send-flashcard-email] student lookup failed', studentError.message);
          return jsonResponse({ error: 'Lookup failed' }, 500, corsHeaders);
        }
        if (!student || (callerTeacherId && student.teacher_id !== callerTeacherId)) {
          return jsonResponse({ error: 'Student not found' }, 404, corsHeaders);
        }
        hubTeacherId = student.teacher_id;
        studentName = cleanText(student.name);
        auditId = `student:${student.id}`;
      } else {
        if (!hubTeacherId) {
          return jsonResponse({ error: 'Missing studentId' }, 400, corsHeaders);
        }
        auditId = `teacher:${hubTeacherId}`;
      }
      ownerTeacherId = hubTeacherId;

      // Same token the teacher UI uses for /my/:token/flashcards.
      const { data: settings } = await admin
        .from('calendar_settings')
        .select('public_calendar_token')
        .eq('teacher_id', hubTeacherId)
        .maybeSingle();
      if (!settings?.public_calendar_token) {
        return jsonResponse({ error: 'Student portal link is not set up' }, 409, corsHeaders);
      }
      url = buildHubUrl(baseUrl, settings.public_calendar_token);
      setTitle = studentName ? `All Flashcard Sets for ${studentName}` : 'All Flashcard Sets';
    } else {
      const shareToken = typeof body.shareToken === 'string' ? body.shareToken.trim() : '';
      if (!shareToken || shareToken.length > 200) {
        return jsonResponse({ error: 'Missing shareToken' }, 400, corsHeaders);
      }
      let query = admin
        .from('flashcard_sets')
        .select('id, title, teacher_id')
        .eq('share_token', shareToken)
        .is('deleted_at', null);
      if (callerTeacherId) query = query.eq('teacher_id', callerTeacherId);
      const { data: set, error: setError } = await query.limit(1).maybeSingle();
      if (setError) {
        console.error('[send-flashcard-email] set lookup failed', setError.message);
        return jsonResponse({ error: 'Lookup failed' }, 500, corsHeaders);
      }
      if (!set) {
        return jsonResponse({ error: 'Flashcard set not found' }, 404, corsHeaders);
      }
      ownerTeacherId = set.teacher_id;
      url = buildSetUrl(baseUrl, shareToken);
      setTitle = cleanText(set.title);
      auditId = `set:${set.id}`;
    }

    // Defence in depth: the link must point at one of our own hosts.
    if (!safeUrl(url, appHosts())) {
      console.error('[send-flashcard-email] APP_BASE_URL host is not an allowed app host');
      return jsonResponse({ error: 'Server misconfigured' }, 500, corsHeaders);
    }

    // Teacher display name from the profile, falling back to the (capped) body value.
    let teacherName = '';
    if (ownerTeacherId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', ownerTeacherId)
        .maybeSingle();
      teacherName = cleanText(`${profile?.first_name || ''} ${profile?.last_name || ''}`);
    }
    if (!teacherName) teacherName = cleanText(body.teacherName);

    // Per-teacher throttle via the existing generic consume_newsletter_rate_limit RPC.
    if (ownerTeacherId && caller.kind !== 'service') {
      const { data: allowed, error: rateError } = await admin.rpc('consume_newsletter_rate_limit', {
        p_key_hash: await sha256Hex(`flashcard-email:teacher:${ownerTeacherId}`),
        p_action: 'flashcard_email_teacher',
        p_limit: SEND_LIMIT,
        p_window_seconds: SEND_WINDOW_SECONDS,
      });
      if (rateError) {
        console.error('[send-flashcard-email] rate limit check failed', rateError.message);
      } else if (allowed !== true) {
        return jsonResponse({ error: 'Too many emails sent. Please try again later.' }, 429, corsHeaders);
      }
    }

    const { subject, html } = buildFlashcardEmail({ isAllSets, teacherName, setTitle, url }, escapeHtml);

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Worksheet Generator <noreply@edooqoo.com>',
        to: [recipient],
        subject,
        html,
      }),
    });
    const emailData = await emailResponse.json().catch(() => ({}));

    if (!emailResponse.ok) {
      console.error('[send-flashcard-email] Resend error', auditId, emailResponse.status, emailData?.message);
      return jsonResponse({ error: 'Failed to send email' }, 502, corsHeaders);
    }

    return jsonResponse({ success: true, emailId: emailData.id }, 200, corsHeaders);
  } catch (error) {
    console.error('[send-flashcard-email] Unexpected error', error instanceof Error ? error.message : 'unknown');
    return jsonResponse({ error: 'Unexpected error' }, 500, corsHeaders);
  }
});
