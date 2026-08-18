import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logError } from "../_shared/logError.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALERT_EMAILS = ["j4n.brz0@gmail.com", "edooqoo@gmail.com"];
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com';

/**
 * v6.9.94 — failure taxonomy.
 *
 * `INFO_TYPES` are NOT incidents: the worksheet reached the teacher. They are
 * quality/telemetry signals and must never be dressed up as "Generation
 * Failed", otherwise every real outage drowns in noise.
 */
const INFO_TYPES = new Set(['parse_recovered']);
const WARNING_TYPES = new Set([
  'parse_recovered',
  'client_stream_lost_pending_db_reconciliation',
]);

/** Per-instance dedup window: identical (errorType, user) within 10 min → one email. */
const DEDUP_WINDOW_MS = 10 * 60 * 1000;
const recentAlerts = new Map<string, number>();

const shouldSendEmail = (errorType: string, userId: string | null): boolean => {
  const key = `${errorType}|${userId ?? 'anonymous'}`;
  const now = Date.now();
  const last = recentAlerts.get(key);
  // Opportunistic cleanup so the map cannot grow unbounded on a warm instance.
  if (recentAlerts.size > 200) {
    for (const [k, t] of recentAlerts) if (now - t > DEDUP_WINDOW_MS) recentAlerts.delete(k);
  }
  if (last && now - last < DEDUP_WINDOW_MS) return false;
  recentAlerts.set(key, now);
  return true;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      errorMessage, errorType, userId, teacherEmail, promptPreview, model, timestamp,
      clientGenerationId,
    } = await req.json();

    const isInfo = INFO_TYPES.has(errorType);
    const severity: 'warning' | 'error' = WARNING_TYPES.has(errorType) ? 'warning' : 'error';

    // Persist FIRST and ALWAYS — the alert email is best-effort, the audit
    // trail in /admin/error-logs is not.
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const emailAllowed = shouldSendEmail(String(errorType), userId ?? null);
    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      await logError(admin, {
        source_name: 'generateWorksheet',
        component: 'worksheets',
        severity,
        message: errorMessage || 'Unknown generation error',
        error_code: String(errorType || 'unknown'),
        context: {
          model: model || 'unknown',
          promptPreview: typeof promptPreview === 'string' ? promptPreview.slice(0, 300) : null,
          clientGenerationId: clientGenerationId ?? null,
          teacherEmail: teacherEmail ?? null,
          emailSuppressedByDedup: !emailAllowed,
          classification: isInfo ? 'quality_signal' : 'failure',
        },
        user_id: typeof userId === 'string' && UUID_RE.test(userId) ? userId : null,
      });
    } else {
      console.warn('⚠️ Supabase service credentials missing — error_logs row skipped');
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping failure notification');
      return new Response(JSON.stringify({ skipped: true, reason: 'no_resend_key', logged: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!emailAllowed) {
      console.log(`🔁 Duplicate alert suppressed within 10min window: ${errorType}`);
      return new Response(JSON.stringify({ sent: false, deduped: true, logged: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headerColor = isInfo ? '#f59e0b' : '#dc2626';
    const headerTitle = isInfo
      ? 'ℹ️ Worksheet saved with AI repair (quality signal)'
      : '⚠️ Worksheet Generation Failed';
    const emailSubject = isInfo
      ? `ℹ️ Quality signal: ${errorType} — ${teacherEmail || 'anonymous'}`
      : `⚠️ Worksheet generation failed: ${errorType} — ${teacherEmail || 'anonymous'}`;
    const badgeBg = isInfo ? '#fffbeb' : '#fef2f2';
    const badgeColor = isInfo ? '#b45309' : '#dc2626';

    const solutions: Record<string, string> = {
      'quota': 'Gemini API quota exceeded. Check <a href="https://aistudio.google.com/">Google AI Studio</a> billing or switch primary model to OpenAI.',
      'validation': 'Prompt validation failed — likely empty or malformed prompt. Check frontend for race conditions or double-click issues.',
      'timeout': 'Generation timed out. Consider reducing exercise count or simplifying prompt.',
      'parse': 'AI returned invalid JSON. Model may need temperature adjustment or JSON mode enforcement.',
      'parse_recovered': 'Gemini returned malformed JSON, recovered via AI fallback. Worksheet was saved successfully, but prompt or temperature may be drifting. Investigate sample output to prevent quality degradation.',
      'audio': 'OpenAI audio model is unreachable. Verify OPENAI_API_KEY has access to gpt-4o-mini and gpt-4o-mini-tts. Check /v1/audio/speech endpoint status.',
      'network': 'Network error connecting to AI provider. Check API key validity and provider status page.',
      'database': 'Failed to save worksheet to database. Check Supabase connection, RLS policies, and table constraints.',
      'client_stream_lost_no_saved_worksheet': 'Browser SSE stream ended without a terminal event AND no worksheet row matching this attempt was found after 30s of polling. This is a true delivery failure (network, edge cold-restart, or backend abort before DB insert). The user saw an error, tokens were NOT consumed, and the Next Step suggestion was NOT marked as used.',
      'client_stream_lost_pending_db_reconciliation': 'Browser SSE stream ended without a terminal event while DB reconciliation was still pending. The backend may still have saved the worksheet. Usual root cause: a long JSON repair / regeneration pass on the edge function. Check generateWorksheet logs for json_repair_* entries around the timestamp; if a worksheet row exists for this teacher at that time, the user only lost the live stream, not the content.',
      'default': 'Unknown error. Check edge function logs for full stack trace.',
    };

    const solution = solutions[errorType] || solutions['default'];
    const ts = timestamp || new Date().toISOString();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#f9fafb;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px;">
    <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
      <div style="background:#dc2626; padding:16px 24px;">
        <h2 style="color:white; margin:0; font-size:18px;">⚠️ Worksheet Generation Failed</h2>
      </div>
      <div style="padding:24px;">
        <table style="width:100%; border-collapse:collapse; margin:0 0 20px 0;">
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; width:120px; vertical-align:top;">Time</td>
            <td style="padding:10px 12px; color:#111827;">${ts}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; vertical-align:top;">Teacher</td>
            <td style="padding:10px 12px; color:#111827;">${teacherEmail || 'anonymous'}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; vertical-align:top;">User ID</td>
            <td style="padding:10px 12px; color:#111827; font-family:monospace; font-size:13px;">${userId || 'N/A'}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; vertical-align:top;">Model</td>
            <td style="padding:10px 12px; color:#111827;">${model || 'unknown'}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; vertical-align:top;">Error Type</td>
            <td style="padding:10px 12px;">
              <span style="background:#fef2f2; color:#dc2626; padding:4px 10px; border-radius:6px; font-weight:700; font-size:13px;">${errorType}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; vertical-align:top;">Error</td>
            <td style="padding:10px 12px; color:#111827;">${errorMessage || 'No error message'}</td>
          </tr>
        </table>

        <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:14px 16px; margin:0 0 20px 0; border-radius:0 8px 8px 0;">
          <strong style="color:#92400e;">💡 Proposed Solution:</strong><br/>
          <span style="color:#78350f;">${solution}</span>
        </div>

        ${promptPreview ? `
        <div style="margin:0 0 20px 0;">
          <div style="font-weight:600; color:#6b7280; margin-bottom:6px; font-size:13px;">📝 Prompt Preview (first 300 chars):</div>
          <pre style="background:#f5f5f5; padding:12px; font-size:11px; overflow:auto; border-radius:8px; border:1px solid #e5e7eb; white-space:pre-wrap; word-break:break-all; max-height:200px;">${promptPreview.substring(0, 300)}</pre>
        </div>
        ` : ''}

        <div style="text-align:center; margin-top:24px;">
          <a href="https://supabase.com/dashboard/project/bvfrkzdlklyvnhlpleck/functions/generateWorksheet/logs"
             style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px; margin:4px;">
            🔍 Edge Function Logs
          </a>
          <a href="${APP_BASE_URL}/admin/error-logs"
             style="display:inline-block; padding:12px 24px; background:#7c3aed; color:white; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px; margin:4px;">
            🛡️ Admin Error Logs
          </a>
        </div>
      </div>
      <div style="background:#f9fafb; padding:12px 24px; border-top:1px solid #e5e7eb; text-align:center;">
        <span style="color:#9ca3af; font-size:12px;">EDOQOO Automated Alert System</span>
      </div>
    </div>
  </div>
</body>
</html>`;

    console.log(`📧 Sending failure alert email: type=${errorType}, teacher=${teacherEmail || 'anonymous'}`);

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'EDOQOO Alerts <notifications@edooqoo.com>',
        to: ALERT_EMAILS,
        subject: `⚠️ Worksheet generation failed: ${errorType} — ${teacherEmail || 'anonymous'}`,
        html,
      }),
    });

    const emailResult = await emailRes.text();
    console.log(`📧 Resend response: ${emailRes.status}`, emailResult);

    if (!emailRes.ok) {
      console.error('❌ Failed to send alert email:', emailResult);
      return new Response(JSON.stringify({ sent: false, error: emailResult }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ notify-generation-failure error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
